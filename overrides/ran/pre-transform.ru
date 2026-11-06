PREFIX sdo: <https://schema.org/>

# SCHEMA-AP-NDE uses https://schema.org/, this dataset http://schema.org/.
DELETE { ?subject ?predicate ?object }
INSERT { ?subject ?httpsPredicate ?object }
WHERE {
  ?subject ?predicate ?object .
  FILTER(STRSTARTS(STR(?predicate), "http://schema.org/"))
  BIND(IRI(CONCAT("https://schema.org/", STRAFTER(STR(?predicate), "http://schema.org/"))) AS ?httpsPredicate)
} ;

DELETE { ?subject a ?type }
INSERT { ?subject a ?httpsType }
WHERE {
  ?subject a ?type .
  FILTER(STRSTARTS(STR(?type), "http://schema.org/"))
  BIND(IRI(CONCAT("https://schema.org/", STRAFTER(STR(?type), "http://schema.org/"))) AS ?httpsType)
} ;

# SCHEMA-AP-NDE has language-tagged text and string identifiers, this dataset has XMLLiterals.
DELETE { ?record sdo:name ?text }
INSERT { ?record sdo:name ?tagged }
WHERE {
  ?record a sdo:CreativeWork ;
    sdo:name ?text .
  BIND(STRLANG(STR(?text), "nl") AS ?tagged)
} ;

DELETE { ?record sdo:identifier ?text }
INSERT { ?record sdo:identifier ?string }
WHERE {
  ?record a sdo:CreativeWork ;
    sdo:identifier ?text .
  BIND(STR(?text) AS ?string)
} ;

DELETE { ?record sdo:about ?text }
INSERT { ?record sdo:about ?tagged }
WHERE {
  ?record a sdo:CreativeWork ;
    sdo:about ?text .
  FILTER(ISLITERAL(?text))
  BIND(STRLANG(STR(?text), "nl") AS ?tagged)
} ;

# SCHEMA-AP-NDE has no comment: it says what description says.
DELETE { ?record sdo:comment ?text }
INSERT { ?record sdo:description ?tagged }
WHERE {
  ?record a sdo:CreativeWork ;
    sdo:comment ?text .
  BIND(STRLANG(STR(?text), "nl") AS ?tagged)
} ;

# SCHEMA-AP-NDE has a creator with a name, this dataset sometimes has the name as text.
DELETE { ?record sdo:creator ?text }
INSERT {
  ?record sdo:creator ?creator .
  ?creator sdo:name ?name .
}
WHERE {
  ?record a sdo:CreativeWork ;
    sdo:creator ?text .
  FILTER(ISLITERAL(?text))
  BIND(STRLANG(STR(?text), "nl") AS ?name)
  BIND(IRI(CONCAT(STR(?record), "#creator-", ENCODE_FOR_URI(STR(?text)))) AS ?creator)
} ;

# SCHEMA-AP-NDE has a Place with a name, this dataset sometimes has the name as text.
DELETE { ?record sdo:contentLocation ?text }
INSERT {
  ?record sdo:contentLocation ?place .
  ?place a sdo:Place ;
    sdo:name ?name .
}
WHERE {
  ?record a sdo:CreativeWork ;
    sdo:contentLocation ?text .
  FILTER(ISLITERAL(?text))
  BIND(STRLANG(STR(?text), "nl") AS ?name)
  BIND(IRI(CONCAT(STR(?record), "#place-", ENCODE_FOR_URI(STR(?text)))) AS ?place)
} ;

# SCHEMA-AP-NDE has an image with a license, contentUrl and thumbnailUrl, this dataset has
# a link to a file and the license on the record. The file number gives the URL of the IIIF image.
INSERT {
  ?record sdo:associatedMedia ?media .
  ?media a sdo:MediaObject , sdo:ImageObject ;
    sdo:license ?license ;
    sdo:contentUrl ?contentUrl ;
    sdo:thumbnailUrl ?image .
}
WHERE {
  ?record a sdo:CreativeWork ;
    sdo:license ?license ;
    sdo:image ?image .
  FILTER(ISIRI(?image))
  BIND(REPLACE(STR(?image), "^.*file=([0-9]+).*$", "$1") AS ?file)
  BIND(IRI(CONCAT(STR(?record), "#media-", ?file)) AS ?media)
  BIND(IRI(CONCAT("https://studiezaal.nijmegen.nl/IIIF/image/3.0/", ?file, "/full/max/0/default.jpg")) AS ?contentUrl)
} ;

# A record without an image keeps its license, on media without a contentUrl.
INSERT {
  ?record sdo:associatedMedia ?media .
  ?media a sdo:MediaObject ;
    sdo:license ?license .
}
WHERE {
  ?record a sdo:CreativeWork ;
    sdo:license ?license .
  FILTER NOT EXISTS { ?record sdo:image ?image }
  BIND(IRI(CONCAT(STR(?record), "#media")) AS ?media)
} ;

# SCHEMA-AP-NDE has a IIIF manifest with its own URI, this dataset has a blank node with its URL as text.
DELETE {
  ?record sdo:image ?node .
  ?node ?property ?value .
}
INSERT {
  ?record sdo:associatedMedia ?manifest .
  ?manifest
    sdo:license ?license ;
    sdo:encodingFormat "application/ld+json;profile=\"http://iiif.io/api/presentation/3/context.json\"" .
}
WHERE {
  ?record a sdo:CreativeWork ;
    sdo:license ?license ;
    sdo:image ?node .
  ?node sdo:contentUrl ?manifestUrl ;
    ?property ?value .
  BIND(IRI(REPLACE(STR(?manifestUrl), "IIIF//", "IIIF/")) AS ?manifest)
}
