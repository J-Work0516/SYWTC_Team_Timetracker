import test from "node:test";
import assert from "node:assert/strict";
import { clients, matters, parseVoice, dailyRows } from "../src/tracking.js";
import { readClockify } from "../src/import.js";
import { readFileSync } from "node:fs";
test("all clients, seven books and the written trip catalog", () => {
  assert.equal(clients.length, 6);
  assert.equal(
    matters(clients[0]).filter((x) => x.startsWith("Books /")).length,
    7,
  );
  assert.deepEqual(
    matters(clients[2]).filter((x) => x.endsWith("Trip")),
    ["Ghana Trip", "Thailand Trip", "Bali Trip"],
  );
});
test("Ashley’s spoken example yields two separately confirmable rows", () => {
  const rows = parseVoice(
    "I spent two hours on BWSL emails and one hour in a Mastermind meeting",
  );
  assert.deepEqual(
    rows.map((r) => [r.matter, r.hours]),
    [
      ["Black Women Sell Live", 2],
      ["Speak Your Way To Cash Mastermind", 1],
    ],
  );
  assert.equal(parseVoice("30 minutes on Jamaica retreat")[0].hours, 0.5);
  assert.equal(parseVoice("1 hour on something unfamiliar")[0].matter, "");
});
test("Central daylight saving transition and overnight allocation", () => {
  const rows = dailyRows({
    kind: "timer",
    created_date: "2026-11-01T04:30:00Z",
    stopped_at: "2026-11-02T06:30:00Z",
  });
  assert.deepEqual(
    rows.map((r) => [r.day, r.seconds]),
    [
      ["2026-10-31", 1800],
      ["2026-11-01", 90000],
      ["2026-11-02", 1800],
    ],
  );
  assert.deepEqual(dailyRows({ kind: "timer" }), []);
});
const csv =
  'Email,Start Date,Start Time,Client,Project,Description,Duration (h)\nmember@example.com,11/03/2026,09:00,Example,Planning,"Prep, review",01:15:00';
test("Clockify detailed CSV handles quoted text and stable repeat keys", () => {
  const [row] = readClockify(csv);
  assert.equal(row.description, "Prep, review");
  assert.equal(row.seconds, 4500);
  assert.equal(row.day, "2026-11-03");
  assert.deepEqual(readClockify(csv), [row]);
});
test("invalid import rows block preview", () => {
  assert.throws(() => readClockify(csv.replace("11/03", "02/31")), /row 2/);
  assert.throws(
    () => readClockify(csv.replace("01:15:00", "1:99:00")),
    /duration/,
  );
});
test("salary and historical writes require an administrator", () => {
  const schema = (name) =>
    JSON.parse(
      readFileSync(
        new URL("../base44/entities/" + name + ".jsonc", import.meta.url),
      ),
    );
  for (const permission of Object.values(schema("TeamProfile").rls))
    assert.deepEqual(permission, { user_condition: { role: "admin" } });
  assert.deepEqual(schema("TimeEntry").rls.update, {
    created_by: "{{user.email}}",
  });
  assert.deepEqual(schema("ClockifyEntry").rls.create, {
    user_condition: { role: "admin" },
  });
});

test("daily totals combine matters while keeping each person and date separate", async () => {
  const { dailyTotals, catalogLabel } = await import("../src/tracking.js");
  const first = { email: "a@example.org", day: "2026-11-09", seconds: 3600 };
  const second = { ...first, email: "b@example.org" };
  const third = { ...first, day: "2026-11-08" };
  assert.deepEqual(dailyTotals([first, { ...first, matter: "Emails" }, second, third]),
    [{ ...first, seconds: 7200 }, second, third]);
  assert.equal(catalogLabel("Ghana Trip"), "401 · Ghana Trip");
  assert.equal(catalogLabel("Imported project"), "Imported project");
});

test("activity estimates use the same rate for each report level", async () => {
  const { estimatedCost } = await import("../src/reports.js");
  const profile = { salary: 60000, cost_basis: 2000 };
  assert.equal(estimatedCost(5400, profile), 45);
  assert.equal(estimatedCost(3600, profile) + estimatedCost(1800, profile), 45);
  assert.equal(estimatedCost(3600, { salary: 0, cost_basis: 2000 }), 0);
  assert.equal(estimatedCost(3600, undefined), null);
  assert.equal(estimatedCost(3600, { salary: 60000, cost_basis: 0 }), null);
});
