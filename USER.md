# Průvodce správce projektu

## Požadavky

- **Node.js** ≥ 20 (doporučeno přes [nvm](https://github.com/nvm-sh/nvm))
- **pnpm** ≥ 9 (`npm install -g pnpm`)
- **PostgreSQL** ≥ 15 s rozšířením [pgvector](https://github.com/pgvector/pgvector)
- Git

## První spuštění

```bash
git clone <repo-url>
cd chat-agent

# Nainstaluj závislosti celého monorepa
pnpm install

# Zkopíruj a uprav proměnné prostředí
cp .env.example .env
```

Vyplň `.env` – zejména:

| Proměnná | Popis |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Náhodný tajný klíč pro JWT (min. 32 znaků) |
| `OPENAI_API_KEY` | API klíč OpenAI (nebo alias v admin UI) |
| `RETELL_API_KEY` | Klíč pro Retell voice (volitelné) |
| `API_PORT` | Port backendu (výchozí `8787`) |

## Databáze

```bash
# Ujisti se, že máš pgvector nainstalovaný:
# CREATE EXTENSION vector;

# Spusť migrace v pořadí
psql "$DATABASE_URL" -f db/migrations/001_initial.sql
psql "$DATABASE_URL" -f db/migrations/002_admin_and_abuse.sql
```

## Spuštění vývojových serverů

```bash
# Spustí api + web + widget-runtime paralelně přes Turbo
pnpm dev
```

| Služba | URL |
|---|---|
| Backend API | http://localhost:8787 |
| Admin web | http://localhost:5173 |
| Widget runtime | http://localhost:5174 |

## Struktura monorepa

```
apps/
  api/             – Hono backend (REST API, webhooky, auth)
  web/             – Merchant admin (React + Tailwind)
  widget-runtime/  – Embeddable widget (Shadow DOM loader)
packages/
  ai-core/         – Orchestrace AI (tool calling, model routing)
  integrations/    – Adaptéry e-shopů (PrestaShop, Shopify, …)
  shared/          – Sdílené typy a Zod schémata
db/
  migrations/      – SQL migrace (spouštět ručně v pořadí)
```

## Práce s balíčky

```bash
# Přidat závislost do konkrétního balíčku
pnpm --filter @chat-agent/api add <package>

# Build celého monorepa
pnpm build

# Testy
pnpm test
```

## Tenant a autentizace

API vyžaduje JWT token + hlavičku `x-tenant-id`. V dev prostředí lze testovat přes `/health` bez auth nebo generovat token manuálně s `JWT_SECRET`.

## Nasazení

- **Frontend** (`apps/web`) → Vercel (automatický deploy z `main` větve)
- **Backend** (`apps/api`) → Railway nebo Fly.io (Docker nebo Node buildpack)
- **Databáze** → spravovaný PostgreSQL s pgvector (Railway, Neon, Supabase)

Před nasazením do produkce nastav všechny proměnné prostředí v cílovém prostředí (ne v `.env` souboru).

## Živý plán projektu

Stav implementace, WIP úkoly a další kroky jsou vedeny v [PLAN.md](PLAN.md).
Pravidla pro AI agenty pracující na kódu jsou v [AGENTS.md](AGENTS.md).
