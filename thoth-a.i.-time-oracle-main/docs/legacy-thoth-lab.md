# Thoth Ecology: AI Ecosystem Digital Twin Runtime

This project specializes the HRM Ecology architecture into a digital-twin world model for forecasting AI ecosystem evolution.

The implementation preserves the original substrate principles:

- common immutable snapshot for all mechanisms
- proposal-only mechanisms (no direct mutation)
- arbitration and singular commit
- explanation ledger and conservation diagnostics
- consequence evaluation, credit assignment, and reputation updates

The AI specialization adds typed twins for:

- AI systems and model families
- compute and hardware infrastructure
- organizations and laboratories
- data ecosystems
- policy and governance environments
- human and institutional response
- safety and failure-mode risk

## Implemented Stages

- Stage 1 (domain model): `src/types/aiEcosystem.ts`
- Stage 2 (static twins): `src/engine/aiEcosystem.ts`
- Stage 3 (dynamic transitions + mechanisms): `src/engine/aiMechanisms.ts` and runtime integration

Detailed roadmap: `docs/ai-ecosystem-roadmap.md`

## Run Locally

Prerequisites: Node.js 20+

1. Install dependencies:
   `npm install`
2. Set `GEMINI_API_KEY` in `.env.local` (optional for non-LLM simulation steps)
3. Start dev server:
   `npm run dev`

By default, the runtime starts in the `AI Ecosystem Twin` scenario.
