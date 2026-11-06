# jmvdcollectie: overrides

Describes how this pipeline overrides the base mapping, and why.

**Origin labels**

- **Original**: the original mapping in `pipelines/jmvdcollectie/` did this.
- **Adapted**: the original did something similar, but the result differs.
- **New**: not in the original. Added for the move to SCHEMA-AP-NDE.

**Every pre-transform step here is new.** The original mapping read this data directly, and `base/` was largely derived from it.

## Pre-transform steps

| # | Step | Origin | Why | Based on |
|---|---|---|---|---|
| 1 | Remove the `CreativeWork` type from `#related-material-N` nodes | New | They are notes on a record, e.g. `"Objecten: zie ook JMD-OR-727 t/m 738."`, not heritage objects. **This reduces the output from 10,603 to 8,810 records**, compared with the baseline. | Source: 1,793 nodes, linked with `hasPart`, with only a `text`. They had no name, and caused 1,794 `edm:rights` violations in the baseline. |
| 2 | Add `sdo:artform` as `additionalType` | New | The main fix: EDM needs a subject, type, place or time, and almost all records have none. Before this, 10,601 records failed. | `artform` isn't in the profile, but it's a named term stating what kind of work it is. It covers all but 1 of the 8,810 records. This is an interpretation of the property; the source does not state it. |
| 3 | Give intervals like `"1900/1999"` the `edtf:EDTF` datatype | New | The profile requires it, and 1,334 values failed. | Profile: date shape. |
| 4 | Remove `dateCreated` values with `xsd:dateTime` | New | The values are 2026 timestamps, so they are treated as registration moments, not creation dates. This is inferred from the values. | Source: 2 values, e.g. `2026-03-16T16:44:36.756Z`. |
| 5 | Convert size values with a decimal comma to numbers | New | The profile requires a number. | Source: 13 values like `"4,5"`. |
| 6 | Remove sizes without a usable value | New | The profile requires a value, and they contain only a unit. | Source: 1,357 nodes with no value, 4 with unparseable text such as `"9.9.9"`. |

## Selector

No override. The original selector matches `base/`.

## Bindings

| Binding | Origin |
|---|---|
| `dataProvider`, `edmType`, `datasetLanguage: "nl"` | Original constants. |

## Handled in `base/`, not here

These were violations in the baseline, and fixing them doesn't need the pre-transform:

- `edm:pid` as a string
- string identifiers (8,810 violations)
- date datatypes (974 each)
- one `edm:object` per record (460)
- creators with a name (0 to 11,122)

## Note: named graph

This dataset's triples are in a named graph, so a `DELETE` must use `GRAPH ?g`. Without it, QLever reports success and removes nothing.

## Result

8,810 records and 1 EDM violation, a record with no subject.
