import {Dataset} from '@lde/dataset';
import {FileWriter} from '@lde/pipeline';
import {describe, expect, it} from 'vitest';
import {createOutputConfig} from './config.js';

const outputDir = 'output';

const datasetUris = [
  'http://data.beeldengeluid.nl/id/dataset/0029',
  'https://zoeken.erfgoedshertogenbosch.nl/AtlantisPubliek/data/dataset/Dataset+Beeldbank+Erfgoed+%27s-Hertogenbosch',
  'https://n2t.net/ark:/32838/dataset',
  'https://atlantislite.deventit.nl/AtlantisPubliek/data/dataset/MHD+-+Eerste+Wereldoorlog',
  'https://n2t.net/ark:/72166/dataset',
  'https://studiezaal.nijmegen.nl/AtlantisPubliek/data/dataset/LOD+Beelddocumenten',
  'HTTPS://Example.ORG',
  'https://example.org/dataset?id=1&lang=nl#main',
  'https://example.org/datasets/café',
];

describe('createOutputConfig', () => {
  it.each(datasetUris)(
    'names the N-Triples file as the FileWriter of @lde/pipeline does for %s',
    uri => {
      const fileWriter = new FileWriter({outputDir});
      const dataset = new Dataset({iri: new URL(uri), distributions: []});

      expect(createOutputConfig(outputDir, uri).paths.nt).toBe(
        fileWriter.getOutputPath(dataset),
      );
    },
  );
});
