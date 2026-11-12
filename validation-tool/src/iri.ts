export const prefixes: Record<string, string> = {
  sdo: 'https://schema.org/',
  schema: 'http://schema.org/',
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  skos: 'http://www.w3.org/2004/02/skos/core#',
  dc: 'http://purl.org/dc/elements/1.1/',
  dcterms: 'http://purl.org/dc/terms/',
  edm: 'http://www.europeana.eu/schemas/edm/',
  ore: 'http://www.openarchives.org/ore/terms/',
  svcs: 'http://rdfs.org/sioc/services#',
  crm: 'http://www.cidoc-crm.org/cidoc-crm/',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
};

/** Shorten an IRI with a well-known prefix, e.g. sdo:name. */
export function compact(iri: string): string {
  for (const [prefix, namespace] of Object.entries(prefixes)) {
    if (iri.startsWith(namespace)) return `${prefix}:${iri.slice(namespace.length)}`;
  }
  return iri;
}
