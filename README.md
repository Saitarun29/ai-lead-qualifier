# AI Lead Qualifier

Every inbound enquiry gets scored, routed to a named owner with a reply deadline, and handed over with a first reply already drafted — instead of sitting in a shared inbox until someone has time to triage it.

Live demo: https://ai-lead-qualifier-self.vercel.app · [Run locally](#run-locally) · [Decisions](docs/decisions.md) · [Changelog](CHANGELOG.md)

Built by Sai Tarun Ronanki — AI Agents & Workflow Automation Consultant, Hyderabad. I build automations that survive production: self-checking workflows, an exceptions path for anything uncertain, and the boring parts (validation, deadlines, a record of what happened) done properly.

## Try the demo

No sign-up, no API key. The live demo runs in demo mode on purpose — see [decision 1](docs/decisions.md).

1. Click **D2C growth lead** in the Samples row. You get a score breakdown with the exact points behind it, a Hot route (AE call, 15-minute SLA) and a drafted first reply you can copy or open in mail.
2. Click **SEO spam**. It tiers Spam, drafts nothing, and the workflow trace shows the notify step skipped.
3. Drag a card on the pipeline board from Warm to Hot. The route changes, the card is marked "manual", and the table view (Board / Table toggle) updates with it. The board is stored in your browser, so it is still there when you come back.

## The problem

This is the setup I keep seeing in small sales teams. Enquiries arrive from a website form, Meta lead ads, LinkedIn, WhatsApp and referrals, and they all land in one place: a shared inbox, or a sheet someone maintains by hand. From there a person copies the details into the CRM, pastes a summary into Slack, and tries to work out who should reply.

Three things go wrong, in this order:

- **Hot leads wait in the same queue as everything else.** A founder asking for a call this week sits behind a student asking for a tutorial and two SEO pitches. Nobody is ignoring them — nobody can tell them apart at a glance.
- **The first reply goes out late because writing it is part of triage.** By the time someone has qualified the lead, found the owner and drafted a reply, hours have passed. The lead has usually filled in two more forms by then.
- **Nothing is recorded.** A week later there is no way to answer "why did we work this lead first?" or "which enquiries did we never reply to?" The inbox is the only record, and it does not have scores, reasons or deadlines in it.

The fix is not "AI reads your email". The fix is a small workflow that qualifies each enquiry the moment it arrives, writes the decision down, and puts a deadline on the next step.

## What this does

For each lead submitted through the form (or posted to the webhook in the n8n version):

1. **Normalize.** Fields are trimmed and length-capped, control characters stripped, budget mapped to a band, timeline to days, and the email domain, industry and tools (HubSpot, Zoho, Slack, WhatsApp, Shopify and the rest of the list in `assets/engine.js`) extracted from the message.
2. **Spam check first.** Pattern hits (SEO/backlink pitches, link stuffing, shouting), link count and low-information text are scored separately. Spam stops here: tier Spam, no reply drafted, no Slack ping.
3. **Score with explicit rules.** Budget, timeline and source carry fixed points; so do the sender's role, intent terms in the message, quantified volume ("400 leads a week") and a stated response-time pain. Every point shows up in the result as a signal with its weight, next to plain-language reasons.
4. **In live mode, the model refines — inside limits.** With `GEMINI_API_KEY` set, the Vercel API asks Gemini 2.0 Flash for a JSON assessment, then validates it against the rule baseline: the score is clamped into its tier band, extracted fields are type-checked, and a Spam result forces an empty reply. See [production notes](#production-notes) for the failure path.
5. **Route by tier, in code.** The tier decides the action, owner, channel and SLA — Hot: AE call, Senior Account Executive, reply within 15 min, Slack #sales-hot. Warm: nurture sequence, SDR team, 4 hours, #sales-warm. Cold: low-touch drip, marketing automation, 24 hours. Spam: disqualify, archived. The model never picks the owner or the deadline.
6. **Draft the first reply.** Under 120 words, addressed to the lead, using their use case, tools and timeline. Spam gets no draft. In the demo the draft is written by the engine's templates; in live mode the model writes it and the template is the fallback.
7. **Record and show the work.** The web demo keeps the lead on a pipeline board (board and table views, live SLA countdowns, KPIs) in `localStorage`. The n8n version writes the row to Supabase `public.leads` and pings Slack, then responds to the form.

## Why it's built this way

The short version — the full reasoning, with trade-offs, is in [docs/decisions.md](docs/decisions.md).

- **Explicit scoring rules over a black-box score.** Every weight is a number in `assets/engine.js` that a client and I can read, argue about and change. If a business sells smaller projects, we change the budget points; we do not re-prompt a model and hope the behaviour follows.
- **The workflow checks its own output.** Model output is validated and clamped, and routing is deterministic. This is the self-checking part: the system does not pass on a result it has not verified against its own rules.
- **Uncertain cases land somewhere visible.** If the live model call fails (after one retry), the lead still gets a rule-based result, flagged with `fallback_reason`, instead of an error page. That is an exceptions queue applied to a single request — nothing is silently dropped.
- **Demo mode needs no key.** Anyone can run the exact scoring, routing and reply logic in a browser in a minute. The trade-off — template wording instead of model wording — is labelled in the mode badge.

## Architecture

Two runtimes, one contract. The web app and the Vercel function share `assets/engine.js`; the n8n workflow implements the same flow for a self-hosted stack, and both sides agree on the JSON result shape.

```
Lead form ──POST──▶ api/qualify.js (Vercel, Node 18+, zero dependencies)
                      │  normalize → spam check → rule baseline
                      │  live mode: Gemini JSON call → validate + clamp
                      │  no key / call failed: rule result (demo mode)
                      └─▶ score, tier, reasons, signals, route, SLA,
                          drafted reply, per-step trace

Browser fallback ────▶ assets/engine.js (same file, runs client-side)
                          assets/pipeline.js → board + localStorage

n8n (self-hosted) ───▶ Webhook: lead-intake → Normalize (Set)
                      → LLM score (HTTP Request, OpenAI-compatible, JSON mode)
                      → Parse score + SLA (Code) → IF tier is not Spam
                      → Supabase insert (public.leads) → Slack notify
                      → Respond to Webhook
                      Spam branch → Respond (spam archived); no insert, no ping

Supabase ────────────▶ public.leads (RLS on) + lead_pipeline_kpis
                          and lead_queue views — supabase/schema.sql
```

Repo layout:

```
index.html                        the tool itself — intake, result, trace, board
assets/style.css                  steel/slate UI, deep green accent, flat
assets/app.js                     UI logic, presets, board rendering
assets/engine.js                  scoring rules, extraction, routing, SLAs, reply drafts
assets/pipeline.js                board helpers (KPIs, SLA text, re-tiering)
api/qualify.js                    GET mode check · POST qualify a lead
scripts/smoke.mjs                 13 checks, demo mode, no keys needed
n8n/ai-lead-qualifier.n8n.json    importable workflow, credentials read from $env
supabase/schema.sql               leads table, RLS policies, KPI and queue views
docs/decisions.md                 why it is built this way
```

## Production notes

What makes this more than a demo page, and where the edges still are:

- **Input is treated as untrusted.** POST only, 8 KB body cap, per-field length limits (name 80, message 2000), control characters stripped, JSON body parse failures return a plain `400` with an error string — never a stack trace. The scoring prompt states that lead text is data, not instructions.
- **Rate guard.** Best-effort limit of 20 requests per minute per IP in the function. It is in-memory per instance, so it slows down abuse of the demo; it is not a distributed rate limiter (see limitations).
- **Model calls have a timeout and one retry.** 12 seconds per attempt, one retry, then the rule-engine fallback with the reason recorded on the result. A lead is never lost because a model endpoint was down.
- **Keys stay server-side.** `GEMINI_API_KEY` is read only in `api/qualify.js`. The n8n workflow reads every credential from `$env` and contains no secrets. [`.env.example`](.env.example) lists the variable names and what each is for — no values.
- **What gets recorded.** In a client deployment, the Supabase row: the lead as submitted, score, tier, confidence, reasons, signals, extracted fields, route, owner, SLA deadline, the drafted reply, and processing time. The schema adds `first_reply_at` and a generated `response_minutes` column, plus a `lead_queue` view ordered by SLA — that is how you catch a deadline before it is missed, not after.
- **Costs stay predictable.** One short model call per lead in live mode, capped output tokens, temperature 0.2. The rule engine does the spam pass and the baseline for free, so a spam-heavy day does not become a model bill.

## Run locally

Static demo — the scoring engine runs in your browser, no keys, no install:

```bash
git clone https://github.com/Saitarun29/ai-lead-qualifier
cd ai-lead-qualifier
npm run dev        # python3 -m http.server 3000
# open http://localhost:3000
```

With the API running locally (demo mode until you add a key):

```bash
npx vercel dev     # http://localhost:3000, serves /api/qualify as well
```

Smoke test — exercises the engine, the board helpers and the API handler in demo mode:

```bash
npm run smoke      # 13 checks, needs no API keys
```

To run live scoring, copy the names from `.env.example` into a `.env` file and set `GEMINI_API_KEY`. The header badge flips from "Demo data" to "Live". For the n8n version you also need `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `SLACK_WEBHOOK_URL` on your n8n instance; `LLM_BASE_URL` and `LLM_MODEL` have defaults (`https://api.openai.com/v1`, `gpt-4o-mini`).

To use the n8n workflow: import `n8n/ai-lead-qualifier.n8n.json` from Workflows → Import from file, run `supabase/schema.sql` in the Supabase SQL editor, set the variables above, activate the workflow, and point your form at `https://<your-n8n>/webhook/lead-intake`.

Deployment is the standard Vercel static + functions setup (`vercel.json` sets `cleanUrls` only). Add `GEMINI_API_KEY` in the project settings for live scoring, or leave it unset and the deployment stays in demo mode.

## Data and privacy

- Every lead in the demo — Priya at "Brightcart", Vikram at "Kaveri Freight", the SEO pitch, the rest of the board — is **fictional sample data**, written for this repo and labelled as sample data in the UI. No real enquiries, clients or results are shown anywhere in this project.
- The demo stores board state only in your browser's `localStorage`. Nothing you type into the demo form is sent anywhere except, in live mode, the `/api/qualify` function on the same deployment.
- In a client deployment the lead data lives in that client's Supabase project (`public.leads`, row level security on, team access for authenticated users only) and the model call sends the lead's form fields to the configured LLM provider for scoring. If a client cannot send enquiry data to a third-party model, the rule engine alone still scores, routes and drafts — that is a supported configuration, not a degraded afterthought.

## Limitations and roadmap

Honest edges, in the order I would fix them for a paying client:

- **Budget bands are in USD**, because that is how the scoring bands were first built (`$5k–$15k` and so on in `assets/engine.js`). For an Indian SMB deployment I would switch the bands to INR ranges — the points stay the same, the labels and thresholds change.
- **Weights are my starting point, not a universal truth.** They are tuned for an automation consultancy's project sizes. Any other business needs a tuning pass against its own closed deals, which the explicit-rules design makes a one-file change — but it still has to be done.
- **No enrichment.** The engine works from what the lead wrote. It does not look up the company, check the website, or verify the email beyond its format and domain type.
- **Routing is one owner per tier.** No round-robin, no territory split, no calendar booking in the reply yet. The reply offers time slots as text.
- **No two-way CRM sync.** The n8n flow writes to Supabase and pings Slack; pushing the qualified lead into HubSpot or Zoho and writing `first_reply_at` back is the next step, and the schema already has the column for it.
- **The rate guard is per-instance.** A production deployment in front of real traffic wants a shared store (for example Upstash or a Supabase table) for rate limits and deduplication on double-submits.

## Work with me

I build systems like this for businesses drowning in manual follow-up and scattered ops — leads in inboxes, data copied between CRM, Sheets, Slack and billing tools by hand. If that is your week, I can build the version of this that fits your stack and your team.

Sai Tarun Ronanki · Hyderabad, India
hello@saitarun.com · [saitarun.com](https://saitarun.com) · [LinkedIn](https://www.linkedin.com/in/saitarunronanki) · [Instagram @tarunaistudio](https://www.instagram.com/tarunaistudio)

More builds in the same series:

- [sai-tarun-portfolio](https://github.com/Saitarun29/sai-tarun-portfolio) — my portfolio site, with the live demos in one place
- [content-ops-pipeline](https://github.com/Saitarun29/content-ops-pipeline) — content operations pipeline
- [knowledge-assistant-rag](https://github.com/Saitarun29/knowledge-assistant-rag) — internal knowledge assistant with RAG

MIT © 2026 Sai Tarun Ronanki — see [LICENSE](LICENSE).
