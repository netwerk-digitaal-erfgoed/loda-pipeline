#!/bin/bash
set -e

# pass the dataset name as the first argument
export DATASET="./${1}"

echo "Make the data ready for upload to Europeana.."

echo "First convert the data file to a RDF/XML serialization..."

docker compose run --rm europeana-tools /bin/bash -c "riot --output=rdfxml /opt/data/${DATASET}.nt > /opt/data/${DATASET}.rdf"

echo "Rewrite the RDF/XML to XML that can be processed by Europeana..."

docker compose run --rm europeana-tools /bin/bash -c "/app/crawler/rdf2edm.sh -input_file /opt/data/${DATASET}.rdf -output_file /opt/data/${DATASET}.zip"

echo "Ready: output file ${DATASET}.zip is written to the data dir..."