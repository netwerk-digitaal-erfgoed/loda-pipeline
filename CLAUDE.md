# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

LODA Pipeline transforms Dutch cultural heritage datasets into Europeana Data Model (EDM) RDF using the `@lde/pipeline` library and QLever (Docker-based SPARQL engine).

This project is intentionally a thin consumer of `@lde/pipeline`. When something doesn't fit well, prefer making changes (even breaking ones) upstream in `@lde/pipeline` rather than working around limitations here.

## Commands

```bash
# Run a pipeline by its name in pipelines.yaml; afterwards dry-runs the S3 upload
npm run pipeline:start -- <name>

# Same, and actually upload the distribution files and description
npm run pipeline:start -- <name> --upload

# Regenerate the dataset description from the run manifest, without rerunning the pipeline
npm run pipeline:describe -- <name>

# Upload the outputs of the last run, without rerunning the pipeline (dry run without --upload)
npm run pipeline:upload -- <name> [--upload]

# Run the tests (vitest)
npm run pipeline:test

# Type-check
npx tsc -p pipeline --noEmit

# Lint and check formatting (eslint, prettier)
npm run lint
```

Tests live next to the code as `*.test.ts`. The root `pipeline:*` scripts end in `--`, so that flags such as `--upload` reach the script instead of npm.

## Architecture

The CLI entry point (`pipeline/src/index.ts`) converts dataset URIs to directory names via `filenamify-url` and delegates to `buildPipeline` (`pipeline/src/build-pipeline.ts`), which wires together:

1. **Dataset selection** (`pipeline/src/dataset-selector.ts`): if the pipeline directory has a `dataset.ttl`, uses `ManualDatasetSelection`; otherwise queries the NDE Dataset Registry via `RegistrySelector`, filtering out EDM distributions.
2. **Distribution resolution**: `ImportResolver` wraps `SparqlDistributionResolver` with `strategy: 'import'` to always import data dumps into a Docker-based QLever instance.
3. **Stages** (`pipeline/src/scan-stages.ts`): auto-discovered from `.rq` files in the pipeline directory. Naming convention: `selector.rq` / `selector-N.rq` for SELECT queries, `executor.rq` / `executor-N.rq` for CONSTRUCT queries. A selector like `selector-1-2-3.rq` is shared across executors 1, 2, and 3.

## Conventions

- ESM with `.js` extensions in all imports; `node:` prefix for built-in modules
- TypeScript strict mode; target ES2022
- Pipeline directories live under `pipelines/` named by `filenamify-url(datasetUri)`
- `dataset.ttl` files use `dcat:accessURL` and `dcat:mediaType` (IANA URI) so the importer recognises the format
- Resource cleanup via `try/finally` on `distributionResolver.cleanup()`
- QLever runs per `QLEVER_ENV`: `docker` (default, local), `native`, or `remote` (sidecar via `@lde/task-runner-http`, used by the `Dockerfile` image); downloads go to `imports/`
