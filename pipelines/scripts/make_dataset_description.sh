#!/bin/bash
set -e

export USER=$(id -u):$(id -g)  # to prevent docker creating 'root' owned files

# read the variables from the 'environment' file
source environment

if [ -z "${DATASET_DESCRIPTION_LANGUAGE}" ]; then
 	echo "DATASET_DESCRIPTION_LANGUAGE not set"
 	exit 1
fi
if [ -z "${DATASET_DESCRIPTION_TITLE}" ]; then 
	echo "DATASET_DESCRIPTION_TITLE not set"
	exit 1
fi
if [ -z "${DATASET_DESCRIPTION_CREATOR_URI}" ]; then
	echo "DATASET_DESCRIPTION_CREATOR_URI not set"
	exit 1
fi
if [ -z "${DATASET_DESCRIPTION_CREATOR_NAME}" ]; then
	echo "DATASET_DESCRIPTION_CREATOR_NAME not set"
	exit 1
fi
if [ -z "${DATASET_DESCRIPTION_CREATE_DATE}" ]; then
	echo "DATASET_DESCRIPTION_CREATE_DATE not set"
	exit 1
fi
if [ -z "${DATASET_DESCRIPTION_SOURCE_DATASET}" ]; then
	echo "DATASET_DESCRIPTION_SOURCE_DATASET not set"
	exit 1
fi
if [ -z "${DATASET_DESCRIPTION_DISTRUTION_BASE}" ]; then
	echo "DATASET_DESCRIPTION_DISTRUTION_BASE not set"
	exit 1
fi

echo "Creating dataset description for $DATASET..."

cd data
# make gzipped version to distribute
gzip -c ${DATASET}-distinct.nt > ${DATASET}.nt.gz

export DISTRIBUTION_NUMBER_TRIPLES=$(wc -l < ${DATASET}-distinct.nt)
export DISTRIBUTION_NUMBER_XML=$(unzip -l ${DATASET}.zip | grep ".edm.xml" | wc -l)

DATE_CREATED=$(stat -c %W "${DATASET}.nt.gz")
# Convert the timestamp to ISO 8601 format
export DISTRIBUTION_DATE_CREATED=$(date -d @$DATE_CREATED -u +"%Y-%m-%dT%H:%M:%SZ")

export DISTRIBUTION_CONTENT_URL_NTRIPLES="${DATASET_DESCRIPTION_DISTRUTION_BASE}/${DATASET}.nt.gz"
export DISTRIBUTION_SIZE_NTRIPLES=$(stat -c %s "${DATASET}.nt.gz")
export DISTRIBUTION_CONTENT_XMLZIP="${DATASET_DESCRIPTION_DISTRUTION_BASE}/${DATASET}.edmxml.zip"
export DISTRIBUTION_SIZE_XMLZIP=$(stat -c %s "${DATASET}.zip")

cd ..

repository="$PIPELINES_REPO/pipeines/$DATASET/ld-workbench"

queryFiles=(`docker compose run --rm tools /bin/bash -c "yq '.stages[].generator[].query' /pipelines/ld-workbench/config.yml"`)
queryFiles+=(`docker compose run --rm tools /bin/bash -c "yq '.stages[].iterator.query' /pipelines/ld-workbench/config.yml"`)

# build the list of query files used for the transformation
queryFileStr=""
for queryFile in "${queryFiles[@]}" ; do
     fileStr=${queryFile/file:\/\//}
     URL_query="$repository/$fileStr"
     if [ -z "$queryFileStr" ]; then
       queryFileStr="\"$URL_query\""
     else 
       queryFileStr="$queryFileStr,\"$URL_query\""
     fi
done

# store the result in the QUERY_FILES variable
export QUERY_FILES=$queryFileStr

envsubst < ../generic/datasetdescription.ttl > data/datasetdescription.ttl

docker compose run --rm tools /bin/bash -c "shacl validate --data /pipelines/data/datasetdescription.ttl --shapes https://raw.githubusercontent.com/netwerk-digitaal-erfgoed/dataset-register/refs/heads/main/requirements/shacl.ttl > /pipelines/data/validate-report-datasetdescription.txt"

#curl 'https://datasetregister.netwerkdigitaalerfgoed.nl/api/datasets' -H 'link: <http://www.w3.org/ns/ldp#RDFSource>; rel="type",<http://www.w3.org/ns/ldp#Resource>; rel="type"' -H 'content-type: application/ld+json' --data-binary '{"@id":"https://nde-europeana.ams3.digitaloceanspaces.com/nafotos.datasetdescription.ttl"}'