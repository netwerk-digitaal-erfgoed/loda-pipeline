PREFIX edtf: <http://id.loc.gov/datatypes/edtf/>
PREFIX sdo: <https://schema.org/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

# This dataset is in a named graph, so a DELETE has to name that graph to have any effect.

# SCHEMA-AP-NDE has no artform: it says what additionalType says.
INSERT { ?record sdo:additionalType ?artform }
WHERE {
  ?record a sdo:CreativeWork ;
    sdo:artform ?artform .
  FILTER(ISIRI(?artform))
} ;

INSERT {
  ?record sdo:additionalType ?term .
  ?term a sdo:DefinedTerm ;
    sdo:name ?name .
}
WHERE {
  ?record a sdo:CreativeWork ;
    sdo:artform ?text .
  FILTER(ISLITERAL(?text))
  BIND(STRLANG(STR(?text), "nl") AS ?name)
  BIND(IRI(CONCAT(STR(?record), "#type-", ENCODE_FOR_URI(STR(?text)))) AS ?term)
} ;

# SCHEMA-AP-NDE has no keywords: they say what about says.
INSERT { ?record sdo:about ?keyword }
WHERE {
  ?record a sdo:CreativeWork ;
    sdo:keywords ?text .
  BIND(IF(LANG(?text) = "", STRLANG(STR(?text), "nl"), ?text) AS ?keyword)
} ;

# SCHEMA-AP-NDE has a DefinedTerm, this dataset sometimes has the material as text.
DELETE { GRAPH ?g { ?record sdo:material ?text } }
INSERT {
  ?record sdo:material ?term .
  ?term a sdo:DefinedTerm ;
    sdo:name ?name .
}
WHERE {
  GRAPH ?g { ?record sdo:material ?text }
  FILTER(ISLITERAL(?text))
  BIND(STRLANG(STR(?text), "nl") AS ?name)
  BIND(IRI(CONCAT(STR(?record), "#material-", ENCODE_FOR_URI(STR(?text)))) AS ?term)
} ;

# The original mapping of this dataset uses the material as a type.
INSERT { ?record sdo:additionalType ?term }
WHERE {
  ?record a sdo:CreativeWork ;
    sdo:material ?term .
  ?term sdo:name ?name .
} ;

# The original mapping of this dataset uses the place of creation as dcterms:spatial.
INSERT { ?record sdo:contentLocation ?place }
WHERE {
  ?record a sdo:CreativeWork ;
    sdo:locationCreated ?place .
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
