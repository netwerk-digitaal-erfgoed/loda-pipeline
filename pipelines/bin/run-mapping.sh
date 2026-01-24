#!/bin/bash

# run the process as the current user
USER=$(id -u):$(id -g)

# read the configuration variables for this dataset
source environment

if [ -z $DATASET ]; then
  echo "Please swith to a dataset directory" 
fi

# create output filename
OUTPUT_FILE="${DATASET}.nt"

# remove old outputfile 
rm -f $OUTPUT_FILE

# start with an empty log file for this session
cat /dev/null > logs/ld-workbench-log.txt

echo "Transforming '${DATASET}' data using LD-workbench, see ld-workbench-log.txt for more details..."

docker compose run --rm map /bin/sh -c "ld-workbench --config /pipelines" &> logs/ld-workbench-log.txt

# move the output file when the process finished without errors 
if [ -f $OUTPUT_FILE ] && [ !$? ]; then
  echo "Finished: '$OUTPUT_FILE' written in the main directory"
else
  echo "Error: Mapping failed, no output file"
  exit 1
fi

