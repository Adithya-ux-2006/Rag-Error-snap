# ErrorSnap

**ErrorSnap** is a Retrieval-Augmented Generation (RAG) application that helps computer engineering students understand programming errors. Enter an error message, optionally select a programming language, and receive a concise, evidence-grounded diagnosis with a recommended fix.

Built with:
- **Next.js 14** (App Router, TypeScript)
- **Neon serverless PostgreSQL** (knowledge base storage)
- **Tailwind CSS** (UI styling)
- **OpenRouter** (LLM generation)

---

## Features

- Deterministic TF-IDF retrieval from a curated Neon PostgreSQL knowledge base
- TF-IDF-based similarity ranking across error messages, names, tags, and keywords
- Top-3 evidence retrieval with configurable relevance threshold
- Evidence-grounded answer generation via OpenRouter Chat Completions API
- Explicit record IDs and relevance scores for every answer
- Graceful fallback when LLM generation is unavailable
- Screenshot upload, paste, drag-and-drop, and browser capture for vision-capable models
- Responsive light UI with graceful text-only fallback
- Vitest unit tests for retrieval, validation, and generation
- Retrieval evaluation script with top-1 and top-3 accuracy metrics

---

## Prerequisites

- **Node.js** 18+ (recommended 20+)
- **npm** or **pnpm**
- **Neon** account — https://neon.tech
- **OpenRouter** account with API key — https://openrouter.ai

---

## Setup

### 1. Clone and install dependencies

```bash
git clone https://github.com/errorsnap/errorsnap.git
cd errorsnap
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```
DATABASE_URL=postgresql://user:password@host.neon.tech/database
OPENROUTER_API_KEY=sk-or-v1-your-api-key
OPENROUTER_MODEL=meta-llama/llama-3.1-8b-instruct
OPENROUTER_VISION_MODEL=your-vision-capable-model   # optional, for screenshots
RATE_LIMIT_MAX_REQUESTS=20                          # optional, per instance/minute
```

### 3. Initialize the database

```bash
npx tsx database/seed.ts
```

### 4. Run the application

```bash
npm run dev
# Open http://localhost:3000
```

---

## Running Tests

```bash
npm test
```

Test coverage:
- Query validation (empty, too long, invalid language)
- TF-IDF retrieval ranking
- Language filtering
- Database error handling
- Generation provider error handling

## Deployment checklist

This app uses Next.js Route Handlers as its backend; no separate web server is required.

1. Apply `database/migrations/001_create_table.sql` to the Neon database, then run `npx tsx database/seed.ts`.
2. Deploy to Netlify with the supplied `netlify.toml`. Netlify detects Next.js App Router routes automatically, including `/api/solve` and `/api/health`.
3. Set `DATABASE_URL` and `OPENROUTER_API_KEY` as **runtime secrets** in the deployment provider. Do not put them in `netlify.toml` or expose them with a `NEXT_PUBLIC_` prefix.
4. Set `OPENROUTER_VISION_MODEL` only when screenshot analysis is enabled and the chosen model supports image input.
5. Verify the deployment with `GET /api/health`. It returns `200` when the database is reachable and `503` when it is not.

`RATE_LIMIT_MAX_REQUESTS` provides a basic per-instance limit for `/api/solve`. For multi-instance production traffic, replace it with a shared rate-limit store before relying on it as an abuse-control boundary.

---

## Evaluation

```bash
npm run evaluate
```

Results are written to `evaluation/results.csv`.

---

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│  User Input │────▶│  /api/solve  │────▶│ Neon Postgres │
└─────────────┘     └──────────────┘     │ (knowledgebase)│
                                         └──────────────┘
                                                │
                                                ▼
                                         ┌───────────────┐
                                         │ TF-IDF Search │
                                         │ + Ranking     │
                                         └───────────────┘
                                                │
                                                ▼
                                         ┌───────────────┐
                                         │ OpenRouter  │
                                         │ LLM (optional)│
                                         └───────────────┘
```

See `report/architecture.mmd` for the Mermaid diagram.

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 14, React, TypeScript | SSR, routing, type safety |
| Styling | Tailwind CSS | Responsive UI |
| Database | Neon PostgreSQL | Knowledge base storage |
| Retrieval | In-process TF-IDF | Keyword-based ranking |
| Generation | OpenRouter API | LLM-powered answers |
| Validation | Zod | Input sanitization |
| Testing | Vitest | Unit testing |

---

## Limitations

- Retrieval is keyword-based, not semantic embeddings
- Generation requires a configured OpenRouter API key
- Knowledge base is curated (not exhaustive)
- No authentication or user accounts

---

## License

MIT
