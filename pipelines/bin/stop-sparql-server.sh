#!/bin/bash
set -e

# run the process as the current user
source setuser.sh

# pass the dataset name as the first argument
export DATASET="${1}"

echo "Stopping the SPARQL server for ${DATASET}..."

docker compose down fuseki 