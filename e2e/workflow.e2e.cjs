/**
 * End-to-end test of the real user workflow in a headless browser.
 *
 *   1. Start the app:          npm run dev
 *   2. In another terminal:    npm run test:e2e
 *
 * Needs Playwright:  npm i -D playwright && npx playwright install chromium
 * Works on an empty or existing database (it reads counts from the API first).
 * Steps marked [UI-state] replace one HTTP response in the browser to test how
 * the screen handles it — they do not test the Claude API (use npm run test:live).
 */
const { chromium } = require("playwright");

const BASE = process.env.E2E_URL || "http://localhost:5173";
let passed = 0;
const check = (cond, msg) => {
  if (!cond) throw new Error(`✖ ${msg}`);
  passed++;
  console.log(`✓ ${msg}`);
};

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => m.type() === "error" && !/status of (4\d\d|503)/.test(m.text()) && errors.push(m.text()));
  const api = (url) => p.evaluate(async (u) => (await fetch(u)).json(), url);

  // ---- Dashboard shows real counts
  await p.goto(BASE + "/");
  await p.getByText("Recent activity").waitFor();
  const [creators, campaignsBefore, draftsBefore] = await Promise.all([api("/api/creators"), api("/api/campaigns"), api("/api/drafts")]);
  const dash = await p.locator("main").innerText();
  check(new RegExp(`Creators in database\\s*${creators.length}`).test(dash), `dashboard: ${creators.length} creators (matches API)`);
  check(new RegExp(`Saved campaigns\\s*${campaignsBefore.length}`).test(dash), `dashboard: ${campaignsBefore.length} campaigns (matches API)`);

  // ---- Campaign builder validation + creation
  await p.getByRole("link", { name: "New campaign" }).first().click();
  await p.getByRole("button", { name: "Find creators" }).click();
  check((await p.locator("p[role=alert]").count()) >= 8, "builder: empty form shows field errors");
  await p.getByRole("button", { name: "Fill with example" }).click();
  check((await p.locator("p[role=alert]").count()) === 0, "builder: example clears errors");
  await p.getByRole("button", { name: "Find creators" }).click();
  await p.waitForURL(/\/campaigns\/\d+$/);
  const campaignId = Number(p.url().split("/").pop());
  await p.getByText(new RegExp(`Showing ${creators.length} of ${creators.length}`)).waitFor();
  check(true, `campaign #${campaignId} created and all creators ranked`);

  // ---- Discovery: ranking, filters, sorting
  const firstCard = p.locator("article").first();
  check(/Skincare/.test(await firstCard.innerText()), "discovery: skincare brief ranks a skincare creator first");
  await p.getByLabel("Category").selectOption("technology");
  const tech = creators.filter((c) => c.niche === "technology").length;
  check((await p.locator("article").count()) === tech, `discovery: category filter (${tech} technology creators)`);
  await p.getByLabel("Category").selectOption("all");
  await p.getByLabel("Sort by").selectOption("name");
  const names = await p.locator("article h3").allTextContents();
  check(names.join("|") === [...names].sort((a, b) => a.localeCompare(b)).join("|"), "discovery: sort by name");
  await p.getByLabel("Sort by").selectOption("score");
  await p.getByLabel("Search creators").fill("zzzz-no-match");
  await p.getByText("No creators match these filters").waitFor();
  await p.getByText("Clear filters").click();
  check((await p.locator("article").count()) === creators.length, "discovery: empty state + clear filters");

  // ---- Creator details: sources + missing data
  await p.locator("article").first().getByRole("link", { name: "View profile" }).click();
  await p.getByText("Compatibility score", { exact: true }).waitFor();
  const hrefs = await p.locator("ol a[target=_blank]").evaluateAll((as) => as.map((a) => a.href));
  check(hrefs.length > 0 && hrefs.every((h) => h.startsWith("https://")), `details: ${hrefs.length} clickable https source links`);
  check((await p.getByText("Unknown — excluded").count()) === 1, "details: audience component shown as unknown, not invented");
  const profileHref = await p.getByRole("link", { name: /Open profile/ }).getAttribute("href");
  const creatorId = Number(new URL(p.url()).pathname.split("/").pop());
  const creator = creators.find((c) => c.id === creatorId);
  check(profileHref === creator.profileUrl, `details: "Open profile" links to the stored profile (${profileHref})`);

  // [UI-state] a creator with no description and no audience figures
  await p.route(`**/api/creators/${creatorId}`, async (r) => {
    const res = await r.fetch();
    const body = await res.json();
    await r.fulfill({ response: res, json: { ...body, description: null, audienceMetrics: [] } });
  });
  await p.reload();
  await p.getByText("Compatibility score", { exact: true }).waitFor();
  check((await p.getByText("Not available").count()) >= 2, "[UI-state] missing description/audience shown as 'Not available'");
  await p.unroute(`**/api/creators/${creatorId}`);

  // ---- Outreach studio: real backend behaviour (no key → clear message)
  const health = await api("/api/health");
  await p.goto(`${BASE}/outreach/new?campaign=${campaignId}&creator=${creatorId}`);
  if (!health.aiConfigured) {
    await p.getByRole("button", { name: "Generate with Claude" }).click();
    await p.getByText(/AI outreach is not configured/).waitFor();
    check(true, "studio: without an API key, shows setup instructions");
  }

  // [UI-state] successful draft → edit → review → copy → save
  await p.route("**/api/outreach/generate", (r) => r.fulfill({ json: {
    subject: "Partnership idea", body: "Hi,\n\nThis is a test draft body that is long enough to look like a real email for the screen.\n\nBest,\n[Your name]",
    personalizationNote: "Test note.", model: "test-model", generatedAt: new Date().toISOString(), attempts: 1, requiresHumanReview: true,
  } }));
  await p.reload();
  await p.getByRole("button", { name: "Generate with Claude" }).click();
  await p.getByText("AI-generated draft — requires human review before use").waitFor();
  check(await p.getByRole("button", { name: "Copy" }).isDisabled(), "[UI-state] studio: AI label shown, Copy locked before review");
  await p.getByLabel("Email body").fill("Hi,\n\nEdited by the e2e test.\n\nBest,\n[Your name]");
  await p.getByText("I've reviewed this email for accuracy.").click();
  await p.getByRole("button", { name: "Copy" }).click();
  check((await p.evaluate(() => navigator.clipboard.readText())).includes("Edited by the e2e test"), "studio: Copy includes the user's edits");
  await p.getByRole("button", { name: "Save draft" }).click();
  await p.waitForURL(/\/outreach\/\d+$/);
  const draftId = Number(p.url().split("/").pop());
  const saved = await api(`/api/drafts/${draftId}`);
  check(saved.body.includes("Edited by the e2e test") && saved.reviewed === true && saved.aiModel === "test-model", `studio: draft #${draftId} saved to SQLite with edits, review flag and model`);
  await p.unroute("**/api/outreach/generate");

  // ---- Drafts: edit again, delete
  await p.getByLabel("Email body").fill("Second edit.");
  check(!(await p.getByRole("checkbox").isChecked()), "studio: editing after review clears the review tick");
  await p.getByRole("button", { name: "Save", exact: true }).click();
  await p.getByText("Changes saved").waitFor();
  await p.goto(BASE + "/outreach");
  check((await api("/api/drafts")).length === draftsBefore.length + 1, "drafts: list matches API");
  p.once("dialog", (d) => d.accept());
  await p.getByRole("button", { name: `Delete draft to ${creator.name}` }).first().click();
  await p.getByText("Draft deleted").waitFor();
  check((await api("/api/drafts")).length === draftsBefore.length, "drafts: delete works");

  // ---- Responsive: no horizontal scrolling on a phone
  const m = await browser.newPage({ viewport: { width: 390, height: 844 } });
  for (const path of ["/", "/campaigns", "/campaigns/new", `/campaigns/${campaignId}`, "/creators", `/creators/${creatorId}?campaign=${campaignId}`, `/outreach/new?campaign=${campaignId}&creator=${creatorId}`, "/outreach"]) {
    await m.goto(BASE + path);
    await m.waitForLoadState("networkidle");
    check(!(await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), `mobile ${path}: no horizontal scroll`);
  }
  await m.getByRole("button", { name: "Open menu" }).click();
  await m.getByRole("dialog", { name: "Menu" }).getByRole("link", { name: "Creators" }).click();
  await m.waitForURL(/\/creators$/);
  check((await m.getByRole("dialog", { name: "Menu" }).count()) === 0, "mobile: menu drawer navigates and closes");

  await p.goto(BASE + "/does-not-exist");
  await p.getByText("Page not found").waitFor();
  check(errors.length === 0, `no unexpected browser errors ${errors.length ? JSON.stringify(errors) : ""}`);
  console.log(`\n${passed} checks passed.`);
  await browser.close();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
