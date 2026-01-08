#!/bin/bash
set -e

# pass the dataset name as the first argument
export DATASET="${1}"

echo "Stopping the SPARQL server for ${DATASET}..."

docker compose down fuseki 