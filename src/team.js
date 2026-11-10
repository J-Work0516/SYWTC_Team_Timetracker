import { $, action, el, table } from "./ui.js";
import { dailyRows, dayOf, hours } from "./tracking.js";

export function setupManager(request, refreshPersonal) {
  const nav = $("adminNav");
  nav.hidden = false;
  nav.textContent = "My team";
  action(nav, async () => {
    $("personal").hidden = true;
    $("managed").hidden = false;
    nav.setAttribute("aria-current","page");
    $("myNav").removeAttribute("aria-current");
    const output = $("teamHours");
    output.replaceChildren();
    const team = await request("team");
    if (!team.length) output.append(el("p","No employees are assigned to you."));
    const year = dayOf(Date.now()).slice(0,4);
    for (const person of team) {
      const rows = [...person.entries.flatMap(dailyRows), ...person.history].sort((a,b)=>b.day.localeCompare(a.day));
      const total = rows.filter(r=>r.day.startsWith(year)).reduce((sum,r)=>sum+r.seconds,0);
      const section = el("article");
      section.append(el("h2",person.name || person.email),el("p",year+" progress: "+hours(total)+" / "+person.target+" hours"));
      table(section,["Date (ET)","Client","Matter","Activity","Hours"],rows.map(r=>[r.day,r.client,r.matter,r.description,hours(r.seconds)]));
      output.append(section);
    }
  });
  action($("myNav"),async()=>{
    $("managed").hidden = true;
    $("personal").hidden = false;
    $("teamHours").replaceChildren();
    nav.removeAttribute("aria-current");
    $("myNav").setAttribute("aria-current","page");
    await refreshPersonal();
  });
}
