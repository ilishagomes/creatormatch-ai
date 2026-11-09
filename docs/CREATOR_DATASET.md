# Creator dataset: research notes

`server/src/data/creators.json` is a **hand-curated** list of real, public creators, researched on **2026-11-05** using web search. Direct page fetching was not available, so every fact comes from search results and the cited source pages.

## Rules the dataset follows

- **Real creators only.** No generated or fictional profiles.
- **Every profile URL was confirmed** from a search result for that exact page (or a cited listing of it). Entries that couldn't be confirmed were removed (Chiara Ferragni, Jenn Im, Sara Dietschy and Nara Smith were dropped in this revision). `verificationStatus: "needs_manual_verification"` is available for future entries that can't be fully confirmed.
- **Descriptions only restate what the cited sources say.** If nothing reliable was found, the field is `null` and the UI shows "Not available".
- **Audience figures** are included only when a source gives both the number *and* a date. They are historical snapshots, not live counts.
- **Never stored:** sponsorship rates, pricing, engagement rates, demographic percentages or availability. The schema rejects unknown fields, so these can't be added by accident.
- **Conflicts** (owned brands, controversies) are listed only when a cited source supports them, and each owned brand links to its source.

Edit the JSON, then run `npm run db:seed`. It updates creators in place, keeping their IDs and any saved drafts. The seed fails with a clear message if any entry breaks the rules above.

## Creators

| Category | Creator | Platform | Profile | Owned brands (conflicts) | Dated audience data |
|---|---|---|---|---|---|
| skincare | Hyram Yarbro | youtube | [youtube.com/@Hyram](https://www.youtube.com/@Hyram) | Selfless by Hyram | — |
| skincare | Dr. Shereene Idriss | youtube | [youtube.com/@shereeneidriss](https://www.youtube.com/@shereeneidriss) | Dr. Idriss (formerly PillowtalkDerm) | — |
| skincare | James Welsh | youtube | [youtube.com/channel/UCPP291gN79qI1QZY1znOscg](https://www.youtube.com/channel/UCPP291gN79qI1QZY1znOscg) | — | — |
| skincare | Cassandra Bankson | youtube | [youtube.com/channel/UCHj2_6e0Y2YdzHZDkkLa53Q](https://www.youtube.com/channel/UCHj2_6e0Y2YdzHZDkkLa53Q) | — | YouTube subscribers: 1,470,000 (2021-05) |
| skincare | Susan Yara | youtube | [youtube.com/channel/UCBCmamMhN7Yxh6MzCpcYcTg](https://www.youtube.com/channel/UCBCmamMhN7Yxh6MzCpcYcTg) | Naturium | — |
| skincare | Dr. Andrea Suarez (Dr Dray) | youtube | [youtube.com/channel/UCnxmUrGMtpQT844Yd_l7Zyg](https://www.youtube.com/channel/UCnxmUrGMtpQT844Yd_l7Zyg) | — | — |
| skincare | Dr. Muneeb Shah (DermDoctor) | tiktok | [tiktok.com/@dermdoctor](https://www.tiktok.com/@dermdoctor) | Remedy Science | — |
| beauty | Nikkie de Jager (NikkieTutorials) | youtube | [youtube.com/@nikkietutorials](https://www.youtube.com/@nikkietutorials) | Nimya | — |
| beauty | Jackie Aina | youtube | [youtube.com/jackieaina](https://www.youtube.com/jackieaina) | FORVR Mood | — |
| fashion | Wisdom Kaye | tiktok | [tiktok.com/@wisdm8](https://www.tiktok.com/@wisdm8) | — | TikTok followers: 10,500,000 (2024) |
| fashion | Leonie Hanne | instagram | [instagram.com/leoniehanne/](https://www.instagram.com/leoniehanne/) | — | — |
| fashion | Matilda Djerf | instagram | [instagram.com/matildadjerf/](https://www.instagram.com/matildadjerf/) | Djerf Avenue | — |
| fitness | Joe Wicks (The Body Coach) | youtube | [youtube.com/channel/UCAxW1XT0iEJo0TYlRfn6rYQ](https://www.youtube.com/channel/UCAxW1XT0iEJo0TYlRfn6rYQ) | The Body Coach app | — |
| fitness | Chloe Ting | youtube | [youtube.com/@ChloeTing](https://www.youtube.com/@ChloeTing) | Core app | — |
| fitness | Jeff Nippard | youtube | [youtube.com/@JeffNippard](https://www.youtube.com/@JeffNippard) | — | — |
| fitness | Pamela Reif | instagram | [instagram.com/pamela_rf/](https://www.instagram.com/pamela_rf/) | Naturally Pam, Pam App | — |
| fitness | Kayla Itsines | instagram | [instagram.com/kayla_itsines/](https://www.instagram.com/kayla_itsines/) | Sweat | — |
| fitness | Cassey Ho (Blogilates) | youtube | [youtube.com/user/blogilates](https://www.youtube.com/user/blogilates) | POPFLEX, Blogilates (Target line) | — |
| technology | Marques Brownlee (MKBHD) | youtube | [youtube.com/@mkbhd](https://www.youtube.com/@mkbhd) | — | — |
| technology | Justine Ezarik (iJustine) | youtube | [youtube.com/ijustine](https://www.youtube.com/ijustine) | — | — |
| technology | Arun Maini (Mrwhosetheboss) | youtube | [youtube.com/@Mrwhosetheboss](https://www.youtube.com/@Mrwhosetheboss) | — | — |
| technology | Linus Tech Tips | youtube | [youtube.com/@LinusTechTips](https://www.youtube.com/@LinusTechTips) | LTT Store | — |
| food | Joshua Weissman | youtube | [youtube.com/joshuaweissman](https://www.youtube.com/joshuaweissman) | — | — |
| food | Nick DiGiovanni | tiktok | [tiktok.com/@nick.digiovanni](https://www.tiktok.com/@nick.digiovanni) | — | — |
| food | Andrew Rea (Babish Culinary Universe) | youtube | [youtube.com/@babishculinaryuniverse](https://www.youtube.com/@babishculinaryuniverse) | — | — |
| food | Eitan Bernath | tiktok | [tiktok.com/@eitan](https://www.tiktok.com/@eitan) | — | — |
| food | Tabitha Brown | tiktok | [tiktok.com/@iamtabithabrown](https://www.tiktok.com/@iamtabithabrown) | Donna's Recipe, Tabitha Brown Collection (Target) | — |
| lifestyle | Emma Chamberlain | youtube | [youtube.com/@emmachamberlain](https://www.youtube.com/@emmachamberlain) | Chamberlain Coffee | YouTube subscribers: 12,000,000 (2025-12) |
| lifestyle | Matt D'Avella | youtube | [youtube.com/channel/UCJ24N4O0bP7LGLBDvye7oCA](https://www.youtube.com/channel/UCJ24N4O0bP7LGLBDvye7oCA) | — | — |
| lifestyle | Ali Abdaal | youtube | [youtube.com/@aliabdaal](https://www.youtube.com/@aliabdaal) | LifeOS / Superfocus | — |
