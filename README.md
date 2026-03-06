# LODA Pipeline

Transforms Dutch cultural heritage datasets into [Europeana Data Model](https://pro.europeana.eu/page/edm-documentation) (EDM) RDF, using [`@lde/pipeline`](https://github.com/ldengine/lde) for orchestration.

Each dataset is identified by its URI. The pipeline looks up the dataset in the [NDE Dataset Register](https://datasetregister.netwerkdigitaalerfgoed.nl/), imports its data into a local [QLever](https://github.com/ad-freiburg/qlever) SPARQL engine, and runs SPARQL CONSTRUCT queries to produce EDM output.

## Prerequisites

- [Node.js](https://nodejs.org/) (v24 LTS or later)
- [Docker](https://www.docker.com/) (for QLever)

## Installation

```sh
git clone https://github.com/netwerk-digitaal-erfgoed/loda-pipeline.git
cd loda-pipeline
npm install
```

## Usage

### Run a pipeline

```sh
npx tsx src/index.ts <dataset-uri>
```

For example:

```sh
npx tsx src/index.ts http://data.beeldengeluid.nl/id/dataset/0029
```

The pipeline directory is derived from the dataset URI (e.g. `pipelines/data.beeldengeluid.nl-id-dataset-0029/`). Output is written as N-Triples to `./output/`.

### Create a new pipeline

```sh
npx tsx src/index.ts init <dataset-uri>
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
