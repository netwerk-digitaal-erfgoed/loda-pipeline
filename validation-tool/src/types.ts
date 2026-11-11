export interface Pipeline {
  name: string;
  datasetUri: string;
}

/** How often each class (rdf:type) and property occurs in an RDF file. */
export interface Counts {
  triples: number;
  classes: Record<string, number>;
  properties: Record<string, number>;
}

export interface ResultSample {
  focusNode: string;
  value?: string;
}

/** The validation results that share a severity, path, constraint and message. */
export interface ResultGroup {
  severity: string;
  path?: string;
  constraint?: string;
  message?: string;
  results: number;
  focusNodes: number;
  samples: ResultSample[];
}

export interface ReportSummary {
  conforms: boolean;
  results: number;
  focusNodes: number;
  bySeverity: Record<string, number>;
  groups: ResultGroup[];
}

/** One point in the pipeline whose data is validated against a set of shapes. */
export interface Checkpoint {
  id: 'source' | 'nde-schema-ap' | 'edm';
  label: string;
  shapes: string;
  report?: ReportSummary;
  counts?: Counts;
  /** What to run to produce the missing report or data. */
  hint?: string;
}

export interface PipelineDetails extends Pipeline {
  checkpoints: Checkpoint[];
}

export interface RecordSample {
  iri: string;
  /** Whether the record reaches the EDM output. */
  inEdm: boolean;
}

/** A record's description in one checkpoint's data, as Turtle. */
export interface RecordVersion {
  id: Checkpoint['id'];
  label: string;
  triples: number;
  turtle?: string;
  /** Why there is no data to describe the record from. */
  missing?: string;
}

export interface RecordDescription {
  iri: string;
  versions: RecordVersion[];
}
