import {
  readQueryFile,
  SparqlConstructReader,
  SparqlItemSelector,
  Stage,
  type Validator,
} from '@lde/pipeline';
import type {DatasetBindingsProvider} from '@lde/pipeline';
import * as z from 'zod';
import {type StageDefinition, scanStages} from './scan-stages.js';

export const StageConfig = z.object({
  batchSize: z.number().gte(10).default(2000),
  maxConcurrency: z.number().gte(1).default(30),
});

type StageConfig = z.infer<typeof StageConfig>;

async function createStage(
  stageDef: StageDefinition,
  validator: Validator,
  bindingsProvider: DatasetBindingsProvider,
  config: StageConfig,
): Promise<Stage> {
  StageConfig.parse(config);

  const [selectorQuery, readers] = await Promise.all([
    readQueryFile(stageDef.selectorFile),
    Promise.all(
      stageDef.executorFiles.map(f =>
        SparqlConstructReader.fromFile(f, {lineBuffer: true}),
      ),
    ),
  ]);

  return new Stage({
    name: `Stage ${stageDef.stageNumber}`,
    readers,
    itemSelector: new SparqlItemSelector({query: selectorQuery}),
    batchSize: config.batchSize,
    maxConcurrency: config.maxConcurrency,
    validation: {validator, onInvalid: 'write'},
    bindingsProvider,
  });
}

export async function createStages(
  pipelineDir: string,
  validator: Validator,
  bindingsProvider: DatasetBindingsProvider,
  config: StageConfig,
  selectorOverride?: string,
): Promise<Stage[]> {
  const stageDefs = await scanStages(pipelineDir, selectorOverride);
  return Promise.all(
    stageDefs.map(stageDef =>
      createStage(stageDef, validator, bindingsProvider, config),
    ),
  );
}
