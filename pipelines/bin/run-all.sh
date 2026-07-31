#!/bin/bash
set -e

# Usage:
# set de current working director to 'pipelines'
# 
# 'run-all.sh' runs all pipelines that have the PRODUCTION var set to 1
# 'runall.sh 'example' only runs the 'example' pipeline

process_dataset () {
	local DATASET=$1

    echo "Change directory to $1"

    cd $1

    # TODO: add configure step but only when first setup is done
	# so the Fuseki and LD-Workbench config files must already be present
	# configure.sh

	start-sparql-server.sh

	run-mapping.sh

	stop-sparql-server.sh

	convert-to-edm.sh

	#upload-to-s3bucket.sh

	#make-dataset-description.sh 
	
	cd ..
}

# Initialize the DATASETS array
datasetlist=()

if [ $# -gt 0 ]; then
	datasetlist=("$1")
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
			     datasetlist+=("$dir")
			  fi
		   else
		      echo "Skipping $dir (PRODUCTION variable not set)"
		   fi
		else 
		  echo "Ignoring $dir (no 'environment' file found)" 

		fi
	done < <(find . -maxdepth 1 -type d ! -name "." ! -name "generic" ! -name ".s3" ! -name "bin" -exec basename {} \; | sort -n)
fi

# Loop through the array and print each item
for dataset in "${datasetlist[@]}"; do
    echo "* Processing $dataset"
	process_dataset $dataset
done
