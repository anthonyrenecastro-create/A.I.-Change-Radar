# AI Change Radar

**AZxAI Radar** is an evidence-backed intelligence and change-monitoring subscription service designed for small and midsize businesses (SMBs). Decision-makers select their industry and tracked AI vendors (OpenAI, Anthropic, Google Gemini, Microsoft Azure, AWS Bedrock, Mistral AI) to receive concise, factual weekly briefings answering five critical questions:

1. **What changed** (concise executive summary)
2. **Why it matters to their business** (industry-specific implications)
3. **Whether they should act** (action required vs review recommended vs no action needed, with deadlines)
4. **A practical next step** (proportionate checklist or mitigation)
5. **Public supporting sources** (direct quotes, official links, and content hashes)

---

## Architecture Overview

AI Change Radar adapts the proposal → critique → arbitration → commit → explanation-ledger pattern to typed business events and evidence claims:

```
[Official Vendor Feeds / Docs / Pricing]
                    │
                    ▼
       [Safe Ingestion Engine]  <--- SSRF protection, size caps, rate limits
                    │
                    ▼
      [Normalized Evidence Snapshots] <--- Baseline vs substantive diff vs cosmetic noise
                    │
                    ▼
     [Reasoning Role (Gemini 3.8 / Rules)] <--- Proposes brief items & deterministic $ delta
                    │
                    ▼
     [Critique Role (Gemini 3.8 / Rules)] <--- Adversarial claim audit, date match, quote check
                    │
                    ▼
    [Authoritative Publication Gate] <--- Reviewed Mode (default) vs Automatic Mode
                    │
                    ▼
     [Durable SQLite Publication Ledger]
                    │
                    ▼
 [Weekly Digest Generator & Idempotent Email Sandbox]
```

### Two Linked Business World Models

1. **Vendor State Model**:
   - Versioned, evidence-backed records for each tracked vendor and source.
   - Preserves product names, model deprecation dates, token rates, and security/privacy governance statements.
   - Distinguishes vendor published statements from independently verified behavior.
   - Unknown values are preserved as unknown; failed retrievals are flagged as incomplete coverage rather than "nothing changed".

2. **Customer Context Model**:
   - Tenant-scoped records for industry, selected vendors, delivery email, day, and urgency threshold.
   - Optional operational parameters (active seats, monthly token volume in millions, HIPAA BAA/confidential data handling).
   - Enables deterministic monthly dollar calculations (e.g., `40M tokens/mo × $0.50 rate cut = $20/mo savings`) rather than speculative guessing.

---

## Key Features & Safety Controls

- **Durable Storage**: Built-in zero-native-dependency SQLite via Node 22 (`DatabaseSync`) with schema migrations in `data/radar.sqlite`.
- **SSRF & Source Fetch Safety**: `safeFetch` blocks private IP ranges, loopback (`127.0.0.1`), link-local, and cloud metadata (`169.254.169.254`). Enforces 8s timeouts and 2MB response caps.
- **Baseline vs Change Detection**: The initial retrieval creates a baseline snapshot and emits zero change events. Only subsequent runs with substantive semantic diffs emit change events.
- **Cosmetic Noise Suppression**: Detects and ignores noisy timestamp updates, session nonces, and layout updates while preserving substantive facts.
- **Deduplication**: Hash-based deduplication (`sha256(vendor + category + title + effectiveDate)`) merges repeated announcements while preserving all supporting sources.
- **Autonomous Background Worker**: Runs scheduled ingestion (every 10m) and digest generation (every 15m) without requiring an open browser window.
- **Delivery Idempotency**: Unique keys (`email_digest:tenant:issue`) prevent duplicate customer emails across server restarts.
- **Billing Adapter**: Entitlement checking (Starter 3 vendors, Pro 8 vendors, Enterprise unlimited), HMAC SHA-256 webhook verification, and replay protection.
- **Email Sandbox**: Inspect rendered HTML emails directly in the UI without sending external emails.

---

## Local Development & Setup

### Prerequisites

- Node.js 22+
- npm

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Key configuration parameters:
- `GEMINI_API_KEY`: API key for Gemini 3.8 server-side reasoning and critique (optional; system cleanly falls back to deterministic rule engine if absent).
- `STRIPE_WEBHOOK_SECRET`: Secret for validating billing webhooks (defaults to sandbox key).
- `RESEND_API_KEY` / `SENDGRID_API_KEY`: Optional; if unset, emails route to the built-in inspectable Test Sandbox.

### 3. Run Automated Test Suite
```bash
npm test
```
Executes 10 comprehensive tests validating snapshot immutability, canonical serialization, SSRF blocking, baseline ingestion, cosmetic noise suppression, critique rejection of unsupported claims, deterministic price calculations, billing webhooks, and restart-safe delivery idempotency.

### 4. Run Development Server
```bash
npm run dev
```
Starts Express + Vite on `http://0.0.0.0:3000`.

### 5. Build for Production
```bash
npm run build
```

---

## Demonstration Persona Accounts

You can switch between personas directly in the top-right header dropdown:
1. **Acme Legal Partners LLP** (`managing-partner@acmelegal.com`): Legal & Professional Services, Pro Plan (OpenAI, Anthropic).
2. **Apex Health Systems** (`cto@apexhealthclinic.org`): Healthcare & Life Sciences, Starter Plan (Google Gemini, Microsoft Azure).
3. **CloudScale SaaS Inc** (`engineering@cloudscalesoftware.io`): Technology & Software, Enterprise Plan (OpenAI, Anthropic, AWS Bedrock, Mistral).
4. **System Editorial Owner**: Operations and Editorial Console with full review queue, live source inspection, and crawler controls.

---

## Limitations & Scope Boundaries

- **Weekly Digest Focus**: Real-time urgent paging, consulting services, and custom enterprise deployments are outside the initial offer scope.
- **Pricing Hypothesis**: Pricing by tracked vendor count is a testable hypothesis with configurable plans, not proven customer willingness-to-pay.
- **Connector Coverage**: Live connectors inspect publicly accessible HTML and JSON endpoints. Feeds behind authentication gates or interactive CAPTCHAs require manual editorial input.
- **LLM Grounding**: Agreement between reasoning and critique using the same foundation model is not calibrated external truth; all commercial claims must cite retrieved public source URLs.
