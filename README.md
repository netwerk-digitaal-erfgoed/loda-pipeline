# LODA Pipeline

Transforms Dutch cultural heritage datasets into [Europeana Data Model](https://pro.europeana.eu/page/edm-documentation) (EDM) RDF, using [`@lde/pipeline`](https://github.com/ldengine/lde) for orchestration.

Each dataset is identified by its URI. The pipeline looks up the dataset in the [NDE Dataset Register](https://datasetregister.netwerkdigitaalerfgoed.nl/), imports its data into a local [QLever](https://github.com/ad-freiburg/qlever) SPARQL engine, and runs SPARQL CONSTRUCT queries to produce EDM output.

## Prerequisites

- [Docker](https://www.docker.com/) (Engine 28 or later, with Docker Compose)
- [Node.js](https://nodejs.org/) (v26 or later), only to run the pipeline without docker

## Installation

```sh
git clone https://github.com/netwerk-digitaal-erfgoed/loda-pipeline.git
cd loda-pipeline
```

## Usage

### Run a pipeline

```sh
scripts/run <pipeline>
```

For example:

```sh
scripts/run amateurfilm
```

`<pipeline>` is the name of a directory under `pipelines/`. This runs the pipeline with Docker Compose, with QLever in a sidecar container. Output is written as N-Triples to `./output/`.

Alternatively, run the pipeline directly with Node.js:

```sh
npm install
npm start -- amateurfilm
```

### QLever modes

The pipeline runs QLever as a sidecar, using the `remote` mode of [`@lde/sparql-qlever`](https://ldelements.org/reference/sparql-qlever). When running the pipeline directly, set `QLEVER_ENV` to `docker` (default) to run QLever in Docker containers, or to `native` to run QLever binaries from `PATH`.

### Create a new pipeline

```sh
npm start -- init <pipeline>
```

This creates the pipeline directory under `pipelines/`. Then add SPARQL query files to it:

- **`selector.rq`** — a SELECT query that returns `$this` bindings (the items to transform)
- **`executor.rq`** — a CONSTRUCT query that produces EDM triples for each `$this`

For multi-stage pipelines, use numbered files: `selector-1-2-3.rq`, `executor-1.rq`, `executor-2.rq`, etc. Executors sharing a selector run as a single stage with multiple executors.

### Datasets not in the registry

For datasets whose source data isn't registered in the NDE Dataset Register, add a `dataset.ttl` file to the pipeline directory with the download distribution:

```turtle
@prefix dcat: <http://www.w3.org/ns/dcat#> .

[] dcat:distribution [
  dcat:accessURL <https://example.com/data.nt>
] .
```

## Directory structure

```
loda-pipeline/
├── scripts/
│   └── run                   Run a pipeline with Docker Compose
├── src/
│   ├── index.ts              Entry point
│   ├── build-pipeline.ts     Pipeline construction
│   ├── dataset-selector.ts   Dataset resolution (registry or local)
│   └── scan-stages.ts        .rq file scanner
└── pipelines/
    └── <filenamified-uri>/
        ├── selector.rq       Item selector query
        ├── executor.rq       CONSTRUCT executor query
        └── dataset.ttl       (optional) local distributions
```
