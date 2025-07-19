#!/bin/bash
set -e

# pass the dataset name as the first argument
export DATASET="./${1}"
 
echo "Transform the data for ${DATASET} using LD-workbench..."

docker compose run --rm map /bin/sh -c "ld-workbench --config /pipelines"