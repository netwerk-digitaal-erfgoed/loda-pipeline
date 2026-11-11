import {access} from 'node:fs/promises';
import path from 'node:path';
import {
  readQueryFile,
  SparqlConstructReader,
  SparqlItemSelector,
  Stage,
  type Validator,
} from '@lde/pipeline';
// import type {DatasetBindingsProvider} from '@lde/pipeline';
import * as z from 'zod';
import {type StageDefinition, scanStages} from './scan-stages.js';
import {createShaclValidator} from './validator.js';

/**
 * The layers of a pipeline, in the order they run: the source to SCHEMA-AP-NDE,
 * then SCHEMA-AP-NDE to EDM. Each is a directory in the base and override
 * directories.
 */
const LAYERS = ['nde-schema-ap', 'edm'];

/** The SHACL shapes in a layer's base directory that the layer's output must conform to. */
const SHAPES_FILE = 'shapes.ttl';

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
    name: `Stage ${stageDef.stageNumber}`,
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
 * Create the stages of a pipeline as one chain through its {@link LAYERS}:
 * each stage reads the output of the one before it, and only the output of the
 * last stage is written. The output of each layer's last stage is validated
 * against the layer's shapes.
 */
export async function createStages(
  baseDir: string,
  validationOutputDir: string,
  // bindingsProvider: DatasetBindingsProvider,
  config: StageConfig,
  overrideDirs: string[] = [],
): Promise<Stage[]> {
  const chain: {stageDef: StageDefinition; validator?: Validator}[] = [];
  for (const layer of LAYERS) {
    const stageDefs = await scanStages(
      path.join(baseDir, layer),
      await existingDirs(overrideDirs.map(dir => path.join(dir, layer))),
    );

    const validator = createShaclValidator(
      path.join(baseDir, layer, SHAPES_FILE),
      path.join(validationOutputDir, layer),
    );

    chain.push(
      ...stageDefs.map((stageDef, index) => ({
        stageDef,
        validator: index === stageDefs.length - 1 ? validator : undefined,
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

async function existingDirs(dirs: string[]): Promise<string[]> {
  const exists = await Promise.all(
    dirs.map(dir =>
      access(dir).then(
        () => true,
        () => false,
      ),
    ),
  );
  return dirs.filter((_, index) => exists[index]);
}
