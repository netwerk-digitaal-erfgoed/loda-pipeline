#!/bin/bash
set -e

# Initialize the DATASETS array
unset DATASET

source environment
if [ -z $DATASET ]; then
  echo "Please swith to a dataset directory" 
fi

echo -n "`date`: "
echo "Starting the SPARQL server with for ${DATASET}..."

# start with an empty log file for this session
cat /dev/null > fuseki/log.txt

# run the process as the current user
USER=$(id -u):$(id -g)

# TIP: remove --detach option for debugging
docker compose up --detach fuseki >> fuseki/log.txt

echo "Waiting for the sparql server to be up and running..."

end=$((SECONDS+10))
until $(curl --output /dev/null --silent --fail --data "query=select*{?s%20?p%20?o}LIMIT%2010" http://localhost:3030/$DATASET/sparql); do
  sleep 3s
  if [ $SECONDS -gt $end ]; then
    echo "Failed to bring up Fuseki, please see log files for possible reasons" >> fuseki/log.txt
    exit 1
  fi
done
echo -n "`date`: "
echo "Sparql server available!"