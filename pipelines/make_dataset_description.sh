#!/bin/bash
set -e

# pass the dataset name as the first argument
export DATASETNAME="${1}"

if [ ! -f ./${1}/datasetdescription.env ]; then
	echo "No datasetdescription contents found, create ${DATASET}/datasetdescription.env"
	exit;
fi

# make gzipped version to distribute
gzip -c ${DATASETNAME}/${DATASETNAME}-distinct.nt > ${DATASETNAME}/${DATASETNAME}.nt.gz

source ./${DATASETNAME}/datasetdescription.env >/dev/null

export DISTRIBUTION_NUMBER_TRIPLES=$(wc -l < ${DATASETNAME}/${DATASETNAME}-distinct.nt)
export DISTRIBUTION_NUMBER_XML=$(unzip -l ${DATASETNAME}/${DATASETNAME}.zip | grep ".edm.xml" | wc -l)

DISTRIBUTION_DATE_CREATED=$(stat -c %W "${DATASETNAME}/${DATASETNAME}.nt.gz")
# Convert the timestamp to ISO 8601 format
export DISTRIBUTION_DATE_CREATED=$(date -d @$DISTRIBUTION_DATE_CREATED -u +"%Y-%m-%dT%H:%M:%SZ")

export DISTRIBUTION_CONTENT_URL_NTRIPLES="${DATASET_DESCRIPTION_DISTRUTION_BASE}/${DATASETNAME}.nt.gz"
export DISTRIBUTION_SIZE_NTRIPLES=$(stat -c %s "${DATASETNAME}/${DATASETNAME}.nt.gz")
export DISTRIBUTION_CONTENT_XMLZIP="${DATASET_DESCRIPTION_DISTRUTION_BASE}/${DATASETNAME}.edmxml.zip"
export DISTRIBUTION_SIZE_XMLZIP=$(stat -c %s "${DATASETNAME}/${DATASETNAME}.zip")

envsubst < datasetdescription.ttl > ${DATASETNAME}/${DATASETNAME}.datasetdescription.ttl