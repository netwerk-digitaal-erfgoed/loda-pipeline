# LODA-pipeline

Linked Open Data Aggregator (LODA) pipeline. This repository is a new setup to for an automated pipeline to transform linked datasets for delivery to Europeana

The pipeline is run through bash scripts and is completly dockerized, see [config](pipelines/compose.yaml) for more details. 

Datasets are automatically downloaded and loaded in to a [QLever](https://github.com/ad-freiburg/qlever) based SPARQL endpoint. The mapping is based on the [LD-Workbench](https://github.com/netwerk-digitaal-erfgoed/ld-workbench) tooling.

Running the pipeline:

```sh
git clone https://github.com/netwerk-digitaal-erfgoed/loda-pipeline.git
cd loda-pipeline/pipelines
./run-all.sh
```
