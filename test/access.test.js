import test from "node:test";
import assert from "node:assert/strict";
import {trackerAction} from "../base44/functions/trackerAccess/policy.js";
const company = "@ashleynicolekirkwood.com";
const user = local => ({email:local+company,is_verified:true});
function entity(rows = []) {
  return {
    list:async (_,limit,skip)=>rows.slice(skip,skip+limit),
    filter:async (where,_,limit,skip=0)=>rows.filter(r=>Object.entries(where).every(([k,v])=>r[k]===v)).slice(skip,skip+limit),
    create:async data=>rows.push({...data,id:String(rows.length+1)}),
    update:async (id,data)=>Object.assign(rows.find(p=>p.id===id),data),
  };
}
function database() {
  return {TeamProfile:entity([
    {id:"1",email:user("supervisor").email,access_level:"Team Manager"},
    {id:"2",email:user("worker").email,manager_email:user("supervisor").email,salary:98765,target:1900},
    {id:"3",email:user("other").email,job_role:"CEO"},
  ]), TimeEntry:entity([{created_by:user("worker").email,description:"Assigned work"},{created_by:user("other").email,description:"Outside team"}]),
  ClockifyEntry:entity(),User:entity()};
}
test("the five named accounts default to Full Admin only after verification", async()=>{
  for (const local of ["ashley","chris","danielle","marvic","jim"]) {
    const who=user(local);
    assert.equal((await trackerAction(who,database(),{action:"session"})).access,"Full Admin");
    await assert.rejects(trackerAction({...who,is_verified:false},database(),{action:"reports"}),{status:403});
  }
});
test("employee cannot elevate with a title, platform role, or forged request",async()=>{
  const who={...user("other"),role:"admin"};
  assert.equal((await trackerAction(who,database(),{action:"session",access:"Full Admin"})).access,"Employee");
  for (const action of ["team","reports","saveProfile","import"]) {
    await assert.rejects(trackerAction(who,database(),{action,email:user("ashley").email}),{status:403});
  }
});
test("manager receives only assigned work and KPI, with no salary fields",async()=>{
  const team=await trackerAction(user("supervisor"),database(),{action:"team",email:user("other").email});
  assert.equal(team.length,1); assert.equal(team[0].target,1900);
  assert.deepEqual(team[0].entries.map(x=>x.description),["Assigned work"]);
  assert.ok(!("salary" in team[0]));
  for(const action of ["reports","saveProfile","import"]) await assert.rejects(trackerAction(user("supervisor"),database(),{action}),{status:403});
});
test("admin can end development access and employee gets only own target",async()=>{
  const db=database();
  await trackerAction(user("ashley"),db,{action:"saveProfile",profile:{email:user("jim").email,name:"Jim",job_role:"AI Engineer",access_level:"Employee",target:2000,cost_basis:2000}});
  await assert.rejects(trackerAction(user("jim"),db,{action:"reports"}),{status:403});
  assert.deepEqual(await trackerAction(user("worker"),db,{action:"session",email:user("ashley").email}),{access:"Employee",target:1900});
});
