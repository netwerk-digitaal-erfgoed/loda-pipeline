import type {DatasetBindingsProvider} from '@lde/pipeline';
import {PipelineConfig} from '../config.js';
import {DataFactory} from 'n3';

const {literal} = DataFactory;

export function createBindingsProvider(
  pipelineConfig: PipelineConfig,
): DatasetBindingsProvider {
  return {
    bindings() {
      if (!pipelineConfig.bindings) {
        return [];
      }
      return [
        Object.entries(pipelineConfig.bindings).reduce(
          (acc, [name, value]) => Object.assign(acc, {[name]: literal(value)}),
          {},
        ),
      ];
    },
  };
}
