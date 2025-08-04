#!/bin/bash
set -e

# Usage: 
# ./runall.sh runs all pipelines
# ./runall.sh xyz only runs the xys pipeline

process_dataset () {
	local DATASET=$1

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
	
	./make_dataset_description.sh $DATASET
	
	./upload-to-s3bucket.sh $DATASET
}


# Initialize the DATASETS array
DATASETS=()

if [ $# -gt 0 ]; then
	DATASETS=("$1")
else
	while IFS= read -r dir; do
		DATASETS+=("$dir")
	done < <(find . -maxdepth 1 -type d ! -name "." ! -name "shapes" ! -name "qlever" -exec basename {} \;)
fi

# Loop through the array and print each item
for dataset in "${DATASETS[@]}"; do
    echo "* Processing $dataset"
	process_dataset $dataset
done
