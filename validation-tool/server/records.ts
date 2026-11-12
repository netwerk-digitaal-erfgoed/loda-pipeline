import PrefixMap from '@rdfjs/prefix-map/PrefixMap.js';
import Serializer from '@rdfjs/serializer-turtle';
import {DataFactory, type Quad} from 'n3';
import {createHighlighter} from 'shiki';
import {prefixes} from '../src/iri.ts';
import type {RdfNode, RdfValue} from '../src/types.ts';
import {readQuads} from './rdf.ts';

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const XSD_STRING = 'http://www.w3.org/2001/XMLSchema#string';
const THEME = 'github-light';

/** How many links to follow from a record and its own nodes. */
const DEPTH = 2;

/** Whether a node is the record or one of its own nodes. */
export function ownNode(node: string, record: string): boolean {
  return node === record || node.startsWith(`${record}#`);
}

/**
 * The triples that describe a record in an RDF file: those of the record and of
 * its own nodes (IRIs that start with the record's IRI and a #), and of the
 * nodes they link to, up to {@link DEPTH} links away. Each link takes another
 * pass over the file.
 */
export async function describeRecord(path: string, record: string): Promise<Quad[]> {
  const quads: Quad[] = [];
  const described = new Set<string>();

  let frontier = new Set<string>();
  for (let depth = 0; depth <= DEPTH; depth++) {
    const found: Quad[] = [];
    for await (const quad of readQuads(path)) {
      const subject = quad.subject.value;
      if (depth === 0 ? ownNode(subject, record) : frontier.has(subject)) found.push(quad);
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

const serializer = new Serializer({
  prefixes: new PrefixMap(
    Object.entries(prefixes).map(([prefix, namespace]) => [prefix, DataFactory.namedNode(namespace)]),
    {factory: DataFactory},
  ),
});
const highlighter = createHighlighter({langs: ['turtle'], themes: [THEME]});

/** Serialise the triples as pretty-printed Turtle, highlighted as HTML. */
export async function toTurtle(quads: Quad[]): Promise<string> {
  return (await highlighter).codeToHtml(serializer.transform(quads), {lang: 'turtle', theme: THEME});
}

/**
 * The triples as a tree: the record and its own nodes, each with the blank nodes and
 * other described nodes they link to nested inside. Links to the record's own nodes,
 * and links back to a node higher up, stay links.
 */
export function toTree(quads: Quad[], record: string): RdfNode[] {
  const bySubject = new Map<string, Quad[]>();
  for (const quad of quads) {
    const described = bySubject.get(quad.subject.value) ?? [];
    described.push(quad);
    bySubject.set(quad.subject.value, described);
  }

  function node(term: Quad['subject'] | Quad['object'], path: Set<string>): RdfNode {
    const inside = new Set([...path, term.value]);
    const types: string[] = [];
    const properties = new Map<string, RdfValue[]>();
    for (const quad of bySubject.get(term.value) ?? []) {
      if (quad.predicate.value === RDF_TYPE && quad.object.termType === 'NamedNode') {
        types.push(quad.object.value);
        continue;
      }
      const values = properties.get(quad.predicate.value) ?? [];
      values.push(value(quad.object, inside));
      properties.set(quad.predicate.value, values);
    }
    return {
      id: term.value,
      blank: term.termType === 'BlankNode',
      types,
      properties: [...properties]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([predicate, values]) => ({predicate, values})),
    };
  }

  function value(object: Quad['object'], path: Set<string>): RdfValue {
    if (object.termType === 'Literal') {
      if (object.language) return {kind: 'literal', value: object.value, language: object.language};
      if (object.datatype.value !== XSD_STRING) {
        return {kind: 'literal', value: object.value, datatype: object.datatype.value};
      }
      return {kind: 'literal', value: object.value};
    }
    const nested =
      !path.has(object.value) &&
      !ownNode(object.value, record) &&
      (object.termType === 'BlankNode' || bySubject.has(object.value));
    return nested ? {kind: 'node', node: node(object, path)} : {kind: 'iri', value: object.value};
  }

  return [...bySubject.values()]
    .map(described => described[0].subject)
    .filter(subject => ownNode(subject.value, record))
    .sort((a, b) => (a.value === record ? -1 : b.value === record ? 1 : a.value.localeCompare(b.value)))
    .map(subject => node(subject, new Set()));
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
