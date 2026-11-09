const domain = "@ashleynicolekirkwood.com";
const initialAdmins = new Map([
  ["ashley", "Ashley Kirkwood"], ["chris", "Chris Kirkwood"],
  ["danielle", "Danielle Adams"], ["marvic", "Marvic Therese"], ["jim", "Jim Rodmark Camus"],
].map(([local, name]) => [local + domain, name]));
const roles = ["Employee", "Team Manager", "Full Admin"];
const normalize = value => String(value ?? "").trim().toLowerCase();
const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
function reject(status, message) {
  throw Object.assign(new Error(message), {status});
}
function roleOf(email, profile) {
  return profile?.access_level ?? (initialAdmins.has(email) ? "Full Admin" : "Employee");
}
async function list(entity, filter) {
  const rows = [];
  for (let skip = 0; ; skip += 100) {
    const page = filter ? await entity.filter(filter, "id", 100, skip) : await entity.list("id", 100, skip);
    rows.push(...page);
    if (page.length < 100) return rows;
  }
}
function publicProfile(p) {
  return {email:p.email, name:p.name, target:p.target || 2000};
}
export async function trackerAction(user, db, body) {
  const email = normalize(user?.email);
  if (!email || user.is_verified !== true) reject(403, "A verified sign-in is required.");
  const profiles = await db.TeamProfile.filter({email}, "id", 2);
  if (profiles.length > 1) reject(409, "Duplicate team profiles need administrator review.");
  const own = profiles[0];
  const access = roleOf(email, own);
  if (body.action === "session") return {access, target:own?.target || 2000};

  if (body.action === "team") {
    if (access !== "Team Manager") reject(403, "Team Manager access required.");
    const team = (await list(db.TeamProfile, {manager_email:email})).filter(p => normalize(p.manager_email) === email);
    const result = [];
    for (const p of team) {
      const [entries, history] = await Promise.all([
        list(db.TimeEntry, {created_by:p.email}), list(db.ClockifyEntry, {email:p.email}),
      ]);
      const fields = r => ({day:r.day, client:r.client, matter:r.matter, description:r.description,
        seconds:r.seconds, kind:r.kind, created_date:r.created_date, stopped_at:r.stopped_at});
      result.push({...publicProfile(p), entries:entries.map(fields), history:history.map(fields)});
    }
    return result;
  }
  if (access !== "Full Admin") reject(403, "Full Admin access required.");
  if (body.action === "reports") {
    const [timed, history, team, accounts] = await Promise.all([
      list(db.TimeEntry), list(db.ClockifyEntry), list(db.TeamProfile), list(db.User),
    ]);
    const existing = new Map(team.map(p => [p.email,p]));
    for (const [address,name] of initialAdmins) {
      if (!existing.has(address)) existing.set(address,{email:address,name});
    }
    return {timed, history, team:[...existing.values()].map(p=>({...p,access_level:roleOf(p.email,p)})),
      accounts:accounts.map(u=>({email:u.email,full_name:u.full_name}))};
  }
  if (body.action === "saveProfile") {
    const p = body.profile || {};
    const address = normalize(p.email);
    if (!validEmail(address) || !roles.includes(p.access_level) || !p.name?.trim() ||
        !p.job_role?.trim() || !Number.isFinite(p.target) || p.target < 1 ||
        !Number.isFinite(p.cost_basis) || p.cost_basis < 1) reject(400, "Check the member details and access level.");
    if (address === email && p.access_level !== "Full Admin") reject(400, "Ask another Full Admin to change your access.");
    const manager = normalize(p.manager_email);
    if (manager) {
      if (!validEmail(manager) || manager === address) reject(400, "Choose another team member as manager.");
      const matches = await db.TeamProfile.filter({email:manager}, "id", 2);
      if (matches.length !== 1 || matches[0].access_level !== "Team Manager") reject(400,"Assign the supervisor Team Manager access first.");
    }
    const data = {email:address,name:p.name.trim(),job_role:p.job_role.trim(),target:p.target,
      cost_basis:p.cost_basis,work_location:p.work_location || "",manager_email:manager,access_level:p.access_level};
    if (p.salary != null) {
      if (!Number.isFinite(p.salary) || p.salary < 0) reject(400, "Check the annual salary.");
      data.salary = p.salary;
    }
    const matches = await db.TeamProfile.filter({email:address},"id",2);
    if (matches.length > 1) reject(409,"Resolve duplicate team profiles before editing.");
    if (matches.length) await db.TeamProfile.update(matches[0].id,data);
    else await db.TeamProfile.create(data);
    return {saved:true};
  }
  if (body.action === "import") {
    const rows = body.rows;
    if (!Array.isArray(rows) || rows.length > 100) reject(400,"Invalid import batch.");
    for (const r of rows) {
      if (!validEmail(r.email) || !r.import_key || !r.client || !r.matter ||
          !/^\d{4}-\d{2}-\d{2}$/.test(r.day) || !Number.isFinite(r.seconds) || r.seconds <= 0) reject(400,"Invalid Clockify entry.");
    }
    for (const r of rows) {
      const existing = await db.ClockifyEntry.filter({import_key:r.import_key},"id",1);
      if (!existing.length) await db.ClockifyEntry.create({email:normalize(r.email),import_key:r.import_key,
        client:r.client,matter:r.matter,day:r.day,seconds:r.seconds,description:r.description || ""});
    }
    return {saved:true};
  }
  reject(400,"Unknown action.");
}
