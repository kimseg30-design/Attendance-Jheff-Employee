# Vercel Deployment Guide

This project is configured to deploy directly to **Vercel** with explicit server and browser configuration.

---

## 1. Vercel Architecture

- **Frontend (Vite SPA)**: Builds into `client/dist` and is distributed via Vercel's global Edge CDN.
- **Backend (Node.js API)**: Functions execute as Vercel Serverless Functions via `/api/index.js`, dynamically wrapping the Express backend (`server/src/app.js`).
- **Clean Rewrites**: Requests to `/api/(.*)` route directly to the `/api` serverless handler, while all other paths route to `/index.html` to support client-side React routing without 404s on page refresh.

### `vercel.json`
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "client/dist",
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

---

## 2. Environment Variables to Set on Vercel

In **Vercel -> Project Settings -> Environment Variables**, add:

```env
# Server-only Supabase credentials. Never add the server key with a VITE_ prefix.
SUPABASE_URL=https://xurvumenaszahorrxhxf.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-only-service-role-or-secret-key>
ADMIN_EMAILS=<comma-separated verified administrator email addresses>
APP_BASE_URL=https://attendance-jheff-employee.vercel.app

# Public browser credentials. Keep restrictive RLS enabled on every payroll table.
VITE_SUPABASE_URL=https://xurvumenaszahorrxhxf.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_0uYtc2gANKbcM2trdrO8zA_DINcfSiZ
```

The browser publishable key is used only for Supabase Auth. The server refuses API
requests without a verifiable Supabase access token and refuses database operations
without `SUPABASE_SERVICE_ROLE_KEY`. Do not run `enable_rls_policies.sql` or
`grant_publishable_access.sql`; both grant broad direct database access.

Before production traffic, set Auth redirect URLs for the production domain and
verify that the server-only key is configured in Vercel Production and Preview
environments as intended. The app no longer supports demo login or localStorage
role simulation.

---

## 3. Verification & Health Checks

- **Vite Build**: Run `npm run build` for the current result.
- **Node Syntax Check**: Run `npm run lint` for the current result.
- **Endpoint Resilience**: All 22 endpoints are statically imported in `server/src/endpoints.js` to guarantee AWS Lambda / Vercel Serverless bundle inclusion.
- **Dual Routing**: Express accepts both `/api/:name` and `/:name` so no path prefixes are broken.
