# Database Connection & Secret Key Purge

Configure the PH Attendance & Payroll application to communicate with the target Supabase instance using the public REST endpoint and publishable API key, while purging all exposed secret key references from client and server layers with robust offline fallback.

### User Review & Critical Decisions

> [!IMPORTANT]
> The secret service-role key (`sb_secret_...`) is being completely removed and will not be used anywhere in the codebase. All queries from the server and browser will use the publishable key (`sb_publishable_0uYtc2gANKbcM2trdrO8zA_DINcfSiZ`) or authenticated user session tokens.

- **Confirmed Decision (Fallback Mode)**: Use publishable key for all Supabase calls, with automatic, transparent in-memory fallback if queries fail, time out, or encounter unconfigured tables/policies.
- **Confirmed Decision (Key Purge)**: Completely eliminate any lingering secret key references across the entire codebase, environment templates, and server bundles.

---

### 1. Overview & Core Concept

- **What It Does**: Establishes persistent live communication between the Sahod payroll application and the remote Supabase database (`https://xurvumenaszahorrxhxf.supabase.co`), allowing employee records, attendance entries, payslips, leaves, cash advances, and sinking fund operations to persist to PostgreSQL tables while remaining fully operational even in constrained network environments.
- **Target Audience**: HR administrators, payroll managers, and sinking fund officers managing daily operations.
- **Key Value**: Secure database access via standard publishable credentials without exposing elevated backend secrets, paired with an unbreakable fallback that guarantees continuous business operations.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  - *Startup & Dashboard*: The application checks database connectivity and loads live department counts, attendance metrics, and payroll summaries.
  - *Authentication*: Users authenticate via Supabase Auth (or the pre-approved administrative session) using the publishable key.
  - *Data Management*: Adding, updating, or deleting employees, attendance records, loans, or contributions directly synchronizes with remote Supabase tables.
- **Visual Identity & Theme**:
  - *Aesthetic*: Clean administrative interface utilizing existing Tailwind slate and indigo accents.
  - *Feedback*: Subtle connection and sync status notifications when saving records, with immediate error handling toasts if network interruptions occur.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: URL Normalization**
  - *Chosen Approach*: Accept the user-provided URL (`https://xurvumenaszahorrxhxf.supabase.co/rest/v1/`) and automatically normalize to the Supabase project origin (`https://xurvumenaszahorrxhxf.supabase.co`) so both the PostgREST REST API (`/rest/v1/*`) and the Supabase Auth API (`/auth/v1/*`) resolve properly.
  - *Why*: Passing `/rest/v1/` to the Supabase client library directly breaks Auth sub-endpoints (`/auth/v1/token`), whereas normalizing the origin allows both Auth and REST to function smoothly.

- **Decision 2: Client & Server Publishable Credential Strategy**
  - *Chosen Approach*: Configure both the client-side Supabase client and server-side RPC proxy with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` / `SUPABASE_PUBLISHABLE_KEY`.
  - *Why*: Keeps sensitive elevated credentials off the system, relying on Row Level Security (RLS) and authenticated user Bearer tokens.

- **Decision 3: Transparent Memory Fallback Shield**
  - *Chosen Approach*: If remote database requests fail due to missing tables, RLS policy denials, or container sandbox networking limits, the server falls back to `memoryStore.js` without crashing or returning 500 errors to the UI.
  - *Why*: Prevents downtime and ensures users can continuously test and demo all payroll and sinking fund features.

---

### 4. Technical Architecture & Data Strategy

#### Architecture & Component Diagram

```
┌───────────────────────────────────────────────────────────────┐
│                      Client (React SPA)                       │
│  - App.jsx / Layout / Pages (Attendance, Payroll, SF)        │
│  - Supabase Client (Publishable Key Only)                     │
└───────────────────────────────┬───────────────────────────────┘
                                │ HTTP /api/* (RPC Calls)
                                ▼
┌───────────────────────────────────────────────────────────────┐
│                     Server (Express.js)                       │
│  - Endpoints (getDashboard, listRecords, saveRecord, etc.)    │
│  - Auth User Token Resolution (Bearer JWT / Demo Admin)       │
└───────────────┬───────────────────────────────┬───────────────┘
                │ Live Fetch (Publishable Key)  │ Unreachable / Error
                ▼                               ▼
┌───────────────────────────────┐ ┌─────────────────────────────┐
│  Remote Supabase Database     │ │ In-Memory Fallback Store    │
│  https://xurvumenaszahorrxhxf │ │ memoryStore.js (Local Seed) │
│  - PostgREST /rest/v1/*       │ └─────────────────────────────┘
│  - Auth /auth/v1/*            │
└───────────────────────────────┘
```

#### Step-by-Step Implementation Sequence

1. **Environment Configuration**:
   - Update `.env.example` and active environment settings with the normalized Supabase URL (`https://xurvumenaszahorrxhxf.supabase.co`) and publishable key (`sb_publishable_0uYtc2gANKbcM2trdrO8zA_DINcfSiZ`).
   - Remove any references or placeholders for `SUPABASE_SECRET_KEY` or `ZITE_API_KEY`.

2. **Server Supabase Client & REST Handlers**:
   - Update `server/src/lib/supabase.js` and `server/src/zite/db.js` to accept the URL and publishable key.
   - Strip any fallback references to secret keys.
   - Maintain the automatic fallback to `memoryStore.js` when queries encounter network barriers or table errors.

3. **Client Supabase Client**:
   - Update `client/src/zite/supabaseClient.js` with the clean URL and publishable key.
   - Ensure the client build cleanly bundles without any secret key remnants.

4. **Verification & Testing**:
   - Run a clean build (`npm run build`) and server endpoint tests.
   - Validate live queries and seamless UI loading.
