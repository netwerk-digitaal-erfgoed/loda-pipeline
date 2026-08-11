#!/bin/bash
source setuser.sh

# optional flag for Fuseki, set when data is in nquads
unionDefaultGraph=false

# read the variables for this dataset
source environment


# function that selects the best RDF download link based on the DATASET_URI variable
select_download_link() {

    dr_endpoint="https://datasetregister.netwerkdigitaalerfgoed.nl/sparql"

    # use the DATASET_URI to create the download query for this dataset
    envsubst < ../generic/downloadlink.rq > ./data/downloadlink.rq

    echo "Searching the Datasetregister for a download link for dataset $DATASET_URI..."

    # run the query at the Datasetregister's sparql endpoint and store the result in an array
    IFS=$'\n' read -r -d $'' -a sparqlresults < <( docker compose run --rm tools /bin/bash -c "rsparql --service $dr_endpoint --query /pipelines/data/downloadlink.rq --results CSV" && printf '\0' )

    # ignore the header line, read the value of the accessUrl as the first result
    downloadfile=`echo ${sparqlresults[1]}| tr -d '\r'`

    echo "Download file is: $downloadfile"

    if [ "$downloadfile" == "" ]; then
        echo "No download file found, please set the DOWNLOAD_URI manually and clear the DATASET_URI setting" 
        exit 1
    else
        # store the name of the download file in the DOWNLOAD_URL variable
        sed -i "/^export DOWNLOAD_URL=/c\export DOWNLOAD_URL=${downloadfile}" ./environment
    fi
}


download_data_files() {

    source environment
    echo "downloading data files"
    echo "Dataset name is: $DATASET"
    echo "DOWNLOAD URL is: $DOWNLOAD_URL"
    echo "Cleaning the data dir and starting download..."

    # clear the data directory
    cd data
    rm -rf *

    # do the actual download
    wget -v $DOWNLOAD_URL > ../logs/download-log.txt 2>&1

    # determine the name of the download file
    file=${DOWNLOAD_URL##*/} 
    echo "Name of the download file is: $file"

    # check if the download was succesful; else terminate the script
    if grep -wq "ERROR" ../logs/download-log.txt; then 
        echo "ERROR in download, see logs/download-log.txt for more information, aborting config procedure!" 
        if [ -f "$file" ]; then
            rm $file
        fi
        cd ..
        exit 1
    fi

    # download was succesfull, see if further processing is needed
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
        *.nq | *.nquads | *.nquads.gz | *.nq.gz )
            echo "Known file type, no extra processing needed!" 
            echo "Detected nq types, setting the tdb2:unionDefaultGraph parameter to true in fuseki/config.ttl"
            # this var is used to select the nquad config file
            unionDefaultGraph=true
            ;;
        *)
            echo "Unsupported file format, please prepare download files manualy" 
            exit 1 ;;
    esac

    # build al list from the RDF files in the data direct
    echo "Creating a list of RDF files for building the database"
    shopt -s nullglob  # only read matches with existing files
    dataFiles=(*.rdf *.rdf.gz *.ttl *.ttl.gz *.owl *.owl.gz *.nt *.nt.gz *.nq *.nquads *.nquads.gz *.nq.gz)

    # Convert the array to a string with a delimiter
    dataFilesString=$(IFS=:; echo "${dataFiles[*]}")

    cd ..

    # update the DATA_FILES variable in the environment file
    sed -i "/^export DATA_FILES=/c\export DATA_FILES=${dataFilesString}" ./environment

    echo "DATA_FILES variable set to ${dataFilesString}!"

    echo "Download and optional extraction performed, data files ready for processing."
}

load_data() {

    if [ -z $dataFiles ]; then
       echo "Error: no files to load specified, this should not happen, aborting!" 
       exit 1
    fi

    cd data
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

    # TODO: some datasets have strange names like ""Dataset+Beeldbank+Erfgoed+'s-Hertogenbosch.nt" 
    # currently this breaks the Fuseke loader script.
    #
    # create the TDB2 database in the data dir with the name 'DB'
    docker compose run --rm tools /bin/bash -c "tdb2.tdbloader --loc /pipelines/data/DB $filelist"
    echo "Fuseki Database created!"

    # write some characteristics of the created database for debugging purposes
    docker compose run --rm tools /bin/bash -c "tdb2.tdbstats --loc /pipelines/data/DB > /pipelines/logs/dbstats.txt"
    echo "See 'logs/dbstats.txt' for more details about the contents of the database"

    cd ..

}

# function for creating the configuration files for specific for this dataset
write_config_files() {

    if [ -f "./fuseki-config.ttl" ] | [ -f "./ld-workbench-config.yml" ]; then
  
        echo "Configuration files already exists assuming correct config files are installed!"

    else 

        echo "Creating the Fuseki config file"

        # create a local copy of the fuseki config file
        if [ "$unionDefaultGraph" == true ]; then
  
            # using nquad requires an addition statement for in the config file
            envsubst < ../generic/fuseki-config-nquad.ttl > ./fuseki-config.ttl

        else

            # use the default config file
            envsubst < ../generic/fuseki-config.ttl > ./fuseki-config.ttl

        fi

        echo "Creating the LD-Workbench config files"

        # write the LD-Workbench configuration based on the environment variables
        envsubst < ../generic/ld-workbench-config.yml > ./ld-workbench-config.yml

        # write the generator query based on the environment variables

        # small hack to prevent replacement of the special variable $this
        export this="\$this"

        # create the generator query for this dataset
        envsubst < ../generic/edm-generator.rq > ./edm-generator.rq

        # copy the default iterator query to the dataset configuration as a starting point
        cp ../generic/iterator.rq ./iterator.rq

    fi 

}

# ======================= main part of the script ==================================

# check if the DATASET_URI is set, in that case a distribution link will be selected
# and a new download sequence will start
if [ ! -z "$DATASET_URI" ]; then 

    echo "Dataset URI: $DATASET_URI"
    
    select_download_link    # call function to determine the proper download link

    download_data_files     # call function to actually download the data files

    load_data               # call function to load the data into the Fuseki database


# if the DATASET_URI is not set try to follow a download link   
elif [ ! -z "$DOWNLOAD_URL" ]; then 

    download_data_files     # call function to actually download the data files

    load_data               # call function to load the data into the Fuseki database


# if only the DATA_FILES variable is set use this to load the files
elif [ ! -z "$DATA_FILES" ]; then 

    # build a list based on the DATA_FILES_FILES var
    echo "Adding $DATA_FILES to the list for building the database"
    IFS=":" dataFiles=( $DATA_FILES )

    load_data               # call function to load the data into the Fuseki database

else 

    echo "No data found, please set DATASET_URI, DOWNLOAD_URI or DATASET_FILES..."
    exit 1
fi 

# call function to create the configuration files for this dataset
write_config_files
