# denbosch: overrides

Describes how this pipeline overrides the base mapping, and why.

**Origin labels**

- **Original**: `pipelines/denbosch/schema-ap-nde.rq` or `executor.rq` did this.
- **Adapted**: the original did something similar, but the result differs.
- **New**: not in the original. Added for the move to SCHEMA-AP-NDE.

## Pre-transform steps

| # | Step | Origin | Why | Based on |
|---|---|---|---|---|
| 1 | Remove the blank `CreativeWork` collections and the `isPartOf` links to them | New | The profile needs `isPartOf` to be a URI, and these blank nodes aren't records. | Source: all 44,025 `CreativeWork`s are blank nodes. |
| 2 | Retype records from `MediaObject` to `CreativeWork` | Original | The records are heritage objects, which the profile models as `CreativeWork`. | `schema-ap-nde.rq`. |
| 3 | `sdo:author` becomes `sdo:creator`, name tagged `@nl` | Adapted | Same mapping as the original, but it reuses the existing node instead of minting `#creator`. `jobTitle` stays in the data but isn't mapped. | `schema-ap-nde.rq`. |
| 4 | Place name from street and locality | Adapted | Same logic as the original, on the existing node instead of minting `#place`. | `schema-ap-nde.rq`. |
| 5 | Remove places without a name and authors without a name | New | The profile requires a name, and these nodes say nothing. | Profile: `Place` and `Person` shapes. About 8,500 places failed before this. |
| 6 | Convert existing `XMLLiteral` record names to `@nl` | New | About 660 records have their own title, which failed EDM. | EDM shape: `dc:title` must be a string. |
| 7 | Composite `sdo:name` ("Genre - Street, Locality") for records without a name | Adapted | The profile requires a name. Now only for records without one; the original added it to all. | `schema-ap-nde.rq`. |
| 8 | `sdo:genre` text becomes a named term in `additionalType` | New | The profile requires a term. The original kept it as `sdo:genre` text, output as `dc:subject`. Now `dc:type`. | Profile: term shapes. `"Foto"` is a type. |
| 9 | `sdo:material` text becomes a named term | New | The profile requires a term, and `base/` reads `material/name`. The original tagged the text. | Profile: `material` shape. |
| 10 | Rewrite open dates: `"/1960"` to `"../1960"` | New | 1,376 values failed the profile's interval syntax. | Profile: `temporalCoverage` pattern. |
| 11 | `sdo:keywords` becomes literal `sdo:about` | New | The profile has no keywords, and they are this dataset's subjects. The original kept them, but `executor.rq` didn't output them. **Known gap:** the profile wants terms, but `base/` would output a minted term's URI instead of its name. | Source: about 148,000 keywords. |
| 12 | Tag `sdo:description` with `@nl` | Original | The profile requires language-tagged text. | `schema-ap-nde.rq`. |
| 13 | Image media with IIIF `full/max` URL, from the file number | **Changed from original** | The original put the manifest in `contentUrl`, and `executor.rq` used the `icoon.ico` thumbnail as `isShownBy`. Europeana says a WebResource must not be a manifest. | Europeana's IIIF guideline. Checked: the URL returns `image/jpg`, and the manifest references the same image. |
| 14 | `icoon.ico` as `thumbnailUrl` | Original | Checked: returns `image/jpeg`. | `schema-ap-nde.rq`. |
| 15 | CC0 as media licence | Original | The source has no media licence. Hard-coded. | `schema-ap-nde.rq` notes this as a caveat. |
| 16 | Manifest as its own media entry, with the `encodingFormat` the profile expects | New | How the profile models manifests. | Profile: IIIF manifest shape. |

## Selector

`selector-100.rq` requires `sdo:associatedMedia`. **Adapted:** the original selector matches `base/`, but `executor.rq` required media in its `WHERE`, which filtered the same records. It selects 43,786 of the 45,614 records.

## Dataset URI

**New:** `pipelines.yaml` uses the current register URI on `zoeken.erfgoedshertogenbosch.nl`. `pipelines/denbosch/config.yaml` has an outdated URI, and its `dataset.ttl` points at EDM output rather than source data.

## Bindings

| Binding | Origin |
|---|---|
| `dataProvider`, `edmType`, `datasetLanguage: "nl"` | Original constants. |

## Result

43,786 records and 0 EDM violations, plus 108 warnings for records with several titles.

Profile gaps left: literal `about` values, `sdDatePublished` isn't in the source, and some nodes have names that fail the profile.
