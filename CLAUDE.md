# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

LODA Pipeline transforms Dutch cultural heritage datasets into Europeana Data Model (EDM) RDF using the `@lde/pipeline` library and QLever (Docker-based SPARQL engine).

This project is intentionally a thin consumer of `@lde/pipeline`. When something doesn't fit well, prefer making changes (even breaking ones) upstream in `@lde/pipeline` rather than working around limitations here.

## Commands

```bash
# Run a pipeline for a dataset
npm start -- <dataset-uri>

# Create a new pipeline directory
npm start -- init <dataset-uri>

# Type-check
npx tsc --noEmit
```

No linter or test framework is configured.

## Architecture

The CLI entry point (`src/index.ts`) converts dataset URIs to directory names via `filenamify-url` and delegates to `buildPipeline` (`src/build-pipeline.ts`), which wires together:

1. **Dataset selection** (`src/dataset-selector.ts`): if the pipeline directory has a `dataset.ttl`, uses `ManualDatasetSelection`; otherwise queries the NDE Dataset Registry via `RegistrySelector`, filtering out EDM distributions.
2. **Distribution resolution**: `ImportResolver` wraps `SparqlDistributionResolver` with `strategy: 'import'` to always import data dumps into a Docker-based QLever instance.
3. **Stages** (`src/scan-stages.ts`): auto-discovered from `.rq` files in the pipeline directory. Naming convention: `selector.rq` / `selector-N.rq` for SELECT queries, `executor.rq` / `executor-N.rq` for CONSTRUCT queries. A selector like `selector-1-2-3.rq` is shared across executors 1, 2, and 3.

## Conventions

- ESM with `.js` extensions in all imports; `node:` prefix for built-in modules
- TypeScript strict mode; target ES2022
- Pipeline directories live under `pipelines/` named by `filenamify-url(datasetUri)`
- `dataset.ttl` files use `dcat:accessURL` and `dcat:mediaType` (IANA URI) so the importer recognises the format
- Resource cleanup via `try/finally` on `distributionResolver.cleanup()`
- Requires Docker for QLever; downloads go to `imports/`
