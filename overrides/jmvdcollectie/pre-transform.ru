PREFIX edtf: <http://id.loc.gov/datatypes/edtf/>
PREFIX sdo: <https://schema.org/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

# This dataset is in a named graph, so a DELETE has to name that graph to have any effect.

# Related material is a note on a record, not a heritage object.
DELETE { GRAPH ?g { ?note a sdo:CreativeWork } }
WHERE {
  GRAPH ?g { ?note a sdo:CreativeWork }
  ?record sdo:hasPart ?note .
  FILTER(CONTAINS(STR(?note), "#related-material-"))
} ;

# SCHEMA-AP-NDE has no artform: it says what additionalType says.
INSERT { ?record sdo:additionalType ?artform }
WHERE {
  ?record a sdo:CreativeWork ;
    sdo:artform ?artform .
} ;

# SCHEMA-AP-NDE requires an EDTF datatype for an interval.
DELETE { GRAPH ?g { ?record sdo:dateCreated ?text } }
INSERT { ?record sdo:dateCreated ?interval }
WHERE {
  GRAPH ?g { ?record sdo:dateCreated ?text }
  FILTER(CONTAINS(STR(?text), "/") && DATATYPE(?text) = xsd:string)
  BIND(STRDT(STR(?text), edtf:EDTF) AS ?interval)
} ;

# These are the moment of registration, not of creation.
DELETE { GRAPH ?g { ?record sdo:dateCreated ?timestamp } }
WHERE {
  GRAPH ?g { ?record sdo:dateCreated ?timestamp }
  FILTER(DATATYPE(?timestamp) = xsd:dateTime)
} ;

# SCHEMA-AP-NDE has a numeric size value, this dataset sometimes has a decimal comma.
DELETE { GRAPH ?g { ?size sdo:value ?text } }
INSERT { ?size sdo:value ?number }
WHERE {
  GRAPH ?g { ?size a sdo:QuantitativeValue ; sdo:value ?text }
  FILTER(DATATYPE(?text) = xsd:string && REGEX(STR(?text), "^[0-9]+,[0-9]+$"))
  BIND(STRDT(REPLACE(STR(?text), ",", "."), xsd:decimal) AS ?number)
} ;

# A size without a usable value says nothing.
DELETE {
  GRAPH ?g {
    ?record sdo:size ?size .
    ?size ?property ?value .
  }
}
WHERE {
  GRAPH ?g {
    ?record sdo:size ?size .
    ?size a sdo:QuantitativeValue ;
      ?property ?value .
  }
  FILTER NOT EXISTS {
    ?size sdo:value ?number .
    FILTER(DATATYPE(?number) != xsd:string)
  }
}
