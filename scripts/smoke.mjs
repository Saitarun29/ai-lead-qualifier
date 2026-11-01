// Smoke test — runs with no API keys, in demo mode only.
//   node scripts/smoke.mjs   (or: npm run smoke)
// Covers the shared scoring engine, the pipeline helpers, and the
// /api/qualify handler with a mocked req/res in demo mode.

delete process.env.GEMINI_API_KEY;

const { qualifyDemo, normalizeLead, validateLead } = await import("../assets/engine.js");
const { toEntry, retier, computeKpis } = await import("../assets/pipeline.js");
const { default: handler } = await import("../api/qualify.js");

let passed = 0;
function check(label, cond) {
  if (!cond) throw new Error(`Smoke check failed: ${label}`);
  passed += 1;
  console.log(`  ok  ${label}`);
}

const hot = qualifyDemo({
  name: "Priya Raman", email: "priya@brightcart.in", company: "Brightcart", role: "Head of Growth",
  budget: "15-50k", timeline: "asap", source: "referral",
  message: "We get ~400 inbound leads a week across Shopify, Meta lead forms and WhatsApp. 3 SDRs triage them manually in HubSpot and our median response time is about 6 hours, so hot leads go cold. We want AI scoring + routing to Slack live before our festive sale launch. Can we get on a call this week?",
});
check(`hot sample tiers Hot (got ${hot.tier}, score ${hot.score})`, hot.tier === "Hot" && hot.score >= 75);
check("hot sample has a route, owner and SLA due time", Boolean(hot.route?.action && hot.route?.owner && hot.sla?.due_at));
check("hot sample drafts a reply", Boolean(hot.reply?.subject && hot.reply?.body));

const spam = qualifyDemo({
  name: "Kevin Rank", email: "offers@rankmasters-seo.biz", company: "Rank Masters SEO", role: "Sales",
  budget: "unsure", timeline: "asap", source: "other",
  message: "Dear Sir, we offer CHEAP SEO services and 500 high DA backlinks + guest post on top sites!!! Visit http://rankmasters-seo.biz and http://bit.ly/seo-deal today, WhatsApp now.",
});
check(`spam sample tiers Spam (got ${spam.tier}, score ${spam.score})`, spam.tier === "Spam" && spam.score <= 10);
check("spam drafts no reply", !spam.reply?.body);

const student = qualifyDemo({
  name: "Meera Joshi", email: "meera.j2002@gmail.com", company: "", role: "Marketing Intern",
  budget: "lt1k", timeline: "exploring", source: "google-ads",
  message: "Hi, just curious how AI lead scoring works. Maybe for a college project.",
});
check(`student sample tiers Cold (got ${student.tier}, score ${student.score})`, student.tier === "Cold");

check("empty lead fails validation", validateLead(normalizeLead({})).length >= 2);
check("bad email fails validation", validateLead(normalizeLead({ name: "Test Lead", message: "hello there", email: "not-an-email" })).some((e) => e.includes("email")));

const entry = toEntry(hot);
const moved = retier(entry, "Warm");
check("retier moves a card and marks it manual", moved.tier === "Warm" && moved.overridden === true && moved.route === "Nurture sequence");
const kpis = computeKpis([entry, toEntry(spam), toEntry(student)]);
check("KPIs count tiers", kpis.total === 3 && kpis.Hot === 1 && kpis.Spam === 1 && kpis.Cold === 1);

// API handler, demo mode (no GEMINI_API_KEY set above)
function mockRes() {
  return {
    statusCode: null, body: null, headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}
const getRes = mockRes();
await handler({ method: "GET", headers: {}, socket: {} }, getRes);
check("GET /api/qualify reports demo mode without a key", getRes.statusCode === 200 && getRes.body?.mode === "demo");

const postRes = mockRes();
await handler(
  { method: "POST", headers: {}, socket: { remoteAddress: "127.0.0.1" }, body: { lead: { name: "Priya Raman", email: "priya@brightcart.in", company: "Brightcart", role: "Head of Growth", budget: "15-50k", timeline: "asap", source: "referral", message: "We get ~400 inbound leads a week and want AI scoring and routing to Slack. Can we get on a call this week?" } } },
  postRes,
);
check("POST /api/qualify returns a scored demo result", postRes.statusCode === 200 && typeof postRes.body?.score === "number" && Boolean(postRes.body?.tier));

const badRes = mockRes();
await handler({ method: "POST", headers: {}, socket: { remoteAddress: "127.0.0.1" }, body: { lead: { name: "", message: "" } } }, badRes);
check("POST with an empty lead returns a clear 400 JSON error", badRes.statusCode === 400 && typeof badRes.body?.error === "string" && !("stack" in (badRes.body || {})));

console.log(`\nSmoke test passed — ${passed} checks, demo mode, no API keys used.`);
