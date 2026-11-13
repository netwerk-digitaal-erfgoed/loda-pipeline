import {FileWriter, type ImportResolver, Pipeline} from '@lde/pipeline';
import {applicationConfig, type PipelineConfig} from '../config.js';
import {createDatasetSelector} from './dataset-selector.js';
import {createQleverResolvers} from './distribution-resolver.js';
import {createStages} from './stage.js';
import {LoggerReporter} from '@lde/pipeline-logger-reporter';
import pino from 'pino';
// import {createBindingsProvider} from './bindings-provider.js';

export async function build(
  pipelineConfig: PipelineConfig,
): Promise<{pipeline: Pipeline; distributionResolver: ImportResolver}> {
  // const bindingsProvider = createBindingsProvider(pipelineConfig);

  const datasetSelector = await createDatasetSelector(
    new URL(pipelineConfig.dataset.uri),
    new URL(applicationConfig.REGISTRY_ENDPOINT),
    pipelineConfig.dataset.file,
  );

  const {distributionResolver, stageOutputResolver} =
    await createQleverResolvers(
      applicationConfig.getPath(applicationConfig.IMPORT_DIR),
      applicationConfig.QLEVER_MEMORY_GB,
      applicationConfig.QLEVER_ENV,
      applicationConfig.QLEVER_IMAGE,
    );

  const stages = await createStages(
    applicationConfig.getPath(applicationConfig.BASE_CONFIG_DIR),
    applicationConfig.getPath(applicationConfig.VALIDATION_OUTPUT_DIR),
    // bindingsProvider,
    {
      batchSize: applicationConfig.STAGE_BATCH_SIZE,
      maxConcurrency: applicationConfig.STAGE_MAX_CONCURRENCY,
    },
    pipelineConfig.overrides,
  );

  const logger = pino({
    level: process.env.LOG_LEVEL ?? 'debug',
    transport: process.stdout.isTTY
      ? {target: 'pino-pretty', options: {colorize: true}}
      : undefined,
  });

  const pipeline = new Pipeline({
    name: pipelineConfig.name,
    datasetSelector,
    distributionResolver,
    stages,
    writers: new FileWriter({
      outputDir: applicationConfig.getPath(applicationConfig.OUTPUT_DIR),
    }),
    chaining: {
      stageOutputResolver,
      outputDir: applicationConfig.getPath(applicationConfig.STAGE_OUTPUT_DIR),
    },
    reporter: new LoggerReporter(logger.child({component: 'pipeline'})),
  });

  return {pipeline, distributionResolver};
}
