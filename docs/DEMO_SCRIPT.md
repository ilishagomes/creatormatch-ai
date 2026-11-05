# 2-minute demo script

**Before recording**
1. Stop the app, run `npm run db:reset` for a clean database, then `npm run dev`.
2. `npm run ai:check`: confirm Claude responds and the header pill says **AI ready**.
3. Open the profile links of the creators you'll show and confirm they load.
4. Browser at ~1280px wide, zoom 100%, bookmarks bar hidden.

| Time | Screen | What to say |
|---|---|---|
| 0:00–0:15 | **Dashboard** | "CreatorMatch AI helps a brand find real creators who fit a campaign and draft outreach. Every number here comes from the database: 30 researched creators, my campaigns and drafts." |
| 0:15–0:35 | **New campaign** → click **Find creators** empty, then **Fill with example** → **Find creators** | "The brief is validated in the browser and again on the server with zod. Here's a fragrance-free serum launch for sensitive skin." |
| 0:35–1:00 | **Discovery** | "*How we read your brief* shows the weighted topics. Creators are ranked by a deterministic score: niche 40, keywords 25, platform 20, verified audience 15. There's no audience data, so that part is excluded, not guessed; that's the 85% coverage." Change the platform filter, then tick **Hide conflicts**. |
| 1:00–1:20 | **View profile** on a top creator | "Here's the full calculation, with clickable verified sources and a limitations panel. Conflict flags, like a creator owning a competing brand, are shown separately rather than hidden in the score." |
| 1:20–1:50 | **Generate outreach** → **Generate with Claude** | "Claude writes from verified facts only. The reply is schema-validated with zod and checked for invented contacts, statistics or payment terms. It's labelled as an AI draft, and Copy stays locked until I review it." Edit a line, tick review, **Copy**, **Save draft**. |
| 1:50–2:00 | **Outreach** drafts, then terminal `npm test` | "Drafts are saved in SQLite with the model that wrote them. 136 automated tests run offline with a mocked Claude; a separate live test uses the real API." |

**Questions you might get**
- *Why not let the AI do the matching?* Deterministic scoring is explainable, testable and reproducible: same input, same score. Claude is only used to write language (emails and plain-English summaries), and code checks it can't introduce numbers.
- *Why is the score 85% coverage?* There's no verified audience data, so that 15% weight is excluded and the score rescaled, rather than guessed.
- *Why aren't conflicts subtracted?* Fit and business conflicts are different decisions; a flag keeps both visible.
- *How do you stop the AI making things up?* It only receives verified fields, the prompt forbids invented claims, structured outputs plus zod validate the shape, regex guardrails reject contact details, links and statistics, and a human must review.
- *How are tests independent of the API?* `createApp` takes the generator as a parameter; tests pass a fake.
