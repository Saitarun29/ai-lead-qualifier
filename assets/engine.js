// Shared, dependency-free lead qualification engine.
// Used by /api/qualify (demo mode + validation of live LLM output) and by the
// browser as an offline fallback when the API is unreachable.

export const BUDGETS = [
  { id: "lt1k", label: "Under $1k", min: 0, max: 1000, pts: 4 },
  { id: "1-5k", label: "$1k – $5k", min: 1000, max: 5000, pts: 12 },
  { id: "5-15k", label: "$5k – $15k", min: 5000, max: 15000, pts: 20 },
  { id: "15-50k", label: "$15k – $50k", min: 15000, max: 50000, pts: 27 },
  { id: "50k+", label: "$50k+", min: 50000, max: null, pts: 30 },
  { id: "unsure", label: "Not sure yet", min: null, max: null, pts: 8 },
];

export const TIMELINES = [
  { id: "asap", label: "ASAP", days: 14, pts: 22, phrase: "two-week go-live target" },
  { id: "month", label: "This month", days: 30, pts: 18, phrase: "this-month timeline" },
  { id: "1-3m", label: "1 – 3 months", days: 90, pts: 12, phrase: "1–3 month window" },
  { id: "3-6m", label: "3 – 6 months", days: 180, pts: 6, phrase: "3–6 month window" },
  { id: "exploring", label: "Just exploring", days: null, pts: 2, phrase: "timeline" },
];

export const SOURCES = [
  { id: "referral", label: "Referral", pts: 10 },
  { id: "webinar", label: "Webinar", pts: 8 },
  { id: "website", label: "Website form", pts: 8 },
  { id: "linkedin", label: "LinkedIn", pts: 7 },
  { id: "google-ads", label: "Google Ads", pts: 6 },
  { id: "outbound", label: "Cold outbound reply", pts: 5 },
  { id: "other", label: "Other", pts: 3 },
];

export const TIERS = ["Hot", "Warm", "Cold", "Spam"];

export const SLA = {
  Hot: { minutes: 15, label: "Reply within 15 min" },
  Warm: { minutes: 240, label: "Reply within 4 hours" },
  Cold: { minutes: 1440, label: "Reply within 24 hours" },
  Spam: { minutes: null, label: "No reply — auto-archived" },
};

export const ROUTES = {
  Hot: {
    action: "AE call",
    owner: "Senior Account Executive",
    channel: "Slack #sales-hot + CRM deal (Stage: Discovery)",
    next_step: "Book a 20-min discovery call today; calendar link included in reply.",
  },
  Warm: {
    action: "Nurture sequence",
    owner: "SDR team",
    channel: "Slack #sales-warm + 5-touch email sequence",
    next_step: "Send tailored case study, follow up in 3 days, re-score on reply.",
  },
  Cold: {
    action: "Nurture sequence",
    owner: "Marketing automation",
    channel: "Monthly newsletter + resource drip",
    next_step: "Add to low-touch drip; re-score automatically if engagement rises.",
  },
  Spam: {
    action: "Disqualify",
    owner: "—",
    channel: "Archived (spam filter)",
    next_step: "No action. Sender pattern logged for the spam filter.",
  },
};

export const LIMITS = {
  name: 80, company: 100, role: 80, email: 120, message: 2000,
};

const DECISION_ROLES = /\b(founder|co-?founder|ceo|cto|coo|cmo|cro|cfo|chief|owner|president|partner|vp|vice president|head of|director|gm|general manager|managing)\b/i;
const MANAGER_ROLES = /\b(manager|lead|principal|senior|sr\.?|specialist|architect|consultant)\b/i;
const LOW_ROLES = /\b(student|intern|trainee|learner|job seeker|freelancer looking)\b/i;

const INTENT_TERMS = [
  ["automat", "Automation intent"],
  ["workflow", "Workflow problem"],
  ["crm", "CRM in stack"],
  ["hubspot", "HubSpot user"],
  ["salesforce", "Salesforce user"],
  ["zoho", "Zoho user"],
  ["pipedrive", "Pipedrive user"],
  ["integrat", "Integration need"],
  ["pipeline", "Pipeline pain"],
  ["lead", "Lead volume"],
  ["manual", "Manual process today"],
  ["hours", "Time cost mentioned"],
  ["scale", "Scaling pressure"],
  ["proposal", "Asked for proposal"],
  ["call", "Asked for a call"],
  ["demo", "Asked for a demo"],
  ["deadline", "Hard deadline"],
  ["launch", "Launch date"],
  ["n8n", "Knows n8n"],
  ["ai", "AI use case"],
];

const SPAM_PATTERNS = [
  /\bseo services?\b/i, /\bbacklinks?\b/i, /\bguest post/i, /\bcasino\b/i,
  /\bcrypto (signal|investment)/i, /\bloan offer/i, /\bdear sir\b/i,
  /\bhigh da\b/i, /\bcheap\b.*\b(services?|price)\b/i, /\bclick here\b/i,
  /\bbuy (followers|likes)\b/i, /\bweb ?design (offer|package)/i,
];

const TOOLS = [
  "HubSpot", "Salesforce", "Zoho", "Pipedrive", "Google Sheets", "Sheets", "Slack",
  "WhatsApp", "Shopify", "Notion", "Airtable", "Gmail", "Outlook", "n8n", "Zapier",
  "Make", "Meta lead forms", "Typeform", "Intercom", "Freshdesk", "Supabase",
];

const INDUSTRIES = [
  [/\b(d2c|dtc|shopify|e-?commerce|store|brand)\b/i, "E-commerce / D2C"],
  [/\b(saas|software|platform|app)\b/i, "SaaS"],
  [/\b(real estate|property|brokerage)\b/i, "Real estate"],
  [/\b(agency|clients)\b/i, "Agency"],
  [/\b(clinic|hospital|health|patient)\b/i, "Healthcare"],
  [/\b(fintech|bank|lending|insurance)\b/i, "Financial services"],
  [/\b(edtech|online course|school|university)\b/i, "Education"],
  [/\b(logistics|freight|shipping|fleet|warehouse)\b/i, "Logistics"],
  [/\b(manufactur|factory|b2b distribution)\b/i, "Manufacturing"],
];

const USE_CASES = [
  [/\b(lead|inbound|inquir|enquir).{0,40}(scor|qualif|triage|rout)/i, "Lead scoring & routing"],
  [/\b(scor|qualif|triage|rout).{0,40}(lead|inbound|inquir|enquir)/i, "Lead scoring & routing"],
  [/\b(ai|lead|smart) routing\b|\broute (them|leads|inquiries)/i, "Lead scoring & routing"],
  [/\bquote/i, "Quote-request intake"],
  [/\b(support|ticket)/i, "Support automation"],
  [/\b(report|dashboard)/i, "Reporting automation"],
  [/\b(crm).{0,30}(sync|clean|update)/i, "CRM sync"],
  [/\b(follow.?up|nurtur)/i, "Follow-up automation"],
];

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const str = (v, max) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

export function findBy(list, idOrLabel) {
  const v = String(idOrLabel ?? "").toLowerCase();
  return list.find((x) => x.id === v || x.label.toLowerCase() === v) || null;
}

export function normalizeLead(input = {}) {
  const budget = findBy(BUDGETS, input.budget) || BUDGETS.find((b) => b.id === "unsure");
  const timeline = findBy(TIMELINES, input.timeline) || TIMELINES.find((t) => t.id === "exploring");
  const source = findBy(SOURCES, input.source) || SOURCES.find((s) => s.id === "other");
  return {
    name: str(input.name, LIMITS.name),
    company: str(input.company, LIMITS.company),
    role: str(input.role, LIMITS.role),
    email: str(input.email, LIMITS.email).toLowerCase(),
    message: str(input.message, LIMITS.message).replace(/\s+/g, " "),
    budget: budget.id,
    budget_label: budget.label,
    timeline: timeline.id,
    timeline_label: timeline.label,
    source: source.id,
    source_label: source.label,
  };
}

export function validateLead(lead) {
  const errors = [];
  if (lead.name.length < 2) errors.push("name is required");
  if (lead.message.length < 3) errors.push("message is required");
  if (lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) errors.push("email looks invalid");
  return errors;
}

function firstName(name) {
  return (name.split(/\s+/)[0] || "there").replace(/[^\p{L}\-']/gu, "") || "there";
}

export function extractFields(lead) {
  const text = `${lead.message} ${lead.company} ${lead.role}`;
  const budget = findBy(BUDGETS, lead.budget);
  const timeline = findBy(TIMELINES, lead.timeline);
  const tools = TOOLS.filter((t) => new RegExp(`\\b${t.replace(/ /g, "\\s")}\\b`, "i").test(text));
  const uniqTools = [...new Set(tools.map((t) => (t === "Sheets" ? "Google Sheets" : t)))];
  const industry = (INDUSTRIES.find(([re]) => re.test(text)) || [null, "Unknown"])[1];
  const useCase = (USE_CASES.find(([re]) => re.test(lead.message)) || [null, /automat|workflow/i.test(lead.message) ? "Workflow automation" : "General inquiry"])[1];
  const teamM = lead.message.match(/(\d{1,5})[\s-]*(?:person|people|employees|reps|agents|staff|members|sdrs?|sales ?people)\b/i);
  const volM = lead.message.match(/~?\s?(\d[\d,.]*\s?k?)\s*(?:[a-z]+\s+)?(leads|inquiries|enquiries|tickets|orders|calls|emails|requests|quotes)\s*(?:a|per|\/|each|every)?\s*(day|week|month)?/i);
  const respM = lead.message.match(/(?:response|reply|respond)[^.]{0,40}?(\d+(?:\.\d+)?)\s*(min(?:ute)?s?|hours?|hrs?|days?)/i);
  const domain = lead.email.includes("@") ? lead.email.split("@")[1] : null;
  const freeMail = domain ? /^(gmail|yahoo|hotmail|outlook|icloud|proton|rediffmail|aol)\./i.test(domain) : null;
  return {
    first_name: firstName(lead.name),
    company: lead.company || "Not provided",
    role: lead.role || "Not provided",
    decision_maker: DECISION_ROLES.test(lead.role),
    industry,
    use_case: useCase,
    tools_mentioned: uniqTools,
    team_size: teamM ? Number(teamM[1]) : null,
    volume: volM ? `${volM[1].trim()} ${volM[2].toLowerCase()}${volM[3] ? " / " + volM[3].toLowerCase() : ""}` : null,
    current_response_time: respM ? `${respM[1]} ${respM[2]}` : null,
    budget_usd: budget && budget.min !== null ? { min: budget.min, max: budget.max } : null,
    timeline_days: timeline ? timeline.days : null,
    email_domain: domain,
    business_email: freeMail === null ? null : !freeMail,
    source: lead.source_label,
  };
}

export function spamCheck(lead) {
  const msg = lead.message;
  const hits = SPAM_PATTERNS.filter((re) => re.test(`${msg} ${lead.company} ${lead.name}`)).length;
  const links = (msg.match(/https?:\/\//gi) || []).length;
  const shouting = msg.length > 20 && msg.replace(/[^A-Z]/g, "").length / Math.max(1, msg.replace(/[^A-Za-z]/g, "").length) > 0.6;
  const bangs = (msg.match(/!{2,}/g) || []).length;
  const gibberish = /[bcdfghjklmnpqrstvwxz]{6,}/i.test(msg) || (msg.length < 15 && !/\?/.test(msg));
  let s = hits * 2 + (links >= 2 ? 2 : links) + (shouting ? 2 : 0) + (bangs ? 1 : 0) + (gibberish ? 2 : 0);
  return { isSpam: s >= 4, signals: { pattern_hits: hits, links, shouting, gibberish, bangs } };
}

export function scoreLead(lead) {
  const reasons = [];
  const signals = [];
  const ex = extractFields(lead);
  const spam = spamCheck(lead);

  if (spam.isSpam) {
    const why = [];
    if (spam.signals.pattern_hits) why.push(`${spam.signals.pattern_hits} known spam phrase${spam.signals.pattern_hits > 1 ? "s" : ""} (e.g. SEO / backlinks / "Dear Sir")`);
    if (spam.signals.links) why.push(`${spam.signals.links} outbound link${spam.signals.links > 1 ? "s" : ""} in the message`);
    if (spam.signals.shouting || spam.signals.bangs) why.push("Aggressive formatting (caps / !!!)");
    if (spam.signals.gibberish) why.push("Low-information or gibberish text");
    why.push("Message is a vendor pitch, not a buying inquiry");
    return {
      score: clamp(3 + spam.signals.links, 0, 10),
      tier: "Spam",
      confidence: 0.97,
      reasons: why,
      intent_signals: [
        { label: "Vendor pitch", polarity: "negative", weight: -40 },
        ...(spam.signals.links ? [{ label: "Link stuffing", polarity: "negative", weight: -15 }] : []),
        { label: "No problem statement", polarity: "negative", weight: -10 },
      ],
      extracted: ex,
    };
  }

  const b = findBy(BUDGETS, lead.budget);
  const t = findBy(TIMELINES, lead.timeline);
  const s = findBy(SOURCES, lead.source);
  let score = 3; // completed a qualified form

  score += b.pts;
  if (b.pts >= 20) { reasons.push(`Budget ${b.label} fits a production engagement`); signals.push({ label: `Budget ${b.label}`, polarity: "positive", weight: b.pts }); }
  else if (b.id === "unsure") { reasons.push("Budget not defined yet — needs discovery"); signals.push({ label: "Budget undefined", polarity: "neutral", weight: b.pts }); }
  else { reasons.push(`Budget ${b.label} is below typical project size`); signals.push({ label: `Low budget (${b.label})`, polarity: "negative", weight: b.pts }); }

  score += t.pts;
  if (t.pts >= 18) { reasons.push(`Urgent timeline: ${t.label}`); signals.push({ label: "Urgent timeline", polarity: "positive", weight: t.pts }); }
  else if (t.pts >= 12) { reasons.push(`Active project window (${t.label})`); signals.push({ label: "Near-term project", polarity: "positive", weight: t.pts }); }
  else { reasons.push(`Long or undefined timeline (${t.label})`); signals.push({ label: "No urgency", polarity: "negative", weight: t.pts }); }

  if (DECISION_ROLES.test(lead.role)) { score += 16; reasons.push(`${lead.role} is likely a decision maker`); signals.push({ label: "Decision maker", polarity: "positive", weight: 16 }); }
  else if (LOW_ROLES.test(lead.role)) { reasons.push(`Role "${lead.role}" is unlikely to hold budget`); signals.push({ label: "Non-buyer role", polarity: "negative", weight: 0 }); }
  else if (MANAGER_ROLES.test(lead.role)) { score += 11; reasons.push(`${lead.role} — influencer, may need an exec sponsor`); signals.push({ label: "Influencer role", polarity: "neutral", weight: 11 }); }
  else { score += 5; signals.push({ label: "Role unclear", polarity: "neutral", weight: 5 }); }

  score += s.pts;
  if (s.pts >= 10 && s.id === "referral") { reasons.push(`${s.label} source — came in on a personal introduction`); signals.push({ label: `${s.label} source`, polarity: "positive", weight: s.pts }); }
  else signals.push({ label: `${s.label} source`, polarity: "neutral", weight: s.pts });

  const lower = lead.message.toLowerCase();
  const matched = INTENT_TERMS.filter(([k]) => (k === "ai" ? /\bai\b/.test(lower) : lower.includes(k)));
  const intentPts = clamp(matched.length * 2, 0, 8);
  score += intentPts;
  matched.slice(0, 4).forEach(([, label]) => signals.push({ label, polarity: "positive", weight: 2 }));
  if (matched.length >= 4) reasons.push("Clear, specific problem statement with buying language");
  else if (matched.length === 0) reasons.push("Message has no concrete problem or buying signal");

  if (ex.volume) { score += 3; reasons.push(`Quantified volume: ${ex.volume}`); }
  if (ex.current_response_time) { score += 2; reasons.push(`Pain quantified: current response ~${ex.current_response_time}`); }
  if (ex.tools_mentioned.length) signals.push({ label: `Stack: ${ex.tools_mentioned.slice(0, 3).join(", ")}`, polarity: "positive", weight: 1 });
  if (lead.message.length < 40) { score -= 6; signals.push({ label: "Very short message", polarity: "negative", weight: -6 }); }
  if (/\b(college project|assignment|just curious|learning|tutorial)\b/i.test(lead.message)) { score -= 8; reasons.push("Reads as research / learning, not a purchase"); signals.push({ label: "Research intent", polarity: "negative", weight: -8 }); }
  if (ex.business_email === false) { score -= 2; signals.push({ label: "Free email domain", polarity: "negative", weight: -2 }); }
  if (ex.business_email === true) { score += 2; signals.push({ label: "Business email", polarity: "positive", weight: 2 }); }

  score = clamp(Math.round(score), 3, 97);
  const tier = score >= 75 ? "Hot" : score >= 50 ? "Warm" : "Cold";
  const margin = Math.min(Math.abs(score - 75), Math.abs(score - 50));
  const confidence = Math.round(clamp(0.7 + margin / 60, 0.7, 0.96) * 100) / 100;
  return { score, tier, confidence, reasons: reasons.slice(0, 6), intent_signals: signals.slice(0, 8), extracted: ex };
}

export function draftReply(lead, tier, ex) {
  const fn = ex.first_name;
  const co = lead.company || "your team";
  const uc = ex.use_case === "General inquiry" ? "what you're looking to automate" : ex.use_case.toLowerCase();
  const tl = (findBy(TIMELINES, lead.timeline) || {}).phrase || "timeline";
  const t3 = ex.tools_mentioned.slice(0, 3);
  const across = t3.length ? ` across ${t3.length > 1 ? t3.slice(0, -1).join(", ") + " and " + t3[t3.length - 1] : t3[0]}` : "";
  const inTools = t3.length === 1 ? ` in ${t3[0]}` : across;
  const ucCap = uc.charAt(0).toUpperCase() + uc.slice(1);
  if (tier === "Spam") return { subject: "", body: "" };
  if (tier === "Hot") {
    return {
      subject: `${co} × ${uc} — quick call this week?`,
      body: `Hi ${fn},\n\nThanks for reaching out. ${ucCap}${across} is exactly the kind of system we build${ex.volume ? `, and at ${ex.volume} every hour of manual triage costs you deals` : ""}.\n\nGiven your ${tl}, I'd suggest a 20-minute call so I can map your current flow and show you a working scoring + routing setup. Here are two slots — or grab any time that suits: https://saitarun.com\n\n• Today, 4:30 PM IST\n• Tomorrow, 11:00 AM IST\n\nTalk soon,\nSai Tarun`,
    };
  }
  if (tier === "Warm") {
    return {
      subject: `Ideas for ${uc} at ${co}`,
      body: `Hi ${fn},\n\nThanks for the note about ${uc}${inTools}. Teams like ${co} usually start with one high-volume workflow, automate the triage step, and expand once the numbers are proven.\n\nI can share a short walkthrough of how the scoring and routing is set up: https://saitarun.com. If it fits, I'm happy to put together a scoped proposal — would a kickoff inside your ${tl} work?\n\nBest,\nSai Tarun`,
    };
  }
  return {
    subject: `Resources on ${uc}`,
    body: `Hi ${fn},\n\nThanks for your interest! Since you're early in exploring this, here are a few resources that explain how AI lead qualification works in practice — including an n8n workflow you can import and try.\n\nWhenever you're ready to build something for real, just reply to this email and we'll pick it up from there.\n\nCheers,\nSai Tarun`,
  };
}

export function finalize(lead, core, { mode, model, startedAt, now = Date.now(), traceMs } = {}) {
  const tier = TIERS.includes(core.tier) ? core.tier : "Cold";
  const sla = SLA[tier];
  const reply = core.reply && core.reply.body ? core.reply : draftReply(lead, tier, core.extracted);
  const processing_ms = Math.max(1, now - (startedAt || now));
  const t = traceMs || {};
  return {
    id: (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : `lead_${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    created_at: new Date(now).toISOString(),
    mode,
    model,
    lead,
    score: clamp(Math.round(Number(core.score) || 0), 0, 100),
    tier,
    confidence: core.confidence,
    reasons: core.reasons,
    intent_signals: core.intent_signals,
    extracted: core.extracted,
    route: { ...ROUTES[tier] },
    reply,
    sla: {
      minutes: sla.minutes,
      label: sla.label,
      due_at: sla.minutes ? new Date(now + sla.minutes * 60000).toISOString() : null,
    },
    processing_ms,
    trace: [
      { step: "webhook", label: "Webhook received", ms: t.webhook ?? 4, detail: "POST /webhook/lead-intake · 200" },
      { step: "enrich", label: "Normalize & enrich", ms: t.enrich ?? 9, detail: `Mapped budget/timeline · ${core.extracted.industry} · ${core.extracted.tools_mentioned.length} tools detected` },
      { step: "score", label: "LLM score", ms: t.score ?? Math.max(1, processing_ms - 20), detail: mode === "live" ? `${model} · JSON mode` : "Rule engine (demo mode)" },
      { step: "route", label: "Route by tier", ms: t.route ?? 2, detail: `IF tier = ${tier} → ${ROUTES[tier].action}` },
      { step: "notify", label: "Slack + CRM", ms: t.notify ?? 3, detail: tier === "Spam" ? "Skipped notify · archived row" : `${tier === "Hot" ? "#sales-hot" : tier === "Warm" ? "#sales-warm" : "drip list"} · supabase.leads insert` },
      { step: "respond", label: "Respond to webhook", ms: t.respond ?? 1, detail: `200 OK · ${processing_ms} ms total` },
    ],
  };
}

export function qualifyDemo(rawLead, opts = {}) {
  const startedAt = opts.startedAt || Date.now();
  const lead = normalizeLead(rawLead);
  const core = scoreLead(lead);
  // Simulated stage timings so the trace reads realistically in demo mode.
  const traceMs = { webhook: 6, enrich: 14, score: 780 + (core.score % 9) * 41, route: 3, notify: 118, respond: 2 };
  const total = Object.values(traceMs).reduce((a, b) => a + b, 0);
  return finalize(lead, core, { mode: "demo", model: "rules-v1", startedAt, now: startedAt + total, traceMs });
}
