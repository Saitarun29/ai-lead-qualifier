import { BUDGETS, TIMELINES, SOURCES, ROUTES, LIMITS, qualifyDemo } from "./engine.js";
import { fmtMs, fmtVal, fmtBudget, ago, dueText, toEntry, retier, addEntry, computeKpis, MAX_ENTRIES } from "./pipeline.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const STORE = "alq.pipeline.v2";
const REQUEST_TIMEOUT_MS = 15000;

const PRESETS = [
  {
    name: "Priya Raman", email: "priya@brightcart.in", company: "Brightcart", role: "Head of Growth",
    budget: "15-50k", timeline: "asap", source: "referral",
    message: "We get ~400 inbound leads a week across Shopify, Meta lead forms and WhatsApp. 3 SDRs triage them manually in HubSpot and our median response time is about 6 hours, so hot leads go cold. We want AI scoring + routing to Slack live before our festive sale launch. Can we get on a call this week?",
  },
  {
    name: "Vikram Shetty", email: "vikram@kaverifreight.in", company: "Kaveri Freight", role: "Operations Manager",
    budget: "5-15k", timeline: "1-3m", source: "linkedin",
    message: "Exploring ways to automate our quote request intake. Requests come in by email and a web form from our Bengaluru and Chennai branches, then get copied into Zoho CRM by hand. We're a 12 person sales team. Would like to understand costs and see a rough proposal.",
  },
  {
    name: "Meera Joshi", email: "meera.j2002@gmail.com", company: "", role: "Marketing Intern",
    budget: "lt1k", timeline: "exploring", source: "google-ads",
    message: "Hi, just curious how AI lead scoring works. Maybe for a college project.",
  },
  {
    name: "Kevin Rank", email: "offers@rankmasters-seo.biz", company: "Rank Masters SEO", role: "Sales",
    budget: "unsure", timeline: "asap", source: "other",
    message: "Dear Sir, we offer CHEAP SEO services and 500 high DA backlinks + guest post on top sites!!! Visit http://rankmasters-seo.biz and http://bit.ly/seo-deal today, WhatsApp now.",
  },
];

// Fictional sample history so the dashboard is never empty on first visit. Names and companies are invented.
const SEEDS = [
  { age: 4, replied: null, lead: { name: "Arjun Mehta", email: "arjun@ledgerly.io", company: "Ledgerly", role: "Founder & CEO", budget: "15-50k", timeline: "month", source: "website", message: "Our demo request form gets ~120 leads a month and lands in a shared inbox. We want every lead scored and enriched, pushed into HubSpot, with a Slack ping for the good ones. Can you share a proposal and timeline?" } },
  { age: 38, replied: 7, lead: { name: "Sara Khan", email: "sara@kestrelrealty.in", company: "Kestrel Realty", role: "VP Sales", budget: "50k+", timeline: "asap", source: "referral", message: "We handle 2,000 property inquiries a month from portals and WhatsApp across Hyderabad. Agents respond in 5 hours on average and we lose buyers. Need AI routing to the right agent by area and budget, integrated with Salesforce. Deadline is our Q1 launch — let's do a call." } },
  { age: 125, replied: 52, lead: { name: "Divya Nair", email: "divya@aarogyaclinics.in", company: "Aarogya Clinics", role: "Marketing Manager", budget: "5-15k", timeline: "1-3m", source: "webinar", message: "Saw your webinar. We'd like to automate follow-up for patient inquiries from Google Ads and our site into our CRM. Not sure about the exact scope yet." } },
  { age: 310, replied: 95, lead: { name: "Ananya Rao", email: "ananya@pixelandpine.co", company: "Pixel & Pine", role: "Head of Operations", budget: "1-5k", timeline: "3-6m", source: "linkedin", message: "Agency with 25 people. Looking at automating client reporting and lead intake workflow with n8n at some point next year." } },
  { age: 560, replied: 410, lead: { name: "Rohit Verma", email: "rohit.v@outlook.com", company: "Freelance", role: "Analyst", budget: "unsure", timeline: "exploring", source: "google-ads", message: "Interested in learning what AI agents can do for small businesses. Any tutorial?" } },
  { age: 1500, replied: null, lead: { name: "Crypto Alpha", email: "vip@alpha-signals.xyz", company: "Alpha Signals", role: "Promoter", budget: "unsure", timeline: "asap", source: "other", message: "GET 10X RETURNS WITH OUR CRYPTO SIGNALS!!! Click here http://alpha-signals.xyz http://t.me/alpha now" } },
];

/* ---------------- Mode badge ---------------- */
let apiOnline = true;
function setBadge(mode, note) {
  const b = $("#modeBadge");
  b.className = `badge ${mode === "live" ? "is-live" : "is-demo"}`;
  b.querySelector("span").textContent = mode === "live" ? "Live" : "Demo data";
  b.title = note || (mode === "live" ? "Scoring with Gemini through /api/qualify" : "Deterministic rule engine. Set GEMINI_API_KEY for live scoring.");
}
async function checkHealth() {
  try {
    const r = await fetchWithTimeout("/api/qualify", { headers: { Accept: "application/json" } }, 5000);
    const ct = r.headers.get("content-type") || "";
    if (!r.ok || !ct.includes("json")) throw new Error("no api");
    const j = await r.json();
    setBadge(j.mode);
  } catch {
    apiOnline = false;
    setBadge("demo", "API not reachable. Running the same engine in your browser.");
  }
}
async function fetchWithTimeout(url, opts = {}, ms = REQUEST_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); } finally { clearTimeout(t); }
}

/* ---------------- Form ---------------- */
const form = $("#leadForm");
function fillSelect(sel, list, def) {
  sel.innerHTML = list.map((o) => `<option value="${esc(o.id)}"${o.id === def ? " selected" : ""}>${esc(o.label)}</option>`).join("");
}
function resetSelects() {
  fillSelect($("#budget"), BUDGETS, "unsure");
  fillSelect($("#timeline"), TIMELINES, "1-3m");
  fillSelect($("#source"), SOURCES, "website");
}
resetSelects();

const msg = form.elements.message;
const updateCount = () => { $("#msgCount").textContent = `${msg.value.length} / ${LIMITS.message}`; };
msg.addEventListener("input", updateCount);
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
$(".kbd").textContent = isMac ? "⌘ ↵" : "Ctrl ↵";

function applyPreset(p) {
  for (const [k, v] of Object.entries(p)) {
    const el = form.elements[k];
    if (el) el.value = v;
  }
  updateCount();
  hideError();
}
$$(".chip[data-preset]").forEach((c) => c.addEventListener("click", () => {
  $$(".chip").forEach((x) => { x.classList.remove("on"); x.setAttribute("aria-pressed", "false"); });
  c.classList.add("on");
  c.setAttribute("aria-pressed", "true");
  applyPreset(PRESETS[Number(c.dataset.preset)]);
  submit();
}));
$("#clearForm").addEventListener("click", () => {
  form.reset();
  resetSelects();
  $$(".chip").forEach((x) => { x.classList.remove("on"); x.setAttribute("aria-pressed", "false"); });
  updateCount();
  hideError();
});

function showError(t, field) {
  const e = $("#formError"); e.textContent = t; e.hidden = false;
  $$("[aria-invalid]", form).forEach((x) => x.removeAttribute("aria-invalid"));
  if (field) { const el = form.elements[field]; el.setAttribute("aria-invalid", "true"); el.focus(); }
}
function hideError() { $("#formError").hidden = true; $$("[aria-invalid]", form).forEach((x) => x.removeAttribute("aria-invalid")); }

form.addEventListener("submit", (e) => { e.preventDefault(); submit(); });
form.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } });

function validate(data) {
  if ((data.name || "").trim().length < 2) return ["Add the lead’s name.", "name"];
  if ((data.message || "").trim().length < 3) return ["Add a message. It is the strongest intent signal.", "message"];
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return ["That email address doesn’t look right.", "email"];
  return null;
}

let busy = false;
let lastData = null;
async function submit(dataOverride) {
  if (busy) return;
  const data = dataOverride || Object.fromEntries(new FormData(form).entries());
  const invalid = validate(data);
  if (invalid) return showError(...invalid);
  hideError();
  lastData = data;
  busy = true;
  const btn = $("#submitBtn");
  btn.disabled = true;
  btn.querySelector(".btn-label").textContent = "Running";
  btn.querySelector(".kbd").outerHTML = '<span class="spinner kbd-slot" aria-hidden="true"></span>';
  setResultState("loading");

  if (window.innerWidth < 860) $("#resultCard").scrollIntoView({ behavior: "smooth", block: "start" });
  let result;
  try {
    result = await runTrace(qualify(data));
  } catch (err) {
    resetTrace();
    setResultState("error", err.message || "Something went wrong.");
  }
  btn.disabled = false;
  btn.querySelector(".btn-label").textContent = "Qualify lead";
  btn.querySelector(".kbd-slot").outerHTML = `<kbd class="kbd" aria-hidden="true">${isMac ? "⌘ ↵" : "Ctrl ↵"}</kbd>`;
  busy = false;
  if (!result) return;
  setBadge(result.mode, result.fallback_reason);
  showResult(result);
  pipeline = addEntry(pipeline, toEntry(result));
  lastAdded = result.id;
  save();
  render();
}
$("#retryBtn").addEventListener("click", () => { if (lastData) submit(lastData); });

async function qualify(data) {
  if (apiOnline) {
    try {
      const r = await fetchWithTimeout("/api/qualify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ lead: data }),
      });
      const ct = r.headers.get("content-type") || "";
      if (ct.includes("json")) {
        const j = await r.json();
        if (r.ok) return j;
        if ([400, 413, 429].includes(r.status)) throw Object.assign(new Error(j.error || "Request rejected."), { fatal: true });
      }
    } catch (e) {
      if (e.fatal) throw e;
    }
    apiOnline = false; // static hosting or network issue: use the in-browser engine
  }
  return qualifyDemo(data);
}

/* ---------------- Workflow trace ---------------- */
const STEPS = ["webhook", "enrich", "score", "route", "notify", "respond"];
const stepEl = (s) => $(`#trace li[data-step="${s}"]`);
function setStatus(cls, text) { const rs = $("#runStatus"); rs.className = `status ${cls}`; rs.textContent = text; }
function resetTrace() {
  STEPS.forEach((s) => { const li = stepEl(s); li.className = ""; li.querySelector("em").textContent = "—"; });
  setStatus("", "Idle");
}
function paintTrace(result) {
  const t = Object.fromEntries(result.trace.map((x) => [x.step, x]));
  STEPS.forEach((s) => {
    const li = stepEl(s);
    li.className = s === "notify" && result.tier === "Spam" ? "done skipped" : "done";
    li.querySelector("em").textContent = fmtMs(t[s].ms);
    if (s !== "webhook") li.querySelector("small").textContent = t[s].detail;
  });
  setStatus("done", `Completed · ${fmtMs(result.processing_ms)}`);
}
async function runTrace(request) {
  resetTrace();
  setStatus("running", "Running");
  const set = (s, cls) => { stepEl(s).className = cls; };
  set("webhook", "running"); await sleep(180);
  set("webhook", "done");
  set("enrich", "running"); await sleep(220);
  set("enrich", "done");
  set("score", "running");
  const [result] = await Promise.all([request, sleep(450)]);
  for (const s of ["score", "route", "notify", "respond"]) {
    set(s, "running");
    await sleep(140);
    set(s, "done");
  }
  paintTrace(result);
  return result;
}

/* ---------------- Result ---------------- */
function setResultState(state, message) {
  $("#resEmpty").hidden = state !== "empty";
  $("#resLoading").hidden = state !== "loading";
  $("#resError").hidden = state !== "error";
  $("#resBody").hidden = state !== "result";
  $("#resultCard").setAttribute("aria-busy", state === "loading" ? "true" : "false");
  $("#toggleJson").disabled = state !== "result";
  if (state === "error") $("#resErrorMsg").textContent = message;
  if (state !== "result") { $("#resTitle").textContent = "Result"; $("#resMeta").textContent = ""; }
}

let current = null;
function showResult(r) {
  current = r;
  setResultState("result");
  $("#resTitle").textContent = `${r.lead.name}${r.lead.company ? " · " + r.lead.company : ""}`;
  $("#resMeta").textContent = `${String(r.id).slice(0, 8)} · ${r.mode === "live" ? r.model : "rules"}`;

  $("#scoreNum").textContent = r.score;
  $("#meterFill").style.width = `${Math.max(0, Math.min(100, r.score))}%`;
  const tp = $("#tierPill");
  tp.className = `pill t-${r.tier}`;
  tp.textContent = r.tier === "Spam" ? "Spam" : `${r.tier} lead`;
  $("#confidence").textContent = r.confidence ? `${Math.round(r.confidence * 100)}% confidence` : "";

  $("#routeAction").textContent = r.route.action;
  $("#routeOwner").textContent = r.route.owner;
  $("#routeChannel").textContent = r.route.channel;
  $("#routeNext").textContent = r.route.next_step;
  $("#slaLabel").textContent = r.sla.minutes ? r.sla.label.replace(/^Reply within /, "") : "None";
  $("#slaDue").textContent = r.sla.due_at ? `due ${new Date(r.sla.due_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "auto-archived";

  $("#reasons").innerHTML = r.reasons.map((x) => `<li>${esc(x)}</li>`).join("");
  $("#signals").innerHTML = r.intent_signals.map((s) => {
    const w = Number(s.weight) || 0;
    const pol = ["positive", "negative", "neutral"].includes(s.polarity) ? s.polarity : "neutral";
    return `<li class="${pol}"><span>${esc(s.label)}</span><span class="w">${w > 0 ? "+" : w < 0 ? "−" : ""}${Math.abs(w)}</span></li>`;
  }).join("");

  const ex = r.extracted || {};
  const fields = [
    ["Industry", ex.industry], ["Use case", ex.use_case], ["Decision maker", ex.decision_maker], ["Budget (USD)", fmtBudget(ex.budget_usd)],
    ["Timeline", ex.timeline_days ? `${ex.timeline_days} days` : r.lead.timeline_label], ["Volume", ex.volume], ["Team size", ex.team_size], ["Current response", ex.current_response_time],
    ["Stack", ex.tools_mentioned], ["Email domain", ex.email_domain], ["Business email", ex.business_email], ["Source", ex.source],
  ];
  $("#fields").innerHTML = fields.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(fmtVal(v))}</dd></div>`).join("");

  const rb = $("#replyBox");
  const hasReply = Boolean(r.reply && r.reply.body);
  rb.classList.toggle("empty", !hasReply);
  $("#mailReply").hidden = !hasReply;
  $("#copyReply").hidden = !hasReply;
  if (hasReply) {
    $("#replySubject").textContent = r.reply.subject;
    $("#replyBody").textContent = r.reply.body;
    $("#mailReply").href = `mailto:${encodeURIComponent(r.lead.email || "")}?subject=${encodeURIComponent(r.reply.subject)}&body=${encodeURIComponent(r.reply.body)}`;
  } else {
    $("#replySubject").textContent = "";
    $("#replyBody").textContent = "No reply drafted. Spam is archived and never reaches the sales team.";
  }
  $("#jsonView").textContent = JSON.stringify(r, null, 2);
  $$(".lcard").forEach((c) => c.classList.toggle("active", c.dataset.id === r.id));
}

$("#toggleJson").addEventListener("click", () => {
  const j = $("#jsonView"); j.hidden = !j.hidden;
  $("#toggleJson").setAttribute("aria-expanded", String(!j.hidden));
  $("#toggleJson").textContent = j.hidden ? "JSON" : "Hide JSON";
});
$("#copyReply").addEventListener("click", async () => {
  if (!current?.reply?.body) return;
  try { await navigator.clipboard.writeText(`Subject: ${current.reply.subject}\n\n${current.reply.body}`); toast("Reply copied"); } catch { toast("Clipboard not available in this browser"); }
});

let toastT;
function toast(t) {
  const el = $("#toast"); el.textContent = t; el.classList.add("show");
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), 2000);
}

/* ---------------- Pipeline (localStorage) ---------------- */
let pipeline = [];
let lastAdded = null;

function seed() {
  const now = Date.now();
  return SEEDS.map((s) => {
    const at = now - s.age * 60000;
    const r = qualifyDemo(s.lead, { startedAt: at });
    r.created_at = new Date(at).toISOString();
    if (r.sla.minutes) r.sla.due_at = new Date(at + r.sla.minutes * 60000).toISOString();
    return toEntry(r, { sample: true, replied_after_min: s.replied });
  }).sort((a, b) => b.created_at.localeCompare(a.created_at));
}
function load() {
  try {
    const j = JSON.parse(localStorage.getItem(STORE) || "null");
    if (Array.isArray(j) && j.length && j.every((e) => e && e.id && e.result)) return j;
  } catch { /* ignore corrupt storage */ }
  return seed();
}
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(pipeline.slice(0, MAX_ENTRIES))); } catch { /* quota or private mode */ }
}

const fmtStamp = (iso) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

function render() {
  const k = computeKpis(pipeline);
  $("#kTotal").textContent = k.total;
  $("#kHot").textContent = k.Hot;
  $("#kWarm").textContent = k.Warm;
  $("#kCold").textContent = k.Cold;
  $("#kSpam").textContent = k.Spam;
  $("#kOverdue").textContent = k.overdue;
  $("#kAvg").textContent = k.avgMs == null ? "—" : fmtMs(k.avgMs);

  ["Hot", "Warm", "Cold"].forEach((tier) => {
    const lane = $(`.lane[data-tier="${tier}"]`);
    const items = pipeline.filter((e) => e.tier === tier);
    lane.querySelector(".lane-n").textContent = items.length;
    lane.querySelector(".lane-body").innerHTML = items.length ? items.map((e) => {
      const d = dueText(e);
      const tag = e.overridden ? '<span class="tag">manual</span>' : e.id === lastAdded ? '<span class="tag">new</span>' : "";
      return `<article class="lcard${current && current.id === e.id ? " active" : ""}" draggable="true" data-id="${esc(e.id)}" tabindex="0" aria-label="${esc(e.name)}, score ${e.score}, ${esc(d.t)}">
        <div class="lcard-top"><b>${esc(e.name)}</b><span class="sc num">${e.score}</span></div>
        <p>${esc(e.company || "No company")} · ${esc(e.route)}</p>
        <div class="meta"><span>${ago(e.created_at)} ${tag}</span><span class="num due-${d.state}">${esc(d.t)}</span></div>
      </article>`;
    }).join("") : `<div class="lane-empty">No ${tier.toLowerCase()} leads yet. Leads routed here will show up in this lane.</div>`;
  });

  $("#rowCount").textContent = `${pipeline.length} ${pipeline.length === 1 ? "lead" : "leads"}`;
  $("#tbody").innerHTML = pipeline.map((e) => {
    const d = dueText(e);
    return `<tr data-id="${esc(e.id)}" tabindex="0">
      <td class="id">${esc(String(e.id).slice(0, 8))}</td>
      <td class="ts">${esc(fmtStamp(e.created_at))}</td>
      <td>${esc(e.name)}</td><td>${esc(e.company || "—")}</td>
      <td class="r num">${e.score}</td><td><span class="pill t-${esc(e.tier)}">${esc(e.tier)}</span></td>
      <td>${esc(e.route)}</td>
      <td class="num due-${d.state}">${esc(d.t)}</td>
      <td>${esc(e.source)}</td></tr>`;
  }).join("");
}

function openEntry(id) {
  const e = pipeline.find((x) => x.id === id);
  if (!e?.result) return;
  const r = { ...e.result, tier: e.tier, route: e.overridden ? { ...ROUTES[e.tier] } : e.result.route };
  showResult(r);
  paintTrace(r);
  if (window.innerWidth < 860) $("#resultCard").scrollIntoView({ behavior: "smooth", block: "start" });
}
const onOpenKey = (sel) => (ev) => { const el = ev.target.closest(sel); if (el && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); openEntry(el.dataset.id); } };
$("#board").addEventListener("click", (ev) => { const c = ev.target.closest(".lcard"); if (c) openEntry(c.dataset.id); });
$("#board").addEventListener("keydown", onOpenKey(".lcard"));
$("#tbody").addEventListener("click", (ev) => { const tr = ev.target.closest("tr"); if (tr) openEntry(tr.dataset.id); });
$("#tbody").addEventListener("keydown", onOpenKey("tr"));

// Drag to re-tier
let dragId = null;
$("#board").addEventListener("dragstart", (ev) => {
  const c = ev.target.closest(".lcard"); if (!c) return;
  dragId = c.dataset.id; c.classList.add("dragging");
  ev.dataTransfer.effectAllowed = "move";
  ev.dataTransfer.setData("text/plain", dragId);
});
$("#board").addEventListener("dragend", (ev) => { ev.target.closest?.(".lcard")?.classList.remove("dragging"); $$(".lane").forEach((l) => l.classList.remove("over")); });
$$(".lane").forEach((lane) => {
  lane.addEventListener("dragover", (ev) => { ev.preventDefault(); lane.classList.add("over"); });
  lane.addEventListener("dragleave", (ev) => { if (!lane.contains(ev.relatedTarget)) lane.classList.remove("over"); });
  lane.addEventListener("drop", (ev) => {
    ev.preventDefault(); lane.classList.remove("over");
    const id = ev.dataTransfer.getData("text/plain") || dragId;
    const idx = pipeline.findIndex((x) => x.id === id);
    const tier = lane.dataset.tier;
    if (idx < 0 || pipeline[idx].tier === tier) return;
    pipeline[idx] = retier(pipeline[idx], tier);
    save(); render();
    toast(`${pipeline[idx].name} moved to ${tier}. Route: ${ROUTES[tier].action}`);
  });
});

// View toggle
$$(".seg button").forEach((b) => b.addEventListener("click", () => {
  $$(".seg button").forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-selected", String(x === b)); });
  const table = b.dataset.view === "table";
  $("#board").hidden = table; $("#boardHint").hidden = table; $("#tableView").hidden = !table;
}));
$("#resetPipe").addEventListener("click", () => {
  pipeline = seed(); save(); render(); openEntry(pipeline[0].id); toast("Pipeline reset to sample data");
});

/* ---------------- Boot ---------------- */
pipeline = load();
render();
if (pipeline.length) openEntry(pipeline[0].id); else setResultState("empty");
updateCount();
checkHealth();
setInterval(render, 30000);
