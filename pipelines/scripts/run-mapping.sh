#!/bin/bash

# run the process as the current user
USER=$(id -u):$(id -g)

# pass the dataset name as the first argument
export DATASET="${1}"

# create output filename
OUTPUT_FILE="./ld-workbench/${DATASET}.nt"

# remove old outputfile 
rm -f $OUTPUT_FILE

# start with an empty log file for this session
cat /dev/null > ld-workbench/log.txt

echo "Transforming '${DATASET}' data using LD-workbench, see ld-workbench/log.txt for more details..."

docker compose run --rm map /bin/sh -c "ld-workbench --config /pipelines" &> ld-workbench/log.txt

# move the output file when the process finished without errors 
if [ -f $OUTPUT_FILE ] && [ !$? ]; then
  # mv the output file to the dataset root if the mapping was succesful
  # TODO create a shared volume in docker-compose ??
  mv $OUTPUT_FILE ./data/${DATASET}.nt
else
  echo "Error: Mapping failed, no output file"
  exit 1
fi

