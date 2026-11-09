import Papa from "papaparse";
export function readClockify(csv) {
  const parsed = Papa.parse(csv.replace(/^\uFEFF/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  if (parsed.errors.length)
    throw Error("CSV could not be read. " + parsed.errors[0].message);
  return parsed.data.map((row, index) => {
    const fail = (message) => {
      throw Error("CSV row " + (index + 2) + " — " + message);
    };
    const email = (row.email || row["user email"] || "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email))
      fail("Include the team member’s email in the detailed export.");
    const input = (row["start date"] || "").trim();
    const usDate = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input);
    const day = usDate
      ? [
          usDate[3],
          usDate[1].padStart(2, "0"),
          usDate[2].padStart(2, "0"),
        ].join("-")
      : input;
    const date = new Date(day + "T12:00:00Z");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
      !Number.isFinite(+date) ||
      date.toISOString().slice(0, 10) !== day
    )
      fail("Use YYYY-MM-DD or US month/day/year.");
    const duration = (row["duration (h)"] || row.duration || "").trim();
    const hms = /^(\d+):([0-5]\d):([0-5]\d)$/.exec(duration);
    const decimal = row["duration (decimal)"]?.trim();
    const seconds = hms
      ? +hms[1] * 3600 + +hms[2] * 60 + +hms[3]
      : decimal
        ? Math.round(Number(decimal) * 3600)
        : NaN;
    if (!Number.isFinite(seconds) || seconds <= 0)
      fail("Include a positive duration in h:mm:ss or decimal hours.");
    const client = row.client?.trim(),
      matter = row.project?.trim() || row.task?.trim();
    if (!client || !matter) fail("Include a client and project or task.");
    const description = row.description?.trim() || "";
    const start = row["start time"]?.trim();
    if (!row["time entry id"] && !start)
      fail("Include Start Time or Time Entry ID for repeatable imports.");
    const import_key =
      row["time entry id"] ||
      JSON.stringify([email, day, start, client, matter, description, seconds]);
    return { email, day, client, matter, description, seconds, import_key };
  });
}
