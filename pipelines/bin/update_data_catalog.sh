#!/usr/bin/env bash
set -euo pipefail

source setuser.sh

export S3_BUCKET="nde-europeana"

export DATASET="." # needed for docker compose to use s3cmd somehow...

export DATACATALOG=dc4eu-lodacatalog.ttl

DATASETS=()
while IFS= read -r file; do
  DATASET_URI=$(grep -m1 -oE '^<[^>]+>' "$file")
  DATASETS+=("$DATASET_URI")
  DATASETDESCRIPTIONS+=$(grep -v prefix "$file");
done < <(find . -mindepth 2 -name "*datasetdescription.ttl")

if [ ${#DATASETS[@]} -eq 0 ]; then
  echo "ERROR: No *datasetdescription.ttl files found — exiting." >&2
  exit 1
fi

echo "Found ${#DATASETS[@]} datasets, creating data catalog."

IFS=', '
DCAT_DATASET="${DATASETS[*]}"
unset IFS

TODAY=$(date +%Y-%m-%d)


cat > $DATACATALOG <<EOF
@prefix dcat: <http://www.w3.org/ns/dcat#> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<https://dc4eu.nl/id/loda-catalog> a dcat:Catalog ;
  dcterms:title       "DC4EU/LODA Data Catalog"@en ;
  dcterms:description "A catalog of selected datasets prepared for Europeana in the LODA pipeline."@en ;
  dcterms:publisher   <https://dc4eu.nl> ;
  dcterms:modified    "${TODAY}"^^xsd:date ;
  dcat:dataset        ${DCAT_DATASET} ;
.
${DATASETDESCRIPTIONS}
EOF

docker compose run --rm s3cmd -f --cf-invalidate --no-preserve --no-mime-magic --mime-type=text/turle --acl-public put ${DATACATALOG} s3://${S3_BUCKET}/${DATACATALOG}
echo ""
echo "Datacatalog now available via  https://ams3.digitaloceanspaces.com/${S3_BUCKET}/${DATACATALOG}"