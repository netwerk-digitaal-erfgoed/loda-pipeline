#!/bin/bash
set -e

# pass the dataset name as the first argument
export DATASET="./${1}"

echo "Start the SPARQL server with for ${DATASET}..."

# run the process as the current user
USER=$(id -u):$(id -g)
docker compose up --detach sparql-server