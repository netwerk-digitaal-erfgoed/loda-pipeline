import {
  readQueryFile,
  SparqlConstructReader,
  SparqlItemSelector,
  Stage,
  type Validator,
} from '@lde/pipeline';
// import type {DatasetBindingsProvider} from '@lde/pipeline';
import * as z from 'zod';
import {
  reportDir,
  type StageDefinition,
  scanStageGroups,
  stageName,
} from './scan-stages.js';
import {createShaclValidator} from './validator.js';

export const StageConfig = z.object({
  batchSize: z.number().gte(10).default(2000),
  maxConcurrency: z.number().gte(1).default(30),
});

type StageConfig = z.infer<typeof StageConfig>;

interface ChainOptions {
  validator?: Validator;
  emitOutput?: boolean;
  stages?: Stage[];
}

async function createStage(
  stageDef: StageDefinition,
  config: StageConfig,
  {validator, emitOutput, stages}: ChainOptions,
): Promise<Stage> {
  StageConfig.parse(config);

  const [selectorQuery, readers] = await Promise.all([
    stageDef.selectorFile && readQueryFile(stageDef.selectorFile),
    Promise.all(
      stageDef.executorFiles.map(f =>
        SparqlConstructReader.fromFile(f, {
          lineBuffer: true,
          deduplicate: true,
        }),
      ),
    ),
  ]);

  return new Stage({
    name: stageName(stageDef),
    readers,
    itemSelector: selectorQuery
      ? new SparqlItemSelector({query: selectorQuery})
      : undefined,
    batchSize: config.batchSize,
    maxConcurrency: config.maxConcurrency,
    validation: validator && {validator, onInvalid: 'write'},
    emitOutput,
    stages,
  });
}

/**
 * Create the stages of a pipeline as one chain through its stage groups:
 * each stage reads the output of the one before it, and only the output of the
 * last stage is written. The output of each group's last stage is validated
 * against the group's shapes.
 */
export async function createStages(
  baseDir: string,
  validationOutputDir: string,
  // bindingsProvider: DatasetBindingsProvider,
  config: StageConfig,
  overrideDirs: string[] = [],
): Promise<Stage[]> {
  const chain: {stageDef: StageDefinition; validator?: Validator}[] = [];
  const stageGroups = await scanStageGroups(baseDir, overrideDirs);

  for (const group of stageGroups) {
    const validator = createShaclValidator(
      group.shapesFile,
      reportDir(validationOutputDir, group.name),
    );

    chain.push(
      ...group.stages.map((stageDef, index) => ({
        stageDef,
        validator: index === group.stages.length - 1 ? validator : undefined,
      })),
    );
  }

  const [first, ...rest] = chain;
  const chained = await Promise.all(
    rest.map(({stageDef, validator}, index) =>
      createStage(stageDef, config, {
        validator,
        emitOutput: index === rest.length - 1,
      }),
    ),
  );

  return [
    await createStage(first.stageDef, config, {
      validator: first.validator,
      emitOutput: chained.length === 0,
      stages: chained,
    }),
  ];
}
