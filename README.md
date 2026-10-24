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
- Robust error input handling: traceback boilerplate stripping (frame lines, file/line
  references, caret lines), camelCase-aware tokenization of compound exception names
  (`SyntaxError` → `syntax error`), and vocabulary-guided segmentation of glued lowercase tokens
- Optional language **auto-detection** from error text signatures (plus manual Python, Java, C++,
  and JavaScript filters)
- Top-3 evidence retrieval with configurable relevance threshold
- Evidence-grounded answer generation via OpenRouter Chat Completions API (server-side key only)
- Explicit record IDs and relevance scores for every answer; the model is instructed to cite only
  actual retrieved records and never fabricated IDs
- Graceful, honest fallback when LLM generation is unavailable (`mode: retrieval_only`, no
  fabricated answers)
- Screenshot upload, paste, drag-and-drop, and browser capture for vision-capable models; the UI
  states explicitly when an attached screenshot was not analyzed
- Responsive light UI with graceful text-only fallback
- Vitest suites for retrieval, validation, generation, knowledge-base integrity, and the
  production-defect regression (69 tests)
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

The seed script is idempotent (per-record upserts, no destructive statements). When the database
endpoint is unreachable from a build environment it logs a warning and exits 0 so deploys do not
fail; run it from an environment with working DNS/Neon access to apply updated records. Netlify
deploys run the seed automatically after each successful build (`npm run seed`), so git-driven
deploys pick up record additions server-side.

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

Current status: 5 test files / 69 tests, all passing.

Test coverage:
- Query validation (empty, too long, invalid language, screenshot data-URL and size limits)
- TF-IDF retrieval ranking and language filtering, incl.
  camelCase/glued-token segmentation and traceback boilerplate stripping
- Database connection and error handling (missing `DATABASE_URL`, connection failure)
- Generation provider error handling (missing key, HTTP errors, timeouts, provider failure)
- Production-defect regression: the exact unterminated-string traceback, missing closing
  parenthesis, IndentationError, ModuleNotFoundError, Java NullPointerException, JavaScript
  ReferenceError, unrelated queries (honest no-match), and screenshot honesty flags

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

Latest measured results over the 15-query evaluation set: Top-1 accuracy 100% (15/15), Top-3
accuracy 100% (15/15). Baseline before the October 2026 retrieval fix: 86.67% / 93.33%, with the
reported traceback-style query returning no evidence at all. Results are written to
`evaluation/results.csv`.

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
- Screenshot analysis requires a configured `OPENROUTER_VISION_MODEL`; without it, or when
  generation is unavailable, images are not analyzed and the UI says so (no OCR fallback exists
  yet)
- Knowledge base is curated (not exhaustive); seeded via `npx tsx database/seed.ts` which must run
  from an environment that can reach the Neon endpoint
- No authentication or user accounts

---

## License

MIT
