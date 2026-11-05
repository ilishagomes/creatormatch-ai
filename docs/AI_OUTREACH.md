# AI outreach generator: how it works

Code:
- Server: `server/src/services/outreach.ts` (prompt, Claude call, validation, retry), `server/src/services/ai.ts` (SDK client, error mapping), `server/src/routes/outreach.ts`, `server/src/routes/drafts.ts`
- Client: `client/src/pages/OutreachStudioPage.tsx` (the AI Outreach Studio), `client/src/pages/DraftsPage.tsx`

## 1. Setting up the API key

The key is read **only by the backend**, from the `.env` file in the project root:

1. Create a key at <https://console.anthropic.com> (Settings → API keys). It starts with `sk-ant-`.
2. In the project root, create `.env` if it doesn't exist:
   ```bash
   cp .env.example .env
   ```
3. Open `.env` and paste your key:
   ```
   ANTHROPIC_API_KEY=sk-ant-...your key...
   ANTHROPIC_MODEL=claude-opus-5-5
   ```
4. Restart the app (`npm run dev`). The header pill changes from **AI not configured** to **AI ready**.
5. Check it with one real call:
   ```bash
   npm run ai:check
   ```

`.env` is git-ignored, so the key can't be committed. If the key or model is wrong, the app shows a specific message ("rejected the API key" or "model was not found") instead of a generic error.

## 2. How the frontend calls the backend

```
OutreachStudioPage ──fetch POST /api/outreach/generate { campaignId, creatorId }──▶ Express (localhost:3001, via the Vite proxy)
```

- The browser only sends **two IDs**. It never sees the API key and never talks to Anthropic.
- Generation starts only when the user clicks **Generate with Claude**, so opening or refreshing the page never costs money. While waiting, the studio shows a loading skeleton with elapsed seconds.
- A request already in flight blocks a second one, so double-clicks can't send duplicates.
- On error, the server returns `{ error, details, code, retryable }`. The studio shows the message, a hint for that `code`, and **Try again (n left)** when `retryable` is true. Each visit allows **3** attempts. **Write it myself** is always available. Regenerating over edited text asks for confirmation first.

## 3. How the backend calls Claude

`POST /api/outreach/generate`:

1. **Validates** the IDs with zod and loads the campaign and creator from SQLite (404 if missing).
2. **Rate-limits:** at most 10 AI requests per minute per client, to protect your API bill. Over the limit you get a 429 with `Retry-After`.
3. **Builds the prompt** (`buildUserPrompt`):
   - **Campaign:** brand name, product, product/campaign description, campaign goal, industry, target audience, age range, platforms, and "the brand has a budget for a paid partnership — do not state an amount".
   - **Verified creator profile:** name, handle, platform, content niche, content topics, and the sourced description (left out if `null`).
   - **Topics the creator shares with the brief**, from the matching algorithm.
   - **Never sent:** internal notes, owned brands, audience figures, the exact budget.
4. **Calls Claude** with the official SDK (`client.beta.messages.create`):
   - `model` comes from `ANTHROPIC_MODEL` (default `claude-opus-5-5`).
   - **Structured outputs:** `output_config.format` is a JSON Schema generated from our zod schema with the SDK helper `betaZodOutputFormat`, so the API constrains the reply to `{ subject, body, personalizationNote }`.
   - `effort: "low"`: a short email doesn't need deep reasoning, so this is faster and cheaper.
   - `fallbacks: "default"`: if a safety filter wrongly declines, Anthropic retries on a fallback model.
   - The SDK itself retries network errors, 429s and 5xx once (`maxRetries: 1`), with a 90-second timeout.

## 4. How the response is validated

Each reply goes through three checks in order (`parseAiResponse`):

| Check | Fails when | Error `code` |
|---|---|---|
| Stop reason | Claude declined (`refusal`) or ran out of space (`max_tokens`) | `refusal` / `truncated` |
| `JSON.parse` | The text isn't JSON | `invalid_json` |
| **zod schema** (`aiOutreachSchema`) | A field is missing, empty, too short or too long | `schema` |
| **Guardrails** (`checkGuardrails`) | Any email address, phone number, URL, follower/subscriber/engagement figure, payment amount (£/$/€ or "500 dollars"), claim of prior contact ("following up", "as we discussed"), or claimed previous partnership | `guardrail` |

**Automatic retry:** if a check fails (except refusal), the server asks Claude **once more**, so at most 2 calls per click. If both fail, the user sees what went wrong, e.g. *"The AI draft included unverified information, so it was discarded. (2 attempts) — States a payment amount, which was not provided"*, and can try again or write it themselves.

The same zod schema defines what the API must return *and* what our code accepts, so the two can't drift apart.

## 5. How the email draft is saved

1. A generated email is **never saved automatically**. It appears in an editor labelled **"AI-generated draft — requires human review before use"**, with the model name.
2. The user edits the subject and body. The **Copy** button stays disabled until they tick *"I've reviewed this email for accuracy."* Editing after ticking clears the tick.
3. **Save draft** → `POST /api/drafts` → zod validation → `INSERT INTO outreach_drafts` with `ai_generated = 1`, `ai_model` (which model wrote it), `reviewed`, and timestamps.
4. The Drafts page lists drafts with **Reviewed / Needs review** and **AI draft · model** labels. `PUT /api/drafts/:id` saves edits or the review flag, and `DELETE` removes a draft.
5. **Nothing is ever emailed.** The app has no email-sending code at all; the user copies the text into their own email client.

## 6. How unverified information is kept from being presented as fact

| Layer | What it does |
|---|---|
| **Data** | Creator records only hold sourced facts; unknowns are `null`. Audience figures need a source and a date. |
| **Input minimisation** | Claude only receives verified profile fields. It never sees owned brands, internal notes, audience numbers or the budget, so it can't repeat them. |
| **Instructions** | The system prompt forbids invented contacts, statistics, partnerships, prior contact, payment terms and dates. |
| **Structure** | Structured outputs plus zod mean the app only ever handles a well-formed `{subject, body, personalizationNote}`. |
| **Code guardrails** | Pattern checks reject drafts that break those rules, even if the model ignored the prompt. Rejected drafts are never shown. |
| **Transparency** | The `personalizationNote` says which verified facts were used, and every draft is labelled as AI-generated with the model name. |
| **Human in the loop** | Copy is locked until a person confirms they've reviewed the email, and nothing is sent automatically. |

The guardrails are pattern-based, so they can't catch everything (for example a subtle wrong claim with no number in it). That's why human review is required, not optional.

## 7. Tests

| Command | Calls the real API? | What it covers |
|---|---|---|
| `npm test` | **No** (mocked SDK) | Zod validation, every guardrail, prompt contents, retry rules (malformed → retry → success; give up after 2; refusals not retried), SDK error mapping, rate limit, `requiresHumanReview`, draft provenance |
| `npm run test:live` | **Yes** (3 small requests) | Real drafts for two real creators pass the same zod schema and guardrails, mention the brand and use the placeholders; a real match explanation passes the number check. Skipped automatically when no key is set. |
| `npm run ai:check` | **Yes** (1 request) | Prints one real draft so you can read it |
