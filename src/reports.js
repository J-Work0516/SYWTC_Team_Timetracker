import { dayOf, dailyRows, dailyTotals, hours } from "./tracking.js";
import { $, el, choices, field, table, action } from "./ui.js";
import { readClockify } from "./import.js";

export function estimatedCost(seconds, profile) {
  if (profile?.salary == null || !(profile.cost_basis > 0)) return null;
  return ((seconds / 3600) * profile.salary) / profile.cost_basis;
}

export function timeBreakdown(rows) {
  const clients = new Map();
  for (const {client, matter, seconds} of rows) {
    if (!clients.has(client)) clients.set(client, {client, seconds: 0, matters: new Map()});
    const group = clients.get(client);
    group.seconds += seconds;
    group.matters.set(matter, (group.matters.get(matter) || 0) + seconds);
  }
  return [...clients.values()].sort((a, b) => b.seconds - a.seconds || a.client.localeCompare(b.client));
}

function showBreakdown(parent, rows, total) {
  if (!total) return;
  parent.append(el("h3", "Time by client and matter"));
  for (const group of timeBreakdown(rows)) {
    const detail = el("details");
    detail.className = "time-breakdown";
    const share = (100 * group.seconds / total).toFixed(1) + "%";
    const summary = el("summary", group.client + " · " + hours(group.seconds) + " h · " + share);
    const bar = el("progress");
    bar.max = total;
    bar.value = group.seconds;
    bar.setAttribute("aria-hidden", "true");
    summary.append(bar);
    detail.append(summary);
    const matters = [...group.matters].sort(([a, x], [b, y]) => y - x || a.localeCompare(b));
    table(detail, ["Matter", "Hours", "Share of client time"], matters.map(([matter, seconds]) =>
      [matter, hours(seconds), group.seconds ? (100 * seconds / group.seconds).toFixed(1) + "%" : "—"]));
    parent.append(detail);
  }
}

export function setupAdmin(request, refreshPersonal) {

  let rows = [],
    profiles = [],
    users = [],
    imports = [];
  const filters = {},
    inputs = {};
  $("adminNav").hidden = false;
  const today = dayOf(Date.now()),
    year = Number(today.slice(0, 4));
  const years = Array.from({ length: 6 }, (_, i) => String(year - i));
  for (const [key, label, options] of [
    ["person", "Person", []],
    ["location", "Work location", ["Outside US", "US", "Unspecified"]],
    ["client", "Client", []],
    ["matter", "Matter", []],
    ["year", "Year", years],
    [
      "month",
      "Month",
      Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")),
    ],
    [
      "sort",
      "Sort by",
      ["Newest day", "Oldest day", "Person", "Client", "Matter", "Most hours"],
    ],
  ]) {
    filters[key] = field(
      $("filters"),
      label,
      choices(el("select"), options, key === "sort" ? null : "All"),
    );
    filters[key].onchange = render;
  }
  filters.date = field($("filters"), "Exact day", el("input"));
  filters.date.type = "date";
  filters.date.onchange = render;
  function showAdmin(show) {
    $("personal").hidden = show;
    $("admin").hidden = !show;
    $(show ? "adminNav" : "myNav").setAttribute("aria-current", "page");
    $(show ? "myNav" : "adminNav").removeAttribute("aria-current");
  }
  action($("adminNav"), async () => {
    showAdmin(true);
    await load();
  });
  action($("myNav"), async () => {
    showAdmin(false);
    await refreshPersonal();
  });
  for (const [key, label, type] of [
    ["email", "Team email", "email"],
    ["name", "Full name", "text"],
    ["job_role", "Team role", "text"],
    ["salary", "Annual salary (USD)", "number"],
    ["target", "Annual KPI hours", "number"],
    ["cost_basis", "Annual hours for cost estimate", "number"],
  ]) {
    const input = field($("profileFields"), label, el("input"));
    inputs[key] = input;
    input.type = type;
    input.required = key !== "salary";
    if (type === "number") {
      input.min = key === "salary" ? "0" : "1";
      input.step = key === "salary" ? "0.01" : "1";
    }
    if (key === "target" || key === "cost_basis") input.value = "2000";
  }
  inputs.access_level = field($("profileFields"), "Tracker access", choices(el("select"), ["Employee","Team Manager","Full Admin"]));
  inputs.manager_email = field($("profileFields"), "Assigned manager email (optional)", el("input"));
  inputs.manager_email.type = "email";
  inputs.work_location = field($("profileFields"), "Work location",
    choices(el("select"), ["US", "Outside US"], "Unspecified"));
  action($("profile").querySelector("button"), async () => {
    if (!$("profile").reportValidity()) return;
    const data = Object.fromEntries(
      Object.entries(inputs).map(([key, input]) => [key, input.value.trim()]),
    );
    data.email = data.email.toLowerCase();
    data.target = Number(data.target);
    data.cost_basis = Number(data.cost_basis);

    if (data.salary === "") delete data.salary;
    else data.salary = Number(data.salary);
    await request("saveProfile", {profile:data});
    await load();
    $("status").textContent = "Member details saved.";
  });
  async function load() {
    const {timed,history,team,accounts} = await request("reports");
    imports = history;
    profiles = team;
    users = accounts;
    rows = [
      ...timed.flatMap((r) =>
        dailyRows(r).map((x) => ({ ...x, email: r.created_by.toLowerCase() })),
      ),
      ...imports,
    ];
    for (const [key, values] of Object.entries({
      person: [
        ...users.map((u) => u.email.toLowerCase()),
        ...profiles.map((p) => p.email),
        ...rows.map((r) => r.email),
      ],
      client: rows.map((r) => r.client),
      matter: rows.map((r) => r.matter),
    })) {
      const previous = filters[key].value;
      choices(filters[key], [...new Set(values)].sort(), "All");
      filters[key].value = previous;
    }
    render();
  }
  function render() {
    const val = Object.fromEntries(
      Object.entries(filters).map(([k, v]) => [k, v.value]),
    );
    const earliest = String(year - 5) + today.slice(4);
    const byEmail = new Map(profiles.map((p) => [p.email, p]));
    const workLocation = (email) => byEmail.get(email)?.work_location || "Unspecified";
    const selected = rows.filter(
      (r) =>
        r.day >= earliest &&
        r.day <= today &&
        (!val.person || r.email === val.person) &&
        (!val.location || workLocation(r.email) === val.location) &&
        (!val.client || r.client === val.client) &&
        (!val.matter || r.matter === val.matter) &&
        (!val.year || r.day.startsWith(val.year)) &&
        (!val.month || r.day.slice(5, 7) === val.month) &&
        (!val.date || r.day === val.date),
    );
    const groups = new Map();
    let total = 0,
      cost = 0,
      unpriced = 0;
    for (const r of selected) {
      const key = JSON.stringify([r.email, r.day, r.client, r.matter]);
      const group = groups.get(key) || { ...r, seconds: 0 };
      group.seconds += r.seconds;
      groups.set(key, group);
      total += r.seconds;
      const estimate = estimatedCost(r.seconds, byEmail.get(r.email));
      if (estimate !== null) cost += estimate;
      else unpriced += r.seconds;
    }
    const money = (x) =>
      x.toLocaleString("en-US", { style: "currency", currency: "USD" });
    function displayCost(row) {
      const estimate = estimatedCost(row.seconds, byEmail.get(row.email));
      return estimate === null ? "—" : money(estimate);
    }
    $("report").replaceChildren(
      el("h3", hours(total) + " hours · " + money(cost) + " estimated cost"),
    );
    if (unpriced)
      $("report").append(
        el(
          "p",
          hours(unpriced) +
            " hours have no salary rate and are excluded from the cost.",
        ),
      );
    showBreakdown($("report"), selected, total);
    const sorted = [...groups.values()].sort((a, b) => {
      if (val.sort === "Most hours") return b.seconds - a.seconds;
      const prop = {
        Person: "email",
        Client: "client",
        Matter: "matter",
        "Oldest day": "day",
      }[val.sort];
      return prop ? a[prop].localeCompare(b[prop]) : b.day.localeCompare(a.day);
    });
    const days = dailyTotals(selected).sort((a, b) => {
      if (val.sort === "Most hours") return b.seconds - a.seconds;
      if (val.sort === "Person") return a.email.localeCompare(b.email) || b.day.localeCompare(a.day);
      const dateOrder = val.sort === "Oldest day" ? a.day.localeCompare(b.day) : b.day.localeCompare(a.day);
      return dateOrder || a.email.localeCompare(b.email);
    });
    $("report").append(el("h3", "Daily hours by team member"));
    table(
      $("report"),
      ["Person", "Date (CT)", "Hours"],
      days.map((r) => [byEmail.get(r.email)?.name || r.email, r.day, hours(r.seconds)]),
    );
    $("report").append(el("h3", "Program and activity costs"));
    table(
      $("report"),
      ["Person", "Date (CT)", "Client", "Matter", "Hours", "Est. cost"],
      sorted.map((r) => {
        const p = byEmail.get(r.email);
        return [
          p?.name || r.email,
          r.day,
          r.client,
          r.matter,
          hours(r.seconds),
          displayCost(r),
        ];
      }),
    );
    if (selected.length) {
      const detail = el("details");
      detail.append(el("summary", "Activity descriptions"));
      table(
        detail,
        ["Person", "Date (CT)", "Client", "Matter", "Activity", "Hours", "Est. cost"],
        selected.map((r) => [
          byEmail.get(r.email)?.name || r.email, r.day, r.client, r.matter,
          r.description, hours(r.seconds), displayCost(r),
        ]),
      );
      $("report").append(detail);
    }
    const kpiYear = val.year || String(year);
    $("directory").replaceChildren(el("p", "Annual progress for " + kpiYear));
    const directory = new Map(
      users.map((u) => [
        u.email.toLowerCase(),
        { email: u.email.toLowerCase(), name: u.full_name },
      ]),
    );
    for (const p of profiles) directory.set(p.email, p);
    for (const r of rows)
      if (!directory.has(r.email)) directory.set(r.email, { email: r.email });
    table(
      $("directory"),
      ["Person", "Job title", "Tracker access", "Work location", "Hours / target", "Progress", ""],
      [...directory.values()].filter((p) => !val.location || workLocation(p.email) === val.location).map((p) => {
        const target = p.target || 2000;
        const annual =
          rows
            .filter((r) => r.email === p.email && r.day.startsWith(kpiYear))
            .reduce((s, r) => s + r.seconds, 0) / 3600;
        const edit = el("button", "Edit");
        edit.onclick = () => {
          for (const [key, input] of Object.entries(inputs))
            input.value =
              p[key] ?? (key === "access_level" ? "Employee" : ["target", "cost_basis"].includes(key) ? 2000 : "");
          inputs.name.focus();
        };
        return [
          p.name || p.email,
          p.job_role || "Role needed",
          (p.access_level || "Employee") + (p.email === "jim@ashleynicolekirkwood.com" && p.access_level === "Full Admin" ? " (development · review at handoff)" : ""),
          workLocation(p.email),
          annual.toFixed(2) + " / " + target,
          ((annual / target) * 100).toFixed(1) + "%",
          edit,
        ];
      }),
    );
  }
  $("csv").onchange = async () => {
    const preview = $("importPreview");
    preview.replaceChildren();
    try {
      const file = $("csv").files[0];
      if (!file) return;
      const batch = readClockify(await file.text());
      const keys = new Set(imports.map((r) => r.import_key));
      const pending = batch.filter((r) => {
        if (keys.has(r.import_key)) return false;
        keys.add(r.import_key);
        return true;
      });
      preview.append(
        el(
          "p",
          pending.length +
            " new entries · " +
            (batch.length - pending.length) +
            " duplicates",
        ),
      );
      if (!pending.length) return;
      table(
        preview,
        ["First entries", "Date", "Client", "Hours"],
        pending
          .slice(0, 5)
          .map((r) => [r.email, r.day, r.client, hours(r.seconds)]),
      );
      const confirm = el("button", "Import " + pending.length + " entries");
      preview.append(confirm);
      action(confirm, async () => {
        const perform = async () => {
          for (let offset = 0; offset < pending.length; offset += 100)
            await request("import", {rows:pending.slice(offset,offset+100)});
        };
        if (navigator.locks)
          await navigator.locks.request("sywtc-clockify-import", perform);
        else await perform();
        preview.replaceChildren(el("p", "Import complete."));
        $("csv").value = "";
        await load();
      });
    } catch (e) {
      preview.textContent = e.message;
    }
  };
}
