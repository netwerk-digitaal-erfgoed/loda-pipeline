import type {TaskRunner} from '@lde/task-runner';
import pino from 'pino';
import {describe, expect, it} from 'vitest';
import {createOutputConfig, type PipelineConfig} from '../config.js';
import {Rdf2EdmWriter} from './rdf2edm-writer.js';

const uri =
  'https://atlantislite.deventit.nl/AtlantisPubliek/data/dataset/MHD+-+Eerste+Wereldoorlog';
const taskRunner = {} as TaskRunner<unknown>;
const logger = pino({enabled: false});

function createPipelineConfig(
  output = createOutputConfig('output', uri),
): PipelineConfig {
  return {name: 'mhdww1', dataset: {uri}, output};
}

describe('Rdf2EdmWriter', () => {
  it('accepts a pipeline config whose N-Triples path matches the FileWriter', () => {
    expect(
      () => new Rdf2EdmWriter(taskRunner, logger, createPipelineConfig()),
    ).not.toThrow();
  });

  it('rejects a pipeline config whose N-Triples path differs from the FileWriter', () => {
    const output = createOutputConfig('output', uri);
    output.paths.nt = 'output/other.nt';

    expect(
      () => new Rdf2EdmWriter(taskRunner, logger, createPipelineConfig(output)),
    ).toThrow('but the pipeline config expects output/other.nt');
  });
});
