import { WORK_TIME_ZONE } from "./tracking.js";
import { $ } from "./ui.js";

export function setupClock() {
  const widget = $("floatingClock"), button = $("clockFace"), detail = $("clockDetail");
  const eastern = {timeZone:WORK_TIME_ZONE};
  const time = new Intl.DateTimeFormat("en-US", {...eastern, hour:"numeric", minute:"2-digit"});
  const date = new Intl.DateTimeFormat("en-US", {...eastern, month:"short", day:"numeric"});
  const abbreviation = new Intl.DateTimeFormat("en-US", {...eastern, timeZoneName:"short"});
  let pinned = false;
  let moved = false;
  let start;
  let manualPosition = false;

  let nextMinute;
  function update() {
    const now = new Date();
    $("clockTime").textContent = time.format(now);
    const zoneName = abbreviation.formatToParts(now).find(part => part.type === "timeZoneName").value;
    $("clockDate").textContent = date.format(now) + " · " + zoneName;
    const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const local = new Intl.DateTimeFormat("en-US", {
      timeZone:localZone, dateStyle:"full", timeStyle:"short",
    });
    const label = localZone === "Asia/Manila" ? "Philippine time" : localZone.replaceAll("_", " ");
    $("localZone").textContent = "Your local time · " + label;
    $("localDateTime").textContent = local.format(now);
    positionDetail();
    clearTimeout(nextMinute);
    nextMinute = setTimeout(update, 60000 - now.getTime() % 60000);
  }
  function place(x, y) {
    const inset = 8;
    const rect = widget.getBoundingClientRect();
    widget.style.left = Math.max(inset, Math.min(x, window.innerWidth - rect.width - inset)) + "px";
    widget.style.top = Math.max(inset, Math.min(y, window.innerHeight - rect.height - inset)) + "px";
    widget.style.bottom = "auto";
    widget.style.right = "auto";
    manualPosition = true;
    positionDetail();
  }
  function fit() {
    if (manualPosition) {
      const rect = widget.getBoundingClientRect();
      place(rect.left, rect.top);
    }
  }
  function positionDetail() {
    if (detail.hidden) return;
    const face = button.getBoundingClientRect();
    const left = Math.max(8, Math.min(face.right - detail.offsetWidth, window.innerWidth - detail.offsetWidth - 8));
    detail.style.left = (left - face.left) + "px";
    detail.style.top = face.top >= detail.offsetHeight + 12
      ? (-detail.offsetHeight - 4) + "px" : (face.height + 4) + "px";
  }
  function expand(open) {
    detail.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
    positionDetail();
  }
  widget.addEventListener("pointerenter", e => {
    if (e.pointerType === "mouse") expand(true);
  });
  widget.addEventListener("pointerleave", () => {
    if (!pinned && !button.matches(":focus-visible")) expand(false);
  });
  button.addEventListener("focus", () => {
    if (button.matches(":focus-visible")) expand(true);
  });
  button.addEventListener("blur", () => { pinned = false; expand(false); });
  document.addEventListener("pointerdown", e => {
    if (!widget.contains(e.target)) { pinned = false; expand(false); }
  });
  button.addEventListener("pointerdown", e => {
    if (!e.isPrimary || e.button !== 0) return;
    const rect = widget.getBoundingClientRect();
    start = {id:e.pointerId, x:e.clientX, y:e.clientY, left:rect.left, top:rect.top};
    moved = false;
    button.setPointerCapture(e.pointerId);
  });
  button.addEventListener("pointermove", e => {
    if (start?.id !== e.pointerId) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (!moved && Math.hypot(dx, dy) < 5) return;
    moved = true;
    pinned = false;
    expand(false);
    place(start.left + dx, start.top + dy);
  });
  button.addEventListener("lostpointercapture", () => { start = undefined; });
  button.addEventListener("click", e => {
    if (!moved || e.detail === 0) { pinned = !pinned; expand(pinned); }
    moved = false;
  });
  button.addEventListener("keydown", e => {
    if (e.key === "Escape") { pinned = false; expand(false); }
    const offsets = {ArrowLeft:[-24,0],ArrowRight:[24,0],ArrowUp:[0,-24],ArrowDown:[0,24]};
    if (offsets[e.key]) {
      e.preventDefault();
      const rect = widget.getBoundingClientRect();
      const [x,y] = offsets[e.key];
      place(rect.left + x, rect.top + y);
    }
  });
  widget.hidden = false;
  update();
  document.addEventListener("visibilitychange", update);
  window.addEventListener("resize", () => { fit(); positionDetail(); });
}
