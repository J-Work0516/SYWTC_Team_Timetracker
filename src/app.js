import "@fontsource/bebas-neue/latin-400.css";
import "@fontsource/poppins/latin-400.css";
import "@fontsource/poppins/latin-600.css";
import "./style.css";
import { createClient, getAccessToken } from "@base44/sdk";
import {
  clients,
  matters,
  parseVoice,
  dayOf,
  dailyRows,
  hours,
  clock,
} from "./tracking.js";
import { $, el, choices, field, table, action, all } from "./ui.js";
import { setupAdmin } from "./reports.js";

async function startApp() {
  const appId = import.meta.env.VITE_BASE44_APP_ID;
  if (!appId)
    throw Error(
      "Set VITE_BASE44_APP_ID to the private trial app ID and rebuild to open the tracker.",
    );
  const api = createClient({
    appId,
    token: getAccessToken(),
    appBaseUrl: location.origin,
  });
  let me;
  try {
    me = await api.auth.me();
  } catch (e) {
    if (![401, 403].includes(e.status ?? e.response?.status)) throw e;
    $("status").textContent = "Sign in with your invited team account. ";
    const sign = el("button", "Sign in");
    sign.onclick = () => api.auth.loginWithProvider("google", location.href);
    $("status").append(sign);
    return;
  }
  const entries = api.entities.TimeEntry;
  let active = [];
  const email = me.email.toLowerCase();
  $("account").hidden = false;
  $("account").onclick = () => api.auth.logout(location.origin);
  $("personal").hidden = false;
  choices($("client"), clients);
  function setMatters() {
    choices($("matter"), matters($("client").value), "Choose a matter");
  }
  setMatters();
  $("client").onchange = setMatters;
  function tick() {
    $("elapsed").textContent = clock(
      active.length
        ? Math.max(
            0,
            Math.floor(
              (Date.now() - Date.parse(active[0].created_date)) / 1000,
            ),
          )
        : 0,
    );
  }
  async function refresh() {
    const [own, imports] = await Promise.all([
      all(entries, { created_by: me.email }),
      all(api.entities.ClockifyEntry, { email }),
    ]);
    active = own.filter((x) => x.kind === "timer" && !x.stopped_at);
    $("timer").hidden = active.length > 0;
    $("running").replaceChildren();
    for (const row of active) {
      const stop = el("button", "Stop timer");
      const display = el("output");
      if (row === active[0]) {
        display.id = "liveElapsed";
      }
      $("running").append(
        el("h3", row.description),
        el("p", row.client + " · " + row.matter),
        display,
        stop,
      );
      action(stop, async () => {
        await entries.update(row.id, {
          stopped_at: new Date(
            Math.max(Date.now(), Date.parse(row.created_date)),
          ).toISOString(),
        });
        await refresh();
      });
    }
    tick();
    const rows = [...own.flatMap(dailyRows), ...imports].sort((a, b) =>
      b.day.localeCompare(a.day),
    );
    const today = dayOf(Date.now());
    for (const [id, prefix] of [
      ["today", today],
      ["month", today.slice(0, 7)],
      ["year", today.slice(0, 4)],
    ]) {
      $(id).textContent =
        hours(
          rows
            .filter((r) => r.day.startsWith(prefix))
            .reduce((sum, r) => sum + r.seconds, 0),
        ) + " h";
    }
    $("history").replaceChildren();
    table(
      $("history"),
      ["Date (CT)", "Client / matter", "Description", "Hours"],
      rows.map((r) => [
        r.day,
        r.client + " / " + r.matter,
        r.description,
        hours(r.seconds),
      ]),
    );
  }
  setInterval(() => {
    tick();
    if ($("liveElapsed"))
      $("liveElapsed").textContent = $("elapsed").textContent + " ";
  }, 1000);
  action($("start"), async () => {
    if (!$("timer").reportValidity() || !$("description").value.trim()) return;
    const start = async () => {
      await refresh();
      if (active.length) return;
      await entries.create({
        kind: "timer",
        client: $("client").value,
        matter: $("matter").value,
        description: $("description").value.trim(),
        day: dayOf(Date.now()),
      });
      $("description").value = "";
      await refresh();
    };
    if (navigator.locks)
      await navigator.locks.request("sywtc-timer-" + me.id, start);
    else await start();
  });
  function draft(value = {}) {
    const box = el("fieldset"),
      legend = el("legend", "Review time entry");
    box.append(legend);
    const client = field(box, "Client", choices(el("select"), clients));
    client.value = value.client || clients[0];
    const matter = field(box, "Matter", el("select"));
    const update = () =>
      choices(matter, matters(client.value), "Choose a matter");
    update();
    matter.value = value.matter || "";
    client.onchange = update;
    const desc = field(box, "Description", el("input"));
    desc.value = value.description || "";
    desc.maxLength = 1500;
    const date = field(box, "Work date (CT)", el("input"));
    date.type = "date";
    date.value = date.max = dayOf(Date.now());
    const duration = field(box, "Hours", el("input"));
    duration.type = "number";
    duration.step = "any";
    duration.min = "0.00028";
    duration.max = "24";
    duration.value = value.hours ?? "";
    const save = el("button", "Confirm and save"),
      remove = el("button", "Discard");
    box.append(save, remove);
    $("drafts").append(box);
    remove.onclick = () => box.remove();
    action(save, async () => {
      for (const input of [matter, desc, date, duration]) {
        input.required = true;
        if (!input.reportValidity()) return;
      }
      if (!desc.value.trim()) throw Error("Enter an activity description.");
      await entries.create({
        kind: "manual",
        client: client.value,
        matter: matter.value,
        description: desc.value.trim(),
        day: date.value,
        seconds: Math.round(Number(duration.value) * 3600),
      });
      box.remove();
      await refresh();
    });
  }
  $("manual").onclick = () => draft();
  action($("review"), () => {
    const parts = parseVoice($("speech").value);
    if (!parts.length)
      throw Error(
        "Include a duration, such as “two hours on BWSL emails”, or choose Add manually.",
      );
    parts.forEach(draft);
    $("speech").value = "";
  });
  action($("dictate"), () => {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech)
      throw Error(
        "Voice input is unavailable in this browser. Type your summary or use device dictation.",
      );
    const recognition = new Speech();
    recognition.lang = "en-US";
    recognition.onresult = (e) => {
      $("speech").value +=
        ($("speech").value ? " " : "") + e.results[0][0].transcript;
    };
    recognition.onerror = (e) => {
      $("status").textContent =
        "Dictation ended: " + e.error + ". You can type your summary.";
    };
    recognition.onend = () => {
      $("dictate").textContent = "Dictate";
    };
    recognition.start();
    $("dictate").textContent = "Listening…";
  });
  $("status").textContent = "";
  if (me.role === "admin") setupAdmin(api, refresh);
  await refresh();
}
startApp().catch((error) => {
  $("status").textContent = error.message;
});
