#!/bin/bash
set -e

# pass the dataset name as the first argument
export DATASET="./${1}"

echo "Make the data ready for upload to Europeana.."

echo "Deduplicate the output from LDWorkbench..."

docker compose run --rm europeana-tools /bin/bash -c "sparql --data /opt/data/${DATASET}.nt --query /opt/shapes/distinct.rq --results=N-Triples > /opt/data/${DATASET}-distinct.nt"

echo "Validate the result against the EDM shape constraints..."

docker compose run --rm europeana-tools /bin/bash -c "shacl validate --data /opt/data/${DATASET}-distinct.nt --shapes /opt/shapes/edm.ttl > /opt/data/validate-report.txt"

echo "Convert the data file to a RDF/XML serialization..."

docker compose run --rm europeana-tools /bin/bash -c "riot --output=rdfxml /opt/data/${DATASET}-distinct.nt > /opt/data/${DATASET}.rdf"

echo "Rewrite the RDF/XML to XML that can be processed by Europeana..."

docker compose run --rm europeana-tools /bin/bash -c "/app/crawler/rdf2edm.sh -input_file /opt/data/${DATASET}.rdf -output_file /opt/data/${DATASET}.zip"

echo "Ready: output file ${DATASET}.zip is written to the data dir..."