#!/bin/bash
set -e

# pass the dataset name as the first argument
export DATASETNAME="${1}"
export DATASET="./${DATASETNAME}"
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

if [ ! -f ./${DATASETNAME}/${DATASETNAME}.datasetdescription.ttl ]; then
    echo "File ${DATASETNAME}/${DATASETNAME}.datasetdescription.ttl not found,"
	echo "NOT uploading ${DATASET} files to S3 bucket ..."	
fi

cd ${DATASET}

echo "Uploading ${DATASET} files to S3 bucket ..."
echo "- ${DATASETNAME}.zip"
docker compose run --rm s3cmd -f --cf-invalidate --no-preserve --no-mime-magic --mime-type=application/zip --acl-public put ${DATASETNAME}.zip s3://${S3_BUCKET}/${1}.edmxml.zip
echo "- ${DATASETNAME}.nt.gz"
docker compose run --rm s3cmd -f --cf-invalidate --no-preserve --no-mime-magic --mime-type=application/n-triples+gzip --acl-public put ${DATASETNAME}.nt.gz s3://${S3_BUCKET}/${DATASETNAME}.nt.gz
echo "- ${DATASETNAME}.datasetdescription.ttl"
docker compose run --rm s3cmd -f --cf-invalidate --no-preserve --no-mime-magic --mime-type=text/turtle --acl-public put ${DATASETNAME}.datasetdescription.ttl s3://${S3_BUCKET}/${DATASETNAME}.datasetdescription.ttl
echo ""
curl 'https://datasetregister.netwerkdigitaalerfgoed.nl/api/datasets' -H 'link: <http://www.w3.org/ns/ldp#RDFSource>; rel="type",<http://www.w3.org/ns/ldp#Resource>; rel="type"' -H 'content-type: application/ld+json' --data-binary '{"@id":"https://${S3_BUCKET}.ams3.digitaloceanspaces.com/${DATASETNAME}.datasetdescription.ttl"}'
echo ""
echo "https://${S3_BUCKET}.ams3.digitaloceanspaces.com/${DATASETNAME}.datasetdescription.ttl"