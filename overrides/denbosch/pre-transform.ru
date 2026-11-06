PREFIX sdo: <https://schema.org/>

# The records of this dataset are MediaObjects, the collections they are in are blank CreativeWorks.
DELETE {
  ?record sdo:isPartOf ?collection .
  ?collection ?property ?value .
}
WHERE {
  ?record sdo:isPartOf ?collection .
  ?collection ?property ?value .
  FILTER(ISBLANK(?collection))
} ;

DELETE { ?record a sdo:MediaObject }
INSERT { ?record a sdo:CreativeWork }
WHERE {
  ?record a sdo:MediaObject .
  FILTER(!ISBLANK(?record))
} ;

# SCHEMA-AP-NDE has a named creator, this dataset has an author with a plain name.
DELETE { ?author sdo:name ?text }
INSERT {
  ?record sdo:creator ?author .
  ?author sdo:name ?name .
}
WHERE {
  ?record a sdo:CreativeWork ;
    sdo:author ?author .
  ?author sdo:name ?text .
  BIND(STRLANG(STR(?text), "nl") AS ?name)
} ;

# SCHEMA-AP-NDE has a Place with a name, this dataset has a street and locality in an address.
DELETE { ?place sdo:name ?oldName }
INSERT { ?place sdo:name ?name }
WHERE {
  ?record a sdo:CreativeWork ;
    sdo:contentLocation ?place .
  ?place sdo:address ?address .
  ?address sdo:streetAddress ?street .
  OPTIONAL { ?address sdo:addressLocality ?locality . FILTER(ISLITERAL(?locality)) }
  OPTIONAL { ?place sdo:name ?oldName }
  BIND(STRLANG(CONCAT(STR(?street), IF(BOUND(?locality), CONCAT(", ", STR(?locality)), "")), "nl") AS ?name)
} ;

# SCHEMA-AP-NDE has no empty places and persons, this dataset has places without an
# address and authors without a name.
DELETE {
  ?record sdo:contentLocation ?place .
  ?place a sdo:Place .
}
WHERE {
  ?record sdo:contentLocation ?place .
  ?place a sdo:Place .
  FILTER NOT EXISTS { ?place sdo:name ?name }
} ;

DELETE {
  ?record sdo:author ?author .
  ?author a sdo:Person .
}
WHERE {
  ?record sdo:author ?author .
  ?author a sdo:Person .
  FILTER NOT EXISTS { ?author sdo:name ?name }
} ;

# SCHEMA-AP-NDE requires a language-tagged name, this dataset has an XMLLiteral on a few
# records and none on the others.
DELETE { ?record sdo:name ?text }
INSERT { ?record sdo:name ?tagged }
WHERE {
  ?record a sdo:CreativeWork ;
    sdo:name ?text .
  FILTER(LANG(?text) = "")
  BIND(STRLANG(STR(?text), "nl") AS ?tagged)
} ;

INSERT { ?record sdo:name ?name }
WHERE {
  ?record a sdo:CreativeWork .
  FILTER(!ISBLANK(?record))
  FILTER NOT EXISTS { ?record sdo:name ?existing }
  OPTIONAL { ?record sdo:genre ?genre }
  OPTIONAL { ?record sdo:contentLocation/sdo:address/sdo:streetAddress ?street }
  OPTIONAL { ?record sdo:contentLocation/sdo:address/sdo:addressLocality ?locality . FILTER(ISLITERAL(?locality)) }
  OPTIONAL { ?record sdo:description ?description }
  BIND(COALESCE(STR(?genre), "") AS ?g)
  BIND(COALESCE(STR(?street), "") AS ?s)
  BIND(COALESCE(STR(?locality), "") AS ?l)
  BIND(IF(?g != "",
    CONCAT(?g, IF(?s != "", CONCAT(" - ", ?s), ""), IF(?l != "", CONCAT(", ", ?l), "")),
    IF(?s != "",
      CONCAT(?s, IF(?l != "", CONCAT(", ", ?l), "")),
      COALESCE(STR(?description), "Beeldbank 's-Hertogenbosch"))) AS ?title)
  BIND(STRLANG(?title, "nl") AS ?name)
} ;

# SCHEMA-AP-NDE has a DefinedTerm, this dataset has the genre as text.
DELETE { ?record sdo:genre ?text }
INSERT {
  ?record sdo:additionalType ?term .
  ?term a sdo:DefinedTerm ;
    sdo:name ?name .
}
WHERE {
  ?record a sdo:CreativeWork ;
    sdo:genre ?text .
  BIND(STRLANG(STR(?text), "nl") AS ?name)
  BIND(IRI(CONCAT(STR(?record), "#type-", ENCODE_FOR_URI(STR(?text)))) AS ?term)
} ;

DELETE { ?record sdo:material ?text }
INSERT {
  ?record sdo:material ?term .
  ?term a sdo:DefinedTerm ;
    sdo:name ?name .
}
WHERE {
  ?record a sdo:CreativeWork ;
    sdo:material ?text .
  FILTER(ISLITERAL(?text))
  BIND(STRLANG(STR(?text), "nl") AS ?name)
  BIND(IRI(CONCAT(STR(?record), "#material-", ENCODE_FOR_URI(STR(?text)))) AS ?term)
} ;

# SCHEMA-AP-NDE writes an open start or end as "..", this dataset leaves it empty.
DELETE { ?record sdo:temporalCoverage ?text }
INSERT { ?record sdo:temporalCoverage ?interval }
WHERE {
  ?record a sdo:CreativeWork ;
    sdo:temporalCoverage ?text .
  FILTER(STRSTARTS(STR(?text), "/") || STRENDS(STR(?text), "/"))
  BIND(IF(STRSTARTS(STR(?text), "/"), CONCAT("..", STR(?text)), CONCAT(STR(?text), "..")) AS ?interval)
} ;

# SCHEMA-AP-NDE has no keywords: they say what about says.
DELETE { ?record sdo:keywords ?text }
INSERT { ?record sdo:about ?keyword }
WHERE {
  ?record a sdo:CreativeWork ;
    sdo:keywords ?text .
  BIND(STRLANG(STR(?text), "nl") AS ?keyword)
} ;

# SCHEMA-AP-NDE has language-tagged text, this dataset has plain text.
DELETE { ?record sdo:description ?text }
INSERT { ?record sdo:description ?tagged }
WHERE {
  ?record a sdo:CreativeWork ;
    sdo:description ?text .
  FILTER(LANG(?text) = "")
  BIND(STRLANG(STR(?text), "nl") AS ?tagged)
} ;

# SCHEMA-AP-NDE has an image with a license, contentUrl and thumbnailUrl, this dataset has
# a link to a file. The file number gives the URLs of the IIIF image. The source has no license.
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
  BIND(CONCAT("https://zoeken.erfgoedshertogenbosch.nl/IIIF/image/3.0/", ?file) AS ?iiifBase)
  BIND(IRI(CONCAT(STR(?record), "#media-", ?file)) AS ?media)
  BIND(IRI(CONCAT(?iiifBase, "/full/max/0/default.jpg")) AS ?contentUrl)
  BIND(IRI(STR(?image)) AS ?thumbnailUrl)
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
  BIND(IRI(REPLACE(STR(?manifestUrl), "IIIF//", "IIIF/")) AS ?manifest)
}
