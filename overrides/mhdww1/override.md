# mhdww1: overrides

Describes how this pipeline overrides the base mapping, and why.

**Origin labels**

- **Original**: the original mapping in `pipelines/mhdww1/executor.rq` did this.
- **Adapted**: the original did something similar, but the result differs.
- **New**: not in the original. Added for the move to SCHEMA-AP-NDE.

## Pre-transform steps

| # | Step | Origin | Why | Based on |
|---|---|---|---|---|
| 1 | Make `rdfs:label` the `sdo:name`, tagged `@nl` | Original | The source has no `sdo:name`, and the profile requires a language-tagged one. | Original maps `rdfs:label` to `dc:title` with `nl`. |
| 2 | Build an image `MediaObject` from the file number in `sdo:image` (IIIF `full/max` URL) | Original | The profile needs a `contentUrl`, and the source only has an `icoon.ico` link. | Original builds this IIIF URL. Checked: returns `image/jpg`. |
| 3 | Use a IIIF `!250,250` URL as `thumbnailUrl` | New | The profile asks for a thumbnail, and `icoon.ico` returned 404 when tested on one record. | Test of one record's URLs. Standard IIIF size syntax. |
| 4 | CC0 as the media licence | Adapted | The source's licence is a malformed literal, `https://creativecommons.org/licenses/zero/1.0/`. | Original hard-codes CC0, and also output the source licence. |
| 5 | Turn the blank-node manifest into a media entry with its own URI and the profile's `encodingFormat` | New | The profile models the manifest as `associatedMedia`. The original computed a manifest URL but never output it. | Profile: IIIF manifest shape. Checked: the URL returns a Presentation 3 manifest. |
| 6 | Turn `sdo:additionalType` text into a named `DefinedTerm` | Adapted | The profile requires a term, and `base/` reads `additionalType/name`. The original output the text directly. | Profile: `additionalType` shape. |
| 7 | Add CRM `P2_has_type` labels as `additionalType` | Original | They are this dataset's type information. This includes `"geheel"`, which is a measurement part rather than a type, kept to match the original. | Original extracts these labels into `dc:type`. |
| 8 | Add materials from `P45_consists_of/P2_has_type` as `sdo:material` | Adapted | The original's `dcterms:medium` contained all CRM type labels. This takes only actual materials, e.g. `"papier"`. | Source structure: `P45_consists_of` leads to the material. |
| 9 | Turn `sdo:creator` text into a creator with a name, skipping `"onbekend"` | New | The original looked for `Role` + `foaf:name`, which doesn't exist here, so it output no creators. Now 27. | Profile: creator requires a name. 61 values are `"onbekend"`, which isn't a known creator. |
| 10 | `dateCreated` from the CRM production time span, as a year or EDTF interval | New | The original output no dates. `sdo:datePublished` is the placeholder `0001-01-01` on all 147 values. | Source: `P108i/P4/P82a` and `P82b`. Profile: date datatypes. |
| 11 | Tag `sdo:abstract` with `@nl` | Original | The profile requires language-tagged text. | Original adds `nl`. |
| 12 | Merge `sdo:size` texts into one `@nl` statement | New | The profile allows one size text per language. The original output no sizes. | Profile: `uniqueLang` on `size`. |

Not used from the original: the Getty type of the identifier as `dc:type`. It describes the identifier, not the object.

## Selector

`selector-100.rq` requires `sdo:image`. **Original**, from `pipelines/mhdww1/selector.rq`. It selects the 100 of 163 records with an image.

## Bindings

| Binding | Origin |
|---|---|
| `dataProvider`, `edmType`, `datasetLanguage: "nl"` | Original constants. |

## Result

100 records and 0 EDM violations. Records with two images no longer repeat `edm:isShownBy` (45 violations in the baseline), because `base/` picks one.

Profile gaps left: `sdDatePublished` isn't in the source, and 3 terms have conflicting labels.
