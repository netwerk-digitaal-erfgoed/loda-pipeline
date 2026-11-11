import {createReadStream} from 'node:fs';
import {extname} from 'node:path';
import {Readable} from 'node:stream';
import {createGunzip} from 'node:zlib';
import {DataFactory, type Quad, StreamParser} from 'n3';
import type {Counts, ReportSummary, ResultGroup} from '../src/types.ts';

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const SH = 'http://www.w3.org/ns/shacl#';
const SAMPLES_PER_GROUP = 10;

const formats: Record<string, string> = {
  '.nt': 'N-Triples',
  '.nq': 'N-Quads',
  '.ttl': 'Turtle',
  '.trig': 'TriG',
};

/** The format to parse an RDF file with, if the tool reads it. */
export function readableFormat(path: string): string | undefined {
  const gzipped = extname(path) === '.gz';
  return formats[extname(gzipped ? path.slice(0, -3) : path)];
}

/**
 * Stream the quads of an RDF file, optionally gzipped, all in the default
 * graph: SHACL validates a graph, and the datasets spread theirs over named
 * graphs.
 */
export async function* readQuads(path: string): AsyncGenerator<Quad> {
  const gzipped = extname(path) === '.gz';
  const format = readableFormat(path);
  if (format === undefined) {
    throw new Error(`Cannot tell the RDF format of ${path}`);
  }

  let input: Readable = createReadStream(path);
  if (gzipped) input = input.pipe(createGunzip());
  const parser = input.pipe(new StreamParser({format}));

  for await (const quad of parser as AsyncIterable<Quad>) {
    yield DataFactory.quad(quad.subject, quad.predicate, quad.object);
  }
}

export class CountsCollector {
  private readonly counts: Counts = {triples: 0, classes: {}, properties: {}};

  add(quad: Quad): void {
    this.counts.triples++;
    const property = quad.predicate.value;
    this.counts.properties[property] = (this.counts.properties[property] ?? 0) + 1;
    if (property === RDF_TYPE) {
      const type = quad.object.value;
      this.counts.classes[type] = (this.counts.classes[type] ?? 0) + 1;
    }
  }

  get result(): Counts {
    return this.counts;
  }
}

export async function countFile(path: string): Promise<Counts> {
  const counts = new CountsCollector();
  for await (const quad of readQuads(path)) counts.add(quad);
  return counts.result;
}

/**
 * Summarise a SHACL validation report: its results grouped by severity, path,
 * constraint and message, with a few focus nodes for each group.
 */
export async function summarizeReport(path: string): Promise<ReportSummary> {
  const bySubject = new Map<string, Quad[]>();
  for await (const quad of readQuads(path)) {
    const quads = bySubject.get(quad.subject.value) ?? [];
    quads.push(quad);
    bySubject.set(quad.subject.value, quads);
  }

  let conforms = true;
  const focusNodes = new Set<string>();
  const bySeverity: Record<string, number> = {};
  const groups = new Map<string, ResultGroup & {focusNodeSet: Set<string>}>();
  let results = 0;

  for (const quads of bySubject.values()) {
    const value = (property: string) =>
      quads.find(quad => quad.predicate.value === SH + property)?.object;
    const types = quads
      .filter(quad => quad.predicate.value === RDF_TYPE)
      .map(quad => quad.object.value);

    if (types.includes(`${SH}ValidationReport`)) {
      if (value('conforms')?.value === 'false') conforms = false;
      continue;
    }
    if (!types.includes(`${SH}ValidationResult`)) continue;

    results++;
    const severity = local(value('resultSeverity')?.value ?? `${SH}Violation`);
    const resultPath = value('resultPath');
    const constraint = value('sourceConstraintComponent')?.value;
    const message = englishMessage(quads);
    const focusNode = value('focusNode')?.value ?? '';
    focusNodes.add(focusNode);
    bySeverity[severity] = (bySeverity[severity] ?? 0) + 1;

    const path = resultPath?.termType === 'NamedNode' ? resultPath.value : undefined;
    const key = [severity, path, constraint, message].join('\u0000');
    const group = groups.get(key) ?? {
      severity,
      path,
      constraint: constraint && local(constraint),
      message,
      results: 0,
      focusNodes: 0,
      samples: [],
      focusNodeSet: new Set<string>(),
    };
    group.results++;
    group.focusNodeSet.add(focusNode);
    if (group.samples.length < SAMPLES_PER_GROUP) {
      group.samples.push({focusNode, value: value('value')?.value});
    }
    groups.set(key, group);
  }

  return {
    conforms,
    results,
    focusNodes: focusNodes.size,
    bySeverity,
    groups: [...groups.values()]
      .map(({focusNodeSet, ...group}) => ({...group, focusNodes: focusNodeSet.size}))
      .sort((a, b) => b.results - a.results),
  };
}

function englishMessage(quads: Quad[]): string | undefined {
  const messages = quads
    .filter(quad => quad.predicate.value === `${SH}resultMessage`)
    .map(quad => quad.object);
  const message =
    messages.find(term => term.termType === 'Literal' && term.language === 'en') ??
    messages[0];
  return message?.value;
}

function local(iri: string): string {
  return iri.slice(Math.max(iri.lastIndexOf('#'), iri.lastIndexOf('/')) + 1);
}
