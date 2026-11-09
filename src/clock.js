import { $ } from "./ui.js";

export function setupClock() {
  const widget = $("floatingClock"), button = $("clockFace"), detail = $("clockDetail");
  const zone = {timeZone:"America/Chicago"};
  const time = new Intl.DateTimeFormat("en-US", {...zone, hour:"numeric", minute:"2-digit"});
  const date = new Intl.DateTimeFormat("en-US", {...zone, month:"short", day:"numeric"});
  const full = new Intl.DateTimeFormat("en-US", {...zone, dateStyle:"full"});
  let moved = false;
  let start;
  let manualPosition = false;

  let nextMinute;
  function update() {
    const now = new Date();
    $("clockTime").textContent = time.format(now);
    $("clockDate").textContent = date.format(now) + " · CT";
    detail.textContent = full.format(now) + " · US Central time";
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
  }
  function fit() {
    if (manualPosition) {
      const rect = widget.getBoundingClientRect();
      place(rect.left, rect.top);
    }
  }
  function expand(open) {
    detail.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
    fit();
  }
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
    place(start.left + dx, start.top + dy);
  });
  button.addEventListener("lostpointercapture", () => { start = undefined; });
  button.addEventListener("click", e => {
    if (!moved || e.detail === 0) expand(detail.hidden);
    moved = false;
  });
  button.addEventListener("keydown", e => {
    if (e.key === "Escape") expand(false);
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
  window.addEventListener("resize", fit);
}
