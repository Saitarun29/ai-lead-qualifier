# Decisions

Notes on the choices in this repo, in the order I would explain them to a client. Each one is a trade-off, not a best practice I copied from somewhere.

## 1. Demo mode needs no API key — 31 Oct 2026

The demo runs end to end with no key set. `api/qualify.js` checks for `GEMINI_API_KEY`; without it, it serves `qualifyDemo()` from `assets/engine.js`. Opened as plain static files, the page runs that same engine in the browser if `/api/qualify` is not reachable.

Why: a portfolio demo that asks a visitor for a key, or dies with a configuration error, shows nothing. A client evaluating this needs to submit a lead and see the score breakdown, the route and the drafted reply in under a minute.

Trade-off: demo scores come from the rule engine, not a live model, so the wording of reasons is less varied. The tier, route and SLA are the same logic the live path is checked against, which is the part that matters for judging the system. The mode badge in the header says which mode you are in — demo results are never dressed up as live AI.

## 2. Scoring weights are explicit rules, not a black-box model — 31 Oct 2026

Budget, timeline and source have point values in `assets/engine.js` (`BUDGETS`, `TIMELINES`, `SOURCES`). So do role (decision maker +16, manager/influencer +11), message intent terms (+2 each, capped), quantified volume and response time, and deductions for a very short message, research intent and a free email domain. Spam is a separate pattern check that runs first.

Why: when a rep asks "why is this lead Hot and that one Warm?", I need an answer I can point at, line by line. A single model prompt that returns a number gives no such answer, and its scoring drifts when the model or the prompt changes.

Trade-off: rules are blunt. They cannot read nuance in a well-written message from a small company, which is why the live path lets the model refine the baseline (decision 3) instead of replacing it. When the weights are wrong for a business, changing them is a small, reviewable edit — and I would rather tune weights with a client than re-prompt a model and hope.

## 3. The model's output is validated and clamped, never trusted — 31 Oct 2026

In live mode the API asks Gemini for JSON, then `mergeLive()` in `api/qualify.js` checks it: tier must be one of Hot / Warm / Cold / Spam, the score is clamped into that tier's band (Hot 75–100, Warm 50–74, Cold 0–49, Spam 0–10), extracted fields are type-checked and length-capped, and a Spam tier forces an empty reply. Anything missing falls back to the rule baseline for that field.

Why: models return malformed JSON, scores that contradict their own tier, and fields in the wrong type. If that output went straight into a CRM, the bad row would be discovered by a rep, in front of the lead's record, days later.

Trade-off: clamping hides some model signal — a score of 90 labelled Warm becomes 74. I accept that. A consistent score/tier pair a team can act on beats a more expressive pair that contradicts itself.

## 4. Routing and SLAs are computed from the tier, in code — 31 Oct 2026

`ROUTES` and `SLA` in `assets/engine.js` map each tier to an action, owner, channel, next step and reply deadline: Hot — AE call, Senior Account Executive, 15 minutes; Warm — nurture sequence, SDR team, 4 hours; Cold — low-touch drip, marketing automation, 24 hours; Spam — disqualify, no owner, no SLA. The model never chooses the owner or the deadline. The n8n workflow does the same in its Parse score + SLA node.

Why: routing is an operations commitment, not a judgement call. If the model picked owners, two near-identical leads could land with different people on different deadlines, and nobody could say why.

Trade-off: the map is coarse. It does not do round-robin, territory or workload balancing. That belongs in the CRM layer of a client deployment; this repo keeps one clear owner per tier so the behaviour is easy to audit.

## 5. Spam is filtered before it can cost anyone attention — 31 Oct 2026

`spamCheck()` in the engine scores pattern hits (SEO/backlink pitches, "Dear Sir", casino/crypto-signal phrasing), link count, shouting and repeated exclamation. At the threshold the lead is tiered Spam with the reasons recorded. In the n8n workflow the IF tier is not Spam node sends spam straight to Respond (spam archived) — no Supabase insert on that branch and no Slack ping. In the web demo, spam gets no drafted reply and the notify step is marked skipped.

Why: the cost of spam is not storage, it is a sales channel that people stop reading. One week of SEO pitches in #sales-hot and the Hot alerts stop working too.

Trade-off: a pattern filter will eventually catch a real lead who writes badly. That risk is why the spam reasons are stored with the result in the demo, and why in a client deployment I would review the archived list weekly at first instead of trusting the threshold blindly.

## 6. One shared engine for the API and the browser; n8n mirrors it — 31 Oct 2026

`assets/engine.js` has no dependencies and no DOM code, so Node (the Vercel function) and the browser import the same file. `assets/pipeline.js` holds the board helpers the same way. The n8n workflow is a separate implementation of the same flow for a self-hosted stack: Webhook, Normalize (Set), LLM score (HTTP Request, OpenAI-compatible), Parse score + SLA (Code), IF, Supabase insert, Slack notify, Respond.

Why: two scoring implementations in the web app would drift within a month. One file means a weight change is tested once and applies to demo, fallback and live validation together.

Trade-off: n8n cannot import the file, so its prompt and SLA logic are a mirror, not the same code. The JSON shape is the contract between them; if I change the shape in `engine.js`, the n8n Parse node needs the same change by hand. I accept that for a reference build — in a client deployment I would pick one runtime and delete the other.

## 7. A failed live call falls back instead of failing the lead — 31 Oct 2026, retry added 1 Nov 2026

The handler wraps the Gemini call (12-second timeout). Since 1 Nov 2026 it retries once after a short pause (`callGeminiWithRetry()` in `api/qualify.js`). If that also fails, the handler returns the rule-engine result with `fallback_reason` set, and the UI badge shows demo mode. The lead is scored, routed and answered either way.

Why: this is the exceptions-queue idea applied to a single request. The uncertain case — "the model did not answer" — should land somewhere visible with the reason attached, not become a 500 that loses the enquiry. A form that errors at the moment a good lead submits is the worst failure this system can have.

Trade-off: the caller cannot tell from the status code alone that live scoring failed; they have to read `mode` / `fallback_reason` in the body. For this API that is the right call — the consumer is my own UI — but a third-party integration would want a header or a stricter mode, and I would add one rather than change this default silently.

## 8. The demo keeps its data in the browser — 31 Oct 2026

The pipeline board persists to `localStorage` (key `alq.pipeline.v2`, capped at 60 entries) and ships with fictional sample leads so the board is readable on first load. The production data path is the one in `supabase/schema.sql`: a `public.leads` table with row level security for authenticated team reads/updates, inserts from n8n using the service-role key server-side only, plus `lead_pipeline_kpis` and `lead_queue` views.

Why: a public demo should not write strangers' test submissions into a real database, and a visitor should be able to drag cards, re-tier a lead and come back to the same board.

Trade-off: localStorage is per-browser and easy to clear, so the demo board is a working model of the queue, not shared team state. Anyone who needs the shared version runs the Supabase schema and the n8n workflow — that split is deliberate, and the README says so.
