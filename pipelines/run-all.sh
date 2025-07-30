#!/bin/bash
set -e

#DATASET="amateurfilm"
DATASET="valkhofmuseum"

./get-data.sh $DATASET

./create-sparql-index.sh $DATASET

./start-sparql-server.sh $DATASET

# wait a short while for the server to come up - should be replace by a test!
echo "Wait a short while for the server to start"
sleep 5s 

./start-mapping.sh $DATASET

./convert-to-edm.sh $DATASET

./stop-sparql-server.sh $DATASET

