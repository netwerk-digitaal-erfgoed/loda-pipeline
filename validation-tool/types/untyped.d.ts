declare module 'rdf-ext' {
  import type {DataFactory, DatasetCore, Quad} from '@rdfjs/types';

  const rdf: DataFactory & {dataset(quads?: Quad[]): DatasetCore & Iterable<Quad>};
  export default rdf;
}

declare module 'shacl-engine/Validator.js' {
  import type {DataFactory, DatasetCore, Quad, Term} from '@rdfjs/types';

  export default class Validator {
    constructor(shapes: DatasetCore, options: {factory: DataFactory});
    validate(data: {dataset: DatasetCore}): Promise<{
      conforms: boolean;
      results: {severity: Term}[];
      dataset: DatasetCore & Iterable<Quad>;
    }>;
  }
}
