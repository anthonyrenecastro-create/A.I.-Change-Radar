# AZxAI Navigator (Axiom Zeta Innovations)

Navigator is the companion to **AI Change Radar**.

| Product | Sells | Answers |
|---|---|---|
| Radar | Monitoring and evidence-backed briefings | “What changed at the vendors?” |
| Navigator | Workflow analysis, scenario planning, decision coordination | “How does it affect *our* workflows, and what do we do?” |

Journey: **Map my AI operations → see affected workflows → compare options → approve an action → record the outcome.**

| Screen | Question |
|---|---|
| My AI Operations | How does our business actually use AI? (inventory, dependency map + table) |
| Exposure | Where does this change touch my business? (confirmed / possible / insufficient information) |
| Decision Sandbox | What happens if we choose this option? (deterministic, versioned scenarios) |
| Action Workspace | Are we prepared, and who does what next? (plans, approval, rehearsals) |
| Decision History | Did our decision work, and what should we remember? |

Weekly Briefs remain as supporting context, linking each item to affected workflows.

## Repository note
This archive did not contain a Radar web app, SQLite store, auth, or billing code (only the pure pipeline in `src/engine/changeRadar.ts`). Navigator's accounts, roles, billing and throttling were therefore built here from scratch rather than patched. The earlier Thoth/HRM workbench is preserved as an optional dev-only lab ([docs/legacy-thoth-lab.md](docs/legacy-thoth-lab.md), `#/lab`).

## Setup
```bash
npm install
cp .env.example .env     # development defaults are fine
npm run dev              # http://localhost:3000, seeds a demo workspace; "Try the demo" on the sign-in page
```
Scripts: `npm run lint` (tsc), `npm test`, `npm run build`, `npm start` (production bundle), `npm run seed:demo`, `npm run admin:reset-password -- <email> <new-password>`.

Stack: React 19 + Vite, Express 5, TypeScript, SQLite (`better-sqlite3`), zod. Migrations run on start ([server/migrations.ts](server/migrations.ts)). Pure logic shared by server and client lives in [shared/](shared).

### Production
`NODE_ENV=production` requires `APP_URL` and `BILLING_WEBHOOK_SECRET` (≥ 24 chars) and refuses `ENABLE_LAB`. Public demo and demo seeding are off by default; if the demo is enabled it is a read-only viewer. Set `TRUST_PROXY=true` behind a proxy. Back up the SQLite file (`DATABASE_PATH`); to wipe a dev database delete the file (scenario revisions are immutable by trigger).

## Security model
- Passwords: scrypt with per-user salt, min 12 chars. Legacy unsalted SHA-256 hashes are accepted once and re-hashed on login; admin reset via `admin:reset-password`.
- Roles are server-controlled (`viewer < editor < admin < owner`). Registration creates a new tenant whose creator is owner; roles are never derived from email text. Only owners add members.
- Login/registration throttling per email and IP; session cookies are httpOnly, SameSite=Lax, secure in production; JSON-only mutations with origin check.
- Every customer record carries `tenant_id`; each query filters by it, relationship IDs are ownership-checked (404 across tenants) and composite foreign keys enforce it in SQLite.
- Paid access is granted **only** by verified billing webhooks (`POST /api/billing/webhook`, header `x-billing-signature: t=<unix>,v1=<hex HMAC-SHA256 of "t.rawBody">`, 5-minute tolerance, idempotent by event id). There is no customer upgrade endpoint. Invalid signatures get 400; a missing secret gets 503.
- Demo data is flagged (`is_demo`), isolated per tenant and in the change feed, and never visible to real tenants.

## Commercial configuration
All plan names/limits live in [server/commercial.ts](server/commercial.ts): monitoring (`none`, `radar_5`, `radar_15`, `radar_unlimited`) and Navigator (`none`, `evaluation`, `navigator`) are separate entitlements; the `navigator_radar_linked` product grants Navigator plus linked read access to the feed without a second monitoring charge. No prices are defined here. The evaluation workflow limit is a placeholder.

## Radar integration
Published changes are read through the `ChangeFeedAdapter` interface ([server/radar.ts](server/radar.ts)). The only implementation is `LocalPipelineAdapter` over the local change pipeline. A future authenticated Radar client can implement the same interface; no live Radar API is assumed.

## Method and limits
- Matching is rule-based and explained (model named, model mentioned, vendor-wide, downstream dependency, missing data). Missing inventory data yields “insufficient information”, never “not affected”.
- Scenario math is deterministic with visible formulas; input and output tokens are priced separately; seats are separate; unknown values are never treated as zero. Low/expected/high are sensitivity cases, not confidence intervals. All rates are user-entered or evidence-linked and dated; no prices, benchmarks or compliance claims are supplied.
- Scenario revisions are append-only (DB triggers block update/delete). Approved plans stay bound to the approved revision and content hash; editing approved content returns the plan to draft.
- Rehearsals are labeled simulations stored separately; they never enter the change feed.
- Forecast vs observed is compared only when currency, period and scope match.
- Past-decision recall explains its basis (same workflow / vendor / change type). No learning or prediction is implemented.
- Navigator never changes vendor accounts or infrastructure. AI-drafted checklists are not implemented; templates are generic, editable and unverified.

See [docs/navigator-demo-walkthrough.md](docs/navigator-demo-walkthrough.md).
