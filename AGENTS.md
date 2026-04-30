# AGENTS Operating Guide

## Mission
Ship a production-grade SaaS for embeddable AI shopping agents with strict tenancy boundaries, resilient ecommerce integrations, and shared AI logic for chat and voice.

## Repository Structure
- apps/api: Hono backend routes, auth middleware, webhook handlers
- apps/widget-runtime: embeddable loader and Shadow DOM runtime
- apps/web: merchant admin frontend
- packages/ai-core: model routing, prompts, tool orchestration
- packages/integrations: Shoptet, WooCommerce, Shopify adapters
- packages/shared: shared types, schemas, validation
- db/migrations: SQL migrations including pgvector setup

## Delivery Rules
1. Work by vertical slices.
2. Each slice must include:
- DB impact (schema/migration when needed)
- API behavior
- Widget or admin UI impact
- Basic tests
3. Keep host-site safety first:
- loader must be async
- Shadow DOM must be closed
- no global CSS leakage
4. Keep PCI scope minimal:
- never store full PAN/card numbers
- use token/redirect checkout only
5. Never break tenant isolation:
- enforce tenant_id filtering at data and service layers
6. Graceful degradation is mandatory:
- ecommerce API downtime must not crash widget or API process

## Coding Standards
- TypeScript-first for backend and app logic.
- Keep modules small and composable.
- Validate input at boundaries with shared schemas.
- Prefer explicit domain types over loose objects.
- Add comments only for non-obvious logic.

## AI Orchestration Rules
- Use GPT-4o-mini for standard conversational turns.
- Escalate to GPT-4o for reasoning-heavy steps.
- Expose tool contracts with strict schemas:
- searchProducts
- addToCart
- startCheckout
- getCartState
- Tool execution must be deterministic and observable.

## Integration Rules
- PrestaShop:
- Prioritize PrestaShop 8.2.0 for first production rollout.
- Use module/webservice bridge and keep adapter contract stable.
- Shoptet:
- If available on host, call shoptet.cartShared.addToCart.
- WooCommerce:
- Use Store API and maintain nonce lifecycle.
- Shopify:
- Use Storefront API cart operations.
- Integration layer must hide provider-specific details behind a stable internal interface.

## Voice Rules
- Retell webhook must call the same ai-core orchestration used by chat.
- Optimize for sub-600ms p95 turn latency.
- Add fallback prompts for uncertain transcription and downstream errors.

## Security and Privacy Rules
- Redact sensitive values from logs.
- Keep secrets in environment variables only.
- Add rate limiting and allowlist checks for widget and webhook entry points.
- Keep audit logs for connector and credential changes.

## Definition of Done for Each Slice
1. Functional path works end-to-end.
2. Error path produces graceful fallback.
3. Types and validation are enforced.
4. Tests cover critical behavior.
5. Documentation updates include any operational changes.

## Plan Hygiene Rules
1. Keep PLAN.md as a living status board with explicit DONE/WIP/TODO for each phase.
2. After each implementation change, update PLAN.md in the same change set.
3. For every updated phase, include at least one concrete NEXT action.
