### schema:CreativeWork
| property | data type(s) | range | constraints  | edm:property | edm:Class |
| :-:|:-:|:-:|:-:|:-:|:-:|
| abstract | Literal | rdf:langString | [0..*]
| additionalType | IRI, blank node | schema:definedTerm | [0..*]
| associatedMedia| IRI, blank node |schema:MediaObject| **[1..*]**
| contentLocation | IRI, blank node | schema:Place, schema:DefinedTerm | [0..*]
| creator | IRI, blank node | schema:Person, schema:Organization,schema:DefinedTerm | **[1..*]**
| description | Literal | rdf:langString | [0..*]
| genre | IRI, blank node | schema:DefinedTerm |  [0..*] 
| identifier | Literal, IRI, blank node | rdf:LangString, schema:PropertyValue| [0..*]
| isPartOf| IRI | schema:Dataset | **[1..*]**
| material | IRI, blank node | schema:DefinedTerm | [0..*]
| name | Literal | rdf:langString | **[1..*]**
| size | Literal | rdf:langString | [0..*]
| temporalCoverage | Literal | schema:DateTime, xsd:string | [0..*]
| text | Literal | rdf:langString | [0..*]
| type | IRI | schema:CreativeWork and one or more subclasses of schema:CreativeWork | [0..*] 
| locationCreated | IRI, blank node | schema:Place, schema:DefinedTerm | [0..*]
| dateCreated | Literal, blank node, IRI | schema:Date, xsd:date, conf. ISO 8601 | [0..*]
| about | IRI, blank node | schema:DefinedTerm | [0..*]
| URI | IRI | persistent identifier | **[1..0]**

### schema:MediaObject
| property | data type(s) | range | constraints  | edm:property | edm:Class |
| :-:|:-:|:-:|:-:|:-:|:-:|
| isBasedOn | IRI | IIIF-Image API object, IIIF-Presentation API object | [0..*]
| contentUrl | Literal | schema:URL | **[1..*]**
| copyrightNotice | Literal | rdf:langString | [0..*]
| license | Literal | schema:URL | **[1..*]**
| thumbnailUrl | Literal | schema:URL | **[1..*]**
| type | IRI | schema:ImageObject, schema:VideoObject, schema:AudioObject, schema:3DModel | [0..*]

### schema:Person
| property | data type(s) | range | constraints  | edm:property | edm:Class |
| :-:|:-:|:-:|:-:|:-:|:-:|
| birthDate | Literal, blank node, IRI | schema:Data, xsd:date, conf. ISO 8601 | [0..1]
| birthPlace | IRI, blank node | schema:Place, schema:DefinedTerm | [0..1]
| deathDate | Literal, blank node, IRI | schema:Data, xsd:date, conf. ISO 8601 | [0..1]
| deathPlace | IRI, blank node | schema:Place, schema:DefinedTerm | [0..1]
| hasOccupation | IRI, blank node | schema:Occupation, schema:DefinedTerm | [0..*]
| name | Literal | rdf:langString | **[1..*]**
| type | IRI | schema:Person | **[1..*]**

### schema:Organization
| property | data type(s) | range | constraints  | edm:property | edm:Class |
| :-:|:-:|:-:|:-:|:-:|:-:|
| address | IRI, blank node | schema:PostalAddress | [0..*]
| name | Literal | rdf:langString | **[1..*]**
| URI | IRI | persistent identifier | **[1..0]** 

### schema:Place 
| property | data type(s) | range | constraints  | edm:property | edm:Class |
| :-:|:-:|:-:|:-:|:-:|:-:|
| address | IRI, blank node | schema:PostalAddress | [0..*]
| geo | IRI, blank node | schema:Geo | [0..1]
| name | Literal | rdf:langString | **[1..*]**

### schema:PostalAddress
| property | data type(s) | range | constraints  | edm:property | edm:Class |
| :-:|:-:|:-:|:-:|:-:|:-:|
| streetAddress | Literal | rdf:langString | [0..*]
| postalCode | Literal | rdf:langString | [0..*]
| addressLocality (city) | Literal | rdf:langString | [0..*]
| addressRegion (province) | Literal | rdf:langString | [0..*]
| addressCountry | Literal | rdf:langString, conf. ISO3166-1 | [0..*]