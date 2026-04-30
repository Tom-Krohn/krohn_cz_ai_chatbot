# chat-agent

Monorepo for a SaaS platform providing embeddable AI shopping agents with chat and voice.

## Quick Start
1. Install dependencies:

```bash
pnpm install
```

2. Run all development apps:

```bash
pnpm dev
```

## Workspace
- apps/api: Hono backend
- apps/widget-runtime: embeddable script runtime
- apps/web: merchant admin frontend
- packages/shared: shared types and schemas
- packages/ai-core: model routing and tool orchestration
- packages/integrations: ecommerce platform adapters
- db/migrations: SQL migrations including pgvector
