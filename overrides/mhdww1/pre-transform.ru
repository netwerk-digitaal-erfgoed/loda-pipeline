PREFIX crm: <http://www.cidoc-crm.org/cidoc-crm/>
PREFIX edtf: <http://id.loc.gov/datatypes/edtf/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX sdo: <https://schema.org/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

# SCHEMA-AP-NDE has a language-tagged name, this dataset has an rdfs:label.
INSERT { ?record sdo:name ?name }
WHERE {
  ?record a sdo:CreativeWork ;
    rdfs:label ?label .
  BIND(STRLANG(STR(?label), "nl") AS ?name)
} ;

# SCHEMA-AP-NDE has an image with a license, contentUrl and thumbnailUrl, this dataset
# has a link to a file. The file number gives the URLs of the IIIF image.
INSERT {
  ?record sdo:associatedMedia ?media .
  ?media a sdo:MediaObject , sdo:ImageObject ;
    sdo:license <https://creativecommons.org/publicdomain/zero/1.0/> ;
    sdo:contentUrl ?contentUrl ;
    sdo:thumbnailUrl ?thumbnailUrl .
}
WHERE {
  ?record a sdo:CreativeWork ;
    sdo:image ?image .
  FILTER(ISLITERAL(?image))
  BIND(REPLACE(STR(?image), "^.*file=([0-9]+).*$", "$1") AS ?file)
  BIND(CONCAT("https://atlantislite.deventit.nl/IIIF/image/3.0/", ?file) AS ?iiifBase)
  BIND(IRI(CONCAT(STR(?record), "#media-", ?file)) AS ?media)
  BIND(IRI(CONCAT(?iiifBase, "/full/max/0/default.jpg")) AS ?contentUrl)
  BIND(IRI(CONCAT(?iiifBase, "/full/!250,250/0/default.jpg")) AS ?thumbnailUrl)
} ;

# SCHEMA-AP-NDE has a IIIF manifest with its own URI, this dataset has a blank node with its URL as text.
DELETE {
  ?record sdo:image ?node .
  ?node ?property ?value .
}
INSERT {
  ?record sdo:associatedMedia ?manifest .
  ?manifest
    sdo:license <https://creativecommons.org/publicdomain/zero/1.0/> ;
    sdo:encodingFormat "application/ld+json;profile=\"http://iiif.io/api/presentation/3/context.json\"" .
}
WHERE {
  ?record a sdo:CreativeWork ;
    sdo:image ?node .
  ?node sdo:contentUrl ?manifestUrl ;
    ?property ?value .
  BIND(IRI(STR(?manifestUrl)) AS ?manifest)
} ;

# SCHEMA-AP-NDE has a DefinedTerm with a name, this dataset has the type as text or as a CRM type.
DELETE { ?record sdo:additionalType ?text }
INSERT {
  ?record sdo:additionalType ?term .
  ?term a sdo:DefinedTerm ;
    sdo:name ?name .
}
WHERE {
  ?record a sdo:CreativeWork ;
    sdo:additionalType ?text .
  FILTER(ISLITERAL(?text))
  BIND(STRLANG(STR(?text), "nl") AS ?name)
  BIND(IRI(CONCAT(STR(?record), "#type-", ENCODE_FOR_URI(STR(?text)))) AS ?term)
} ;

INSERT {
  ?record sdo:additionalType ?type .
  ?type a sdo:DefinedTerm ;
    sdo:name ?name .
}
WHERE {
  ?record a sdo:CreativeWork ;
    crm:P2_has_type ?type .
  ?type a crm:E55_Type ;
    rdfs:label ?label .
  BIND(STRLANG(STR(?label), "nl") AS ?name)
} ;

INSERT {
  ?record sdo:material ?type .
  ?type a sdo:DefinedTerm ;
    sdo:name ?name .
}
WHERE {
  ?record a sdo:CreativeWork ;
    crm:P45_consists_of/crm:P2_has_type ?type .
  ?type rdfs:label ?label .
  BIND(STRLANG(STR(?label), "nl") AS ?name)
} ;

# SCHEMA-AP-NDE has a creator with a name, this dataset has the name as text.
INSERT {
  ?record sdo:creator ?creator .
  ?creator sdo:name ?name .
}
WHERE {
  ?record a sdo:CreativeWork ;
    sdo:creator ?text .
  FILTER(ISLITERAL(?text) && STR(?text) != "onbekend")
  BIND(STRLANG(STR(?text), "nl") AS ?name)
  BIND(IRI(CONCAT(STR(?record), "#creator-", ENCODE_FOR_URI(STR(?text)))) AS ?creator)
} ;

DELETE { ?record sdo:creator ?text }
WHERE {
  ?record a sdo:CreativeWork ;
    sdo:creator ?text .
  FILTER(ISLITERAL(?text))
} ;

# SCHEMA-AP-NDE has a dateCreated, this dataset has the production time span.
INSERT { ?record sdo:dateCreated ?date }
WHERE {
  ?record a sdo:CreativeWork ;
    crm:P108i_was_produced_by/crm:P4_has_time-span ?span .
  ?span crm:P82a_begin_of_the_begin ?begin ;
    crm:P82b_end_of_the_end ?end .
  BIND(SUBSTR(STR(?begin), 1, 4) AS ?beginYear)
  BIND(SUBSTR(STR(?end), 1, 4) AS ?endYear)
  BIND(IF(?beginYear = ?endYear,
    STRDT(?beginYear, xsd:gYear),
    STRDT(CONCAT(?beginYear, "/", ?endYear), edtf:EDTF)) AS ?date)
} ;

# SCHEMA-AP-NDE has language-tagged text, this dataset has plain text.
DELETE { ?record sdo:abstract ?text }
INSERT { ?record sdo:abstract ?tagged }
WHERE {
  ?record a sdo:CreativeWork ;
    sdo:abstract ?text .
  FILTER(LANG(?text) = "")
  BIND(STRLANG(STR(?text), "nl") AS ?tagged)
} ;

# SCHEMA-AP-NDE has one size text per language, this dataset has a text per dimension.
DELETE { ?record sdo:size ?text }
INSERT { ?record sdo:size ?tagged }
WHERE {
  {
    SELECT ?record (GROUP_CONCAT(?size; SEPARATOR = ", ") AS ?sizes) WHERE {
      ?record a sdo:CreativeWork ;
        sdo:size ?size .
      FILTER(ISLITERAL(?size))
    }
    GROUP BY ?record
  }
  ?record sdo:size ?text .
  FILTER(ISLITERAL(?text))
  BIND(STRLANG(?sizes, "nl") AS ?tagged)
}
