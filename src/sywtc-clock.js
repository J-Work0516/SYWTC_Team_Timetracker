// SYWTC floating clock: the same file is used in every Speak Your Way To Cash workspace app.
// Shows the viewer's local time by default. Click it to see company (New York) time and to pick another
// timezone; the choice is remembered on this device. Drag it (or use the arrow keys) to move it.
// Styles are scoped to #sywtcClock so an app's own button/select styles can't change how the clock looks.
const STORE_KEY = "sywtc.clock.timezone";
export const COMPANY_TIME_ZONE = "America/New_York";
const COMMON_ZONES = [
  ["America/New_York", "Eastern · New York"], ["America/Chicago", "Central · Chicago"],
  ["America/Denver", "Mountain · Denver"], ["America/Phoenix", "Arizona · Phoenix"],
  ["America/Los_Angeles", "Pacific · Los Angeles"], ["America/Anchorage", "Alaska · Anchorage"],
  ["Pacific/Honolulu", "Hawaii · Honolulu"], ["America/Toronto", "Toronto"], ["America/Mexico_City", "Mexico City"],
  ["America/Sao_Paulo", "São Paulo"], ["Europe/London", "London"], ["Europe/Paris", "Paris · Berlin · Madrid"],
  ["Africa/Lagos", "Lagos"], ["Africa/Johannesburg", "Johannesburg"], ["Asia/Dubai", "Dubai"],
  ["Asia/Riyadh", "Riyadh"], ["Asia/Kolkata", "India"], ["Asia/Manila", "Philippines · Manila"],
  ["Asia/Singapore", "Singapore"], ["Asia/Tokyo", "Tokyo"], ["Australia/Sydney", "Sydney"],
];

const localZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const isValidZone = zone => { try { new Intl.DateTimeFormat("en-US", {timeZone: zone}); return true; } catch { return false; } };
function readChoice() { try { const z = localStorage.getItem(STORE_KEY); return z && isValidZone(z) ? z : ""; } catch { return ""; } }
function saveChoice(zone) { try { zone ? localStorage.setItem(STORE_KEY, zone) : localStorage.removeItem(STORE_KEY); } catch { /* storage blocked */ } }

/** The timezone the viewer chose, or their device timezone. */
export function getClockZone() { return readChoice() || localZone(); }
/** Calls fn(timeZone) whenever the viewer picks a different timezone. Returns an unsubscribe function. */
export function onZoneChange(fn) {
  const handler = e => fn(e.detail.timeZone);
  window.addEventListener("sywtc:timezone", handler);
  return () => window.removeEventListener("sywtc:timezone", handler);
}
export function zoneLabel(zone) {
  const known = COMMON_ZONES.find(([z]) => z === zone);
  return known ? known[1] : zone.split("/").pop().replaceAll("_", " ");
}
const zoneAbbr = (zone, date) =>
  new Intl.DateTimeFormat("en-US", {timeZone: zone, timeZoneName: "short"}).formatToParts(date).find(p => p.type === "timeZoneName")?.value ?? "";

const CSS = `
#sywtcClock{position:fixed;z-index:60;right:max(16px,env(safe-area-inset-right));bottom:max(16px,env(safe-area-inset-bottom));font-family:Poppins,system-ui,sans-serif;line-height:1.3;pointer-events:none}
#sywtcClock *{box-sizing:border-box}
#sywtcClock .sywtc-clock__face{all:unset;box-sizing:border-box;display:grid;gap:1px;min-width:104px;padding:8px 15px;color:#fff;background:#000;border:2px solid #ffcd02;border-radius:28px;box-shadow:0 3px 12px #0005;touch-action:none;user-select:none;cursor:grab;pointer-events:auto;text-align:left}
#sywtcClock .sywtc-clock__face:active{cursor:grabbing}
#sywtcClock .sywtc-clock__face:focus-visible{outline:3px solid #fff;box-shadow:0 0 0 6px #ffcd02}
#sywtcClock .sywtc-clock__time{font:600 15px/1.2 Poppins,system-ui,sans-serif;color:#fff;font-variant-numeric:tabular-nums}
#sywtcClock .sywtc-clock__date{color:#ffcd02;font:13px/1.2 Barlow,Poppins,system-ui,sans-serif}
#sywtcClock .sywtc-clock__panel{position:absolute;right:0;bottom:calc(100% + 6px);width:min(300px,calc(100vw - 16px));display:grid;gap:8px;padding:12px 14px;border-radius:10px;background:#000;color:#fff;font-size:12px;box-shadow:0 8px 30px #0006;pointer-events:auto}
#sywtcClock .sywtc-clock__panel[hidden]{display:none}
#sywtcClock.is-below .sywtc-clock__panel{bottom:auto;top:calc(100% + 6px)}
#sywtcClock .sywtc-clock__panel strong{display:block;color:#ffcd02;font-weight:600;font-size:12px}
#sywtcClock .sywtc-clock__panel span{display:block}
#sywtcClock .sywtc-clock__now{font-size:14px;color:#fff}
#sywtcClock .sywtc-clock__company{padding-top:8px;border-top:1px solid #ffffff33;color:#d9d9d9}
#sywtcClock .sywtc-clock__panel label{display:grid;gap:4px;margin:0;font-weight:600;font-size:12px;color:#fff}
#sywtcClock .sywtc-clock__panel select{all:unset;box-sizing:border-box;width:100%;min-height:38px;padding:7px 10px;border-radius:6px;background:#fff;color:#000;font:14px Poppins,system-ui,sans-serif;cursor:pointer}
#sywtcClock .sywtc-clock__panel select:focus-visible,#sywtcClock .sywtc-clock__reset:focus-visible{outline:3px solid #ffcd02;outline-offset:2px}
#sywtcClock .sywtc-clock__reset{all:unset;box-sizing:border-box;justify-self:start;padding:6px 10px;border:1px solid #ffcd02;border-radius:6px;color:#ffcd02;font:600 12px Poppins,system-ui,sans-serif;cursor:pointer}
#sywtcClock .sywtc-clock__reset[hidden]{display:none}
#sywtcClock .sywtc-clock__hint{color:#a8a8a8;font-size:11px}
#main{padding-bottom:max(84px,var(--sywtc-clock-pad,0px))}
@media (max-width:720px){#sywtcClock{right:8px;bottom:max(8px,env(safe-area-inset-bottom))}#sywtcClock .sywtc-clock__face{min-width:0;padding:6px 12px}#sywtcClock .sywtc-clock__time{font-size:13px}#sywtcClock .sywtc-clock__date{font-size:11px}}
@media print{#sywtcClock{display:none!important}}
`;

let mounted = null;

/** Adds the clock to the page (once). Safe to call from vanilla pages and React effects. */
export function mountClock() {
  if (mounted) return mounted;
  if (!document.getElementById("sywtc-clock-css")) {
    const style = document.createElement("style");
    style.id = "sywtc-clock-css";
    style.textContent = CSS;
    document.head.appendChild(style);
  }
  const root = document.createElement("div");
  root.className = "sywtc-clock";
  root.id = "sywtcClock";
  root.innerHTML = `
    <div class="sywtc-clock__panel" id="sywtcClockPanel" role="group" aria-label="Clock and timezone" hidden>
      <div><strong class="sywtc-clock__zone"></strong><span class="sywtc-clock__now"></span></div>
      <span class="sywtc-clock__company"></span>
      <label>Show time in<select class="sywtc-clock__select"></select></label>
      <button type="button" class="sywtc-clock__reset">Use my local time</button>
      <span class="sywtc-clock__hint">Drag the clock to move it.</span>
    </div>
    <button type="button" class="sywtc-clock__face" aria-controls="sywtcClockPanel" aria-expanded="false" title="Click to change timezone · drag to move">
      <span class="sywtc-clock__time"></span><span class="sywtc-clock__date"></span>
    </button>`;
  document.body.appendChild(root);
  const $ = sel => root.querySelector(sel);
  const face = $(".sywtc-clock__face"), panel = $(".sywtc-clock__panel"), select = $(".sywtc-clock__select"), reset = $(".sywtc-clock__reset");

  function fillOptions() {
    const device = localZone();
    const all = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
    const common = COMMON_ZONES.map(([z]) => z);
    const opt = (value, text) => { const o = document.createElement("option"); o.value = value; o.textContent = text; return o; };
    select.replaceChildren(opt("", `My local time (${zoneLabel(device)})`));
    const g1 = document.createElement("optgroup"); g1.label = "Common";
    COMMON_ZONES.forEach(([z, label]) => g1.appendChild(opt(z, label)));
    select.appendChild(g1);
    const rest = all.filter(z => !common.includes(z));
    if (rest.length) {
      const g2 = document.createElement("optgroup"); g2.label = "All timezones";
      rest.forEach(z => g2.appendChild(opt(z, z.replaceAll("_", " "))));
      select.appendChild(g2);
    }
    const chosen = readChoice();
    if (chosen && ![...select.options].some(o => o.value === chosen)) select.appendChild(opt(chosen, chosen.replaceAll("_", " ")));
    select.value = chosen;
  }

  let timer;
  function update() {
    const now = new Date(), zone = getClockZone(), chosen = readChoice();
    $(".sywtc-clock__time").textContent = new Intl.DateTimeFormat("en-US", {timeZone: zone, hour: "numeric", minute: "2-digit"}).format(now);
    $(".sywtc-clock__date").textContent = new Intl.DateTimeFormat("en-US", {timeZone: zone, month: "short", day: "numeric"}).format(now) + " · " + zoneAbbr(zone, now);
    $(".sywtc-clock__zone").textContent = (chosen ? "" : "Your local time · ") + zoneLabel(zone);
    $(".sywtc-clock__now").textContent = new Intl.DateTimeFormat("en-US", {timeZone: zone, dateStyle: "full", timeStyle: "short"}).format(now);
    $(".sywtc-clock__company").textContent = "Company time (New York): " +
      new Intl.DateTimeFormat("en-US", {timeZone: COMPANY_TIME_ZONE, weekday: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short"}).format(now);
    reset.hidden = !chosen;
    face.setAttribute("aria-label", `${$(".sywtc-clock__time").textContent}, ${zoneLabel(zone)}. Change timezone`);
    clearTimeout(timer);
    timer = setTimeout(update, 60000 - (now.getTime() % 60000) + 50);
  }

  function choose(zone) {
    saveChoice(zone);
    select.value = zone;
    update();
    window.dispatchEvent(new CustomEvent("sywtc:timezone", {detail: {timeZone: getClockZone()}}));
  }
  select.addEventListener("change", () => choose(select.value));
  reset.addEventListener("click", () => { choose(""); face.focus(); });

  function placePanel() {
    root.classList.toggle("is-below", face.getBoundingClientRect().top < panel.offsetHeight + 16);
    const r = root.getBoundingClientRect();
    panel.style.right = r.right < panel.offsetWidth + 8 ? `${r.right - panel.offsetWidth - 8}px` : "0";
  }
  function open(show) {
    panel.hidden = !show;
    face.setAttribute("aria-expanded", String(show));
    if (show) placePanel();
  }

  let drag = null, manual = false;
  function moveTo(x, y) {
    const r = root.getBoundingClientRect(), inset = 8;
    root.style.left = Math.max(inset, Math.min(x, innerWidth - r.width - inset)) + "px";
    root.style.top = Math.max(inset, Math.min(y, innerHeight - r.height - inset)) + "px";
    root.style.right = root.style.bottom = "auto";
    manual = true;
    if (!panel.hidden) placePanel();
  }
  face.addEventListener("pointerdown", e => {
    if (!e.isPrimary || e.button !== 0) return;
    const r = root.getBoundingClientRect();
    drag = {id: e.pointerId, x: e.clientX, y: e.clientY, left: r.left, top: r.top, moved: false};
    face.setPointerCapture(e.pointerId);
  });
  face.addEventListener("pointermove", e => {
    if (drag?.id !== e.pointerId) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    drag.moved = true;
    open(false);
    moveTo(drag.left + dx, drag.top + dy);
  });
  face.addEventListener("lostpointercapture", () => { setTimeout(() => { drag = null; }, 0); });
  face.addEventListener("click", () => { if (drag?.moved) return; open(panel.hidden); });
  face.addEventListener("keydown", e => {
    const step = {ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24]}[e.key];
    if (step) { e.preventDefault(); const r = root.getBoundingClientRect(); moveTo(r.left + step[0], r.top + step[1]); }
  });
  root.addEventListener("keydown", e => { if (e.key === "Escape" && !panel.hidden) { open(false); face.focus(); } });
  document.addEventListener("pointerdown", e => { if (!root.contains(e.target)) open(false); });
  window.addEventListener("resize", () => { if (manual) { const r = root.getBoundingClientRect(); moveTo(r.left, r.top); } });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) update(); });
  window.addEventListener("storage", e => { if (e.key === STORE_KEY) { fillOptions(); update(); } });

  fillOptions();
  update();
  mounted = {root, getZone: getClockZone};
  return mounted;
}
