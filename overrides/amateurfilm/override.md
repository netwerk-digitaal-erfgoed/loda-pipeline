# amateurfilm: overrides

Describes how this pipeline overrides the base mapping, and why.

**Origin labels**

- **Original**: the original mapping in `pipelines/amateurfilm/` did this.
- **Adapted**: the original did something similar, but the result differs.
- **New**: not in the original. Added for the move to SCHEMA-AP-NDE.

## Pre-transform steps

| # | Step | Origin | Why | Based on |
|---|---|---|---|---|
| 1 | Copy the record's `sdo:license` onto its media | Adapted | The profile has the licence on the media, and `base/` reads it from there. The original read it from the record and output it directly. | Profile: `license` is required on `MediaObject`. Source: all 3,222 licences are on the record. |
| 2 | Replace `CNE` and missing licences with `InC` | Original | Keeps the original's rights decision. Result: rights match the baseline on all 3,214 records. | `executor-aggregation.rq`, the `?fixed_license` rule. |
| 3 | Add a `sdo:name` to creator `Role` nodes, from the GTAA term's `skos:prefLabel` | New | The profile has a creator with a name, and `base/` reads `creator/name`. The original output the GTAA URI (`sdo:creator/sdo:creator`); this outputs a readable name instead, e.g. `"Brouwer, Klaas"@nl`. | Profile: creator requires a name. Source: 1,647 `Role` creators with GTAA terms that have a `prefLabel`. The URI is no longer in the output. |
| 4 | Replace IRI identifiers with string identifiers | New | The profile only allows a string or a `PropertyValue`, and `base/` skips anything else. The original put this value in `edm:pid`. It now ends up in `dc:identifier`, and `edm:pid` is the record URI. | Profile: `identifier` shape. IRI identifiers are outside the profile, so they are handled per dataset rather than in `base/`. |

## Selector

`selector-100.rq` requires `sdo:associatedMedia` with a `sdo:VideoObject`. **Original**, from `pipelines/amateurfilm/selector.rq`. It selects 3,214 of the 3,222 records.

## Bindings

| Binding | Origin | Note |
|---|---|---|
| `dataProvider`, `edmType` | Original | Constants in the original executors. |
| `datasetLanguage: "nl"` | New | The original had no `dc:language`. Without this binding the output gets a registry value that is a URL as text. |

## Not carried over from the original

There is no profile property for these, so they are not in the output. Where they should go is an open question.

| Original output | Source | Count in baseline |
|---|---|---|
| `dcterms:issued` | `sdo:datePublished` | 2,477 |
| `dcterms:isPartOf` | `sdo:partOfSeries` | 3,148 |
| `dcterms:alternative` | `sdo:alternativeHeadline` | 293 |
| `edm:isShownAt` as landing page | `sdo:url` | 3,214, now the data URI |
| `dc:publisher` as IRI | `sdo:publisher` | 3,214, now the data provider name |

`sdo:genre` also moved from `dc:type` to `dc:subject`, because of how `base/` maps it.

## Remaining EDM violations

52 records have no subject, type, place or time in the source. The baseline has the same number of these violations.
