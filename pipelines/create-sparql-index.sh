#!/bin/bash
set -e

# pass the dataset name as the first argument
export DATASET="./${1}"

echo "Create the Qlever index files for ${DATASET} based on the input data..."

# run the process as the current user
USER=$(id -u):$(id -g)
docker compose run --rm --user $USER sparql-server-index 