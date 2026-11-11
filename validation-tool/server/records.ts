import {type Quad, Writer} from 'n3';
import {prefixes} from '../src/iri.ts';
import {readQuads} from './rdf.ts';

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

/** How many links to follow from a record and its own nodes. */
const DEPTH = 2;

/**
 * The triples that describe a record in an RDF file: those of the record and of
 * its own nodes (IRIs that start with the record's IRI and a #), and of the
 * nodes they link to, up to {@link DEPTH} links away. Each link takes another
 * pass over the file.
 */
export async function describeRecord(path: string, record: string): Promise<Quad[]> {
  const quads: Quad[] = [];
  const described = new Set<string>();
  const ownNode = (subject: string) =>
    subject === record || subject.startsWith(`${record}#`);

  let frontier = new Set<string>();
  for (let depth = 0; depth <= DEPTH; depth++) {
    const found: Quad[] = [];
    for await (const quad of readQuads(path)) {
      const subject = quad.subject.value;
      if (depth === 0 ? ownNode(subject) : frontier.has(subject)) found.push(quad);
    }
    for (const quad of found) described.add(quad.subject.value);
    quads.push(...found);

    frontier = new Set(
      found
        .filter(quad => quad.predicate.value !== RDF_TYPE && quad.object.termType !== 'Literal')
        .map(quad => quad.object.value)
        .filter(node => !described.has(node)),
    );
    if (frontier.size === 0) break;
  }
  return quads;
}

/** Serialise the triples as Turtle, the record's own nodes first. */
export function toTurtle(quads: Quad[], record: string): Promise<string> {
  const rank = (subject: string) =>
    subject === record ? 0 : subject.startsWith(`${record}#`) ? 1 : 2;
  const sorted = [...quads].sort(
    (a, b) =>
      rank(a.subject.value) - rank(b.subject.value) ||
      a.subject.value.localeCompare(b.subject.value) ||
      a.predicate.value.localeCompare(b.predicate.value),
  );

  const writer = new Writer({prefixes});
  writer.addQuads(sorted);
  return new Promise((resolve, reject) =>
    writer.end((error, result) => (error ? reject(error) : resolve(result ?? ''))),
  );
}

/** The records in an RDF file: the subjects typed with the given class. */
export async function recordsOfClass(path: string, type: string): Promise<string[]> {
  const records: string[] = [];
  for await (const quad of readQuads(path)) {
    if (quad.predicate.value === RDF_TYPE && quad.object.value === type) {
      records.push(quad.subject.value);
    }
  }
  return records.sort();
}
