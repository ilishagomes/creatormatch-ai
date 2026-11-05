# How the matching algorithm works

Code: `server/src/services/matching/` (`index.ts` scoring, `taxonomy.ts` topics, `text.ts` text matching).
Tests: `server/tests/matching.test.ts`, `server/tests/campaignScenarios.test.ts`.

## The one-sentence version

> For every creator, we measure four things about how well they fit the campaign, give each a weight, **skip anything we don't have real data for**, and turn the result into a score out of 100 that we can explain line by line.

No AI decides the score. The same campaign and creator always produce exactly the same number.

## The four components

| Component | Weight | Question it answers | How it's measured (value 0–1) |
|---|---|---|---|
| Content niche relevance | 40 | Does the creator make content in this category? | Same category = 1 · related category (e.g. skincare ↔ beauty) = 0.4 · otherwise 0 |
| Campaign keyword relevance | 25 | Does their content cover what the brief talks about? | Weighted share of the brief's topics they cover (see below) |
| Platform compatibility | 20 | Do they post where the brand wants to advertise? | Primary platform selected = 1 · otherwise 0 |
| Verified audience relevance | 15 | Does their *verified* audience match the target ages? | Overlap of age ranges, **only if sourced data exists** |

Each component's **points** are `weight × value`. For example, a related category gives 40 × 0.4 = 16 points.

## Step 1: Read the brief as topics, not just words

A plain word match would miss obvious connections: "serum" in a brief and "skincare" on a creator's profile are clearly related. So we use a **taxonomy**, a hand-written dictionary that groups words into **topics** and topics into **families**:

```
family: skincare
  topic "Acne & oily skin"          ← acne, breakout, salicylic, oily skin …
  topic "Moisturising & hydration"  ← moisturizer, moisturiser, dry skin …
  topic "Serums & active ingredients" ← serum, vitamin c, retinol …
family: fitness
  topic "Running & cardio"   ← running, marathon, hiit …
  topic "Gym & strength"     ← gym, squat, lifting …
  topic "Activewear"         ← activewear, leggings, sports bra …
family: technology
  topic "Computers & software" ← laptop, software, pc …
  topic "Consumer technology"  ← gadgets, consumer technology, tech …
```

- **Same topic** = an *exact* match, worth full credit.
- **Same family, different topic** = a *related* match, worth half credit. (Moisturizer ≈ acne, because both are skincare.)
- Anything else = no match.

The text matcher reads **longest phrase first**. "home workouts" becomes the *Home workouts* topic and isn't also read as "home". It also treats "fragrance-free" as one word, so a fragrance-free product never matches "fragrance".

## Step 2: Not every keyword matters equally

Each topic in the brief gets an **importance**:

```
importance = where it appears  ×  how specific it is
             product name 1.5     specific topic (e.g. acne)   1
             description  1.0     broad topic (e.g. "reviews") 0.5
             audience     0.5
```

"Acne" in the product name (1.5 × 1 = **1.5**) matters six times more than "reviews" in the audience field (0.5 × 0.5 = **0.25**). The dashboard shows these weights under "How we read your brief".

Keyword relevance is then:

```
keyword value = Σ (importance × match strength) ÷ Σ importance
                match strength: exact 1, related 0.5, none 0
```

## Step 3: Don't guess missing data. Rescale instead.

We have **no verified audience demographics** for any creator. Filling in a guess (or a 0) would make the score dishonest, so that component is marked **unknown** and left out:

```
score    = 100 × (points earned from measured components) ÷ (weights of measured components)
coverage = weights of measured components   → 40 + 25 + 20 = 85%
```

**Coverage** tells you how much of the model the score is based on. It's shown next to every score (for example, "85% coverage").

## Step 4: Conflicts are flags, not penalties

If the brief's product or description mentions something sold by a brand the creator owns (from a cited source), the creator gets a **conflict flag**. For example: *"Owns Remedy Science, which sells serum — this may compete with your product."*

The flag **does not change the score**. Topical fit and business conflicts are different questions, and a brand might still want to work with a founder. Mixing them into one number would hide that decision. The dashboard has a "Hide creators with conflict flags" filter instead.

## A worked example

Campaign: *Glow Lab, "Vitamin C brightening serum"*, skincare, YouTube + TikTok. Creator: **Dr. Muneeb Shah** (skincare, TikTok, no verified audience data).

| Component | Weight | Value | Points |
|---|---|---|---|
| Niche: skincare = skincare | 40 | 1.0 | 40 |
| Keywords: covers 5 of 5 brief topics (2 exact, 3 related) | 25 | 0.62 | 15.6 |
| Platform: TikTok was selected | 20 | 1.0 | 20 |
| Audience: no verified data | 15 | unknown | — (excluded) |
| **Total** | **85 measured** | | **75.6** |

`75.6 ÷ 85 × 100 = 88.9 → 89/100`, with **85% coverage**, plus a separate conflict flag (he owns Remedy Science).

## Where Claude fits in

Claude **never** produces or changes a number. On a creator profile, "Explain with Claude" sends Claude the *already calculated* breakdown and asks for a short plain-English summary. Before it's shown, code checks the reply:

1. **Every number** in Claude's text must appear in the results we sent. If Claude writes "2 million followers", the reply is rejected.
2. No follower or engagement statistics, and no links.

If either check fails, the user sees an error instead of the text.

## What the tests prove

| Test | Shows that… |
|---|---|
| Skincare creator vs gaming creator | Relevant creators outrank irrelevant ones |
| Platform switch | Choosing TikTok vs YouTube reorders the ranking |
| Category switch | A tech brief puts the tech creator first |
| Missing demographics | Audience is `null`/"unknown", coverage drops to 85%, nothing invented |
| Same input 50× | Identical output every time; input order doesn't matter |
| Related terms | moisturizer/serum/acne/skincare, running/gym/exercise/activewear and laptops/software/gadgets/consumer technology each share a family |
| Keyword importance | Product-name topics outweigh audience-field topics; specific outweighs broad |
| Conflicts | Flagged, and the score is identical with or without them |
| Real dataset scenarios | Skincare, apparel, tech, food and fashion briefs each get the right kind of creator on top |

## Talking points for a demo

- "It's a weighted scoring model with four components, and every point is explained on screen."
- "I use a topic taxonomy so related words match: *serum* and *acne* both count as skincare, but an exact topic match is worth more than a related one."
- "Keywords aren't equal. Words in the product name and specific topics count more than broad words like *reviews*."
- "We don't have verified audience data, so instead of guessing I exclude that component and rescale. The coverage figure is shown with every score."
- "Brand conflicts are flagged separately rather than hidden inside the number."
- "Claude only rewrites the calculated result in plain English, and code rejects any sentence that contains a number we didn't calculate."

## Known limitations

- The taxonomy is hand-written. Words it doesn't know (e.g. a new product category) aren't matched; the dashboard shows which topics it found.
- Platform matching uses the creator's **primary** platform only.
- Related-category and related-topic credit (0.4 and 0.5) are design choices, not learned values. They're constants at the top of `index.ts`, so they're easy to tune.
- The score measures **content fit**. It doesn't predict sales, engagement or whether the creator will say yes.
