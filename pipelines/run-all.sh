#!/bin/bash
set -e

DATASET="amateurfilm"

./get-data.sh $DATASET

./create-sparql-index.sh $DATASET

./start-sparql-server.sh $DATASET

# wait a short while for the server to come up
sleep 5s 

./start-mapping.sh $DATASET

./convert-to-edm.sh $DATASET

./stop-sparql-server.sh $DATASET

