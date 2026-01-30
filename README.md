# Workflow for setting up the loda-pipelines

## Installation
Clone the repository to your local environment and build docker images.

```
$ git clone https://github.com/netwerk-digitaal-erfgoed/loda-pipeline.git
$ cd loda-pipeline
$ cd pipelines
$ source setpath
$ build-all.sh
```
This should result in a succesful build of the fuseki and tools image. The output should be similar to:

```
Using UID=1000 and GID=1000 for building the images
Building fuseki image, see build_fuseki_log.txt...
[+] Building 1/1
 ✔ fuseki  Built0.0s 
Building tools image, see build_tools_log.txt for details...
[+] Building 1/1
 ✔ tools  Built0.0s 
Ready builing the images!
```

The software is now ready for use. Please report any problems installing or building the software to tech@netwerkdigitaalerfgoed.nl, add the logfiles for debugging.

## 1. Preparation of a new dataset in the pipeline
To add a new dataset to the pipeline a number of steps must be performed. These steps are the initialization of the dataset, setting some environment variables, automatically creating configuration scripts and edit the sparql queries for the transformation. These steps are described in detail below. 

**NB Please take note the exact location within the directory structure for each of the steps described below. Running scripts in from the wrong location will give wrong results.**

### Set path
To easily find the scripts available in the `bin` dir **always** start the sequence with following command
```
$ source setpath
```
This will add the `bin` to the default PATH variable. 

### Initialize a new dataset
Starting point for the pipeline configuration is the `pipelines` directory. Each pipeline is created as a separate "dataset" directory within `pipelines`.

This step creates an new entry for the pipeline. Each dataset transformation is regarded as a separate pipeline. The script `init-dataset.sh` takes a dataset name as input and creates an empty structure for this pipeline in within the `pipelines` directory with the lowercase version of the dataset name including an empty `environment` file. 

```
$ cd pipelines
$ init-dataset.sh <new-dataset>
```

The result should be something like this:

```
initialize pipeline for 'new-dataset'
Creating new-dataset
Creating subdirectory for 'data'
Creating subdirectory for 'ld-workbench'
Creating subdirectory for 'fuseki'
Installing 'environment' file
Set DATASET name to new-dataset in new-dataset/environoment
Init proces finished - to proceed set the correct variables in the 'environment' file in 'new-dataset'
```

### Edit the enivronment file
Edit the `environment` file in newly created dataset directory. The pipeline needs a dataset a starting point. There are three ways to specify a source for the data:

1. Set the `DATASET_URI` variable to the URI of the dataset which has Linked Data distributions and is registered in the [NDE-Datasetregister](https://datasetregister.netwerkdigitaalerfgoed.nl/). In this case the software will query the Datasetregister and select one of the available linked data distributions and start the download based on this link. If the `DATASET_URI` is set, the `DOWNLOAD_URL` and `DATA_FILES` variable are automatically set during the configuration proces.

2. Or set the `DOWNLOAD_URL` variable directly to any url where the data can be downloaded from. In this case the dataset is downloaded and extracted automatically. 
3. Or set the `DATA_FILES` and place one or more data files in the data directory manually. 


The variable `PRODUCTION=0` is used for signalling that this dataset is ready for automatic processing. Setting the value to `1` will make this dataset part of the complete pipeline and the processing will triggered by running the `run-all.sh` scripts, which could be setup to run periodically. Leave the value at `0` while testing the new setup for this datasets. The seperate steps in the pipeline can be run manually, see below. 

For the automati creation of a NDE dataset description for the resulting dataset, the additional `DATASET_DESCRIPTION` variables should be set too. See the documentation in the `environment` files for more details. 

### Set up the pipeline configuration 
The next step is automatically downloading the data, creating a Fuseki database and creating the config files for Fuseki and LDWorkbench based on the variables that have been set in the previous step. This is done by calling the `configure.sh`. 

```
$ cd <new-dataset>      # if necessary
$ configure.sh
```

The `configure.sh` script reads the environment variables. It will download or read the datafile(s), create a database for Fuseki and create configuration files for Fuseki and [LD-Workbench](https://github.com/netwerk-digitaal-erfgoed/ld-workbench). It will also install a default set of transformation queries. Consult the logfiles `download-log.txt` and `dbstats.txt` in the `logs` directory for more information about the results of these steps. 

### Edit the sparql queries used for the mapping
The pipeline is now ready to run but the transformation queries must be tailored for the dataset. The default transformation is prepared for the NDE Schema.org profile to EDM mapping. Depending on the conformity to the Schema.org profile adjustments will be necessary. 

LD-Workbench uses a so called iterator query for selecting the resources that are in scope for the transformation. See [interator.rq](pipelines/generic/iterator.rq) for the default version for this query. The actualy mapping for each of the resource is defined using a CONSTRUCT query, the so called generator query. See [edm-generator.rq](pipelines/generic/edm-generator.rq) for the default version. 

Both queries are installed in the `<new-dataset>` subdirectory. Adjust these queries to define the specific conversion for this dataset. 

Tip: Writing the generator query can sometimes be hard. You can start a local sparql endpoint (see next step) and use Yasgui or the VScode SPARQL extension to tune the query interactivly. When finished make sure that the subject `(?s)` is replaced by the iterator variable `$this` which is needed for the LD-Workbench processing.


### 2. Testing the pipeline
The pipeline is now configured to create the datasets acoording to configuration steps described above. Before adding the new dataset to the production pipeline all it should be tested manualy. The section below describes a complete cycle. When satisfied with the results of all the steps the dataset can be added to the production pipeline. See below for more information. 

### Starting the sparql server
The next step is starting the local sparql server with using the dataset defined in the `environment` file. The script will start the server as a background task.

```
$ cd <dataset>      # if necessary
$ start-sparql-server.sh
```

The output should be similar to:
```
Starting the SPARQL server with for <new-dataset>...
[+] Running 1/1
 ✔ Container pipelines-fuseki-1  Started 0.3s  
Waiting for the sparql server to be up and running...
Sparql server available!
 ```

The SPARQL endpoint should now be available at `http://localhost:3030/<dataset>/sparql`. Visiting this URL in the browser should show the following message:
`Service Description: /<dataset>/sparql`

In case of problems see the logfile `fuseki-log.txt` in the `logs` directory for details.


### Running the mapping 
All is set now to do the actual transformation of the data. Make sure the starting point is the `<dataset>` directory.

```
$ cd <new-dataset>      # if necessary
$ run-mapping.sh
```

This should result something similar to the output below:

```
Transforming 'new-dataset' data using LD-workbench, see ld-workbench-log.txt for more details...
```

When succesfully completed the resulting output file with the name `<dataset>.nt` in the main directory. See the log file `ld-workbench-log.txt` for details about the processing, especially helpful for debugging. 

### Stopping the sparql endpoint
The SPARQL-endpoint is no longer needed, so it can be stopped:

```
$ cd <dataset>      # if necessary
$ stop-sparql-server.sh
``` 

### Running the EDM conversion
Although the resulting dataset contains usuable EDM linked data some additional steps must be taken to make this dataset ready for delivery to ingestion pipeline of Europeana. 

The `convert-to-edm.sh` script performs the folling steps:

- deduplicate the LD-Workbench output
- validate the data against an EDM shape file
- convert the data to an RDF/XML serialization
- rewrite the RDF/XML serialization to XML 
- zip the result

To perform these step run the following command:
```
$ cd <dataset>      # if necessary
$ convert-to-edm.sh
```

This result is something similar to the following output:
```
Make the data ready for upload to Europeana..
Deduplicate the output from LDWorkbench...
Validate the result against the EDM shape constraints...
Convert the data file to a RDF/XML serialization...
Rewrite the RDF/XML to XML that can be processed by Europeana...
Ready: output file amateurfilm.zip is written to the main directory...
```

Check the `validate-report.txt` in the `logs` directory for any detected problems and adjust the generator query if nessecary and rerun the mapping and convert steps. 

*Note: the deduplication is a performed to make sure that there are no duplicate triples in the resultset. This step also garantees that the edm:isShowBy only has one value for each resource, when more values are generated in the mapping process a random choice is made. See the [distinct.rq](./pipelines/generic/distinct.rq) query for more details.*


### Create a dataset description
The result of the transformation is a dataset that can be published and registered in the NDE-Datasetregister. In order to do so a dataset description according to the NDE requirements must be created. The dataset description requires a number of static data fields that must be set through the `environment` file. See the section with the `DATASET_DESCRIPTION` for the variables that must be set. See the [NDE Requirements](https://docs.nde.nl/requirements-datasets/) for more details about the different variables and the allowed values. 

After setting the variables the dataset description can be created with the following script:

```
$ cd <dataset>      # if necessary
$ make_dataset_description.sh
``` 

This shoud result in a file called `datasetdescription.ttl` in the main directory that can be used to register the new dataset to the NDE-Datasetregister. In the file `validate-report-datasetdescription.txt` in the `logs` directory the result of the validation is given. See the requirements mentioned above for more information about eventual errors and warnings. 


## Run the complete pipeline
After a succesful result for all steps mentioned above the dataset is ready to be added to the pipline to be run automatically. Change the `PRODUCTION` variable in the `environment` file to `1`. And either go back to the `pipelines` directory and run of the `run-all.sh` script with the `<dataset>` as parameter to process only this dataset or without a parameter to run the pipeline for all the datasets.

```
$ cd pipelines      # if necessary
$ run-all.sh [ <dataset> ]   # optional parameter
``` 

## Directory structure

```md
loda-pipeline/
├── europeana-tools         * EDM-conversion and java tooling 
├── jena-fuseki-docker      * used as local triplestore
└── pipelines
    ├── dataset 1
    |   ├── data/                   * data directory 
    |   ├── logs/                   * logs directory
    |   ├── environment             * main variables defining the dataset
    |   ├── ld-workbench-config.yml * actual transformation queries
    |   ├── iterator.rq 
    |   ├── edm-generator.rq 
    |   └── fuseki-config.ttl       * Fuseki config file
    |
    ├── dataset n
    |
    ├── bin         * scripts as building blocks for the pipeline
    | 
    └── generic     * default config files used a template for new dataset configuration
```