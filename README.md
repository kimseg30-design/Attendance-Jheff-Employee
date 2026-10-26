# Sahod — PH Attendance & Payroll

The app contains employee, attendance, leave, payroll, cash advance, loan, Sinking Fund, reporting, and user access modules.

- Frontend: Vite + React in `client/`
- Backend: Express in `server/`, exposed through Vercel at `/api`
- Authentication and PostgreSQL: Supabase Auth and Postgres

## Local setup

1. Copy `.env.example` to `.env` and configure the Supabase URL, server-only key, browser Auth key, initial admin email(s), and app URL.
2. Never put `SUPABASE_SERVICE_ROLE_KEY` in a `VITE_` variable or commit a real key.
3. In Supabase, apply `schema.sql`, `sinking_fund.sql`, `app_tables.sql`, the feature migrations needed by the deployment (including `weekly_sinking_contribution.sql` when using weekly contributions), then `payroll_atomic_operations.sql`. These payroll functions keep release/deletion ledger changes in one transaction. Review `security_hardening.sql` against the live policies and server key before applying it.
4. Do not run `enable_rls_policies.sql` or `grant_publishable_access.sql` against production payroll data; they enable broad direct database access.
5. Run `npm install`, then `npm run dev` and open the URL printed by Vite.

## Production setup

Configure the variables from `.env.example` in the hosting environment. Set Supabase Auth redirect URLs for the production domain and verify the server-only key before enabling payroll traffic. The app requires a valid Supabase access token for API requests; demo login and local role simulation are disabled.

Run `npm run build` to create the client bundle. The Vercel deployment guide is in `VERCEL.md`.