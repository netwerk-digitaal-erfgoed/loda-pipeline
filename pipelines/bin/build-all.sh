#!/bin/bash
set -e

source setuser.sh

# set DATASET var if not already set, only necessary to prevent docker warning about the variable
if [ -z $DATASET ]; then 
  DATASET=""
fi 

# export it to make it available for the docker compose command
export DATASET

echo "Using UID=$UID and GID=$GID for building the images"

echo "Building fuseki image, see build_fuseki_log.txt..."
docker compose build fuseki > build_fuseki_log.txt

echo "Building tools image, see build_tools_log.txt for details..."
docker compose build tools > build_tools_log.txt

echo "Ready builing the images!"
