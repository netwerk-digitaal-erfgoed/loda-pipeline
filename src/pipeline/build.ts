import {FileWriter, Pipeline} from '@lde/pipeline';
import {ConsoleReporter} from '@lde/pipeline-console-reporter';
import {applicationConfig, type PipelineConfig} from '../config.js';
import {createDatasetSelector} from './dataset-selector.js';
import {createQleverImportResolver} from './distribution-resolver.js';
import {createStages} from './stage.js';
import {createEdmShaclValidator} from './validator.js';

export async function build(pipelineConfig: PipelineConfig) {
  const datasetSelector = await createDatasetSelector(
    new URL(pipelineConfig.dataset.uri),
    pipelineConfig.directory,
    new URL(applicationConfig.REGISTRY_ENDPOINT),
  );

  const distributionResolver = await createQleverImportResolver(
    applicationConfig.IMPORT_DIR,
    applicationConfig.QLEVER_MEMORY_GB,
  );

  const validator = createEdmShaclValidator(
    applicationConfig.VALIDATION_EDM_SHAPES_PATH,
    applicationConfig.VALIDATION_OUTPUT_DIR,
  );

  const stages = await createStages(pipelineConfig.directory, validator, {
    batchSize: applicationConfig.STAGE_BATCH_SIZE,
    maxConcurrency: applicationConfig.STAGE_MAX_CONCURRENCY,
  });

  const pipeline = new Pipeline({
    name: pipelineConfig.name,
    datasetSelector,
    distributionResolver,
    stages,
    writers: new FileWriter({outputDir: applicationConfig.OUTPUT_DIR}),
    reporter: new ConsoleReporter(),
  });

  return {pipeline, distributionResolver};
}
