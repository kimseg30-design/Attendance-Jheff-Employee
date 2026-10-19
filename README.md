# Sahod — PH Attendance & Payroll (JavaScript + Node.js)

Same features as the Zite app: employees, departments, attendance (incl. half-day), leaves,
cash advances, payroll loans, semi-monthly payroll & payslips (release, bulk print, bulk delete),
reports/exports, the Sinking Fund module (members, contributions, loans, interest reconciliation,
audit trail), users & roles with invites, rate limiting, failure log and System health.

- **Frontend:** Vite + React (JavaScript) — `client/`
- **Backend:** Node.js + Express — `server/` (every file in `server/src/api` is a `POST /api/<name>` endpoint)
- **Database & sign-in:** Supabase (Postgres + Supabase Auth: email link and Google)

## Setup
1. In Supabase SQL editor run, in order: `supabase/schema.sql`, `supabase/sinking_fund.sql`, the other
   migration files, `supabase/security_hardening.sql`, then `supabase/app_tables.sql`.
2. Supabase → Authentication: enable Email (magic link) and Google; add `http://localhost:5173` and
   your production URL to Redirect URLs. Sign-ups are invite-only: invite people from the Users page
   (or Supabase → Authentication → Invite user).
3. Copy `client/.env.example` → `client/.env` and `server/.env.example` → `server/.env` and fill in.
4. `npm run install:all`
5. Development: `npm run dev:server` and `npm run dev:client`, open http://localhost:5173
6. Production: `npm run build` then `npm start` (Express serves the built app on `PORT`).
