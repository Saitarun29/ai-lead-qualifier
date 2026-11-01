# Changelog

## 2026-11-01 — Design refinement and production pass

- Restyled the UI from the shared warm-neutral template to this project's own scheme: cool steel/slate surfaces (#E9EEF1, #16202A, #344454) with a flat deep green accent (#145C38). Dark slate top bar, green primary actions and score meter. No gradients.
- Rewrote the README in first person: the shared-inbox problem, what to try in the demo, production notes, data and privacy, and honest limitations. Removed the centred badge-wall header.
- Added `docs/decisions.md` (scoring rules over black-box output, demo mode without a key, model-output clamping, spam handling, the fallback path) and this changelog.
- Sample leads tightened up: fictional Indian SMB scenarios (a Bengaluru–Chennai freight firm, Hyderabad property enquiries, a clinic chain), labelled as sample data in the UI. Removed two invented outcome claims from the shipped copy — the drafted Warm reply and the trace footer no longer quote a response-time improvement figure.
- Production pass: `.env.example` with variable names and purposes only; the Gemini call now retries once before falling back to the rule engine; `scripts/smoke.mjs` added (13 checks, runs with no API keys, wired as `npm run smoke` / `npm test`); `package.json` gained `engines` and working scripts; `.gitignore` now allows `.env.example` to be committed while still ignoring real `.env` files.

## 2026-11-01 — Polish README

- README wording and structure pass after the demo URL fix.

## 2026-11-01 — Update live demo URL

- Pointed the README and page metadata at the live Vercel deployment: https://ai-lead-qualifier-self.vercel.app

## 2026-10-31 — Initial release

- Lead intake form with fictional sample leads, score / tier / reasons result view, workflow trace, and a pipeline board (board and table views, drag to re-tier, SLA countdowns) backed by `localStorage`.
- Shared scoring engine in `assets/engine.js`: explicit budget / timeline / source weights, role and intent signals, pattern-based spam check, tier routing and SLAs, drafted first replies.
- `api/qualify.js` Vercel function: GET mode check, POST qualification — demo mode without a key, live Gemini 2.0 Flash scoring with the model output validated and clamped to its tier band when `GEMINI_API_KEY` is set.
- Importable n8n workflow (`n8n/ai-lead-qualifier.n8n.json`): webhook intake, normalize, OpenAI-compatible LLM score, route by tier, Supabase insert and Slack notify for non-spam leads, spam answered as archived.
- Supabase schema (`supabase/schema.sql`): `public.leads` with row level security, KPI and queue views.
