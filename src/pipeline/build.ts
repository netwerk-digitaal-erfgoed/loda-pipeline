import {FileWriter, ImportResolver, Pipeline} from '@lde/pipeline';
import {applicationConfig, type PipelineConfig} from '../config.js';
import {createDatasetSelector} from './dataset-selector.js';
import {createQleverImportResolver} from './distribution-resolver.js';
import {createStages} from './stage.js';
import {createEdmShaclValidator} from './validator.js';
import {LoggerReporter} from '@lde/pipeline-logger-reporter';
import pino from 'pino';
import {createBindingsProvider} from './bindings-provider.js';

export async function build(
  pipelineConfig: PipelineConfig,
): Promise<{pipeline: Pipeline; distributionResolver: ImportResolver}> {
  const bindingsProvider = createBindingsProvider(pipelineConfig);

  const datasetSelector = await createDatasetSelector(
    new URL(pipelineConfig.dataset.uri),
    new URL(applicationConfig.REGISTRY_ENDPOINT),
    pipelineConfig.dataset.file,
  );

  const distributionResolver = await createQleverImportResolver(
    applicationConfig.IMPORT_DIR,
    applicationConfig.QLEVER_MEMORY_GB,
    applicationConfig.QLEVER_ENV,
    applicationConfig.QLEVER_IMAGE,
  );

  const validator = createEdmShaclValidator(
    applicationConfig.VALIDATION_EDM_SHAPES_PATH,
    applicationConfig.VALIDATION_OUTPUT_DIR,
  );

  const stages = await createStages(
    applicationConfig.BASE_CONFIG_DIR,
    validator,
    bindingsProvider,
    {
      batchSize: applicationConfig.STAGE_BATCH_SIZE,
      maxConcurrency: applicationConfig.STAGE_MAX_CONCURRENCY,
    },
    pipelineConfig.selector?.path,
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
    writers: new FileWriter({outputDir: applicationConfig.OUTPUT_DIR}),
    reporter: new LoggerReporter(logger.child({component: 'pipeline'})),
  });

  return {pipeline, distributionResolver};
}
