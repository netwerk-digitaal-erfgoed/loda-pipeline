# ran: overrides

Describes how this pipeline overrides the base mapping, and why.

**Origin labels**

- **Original**: the original mapping in `pipelines/ran/` did this.
- **Adapted**: the original did something similar, but the result differs.
- **New**: not in the original. Added for the move to SCHEMA-AP-NDE.

## Pre-transform steps

| # | Step | Origin | Why | Based on |
|---|---|---|---|---|
| 1 | Rewrite `http://schema.org/` predicates and types to `https://` | New | The profile and `base/` use `https`, and without this `base/` matches nothing. The original wrote its queries against `http`. | Source: about 1.9M triples, none on `https`. |
| 2 | `sdo:name` from `XMLLiteral` to `@nl` | Original | EDM rejects the `XMLLiteral` titles (133,068 in this dataset). | Original: `STRLANG(STR(?_name), "nl")`. |
| 3 | `sdo:identifier` from `XMLLiteral` to a string | Original | The profile and EDM require a string. | Original: `STR(?_identifier)`. |
| 4 | Literal `sdo:about` from `XMLLiteral` to `@nl` | Adapted | The original used a plain string. **Known gap:** the profile wants terms. | Original: `IF(REGEX(...), IRI(...), STR(...))`. |
| 5 | `sdo:comment` becomes `sdo:description`, tagged `@nl` | Adapted | Same mapping as the original, which output it directly as `dc:description`, with the `XMLLiteral` that later failed EDM. | Original: `sdo:comment ?description`. |
| 6 | Literal creators become creator nodes with a name | Adapted | `base/` reads `creator/name`. The original output the `XMLLiteral` directly. | Source: 11,658 literal creators. |
| 7 | Literal locations become `Place` nodes with a name | Adapted | `base/` reads `contentLocation/name`. The original output the `XMLLiteral` directly. Values like `"onbekend waar"` stay. | Source: 17,584 literal locations. |
| 8 | Image media with IIIF `full/max` URL, from the file number, and the record's licence | **Changed from original** | The original used the `icoon.ico` URL as `isShownBy`, and its IIIF service pointed at the base URI. Now the IIIF image is `isShownBy`. | Original's IIIF URL pattern. Checked: returns `image/jpg`, while `icoon.ico` returns `image/tiff`. |
| 9 | `icoon.ico` as `thumbnailUrl` | New | The profile asks for a thumbnail, and this is what the source provides. | **Possible issue:** it returned `image/tiff` when tested on one record, which may not suit a thumbnail. |
| 10 | Records without an image get licence-only media | New | Their licence would otherwise be lost, and these 16,541 selected records would have no `edm:rights`. The original output CHOs without an aggregation for them. | The dataset has no licence to fall back on. **Not profile-conformant,** because media needs a `contentUrl`. See the open question below. |
| 11 | Manifest as its own media entry | New | How the profile models manifests. The original didn't output it. | Profile: IIIF manifest shape. |

## Selector

`selector-100.rq` excludes records with an `InC` licence (65,375 records). **Adapted:** the original selector had no filter, but both original executors had `FILTER(?license != InC)`, and that decided the output. It selects 70,722 records, the same as the baseline.

## `base/` change for this dataset

**New:** `base/executor-100-cho.rq` outputs a creator or location's URI when it has no name. The source has no labels for its 728 Wikidata creators and 2,228 locations, and a pre-transform can't invent them. The original output these URIs directly.

## Bindings

| Binding | Origin | Note |
|---|---|---|
| `dataProvider`, `edmType` | Original | Constants. |
| `datasetLanguage: "nl"` | New | The original had no `dc:language`. |

## Not carried over from the original

| Original output | Reason |
|---|---|
| `dc:rights` from `sdo:copyrightHolder` | Not in the profile, and `base/` fills `dc:rights` with the data provider. |
| `doap:implements` on the service | Optional, and Europeana doesn't use it. |
| `sdo:genre` as `dc:type` | `base/` maps genre to `dc:subject`. |

## Open question

16,541 records have no image. Europeana does not publish an `IMAGE` without a media link, so these records could be excluded with the selector.

## Result

70,722 records and 381 EDM violations, the same number as the old shape gave: no subject (208) and no title or description (173).
