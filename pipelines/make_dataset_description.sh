#!/bin/bash
set -e

# pass the dataset name as the first argument
export DATASET="./${1}"
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

DATE_CREATED=$(stat -c %W "${DATASETNAME}/${DATASETNAME}.nt.gz")
# Convert the timestamp to ISO 8601 format
export DISTRIBUTION_DATE_CREATED=$(date -d @$DATE_CREATED -u +"%Y-%m-%dT%H:%M:%SZ")

export DISTRIBUTION_CONTENT_URL_NTRIPLES="${DATASET_DESCRIPTION_DISTRUTION_BASE}/${DATASETNAME}.nt.gz"
export DISTRIBUTION_SIZE_NTRIPLES=$(stat -c %s "${DATASETNAME}/${DATASETNAME}.nt.gz")
export DISTRIBUTION_CONTENT_XMLZIP="${DATASET_DESCRIPTION_DISTRUTION_BASE}/${DATASETNAME}.edmxml.zip"
export DISTRIBUTION_SIZE_XMLZIP=$(stat -c %s "${DATASETNAME}/${DATASETNAME}.zip")

envsubst < datasetdescription.ttl > ${DATASETNAME}/${DATASETNAME}.datasetdescription.ttl

docker compose run --rm europeana-tools /bin/bash -c "shacl validate --data /opt/data/${DATASETNAME}.datasetdescription.ttl --shapes https://raw.githubusercontent.com/netwerk-digitaal-erfgoed/dataset-register/refs/heads/main/requirements/shacl.ttl > /opt/data/validate-report-db.txt"

#curl 'https://datasetregister.netwerkdigitaalerfgoed.nl/api/datasets' -H 'link: <http://www.w3.org/ns/ldp#RDFSource>; rel="type",<http://www.w3.org/ns/ldp#Resource>; rel="type"' -H 'content-type: application/ld+json' --data-binary '{"@id":"https://nde-europeana.ams3.digitaloceanspaces.com/nafotos.datasetdescription.ttl"}'

