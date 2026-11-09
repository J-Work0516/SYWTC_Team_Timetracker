export const clients = [
  "Speak Your Way To Cash",
  "Mobile General Counsel",
  "Country Club of the Skies",
  "See Your Way To Cash",
  "Venture Your Way To Cash",
  "Bookkeeping Company",
];
const admin = [
  "Meetings",
  "Emails",
  "Travel",
  "Scheduling",
  "Documentation",
  "Operations",
].map((name) => "Admin Tasks / " + name);
const books = [
  "Speak Your Way To Cash",
  "Millions From The Stage",
  "Launch Your Way To Cash",
  "Sell Your Way To Cash",
  "Mastermind Your Way To Cash",
  "Ida B. Wells",
  "Black Women History",
].map((name) => "Books / " + name);
export function matters(client) {
  if (client === clients[0])
    return [
      ...admin,
      "Pitch Your Way To Cash Academy",
      "Sell Your Way To Cash Challenge",
      "Land Corporate Clients Using AI",
      "Black Women Sell Live",
      "Speak Your Way To Cash Mastermind",
      ...books,
    ];
  if (client === clients[2])
    return ["Ghana Trip", "Thailand Trip", "Bali Trip", ...admin];
  return admin;
}
export const dayOf = (time) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(time));
export const hours = (seconds) => (seconds / 3600).toFixed(2);
export function clock(seconds) {
  return [
    Math.floor(seconds / 3600),
    Math.floor(seconds / 60) % 60,
    seconds % 60,
  ]
    .map((x) => String(x).padStart(2, "0"))
    .join(":");
}
// Timed sessions are allocated to each Central calendar day, including DST transitions.
export function dailyRows(entry) {
  if (entry.kind !== "timer") return [entry];
  if (!entry.stopped_at) return [];
  let start = Math.floor(Date.parse(entry.created_date) / 1000);
  const end = Math.floor(Date.parse(entry.stopped_at) / 1000);
  const rows = [];
  while (start < end) {
    const day = dayOf(start * 1000);
    let low = start + 1,
      high = Math.min(start + 90001, end);
    if (dayOf((high - 1) * 1000) !== day) {
      while (low < high) {
        const mid = Math.floor((low + high) / 2);
        if (dayOf(mid * 1000) === day) low = mid + 1;
        else high = mid;
      }
      high = low;
    }
    rows.push({ ...entry, day, seconds: high - start });
    start = high;
  }
  return rows;
}
const numbers = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
];
export function parseVoice(text) {
  const normalized = text
    .toLowerCase()
    .replace(
      /\b(a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/g,
      (word) => String(Math.max(1, numbers.indexOf(word))),
    );
  const matches = [
    ...normalized.matchAll(
      /\b(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?)\b/g,
    ),
  ];
  return matches.map((match, i) => {
    const desc = normalized
      .slice(
        match.index + match[0].length,
        matches[i + 1]?.index ?? normalized.length,
      )
      .replace(/^\s*(on|in|for)\s+/, "")
      .replace(/[\s,.]+and\s*$/, "")
      .trim();
    let client =
      clients.find((x) => desc.includes(x.toLowerCase())) || clients[0];
    if (/ghana|thailand|bali/.test(desc)) client = clients[2];
    const choices = matters(client);
    const aliases = [
      ["bwsl", "Black Women Sell Live"],
      ["jamaica", "Speak Your Way To Cash Mastermind"],
      ["mastermind meeting", "Speak Your Way To Cash Mastermind"],
    ];
    const alias = aliases.find(([term]) => desc.includes(term));
    const matter =
      choices.find((x) => desc.includes(x.toLowerCase())) ||
      alias?.[1] ||
      choices.find((x) => desc.includes(x.split(" / ").at(-1).toLowerCase())) ||
      "";
    return {
      client,
      matter: choices.includes(matter) ? matter : "",
      description: desc,
      hours: Number(match[1]) / (match[2].startsWith("m") ? 60 : 1),
    };
  });
}
