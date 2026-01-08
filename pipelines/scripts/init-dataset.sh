#!/bin/bash
set -e

# force lowercase
dataset="${1,,}"
echo "initialize pipeline for '$dataset'"

if [ -d $dataset ]; then
  echo "Error: Directory '$dataset' already exists."
  exit 1
fi
echo "Creating $dataset" 
mkdir ./$dataset
cd $dataset

echo "Creating subdirectory for 'data'"
mkdir data
cat /dev/null > ./data/.gitkeep

echo "Creating subdirectory for 'ld-workbench'"
mkdir ld-workbench

echo "Creating subdirectory for 'fuseki'"
mkdir fuseki

# create a mointing point for the log file
mkdir ./fuseki/logs
touch ./fuseki/logs/fuseki_log.txt

echo "Installing 'environment' file"
echo "Set DATASET name to $dataset in $dataset/environoment" 
export DATASET=$dataset
envsubst '$DATASET' < ../generic/environment > ./environment

echo "Init proces finished - to proceed set the correct variables in the 'environment' file in '$dataset'"
