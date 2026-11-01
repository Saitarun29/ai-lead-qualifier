// Pure helpers for the pipeline dashboard (no DOM). Shared by app.js and tests.
import { ROUTES, TIERS } from "./engine.js";

export const MAX_ENTRIES = 60;

export function fmtMs(ms) {
  const n = Math.max(0, Math.round(Number(ms) || 0));
  return n >= 1000 ? `${(n / 1000).toFixed(1)} s` : `${n} ms`;
}

export function fmtVal(v) {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  return String(v);
}

export function fmtBudget(b) {
  if (!b || b.min === null || b.min === undefined) return "—";
  const k = (n) => (n >= 1000 ? `$${n / 1000}k` : `$${n}`);
  return b.max ? `${k(b.min)}–${k(b.max)}` : `${k(b.min)}+`;
}

const span = (m) => {
  const a = Math.abs(m);
  if (a < 60) return `${a}m`;
  if (a < 1440) return `${Math.round(a / 60)}h`;
  return `${Math.round(a / 1440)}d`;
};

export function ago(iso, now = Date.now()) {
  const m = Math.round((now - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  return `${span(m)} ago`;
}

/** SLA status for a pipeline entry: replied, due in, or overdue. */
export function dueText(e, now = Date.now()) {
  if (e.replied_after_min != null) return { t: `Replied in ${span(e.replied_after_min)}`, state: "replied" };
  if (!e.sla_due_at) return { t: "No SLA", state: "none" };
  const diff = Math.round((new Date(e.sla_due_at).getTime() - now) / 60000);
  return diff >= 0 ? { t: `Due in ${span(diff)}`, state: "due" } : { t: `Overdue ${span(diff)}`, state: "late" };
}

export function toEntry(r, extra = {}) {
  return {
    id: r.id,
    created_at: r.created_at,
    name: r.lead.name,
    company: r.lead.company,
    score: r.score,
    tier: r.tier,
    route: r.route.action,
    sla_minutes: r.sla.minutes,
    sla_due_at: r.sla.due_at,
    source: r.lead.source_label,
    processing_ms: r.processing_ms,
    mode: r.mode,
    result: r,
    ...extra,
  };
}

/** Manually move an entry to another tier; returns a new entry. */
export function retier(entry, tier) {
  if (!TIERS.includes(tier)) throw new Error(`Unknown tier: ${tier}`);
  if (entry.tier === tier) return entry;
  return { ...entry, tier, route: ROUTES[tier].action, overridden: true };
}

export function addEntry(pipeline, entry) {
  return [entry, ...pipeline.filter((e) => e.id !== entry.id)].slice(0, MAX_ENTRIES);
}

export function computeKpis(pipeline, now = Date.now()) {
  const k = { total: pipeline.length, Hot: 0, Warm: 0, Cold: 0, Spam: 0, avgMs: null, overdue: 0 };
  let sum = 0;
  for (const e of pipeline) {
    if (k[e.tier] !== undefined) k[e.tier] += 1;
    sum += Number(e.processing_ms) || 0;
    if (dueText(e, now).state === "late") k.overdue += 1;
  }
  if (pipeline.length) k.avgMs = Math.round(sum / pipeline.length);
  return k;
}
