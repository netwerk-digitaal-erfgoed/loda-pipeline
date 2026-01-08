#!/bin/bash
set -e
export USER=$(id -u):$(id -g)
if [ ! -f environment ]; then
  echo "Error: Environment file doesn't exists. Please rerun the init-pipeline script"
  exit 1
fi

# clear old values
unset SOURCE_URL SOURCE_FILES

# read the variables from the 'environment' file
source environment

echo "Creating the Fuseki config file"

# create a local copy of the fuseki config file
envsubst < ../generic/fuseki-config.ttl > ./fuseki/config.ttl

echo "Creating the LD-Workbench config files"

# write the LD-Workbench configuration based on the environment variables
envsubst < ../generic/ld-workbench-config.yml > ld-workbench/config.yml

# write the generator query based on the environment variables

# to prevent replace of the special variable $this
export this="\$this"
envsubst < ../generic/edm-generator.rq > ld-workbench/edm-generator.rq

cp ../generic/iterator.rq ./ld-workbench

# see if a data download an initialization is necessary
# at least SOURCE_URL or SOURCE_FILE should be set
if [ -z "$SOURCE_URL" ] && [ -z "$SOURCE_FILES" ] ; then
   echo "Error: Please set SOURCE_URL or SOURCE_FILES variable in `environment` file"
   exit 1
fi

newDownload=false

# if $SOURCE_URL is set a file will be downloaded 
if [ ! -z "$SOURCE_URL" ]; then
  cd data
  file=${SOURCE_URL##*/} 
  echo "Dataset name is: $DATASET"
  echo "Source URL is: $SOURCE_URL"
  echo "Starting download..."
  if ! wget -o download-log.txt $SOURCE_URL; then
     echo ""
  fi

  # check if the download was succesful; else terminate the script
  if grep -wq "ERROR" download-log.txt; then 
      echo "ERROR in download" 
      rm $file
      cd ..
      exit 1
  fi

  case "$file" in
    *.tar.gz)
      echo "Extracting files..."  
      tar xfz $file ;;
    *.tgz)
      echo "Extracting files..." 
      tar xfz $file ;;
    *.zip)
      echo "Extracting files..."
      unzip $file ;;
    *.nt | *.nt.gz | *.rdf | *.rdf.gz | *.ttl | *.ttl.gz | *.owl | *.owl.gz | *.nq | *.nquads | *.nquads.gz)
      echo "Known file type, no extra processing needed!" ;;
    *)
    echo "Unsupported file format, please prepare download files manualy" 
    exit 1 ;;
  esac
  cd ..
  echo "Download and optional extraction performed, data files ready for processing."
  newDownload=true

fi

# proces the RDF data in ./data if the SOURCE_FILES var is blank 
if [ ! -z "$SOURCE_FILES" ] | [ $newDownload ]; then
  
  cd data

  echo "Looking for input files files to proces..."

  # Create a fuseki TDB2 database from all the downloaded RDF fules
  shopt -s nullglob  # only read matches with existing files
  dataFiles=(*.rdf *.rdf.gz *.ttl *.ttl.gz *.owl *.owl.gz *.nt *.nt.gz *.nq *.nquads *.nquads.gz)
  filelist=""
  for datafile in "${dataFiles[@]}"
  do
     fullname="/pipelines/data/$datafile"
     filelist="$filelist $fullname"
  done
  echo "Creating a Fuseki database with $filelist..."

  # remove previously created database
  if [ -d "./DB" ]; then
    rm -rf ./DB
  fi

  # create the TDB2 database in the data dir with the name 'DB'
  docker compose run --rm tools /bin/bash -c "tdb2.tdbloader --loc /pipelines/data/DB $filelist"

  # Convert the array to a string with a delimiter
  dataFilesString=$(IFS=:; echo "${dataFiles[*]}")
  export SOURCE_FILES_DOWNLOADED="$dataFilesString"

  cd ..
  
  # store the filelist in the SOURCE_FILES variable
  envsubst < environment > tmp.env 
  mv tmp.env environment

  echo "Fuseki database created and SOURCE_FILES variable set!"

fi

echo "Configuration done!"





