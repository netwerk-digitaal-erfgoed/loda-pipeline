#!/bin/bash
set -e

# Initialize the DATASETS array
unset DATASET

if [ -f 'environment' ]; then 
  # read the configuration variables for this dataset
  source environment
else
  echo "No environment file found, please switch to a dataset directory"
  exit
fi

if [ -z $DATASET ]; then
  echo "No Dataset configuration found, please run configure.sh first"
  exit 
fi

echo -n "`date`: "
echo "Starting the SPARQL server for ${DATASET}..."

# run the process as the current user
source setuser.sh

# start with an empty log file for this session
cat /dev/null > logs/fuseki-log.txt

# start the docker container with the Fuseki sparql server
# TIP: remove --detach option for debugging
# All output is logged to fuseki-log.txt 
# Note: the default logfile is also set in log4j2.properties - see jena-fuseki-docker-* files
docker compose up --detach fuseki >> logs/fuseki-log.txt

echo "Waiting for the sparql server to be up and running..."

end=$((SECONDS+10))
until $(curl --output /dev/null --silent --fail --data "query=select*{?s%20?p%20?o}LIMIT%2010" http://localhost:3030/$DATASET/sparql); do
  sleep 3s
  if [ $SECONDS -gt $end ]; then
    echo "Failed to bring up Fuseki, please see log files for possible reasons" >> logs/fuseki-log.txt
    exit 1
  fi
done

COUNT=$(
  curl -s "http://localhost:3030/$DATASET/sparql?query=SELECT%20%28COUNT%28%2A%29%20AS%20%3Faantal%29%20WHERE%20%7B%3Fs%20%3Fp%20%3Fo%7D" \
  | while IFS= read -r line; do
      if [[ $line == *'"value"'* ]]; then
          val=${line##*\"value\": \"}
          val=${val%%\"*}
          echo "$val"
          break
      fi
    done
)

echo -n "`date`: "
echo "Sparql server available with $COUNT triples in it!"
