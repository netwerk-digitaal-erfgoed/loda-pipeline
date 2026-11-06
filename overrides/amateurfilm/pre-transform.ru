PREFIX sdo: <https://schema.org/>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

# SCHEMA-AP-NDE has the license on the media, this dataset has it on the record.
# Replace CNE and missing licenses with InC.
INSERT { ?media sdo:license ?fixedLicense }
WHERE {
  ?record a sdo:CreativeWork ;
    sdo:associatedMedia ?media .
  OPTIONAL { ?record sdo:license ?license }
  BIND(COALESCE(
    IF(BOUND(?license),
      IF(?license = <http://rightsstatements.org/vocab/CNE/1.0/>, 1/0, ?license),
      1/0),
    <http://rightsstatements.org/vocab/InC/1.0/>
  ) AS ?fixedLicense)
} ;

# SCHEMA-AP-NDE has a named creator, this dataset has a Role with a GTAA term.
INSERT { ?role sdo:name ?label }
WHERE {
  ?record a sdo:CreativeWork ;
    sdo:creator ?role .
  ?role sdo:creator ?term .
  ?term skos:prefLabel ?label .
} ;

# SCHEMA-AP-NDE has a string identifier, this dataset has a persistent identifier URI.
DELETE { ?record sdo:identifier ?identifier }
INSERT { ?record sdo:identifier ?identifierString }
WHERE {
  ?record a sdo:CreativeWork ;
    sdo:identifier ?identifier .
  FILTER(ISIRI(?identifier))
  BIND(STR(?identifier) AS ?identifierString)
}
