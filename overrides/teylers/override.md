# teylers: overrides

Describes how this pipeline overrides the base mapping, and why.

**Origin labels**

- **Original**: the original mapping in `pipelines/teylers/` did this.
- **Adapted**: the original did something similar, but the result differs.
- **New**: not in the original. Added for the move to SCHEMA-AP-NDE.

## Pre-transform steps

| # | Step | Origin | Why | Based on |
|---|---|---|---|---|
| 1 | Add `sdo:artform` as `additionalType` (terms directly, text as a new named term) | New | It adds real type information, as in `jmvdcollectie`. | `artform` isn't in the profile, but it states what kind of work it is. Source: 48,631 terms and 13,315 texts. This is an interpretation of the property; the source does not state it. |
| 2 | `sdo:keywords` becomes literal `sdo:about` | Original | The original mapped keywords to `dc:subject`. **Known gap:** the profile wants terms. | `executor-cho.rq`. Source: about 190,000 keywords. |
| 3 | `sdo:material` text becomes a named term | New | The profile requires a term, and `base/` reads `material/name`. | Profile: `material` shape. |
| 4 | Add `sdo:material` as `additionalType` | Original | Keeps the original's `dc:type` output and helps records pass. **The original's own comment calls this a "hack"**, because a material isn't a type. | `executor-cho.rq`: "'hack' have more records valid". |
| 5 | Add `sdo:locationCreated` as `contentLocation` | Original | Keeps the original's `dcterms:spatial` output. Strictly, the place of creation isn't the place depicted. `base/` also outputs it as `dc:coverage`. | `executor-cho.rq`. |
| 6 | Give intervals like `"1600/1650"` the `edtf:EDTF` datatype | New | The profile requires it. The original only applied `STR()`, which `base/` now does too. | Profile: date shape. |
| 7 | Remove `dateCreated` values with `xsd:dateTime` | New | Copied from `jmvdcollectie`. It may match nothing here: `dateTime` isn't among the six most common patterns. | Same platform as `jmvdcollectie`. |
| 8 | Convert size values with a decimal comma to numbers | New | The profile requires a number. Copied from `jmvdcollectie`. | Same platform. Not separately counted here. |
| 9 | Remove sizes without a usable value | New | The profile requires a value. Copied from `jmvdcollectie`. | Same platform. Not separately counted here. |

## Selector

`selector-100.rq` requires `sdo:name` and `sdo:identifier`. **Original**, from `pipelines/teylers/selector.rq`. It also leaves out the 57,996 `#related-material-N` nodes, which have no name. It selects 68,171 of 158,708.

## Bindings

| Binding | Origin |
|---|---|
| `dataProvider`, `edmType`, `datasetLanguage: "nl"` | Original constants. |

## Handled in `base/`, taken from this pipeline

These fixes from the `teylers` original are now in `base/` for every pipeline:

- `MIN(contentUrl)` for one image per record
- the licence of that image as `edm:rights`
- `https` to `http` for licences
- `STR()` on dates
- literal-only `dc:identifier`

## Note: named graph

This dataset's triples are in a named graph, so a `DELETE` must use `GRAPH ?g`. Without it, QLever reports success and removes nothing.

## Open question

4,667 records have no image. The original output a CHO without an aggregation for them. They now get an aggregation with the dataset licence (CC BY 4.0), which is not a licence stated on the record itself. Europeana does not publish an `IMAGE` without a media link, so these records could be excluded with the selector.

## Result

68,171 records and 7,175 EDM violations (14,868 in the baseline), all records with no subject, type, place or time in the source.
