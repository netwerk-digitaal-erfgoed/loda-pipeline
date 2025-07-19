#!/bin/bash
set -e

# pass the dataset name as the first argument
export DATASET="./${1}"

echo "Stop the SPARQL server for ${DATASET}..."

docker compose down sparql-server 