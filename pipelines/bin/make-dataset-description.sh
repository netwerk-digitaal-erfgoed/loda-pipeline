#!/bin/bash
set -e

# to prevent docker creating 'root' owned files
source setuser.sh

# read the configuration variables for this dataset
source environment

if [ -z $DATASET ]; then
  echo "Please swith to a dataset directory" 
fi

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

export DISTRIBUTION_NUMBER_TRIPLES=$(wc -l < data/${DATASET}-distinct.nt)

export DISTRIBUTION_NUMBER_XML=$(unzip -l ${DATASET}.zip | grep ".edm.xml" | wc -l)

DATE_CREATED=$(stat -c %W "${DATASET}.nt.gz")
# Convert the timestamp to ISO 8601 format
export DISTRIBUTION_DATE_CREATED=$(date -d @$DATE_CREATED -u +"%Y-%m-%dT%H:%M:%SZ")

export DISTRIBUTION_CONTENT_URL_NTRIPLES="${DATASET_DESCRIPTION_DISTRUTION_BASE}/${DATASET}.nt.gz"
export DISTRIBUTION_SIZE_NTRIPLES=$(stat -c %s "${DATASET}.nt.gz")
export DISTRIBUTION_CONTENT_URL_XMLZIP="${DATASET_DESCRIPTION_DISTRUTION_BASE}/${DATASET}.edmxml.zip"
export DISTRIBUTION_SIZE_XMLZIP=$(stat -c %s "${DATASET}.zip")

repository="$PIPELINES_REPO/$DATASET"

queryFiles=(`docker compose run --rm tools /bin/bash -c "yq '.stages[].generator[].query' /pipelines/ld-workbench-config.yml"`)
queryFiles+=(`docker compose run --rm tools /bin/bash -c "yq '.stages[].iterator.query' /pipelines/ld-workbench-config.yml"`)

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

envsubst < ../generic/datasetdescription.ttl > datasetdescription.ttl

echo "Dataset description created - now validating against Datasetregister validation endpoint..."
http_response=$(curl -o logs/datasetdescription-validation-result.jsonld -w "%{response_code}" \
			-X POST https://datasetregister.netwerkdigitaalerfgoed.nl/api/datasets/validate \
			-H 'accept: application/ld+json' \
			-H 'Content-Type: text/turtle' \
			--data-binary '@datasetdescription.ttl') 

if [ $http_response != "200" ]; then
    echo "Validation errors where found, see 'ds-description-validation-result.jsonld' for more information"
	echo "The errors need to be fixed before proceeding!"
	echo "Http response: $http_response"
	exit
else
    echo "Validation succesful, see 'ds-description-validation-result.jsonld' for warnings and possible improvements"
fi

echo "Storing the datasetdescription in the S3 storage"

if [ ! -d .s3 ] || [ ! -f .s3/.s3cfg ]; then
    echo "No S3 configuration found, run the upload-to-s3bucket.sh first!"
	exit
fi

if [ ! -f datasetdescription.ttl ]; then
    echo "File datasetdescription.ttl not found,"
	echo "NOT uploading ${DATASET} files to S3 bucket ..."
	exit	
else 
	echo "Uploading ${DATASET} distribution files to S3 bucket ${S3_BUCKET}..."
	docker compose run --rm s3cmd -f --cf-invalidate --no-preserve --no-mime-magic --mime-type=text/turtle --acl-public put datasetdescription.ttl s3://${S3_BUCKET}/${DATASET}.datasetdescription.ttl
fi

echo "Registering dataset description https://${S3_BUCKET}.ams3.digitaloceanspaces.com/${DATASET}.datasetdescription.ttl"

curl -v -X 'POST' \
  'https://datasetregister.netwerkdigitaalerfgoed.nl/api/datasets' \
  -H 'accept: application/ld+json' \
  -H 'Content-Type: application/ld+json' \
  -d '{ "@id": "https://'$S3_BUCKET'.ams3.digitaloceanspaces.com/'$DATASET'.datasetdescription.ttl" }'

#curl 'https://datasetregister.netwerkdigitaalerfgoed.nl/api/datasets' -H 'link: <http://www.w3.org/ns/ldp#RDFSource>; rel="type",#<http://www.w3.org/ns/ldp#Resource>; rel="type"' -H 'content-type: application/ld+json' --data-binary '{"@id":""}'

#curl 'https://datasetregister.netwerkdigitaalerfgoed.nl/api/datasets' -H 'link: <http://www.w3.org/ns/ldp#RDFSource>; rel="type",<http://www.w3.org/ns/ldp#Resource>; rel="type"' -H 'content-type: application/ld+json' --data-binary '{"@id":"https://nde-europeana.ams3.digitaloceanspaces.com/nafotos.datasetdescription.ttl"}'
