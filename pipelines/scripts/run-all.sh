#!/bin/bash
set -e

# Usage:
# set de current working director to 'pipelines'
# 
# './scripts/run-all.sh' runs all pipelines that have the PRODUCTION var set to 1
# './runall.sh 'example' only runs the 'example' pipeline

process_dataset () {
	local DATASET=$1

    echo "Change directory to $1"

    cd $1

	../scripts/start-sparql-server.sh $DATASET

	../scripts/run-mapping.sh $DATASET

	../scripts/stop-sparql-server.sh $DATASET

	../scripts/convert-to-edm.sh $DATASET

	../scripts/make_dataset_description.sh $DATASET
	
	#./upload-to-s3bucket.sh $DATASET

	cd ..
}

# Initialize the DATASETS array
DATASETS=()

if [ $# -gt 0 ]; then
	DATASETS=("$1")
else
	while IFS= read -r dir; do
		if [ -f $dir/environment ]; then
		   unset PRODUCTION 
		   source $dir/environment
		   if [ "$PRODUCTION" -eq 1 ]; then
		      # test if a Fuseki database is created
			  if [ ! -d "$dir/data/DB" ]; then
			     echo "No database available for '$dir', run 'configure.sh' first!"
			  else
			     echo "Adding $dir to the list"
			     DATASETS+=("$dir")
			  fi
		   else
		      echo "Skipping $dir (PRODUCTION variable not set)"
		   fi
		else 
		  echo "Ignoring $dir (no 'environment' file found)" 

		fi
	done < <(find . -maxdepth 1 -type d ! -name "." ! -name "generic" ! -name ".s3" ! -name "scripts" -exec basename {} \; | sort -n)
fi

# Loop through the array and print each item
for dataset in "${DATASETS[@]}"; do
    echo "* Processing $dataset"
	process_dataset $dataset
done
