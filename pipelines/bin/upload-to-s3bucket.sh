#!/bin/bash
set -e

# to prevent docker creating 'root' owned files
source setuser.sh

# read the configuration variables for this dataset
source environment

if [ -z $DATASET ]; then
  echo "Please swith to a dataset directory" 
fi

# make gzipped version to distribute
echo "Creating a gzip version of the N-triples distribution..."
gzip -c data/${DATASET}-distinct.nt > ${DATASET}.nt.gz


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

echo "Uploading ${DATASET} distribution files to S3 bucket ${S3_BUCKET}..."

# Note: already renamed to edmxml.zip
echo "- ${DATASET}.zip"
docker compose run --rm s3cmd --config=/root/.s3cfg -f --cf-invalidate --no-preserve --no-mime-magic --mime-type=application/zip --acl-public put /s3/${DATASET}.zip s3://${S3_BUCKET}/${DATASET}.edmxml.zip
echo "- ${DATASET}.nt.gz"
docker compose run --rm s3cmd --config=/root/.s3cfg -f --cf-invalidate --no-preserve --no-mime-magic --mime-type=application/n-triples+gzip --acl-public put ${DATASET}.nt.gz s3://${S3_BUCKET}/${DATASET}.nt.gz
