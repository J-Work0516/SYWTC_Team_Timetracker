# SYWTC Team Time Tracker

First deliverable in the second trial. Team members select a client and matter, describe the activity, and run a timer or confirm individual entries from a spoken or typed summary. Full Admins can review daily activity, edit directory records, see annual KPI progress and estimated program costs, and preview Clockify Detailed Report CSVs before importing. Work dates and reporting periods use US Eastern time (America/New_York), including daylight saving. Timestamped timers are allocated by Eastern midnight. Manual and imported date-only records retain their assigned work dates. Export new Clockify CSVs in Eastern time. Annual salary is assumed to be USD. The default annual cost basis is 2,000 hours and is editable independently of the KPI target. Estimates apply the currently entered salary to historical hours.

## Run and deploy

Use Node 22.12 or later. Create or select the separate trial app in the correct Base44 workspace. The existing Command Center is the visual reference.

1. Run `npm ci` and `npm test`.
2. Sign in with `npx base44 login`, then run `npx base44 link` from this directory. Select the dedicated trial app or create it during linking.
3. Copy `.env.example` to `.env.local` and set the trial app's public ID in `VITE_BASE44_APP_ID`. For a GitHub-linked hosted build, configure the same build variable in the trial project.
4. Run `npm run build` and `npx base44 deploy`. The deployment includes the three entity schemas, the trackerAccess function and the frontend. Enable Google sign-in and keep the app private. Invite the approved testers and assign tracker access through the protected team profile form.
5. Test two distinct invite-only accounts. A member should see their own entries across logout and reload. An admin should see that member's entries and costs. As the member, directly request TeamProfile and another person's entries through the SDK and verify read denial or an empty result. Verify member writes to TeamProfile and ClockifyEntry are rejected.
6. Start and stop a timer across reload, confirm the two-activity BWSL example, then preview and import a representative Clockify file twice. Verify totals in the admin filters and that the second import creates zero additional rows. During initial testing, have one admin manage imports at a time.

The roster combines app users, seeded administrators and admin-maintained profiles. Verified sign-in defaults to Employee. The five designated administrators initially receive Full Admin through the server policy. Full Admins set Tracker access and Assigned manager email in Team reports. The job-title field is descriptive. A Team Manager can read only assigned employees’ hours and KPI targets. Employees can read their own timesheet and target. Salary profiles and company reports are served through the authenticated trackerAccess function. Review the AI Engineer’s development access at production handoff. Tracker access does not invite a user or grant Base44 workspace permissions. Personal records, CSVs and passwords belong outside this repository. Microphone capture uses browser speech recognition where available. Typed summaries and manual entry are available on other browsers. Confirm jurisdiction, retention policy and employee notice before rollout.

## Remaining trial builds

| Build | Acceptance condition | Input needed for live testing |
| --- | --- | --- |
| CEO dashboard | Daily leads and sales by program, processor disputes and recoveries, support replies and per-account social engagement | CRM/program mapping, Stripe, confirmation of the Commas product, PayPal, support mailbox, and Facebook/Instagram/TikTok accounts |
| Pitching agent | Conversational onboarding, daily researched opportunities, Penny-guided pitches, domain and mailbox provisioning, jurisdiction checks, suppression and paced multi-inbox sending up to 500 per client per day | Penny access, lead research and sending providers, sandbox domains/inboxes, sender identity and approved terms |
| Offer and pricing agent | Names the offer and each component, runs trademark searches, explains pricing grounded in the two books | Authorized copies of Speak Your Way To Cash and Millions From The Stage, trademark-search coverage and target markets |
| Webinar critique and builder | Transcribes Vimeo/YouTube/Zoom recordings, critiques in the coach's voice and drafts in the client's voice | Authorized pitch transcripts, book, permitted voice examples and test recordings |

Deliver each build with a tested live link, reviewer login and brief notes. Include a tone and accuracy sample for each client-facing agent.
