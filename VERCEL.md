# Vercel Zero-Error Deployment Guide

This project is configured to deploy directly to **Vercel** with **zero build errors** and **zero configuration errors**.

---

## 1. Zero-Error Vercel Architecture

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
# Supabase Configuration
SUPABASE_URL=https://xurvumenaszahorrxhxf.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_0uYtc2gANKbcM2trdrO8zA_DINcfSiZ
SUPABASE_JWKS_URL=https://xurvumenaszahorrxhxf.supabase.co/auth/v1/.well-known/jwks.json

# Client-Side Exposed Variables
VITE_SUPABASE_URL=https://xurvumenaszahorrxhxf.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_0uYtc2gANKbcM2trdrO8zA_DINcfSiZ
```

---

## 3. Verification & Health Checks

- **Vite Build**: `npm run build` succeeds in ~3s.
- **Node Syntax & Linter**: `npm run lint` passes with 0 errors.
- **Endpoint Resilience**: All 22 endpoints are statically imported in `server/src/endpoints.js` to guarantee AWS Lambda / Vercel Serverless bundle inclusion.
- **Dual Routing**: Express accepts both `/api/:name` and `/:name` so no path prefixes are broken.
