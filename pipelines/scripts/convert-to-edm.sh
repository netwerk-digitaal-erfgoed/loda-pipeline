#!/bin/bash
set -e

# pass the dataset name as the first argument
export DATASET="${1}"

export USER=$(id -u):$(id -g)  # to prevent docker creating 'root' owned files

echo "Make the data ready for upload to Europeana.."

echo "Deduplicate the output from LDWorkbench..."
docker compose run --rm tools /bin/bash -c "sparql --data /pipelines/data/${DATASET}.nt --query /generic/distinct.rq --results=N-Triples > /pipelines/data/${DATASET}-distinct.nt"

echo "Validate the result against the EDM shape constraints..."
docker compose run --rm tools /bin/bash -c "shacl validate --data /pipelines/data/${DATASET}-distinct.nt --shapes /generic/edm_ext_shacl_shapes.ttl > /pipelines/data/validate-report.txt"

# TODO: use the Europeana Shape file that is under construction, currently the `edm:pid`` was discarded as an unknown property
#docker compose run --rm tools /bin/bash -c "shacl validate --data /pipelines/data/${DATASET}-distinct.nt --shapes https://raw.githubusercontent.com/europeana/metis-edm-ext-schema/refs/heads/main/src/main/resources/schema/edm_ext_shacl_shapes.ttl > /pipelines/data/validate-report.txt"

echo "Convert the data file to a RDF/XML serialization..."
docker compose run --rm tools /bin/bash -c "riot --output=rdfxml /pipelines/data/${DATASET}-distinct.nt > /pipelines/data/${DATASET}.rdf"

echo "Rewrite the RDF/XML to XML that can be processed by Europeana..."
docker compose run --rm tools /bin/bash -c "/app/crawler/rdf2edm.sh -input_file /pipelines/data/${DATASET}.rdf -output_file /pipelines/data/${DATASET}.zip"

echo "Ready: output file ${DATASET}.zip is written to the main directory..."