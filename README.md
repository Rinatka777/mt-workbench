# MT Workbench

A self-hosted translation and evaluation workbench for the OPUS-MT / Finnish–English
medical MT pilot ([compressed-medical-mt-benchmark](../compressed-medical-mt-benchmark)).
Submit text, documents, or (eventually) audio, translate through any model variant,
cache and compare results, collect human quality judgments, track benchmark metrics
over time.

This is a separate application layer, deliberately built in TypeScript (not Python)
to keep backend/fullstack skills sharp alongside day-to-day ML/NLP work.

## Architecture

Two services now, three later:

- **Translation inference** (Python/FastAPI) — model loading and translation only.
  Stateless, no database, no business logic. Mock first, then stock OPUS-MT, then
  fine-tuned/quantized variants as they land in the MT project.
- **App service** (this repo, TypeScript) — auth, job pipeline, cache, storage,
  evaluation, metrics. Owns the Postgres database.
- **Frontend** (React + Vite + TS) — deliberately minimal until Phase 6.
- **Transcription inference** (Python/FastAPI, Phase 7 only) — same stateless pattern.

## Stack

- App backend: Hono + Drizzle ORM + PostgreSQL
- Frontend: React + Vite + TypeScript (Phase 6+)
- Tests: Vitest
- Inference: FastAPI + CTranslate2 (separate repo)

## Service contracts

Fixed first — anything can sit behind them without the app layer changing.

```
POST /translate
  { segments: string[], model: string }
  -> { translations: string[], latencyMs: number, modelVersion: string }

GET /models
  -> { models: [{ id, name, version, quantization }] }
```

Phase 7 adds a second service with the same shape:

```
POST /transcribe
  { audioRef: string, language: "fi" }
  -> { segments: [{ text, startMs, endMs }], modelVersion: string }
```

## Core abstraction

Everything is a list of segments. Pasted text is a job with 3 segments; a document
is a job with 500; audio is a job whose segments come from transcription. One queue,
one cache, one worker, one status model. Input type only determines how segments
are produced. The jobs schema is polymorphic from the start:

```ts
sourceKind: "text" | "document" | "audio"
sourceRef: string | null      // blob key for files, null for pasted text
```

## Build order

1. **Foundation** — Postgres schema, Drizzle setup, migrations, session auth. Mock
   inference service returning canned output after a simulated delay.
   *Acceptance: log in and translate a pasted string end to end.*
2. **Segment pipeline** (the core of the project) — segment, queue, dispatch to
   inference under a concurrency limit, per-segment status, retry with backoff,
   reassemble in order, survive a crash mid-job.
   *Acceptance: a 500-segment document translates correctly, and killing the
   worker halfway then restarting resumes rather than restarting.*
3. **Cache** — content-addressed on (source text hash, model ID, model version),
   invalidated on model version change.
   *Acceptance: re-running the same test set is near-instant and provably hits cache.*
4. **Comparison and metrics** — same source through multiple model variants side
   by side; benchmark runs; latency percentiles and quality scores over time via SQL.
5. **Human evaluation** — annotators, items, judgments; rating/ranking UI; per-model
   aggregates and inter-annotator agreement.
6. **Real frontend** — only now. Replace the ugly forms and tables.
7. **Audio input** (last, deliberately) — blob storage with limits/cleanup,
   transcription service behind its own contract, two-stage resumable jobs,
   timestamp propagation. Kept isolated from Phase 4–5 benchmarking (ASR errors
   compound into translation quality and would muddy the comparison).

## Non-goals

- Not a product: no multi-tenancy, billing, public deployment.
- No model training here — that lives in the MT project.
- No polished UI before Phase 6.

## Constraints

- Must work with the inference service mocked (models aren't finished yet).
- Limited hours/week — each phase must be independently useful if work stops there.
- App layer in TypeScript, deliberately, as a learning choice.

## Getting started

```bash
npm install
cp .env.example .env   # point DATABASE_URL at a local Postgres
npm run dev
```

`src/db/schema.ts` and everything under Phase 1 onward is intentionally unwritten —
see `docs/skills-log.md`.
