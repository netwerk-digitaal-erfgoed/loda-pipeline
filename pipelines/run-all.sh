#!/bin/bash
set -e

#DATASET="amateurfilm"
DATASET="valkhofmuseum"

./get-data.sh $DATASET

# pause a while to wait for the download to finish
echo "Wait a short while for the download to finish"
sleep 2s 

./create-sparql-index.sh $DATASET

./start-sparql-server.sh $DATASET

# wait a short while for the server to come up - should be replace by a test!
echo "Wait a short while for the server to start"
sleep 5s 

./start-mapping.sh $DATASET

./convert-to-edm.sh $DATASET

./stop-sparql-server.sh $DATASET

