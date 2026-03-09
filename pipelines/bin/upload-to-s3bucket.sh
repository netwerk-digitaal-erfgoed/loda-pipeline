#!/bin/bash
set -e

# to prevent docker creating 'root' owned files
source setuser.sh

# read the configuration variables for this dataset
source environment

if [ -z $DATASET ]; then
  echo "Please swith to a dataset directory" 
fi

# TODO move to environment
export S3_BUCKET="nde-europeana"

if [ ! -d .s3 ] || [ ! -f .s3/.s3cfg ]; then
    echo "No S3 configuration found, create via"
	echo "docker run --rm -ti -v $(pwd):/s3 -v $(pwd)/.s3:/root d3fk/s3cmd --configure"
	echo "NOT uploading ${DATASET} files to S3 bucket ..."
	exit

	# Before you run the --configure step, you need an API token from the object storage,
	# For DigitalOcean you need a token for the spaces.read and spaces.update scopes,
	# via https://cloud.digitalocean.com/account/api/tokens

	# other values asked are
	# bucket_location = EU
	# host_base = ams3.digitaloceanspaces.com
	# host_bucket = nde-europeana.ams3.digitaloceanspaces.com

	# The file .s3/.s3cfg is created, optionally you can
	# change the value of public_url_use_https from False to True
fi

if [ ! -f datasetdescription.ttl ]; then
    echo "File datasetdescription.ttl not found,"
	echo "NOT uploading ${DATASET} files to S3 bucket ..."	
fi

echo "Uploading ${DATASET} files to S3 bucket ..."

echo "- ${DATASET}.zip"
docker compose run --rm s3cmd --config=/root/.s3cfg -f --cf-invalidate --no-preserve --no-mime-magic --mime-type=application/zip --acl-public put /s3/${DATASET}.zip s3://${S3_BUCKET}/${DATASET}.edmxml.zip
echo "- ${DATASET}.nt.gz"
docker compose run --rm s3cmd -f --cf-invalidate --no-preserve --no-mime-magic --mime-type=application/n-triples+gzip --acl-public put ${DATASET}.nt.gz s3://${S3_BUCKET}/${DATASET}.nt.gz
echo "- ${DATASET}.datasetdescription.ttl"
docker compose run --rm s3cmd -f --cf-invalidate --no-preserve --no-mime-magic --mime-type=text/turtle --acl-public put datasetdescription.ttl s3://${S3_BUCKET}/${DATASET}.datasetdescription.ttl

echo "Registering dataset description https://${S3_BUCKET}.ams3.digitaloceanspaces.com/${DATASET}.datasetdescription.ttl"
curl -v -X 'POST' \
  'https://datasetregister.netwerkdigitaalerfgoed.nl/api/datasets' \
  -H 'accept: application/ld+json' \
  -H 'Content-Type: application/ld+json' \
  -d '{ "@id": "https://'$S3_BUCKET'.ams3.digitaloceanspaces.com/'$DATASET'.datasetdescription.ttl" }'
#curl 'https://datasetregister.netwerkdigitaalerfgoed.nl/api/datasets' -H 'link: <http://www.w3.org/ns/ldp#RDFSource>; rel="type",<http://www.w3.org/ns/ldp#Resource>; rel="type"' -H 'content-type: application/ld+json' --data-binary '{"@id":""}'
