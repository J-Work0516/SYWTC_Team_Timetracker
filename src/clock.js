import { mountClock } from "./sywtc-clock.js";

/** Shows the shared SYWTC floating clock (viewer's local time, pickable timezone). Time tracking itself still uses US Eastern time. */
export function setupClock() {
  mountClock();
}
