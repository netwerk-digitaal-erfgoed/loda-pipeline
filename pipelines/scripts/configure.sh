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

# see if a data download an initialization is necessary
# at least SOURCE_URL or SOURCE_FILE should be set
if [ -z "$SOURCE_URL" ] && [ -z "$SOURCE_FILES" ] ; then
   echo "Error: Please set SOURCE_URL or SOURCE_FILES variable in `environment` file"
   exit 1
fi

# used for detecting new downloads
newDownload=false

# used for detecting the need special nquad treatement for Fueksi
unionDefaultGraph=false

# if $SOURCE_URL is set a file will be downloaded 
if [ ! -z "$SOURCE_URL" ]; then
  cd data
  rm -rf *
  file=${SOURCE_URL##*/} 
  echo "Dataset name is: $DATASET"
  echo "Source URL is: $SOURCE_URL"
  echo "Cleaning the data dir and starting download..."
  if ! wget -o download-log.txt $SOURCE_URL; then
     echo ""
  fi

  # check if the download was succesful; else terminate the script
  if grep -wq "ERROR" download-log.txt; then 
      echo "ERROR in download, see download-log.txt for more information, aborting config procedure!" 
      if [ -f $file ]; then
        rm $file
      fi
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
    *.nt | *.nt.gz | *.rdf | *.rdf.gz | *.ttl | *.ttl.gz | *.owl | *.owl.gz)
        echo "Known file type, no extra processing needed!" ;;    
    *.nq | *.nquads | *.nquads.gz)
        echo "Known file type, no extra processing needed!" 
        echo "Detected nq types, setting the tdb2:unionDefaultGraph parameter to true in fuseki/config.ttl"
        # this var is used to select the nquad config file
        unionDefaultGraph=true
      ;;
    *)
    echo "Unsupported file format, please prepare download files manualy" 
    exit 1 ;;
  esac
  cd ..
  echo "Download and optional extraction performed, data files ready for processing."
  newDownload=true

fi

# proces the RDF data in ./data if the SOURCE_FILES var is blank 
if [ ! -z "$SOURCE_FILES" ] | [ "$newDownload" == true ]; then
  
  cd data
  echo "Looking for input files files to proces..."

  if [ "$newDownload" == false ]; then

      # build a list based on the SOURCE_FILES var
      echo "Adding $SOURCE_FILES to the list for building the database"
      IFS=":" dataFiles=( $SOURCE_FILES )
  
  else 
  
      # build al list from the RDF files in the data direct
      echo "Creating a list of RDF files for building the database"
      shopt -s nullglob  # only read matches with existing files
      dataFiles=(*.rdf *.rdf.gz *.ttl *.ttl.gz *.owl *.owl.gz *.nt *.nt.gz *.nq *.nquads *.nquads.gz)
  
  fi 
  
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

  # TODO: loading nquad requires an extra option in fuseki/config.ttl to be enabled
  #       define an automation for this detection quads and enabling this option

  # create the TDB2 database in the data dir with the name 'DB'
  docker compose run --rm tools /bin/bash -c "tdb2.tdbloader --loc /pipelines/data/DB $filelist"
  echo "Fuseki Database created!"

  # write some characteristics of the created database for debugging purposes
  docker compose run --rm tools /bin/bash -c "tdb2.tdbstats --loc /pipelines/data/DB > /pipelines/data/dbstats.txt"
  echo "See 'data/dbstats.txt' for more details about the contents of the database"

  cd ..

  # store the file list in the SOURCE_FILES variable 
  if [ "$newDownload" == true ]; then 

    # Convert the array to a string with a delimiter
    dataFilesString=$(IFS=:; echo "${dataFiles[*]}")

    # update the SOURCE_FILES variable in the environment file
    sed -i "/^export SOURCE_FILES=/c\export SOURCE_FILES=${dataFilesString}" ./environment

    echo "SOURCE_FILES variable set to ${dataFilesString}!"
  fi 

fi

if [ -f "./fuseki/config.ttl" ] | [ -f "./ld-workbench/config.yml" ]; then
  
  echo ""
  echo "Configuration files already exists so skipping the creation of new ones."
  echo "Do a manual check for the correct settings!"

else 

  echo "Creating the Fuseki config file"

  # create a local copy of the fuseki config file
  if [ "$unionDefaultGraph" == true ]; then
  
    # using nquad requires an addition statement for in the config file
    envsubst < ../generic/fuseki-config-nquad.ttl > ./fuseki/config.ttl

  else

    # use the default config file
    envsubst < ../generic/fuseki-config.ttl > ./fuseki/config.ttl

  fi

  echo "Creating the LD-Workbench config files"

  # write the LD-Workbench configuration based on the environment variables
  envsubst < ../generic/ld-workbench-config.yml > ld-workbench/config.yml

  # write the generator query based on the environment variables

  # to prevent replacement of the special variable $this
  export this="\$this"
  envsubst < ../generic/edm-generator.rq > ld-workbench/edm-generator.rq

  cp ../generic/iterator.rq ./ld-workbench

fi 

echo "Configuration done!"





