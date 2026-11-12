export interface Pipeline {
  name: string;
  datasetUri: string;
}

/** How often each class (rdf:type) and property occurs in an RDF file. */
export interface Counts {
  triples: number;
  /** Triples that occur more than once, also across graphs; absent in summaries written before it was counted. */
  duplicates?: number;
  classes: Record<string, number>;
  properties: Record<string, number>;
}

export interface ResultSample {
  focusNode: string;
  value?: string;
}

export interface ValidationResult extends ResultSample {
  severity: string;
  path?: string;
  constraint?: string;
  message?: string;
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
  /** Why the report or data is missing, and how to produce it. */
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

/** A node in a record's description: its types and its properties. */
export interface RdfNode {
  /** The IRI, or the blank node's label. */
  id: string;
  blank: boolean;
  types: string[];
  properties: RdfProperty[];
}

export interface RdfProperty {
  predicate: string;
  values: RdfValue[];
}

/** A property value: a literal, a link, or a node described in place. */
export type RdfValue =
  | {kind: 'literal'; value: string; language?: string; datatype?: string}
  | {kind: 'iri'; value: string}
  | {kind: 'node'; node: RdfNode};

/** A record's description in one checkpoint's data, as Turtle and as a tree. */
export interface RecordVersion {
  id: Checkpoint['id'];
  label: string;
  triples: number;
  /** The Turtle, highlighted as HTML. */
  turtle?: string;
  /** The record and its own nodes, with the nodes they link to nested inside. */
  tree?: RdfNode[];
  /** Why there is no data to describe the record from. */
  missing?: string;
}

/** A record in one checkpoint's data, with the validation results about it. */
export interface RecordDetails {
  iri: string;
  version: RecordVersion;
  /** Absent if the checkpoint has no validation report. */
  results?: ValidationResult[];
}

export interface RecordDescription {
  iri: string;
  versions: RecordVersion[];
}

export interface StageRun {
  name: string;
  state: 'running' | 'complete' | 'failed' | 'skipped';
  itemsProcessed: number;
  quadsGenerated: number;
  durationMs?: number;
  /** Why the stage failed or was skipped. */
  message?: string;
}

export interface ValidationRun {
  conforms: boolean;
  violations: number;
  quadsValidated: number;
  message?: string;
}

/** A pipeline run started from the tool, as far as it got. */
export interface RunStatus {
  pipeline: string;
  state: 'running' | 'stopping' | 'succeeded' | 'failed' | 'stopped';
  startedAt: string;
  endedAt?: string;
  exitCode?: number;
  /** What the pipeline is doing for the dataset. */
  phase?: string;
  stages: StageRun[];
  validations: ValidationRun[];
  errors: string[];
  /** The last lines of the pipeline's log. */
  log: string[];
}
