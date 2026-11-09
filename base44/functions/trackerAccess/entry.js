import { createClientFromRequest } from "npm:@base44/sdk@0.8.59";
import { trackerAction } from "./policy.js";

export default async function handler(req) {
  if (req.method !== "POST") return Response.json({error:"POST required."},{status:405});
  const api = createClientFromRequest(req);
  let user;
  try { user = await api.auth.me(); } catch { /* Missing or expired session. */ }
  if (!user) return Response.json({error:"Sign in first."},{status:401});
  try {
    return Response.json(await trackerAction(user, api.asServiceRole.entities, await req.json()));
  } catch (error) {
    return Response.json({error:error.status < 500 ? error.message : "Tracker request failed."},
      {status: [400,403,409].includes(error.status) ? error.status : 500});
  }
}
