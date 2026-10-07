# PLAN - SaaS AI Shopping Agent

## Last Update
- 2026-10-07

## Status Snapshot
- DONE: Monorepo skeleton, widget Shadow DOM loader, base DB schema, initial routes, TS compilation fixed.
- WIP: SQL-backed repository migration (Phase 1/7), Heureka/Zbozi XML feed RAG ingestion pipeline (Phase 3), Jellyfin-like dark UI (Phase 7), and widget bundling (Phase 2).
- TODO: Production e-shop adapters, voice orchestration latency, hardening.

## Architecture Decisions
- Backend: Hono.
- Repository: Monorepo.
- Tenant isolation: JWT + tenant_id on every entity and service boundary.
- Payments: Token/redirect checkout only, no PAN storage.
- Voice provider (MVP): Retell.
- Deploy target: Vercel + Railway/Fly + managed PostgreSQL.
- First ecommerce rollout target: PrestaShop 8.2.0.

## Implementation Board

### Phase 1 - Foundation [WIP]
- DONE: repo scaffolding, shared schemas, API app bootstrap, tenant middleware, migrations baseline.
- DONE: `pnpm dev` builds workspace dependencies before starting persistent dev watchers.
- WIP: audit logging and stricter security headers rollout.
- NEXT: add persistent settings storage wiring to DB instead of in-memory route state.

### Phase 2 - Isolated Widget [WIP]
- DONE: async loader shell, closed Shadow DOM, bubble panel shell.
- WIP: richer failure UX and response states.
- NEXT: enforce compressed loader budget gate (<30KB) in CI.

### Phase 3 - RAG Ingestion and Retrieval [TODO]
- DONE: pgvector extension and initial embedding table schema.
- DONE: feed sync now runs as async ingestion job with tenant-scoped status endpoint and live progress stats (processed/total/percent).
- WIP: admin knowledge-base UI polling of sync job status with live percentage indicator in action button and progress bar.
- TODO: ingestion endpoints for JSON/CSV/URL, chunking and dedupe service, retrieval route with hybrid ranking.
- NEXT: add integration tests for ingestion job lifecycle (queued -> running -> done/failed) and polling error recovery.

### Phase 4 - Conversational Commerce Tools [WIP]
- DONE: tool-calling skeleton in ai-core, commerce route placeholders.
- WIP: admin chat preview endpoint reusing shared orchestration.
- DONE: upgraded AI SDK provider packages to compatible versions so chat-preview no longer fails with unsupported model version.
- DONE: chat-preview and widget chat now use tenant-selected provider/model from admin settings while API keys remain in .env.
- TODO: production adapter execution for PrestaShop 8.2 first, then Shoptet/Woo/Shopify with retries and circuit breaker.
- NEXT: implement PrestaShop 8.2 module/webservice bridge and deterministic execution logs.

### Phase 5 - Order Automation [TODO]
- DONE: checkout lead validation schema and endpoint baseline.
- TODO: multi-turn collector (name/email/address), draft lifecycle, checkout redirect orchestration.
- NEXT: persist validated lead into order_drafts state machine.

### Phase 6 - Voice Bridge [TODO]
- DONE: Retell webhook route scaffold.
- TODO: shared chat/voice orchestration, ASR uncertainty fallback prompts, p95 < 600ms optimization.
- NEXT: wire Retell webhook payload to ai-core turn handler.

### Phase 7 - Tenant Admin and Onboarding [WIP]
- DONE: admin UI foundation, connector settings form, LLM provider/model selection form, chat preview sandbox, document metadata upload action.
- DONE: admin API endpoints for settings, documents, abuse policy, chat preview.
- DONE: settings save path now normalizes invalid legacy LLM values on frontend and returns validation issue details from API.
- DONE: sandbox chat preview now surfaces backend error detail instead of generic failure message.
- DONE: admin settings page now allows switching LLM provider/model per tenant and clarifies env-key usage.
- TODO: persistent DB-backed storage and credential vault integration.
- NEXT: expose backend-reported provider key availability in admin UI to pre-validate selected provider before save.

### Phase 8 - Hardening and Go-Live [TODO]
- TODO: automated tests (unit/integration/e2e/load), OWASP hardening, SLO dashboard, canary rollout and rollback playbook.
- NEXT: introduce minimal test suite per route and middleware.

## Tenant Admin Requirements
- Each tenant/project has dedicated administration controls.
- Knowledge upload and training:
- upload document metadata for PDF/DOC/TXT and enqueue ingestion.
- manage feed/API ingestion sources to continue training chat context.
- Connector and availability settings:
- support non-premium Shoptet mode via product feed/API URL fallback.
- preserve pricing and stock source configuration per tenant.
- Chat preview and testing:
- run sandbox prompts against same ai-core path without triggering real checkout.
- LLM configuration per tenant:
- provider: OpenAI, Gemini, Claude.
- model selection and API key alias mapping.

## Anti-Abuse and Token Protection Design
- Request limits:
- per IP (hourly)
- per tenant (hourly)
- payload size guard
- Token budget policy:
- soft daily budget triggers degrade mode (lighter model/context)
- hard daily budget blocks further turns with safe fallback message
- Abuse monitoring:
- persist abuse policy and abuse events per tenant
- add alerting on repeated rate-limit spikes
- Fallback behavior:
- always return safe user-facing response when quota is exceeded or provider fails
- never crash widget or API process on upstream issues

## Verification Checklist
- Widget styles remain isolated from host CSS.
- Loader remains asynchronous and budget-compliant.
- Chat preview, settings, and document endpoints validate input schema.
- Tenant filtering remains enforced across admin, chat, and commerce routes.
- No PAN/card numbers are stored.

## Scope Boundaries
- Included: embeddable assistant, RAG, conversational commerce, checkout redirect flow, voice bridge, tenant admin.
- Excluded in MVP: direct payment processing, multi-voice provider abstraction, advanced BI.
