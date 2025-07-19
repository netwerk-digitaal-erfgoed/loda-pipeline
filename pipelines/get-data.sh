#!/bin/bash
set -e

# pass the dataset name as the first argument
export DATASET="./${1}"

echo "Download the dataset as specified in the Qleverfile for ${DATASET}..."

# run the process as the current user
USER=$(id -u):$(id -g)
docker compose run --rm --user $USER sparql-server-getdata