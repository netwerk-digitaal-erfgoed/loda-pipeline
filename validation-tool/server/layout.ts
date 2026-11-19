import path from 'node:path';
import {Dataset} from '@lde/dataset';
import {FileWriter} from '@lde/pipeline';
import {
  type ApplicationConfig,
  getPipelineConfigs,
  type PipelineConfig,
  readApplicationConfig,
} from '../../pipeline/src/config.ts';
import {
  reportDir,
  scanStageGroups,
  stageName,
} from '../../pipeline/src/pipeline/scan-stages.ts';

/** The output of a stage group's last stage and its validation report. */
export interface StageGroupLayout {
  name: string;
  shapes: string;
  data: string;
  report: string;
}

/** Where a pipeline reads and writes its files, as absolute paths. */
export interface PipelineLayout {
  name: string;
  datasetUri: string;
  datasetFile?: string;
  registryEndpoint: string;
  importDir: string;
  validationOutputDir: string;
  /** The name of the dataset's files in the output directories. */
  file: string;
  stageGroups: StageGroupLayout[];
}

/**
 * The layout of every pipeline in the repository's pipelines.yaml.
 * The pipeline's CLI does not print it, but a `--layout` flag that does would be easy to add.
 */
export async function readLayouts(repoDir: string): Promise<PipelineLayout[]> {
  const app = readApplicationConfig(repoDir);
  return Promise.all(
    (await getPipelineConfigs()).map(config =>
      pipelineLayout(config, app, repoDir),
    ),
  );
}

/** The layout of a pipeline, with its relative paths resolved against `rootDir`. */
async function pipelineLayout(
  config: PipelineConfig,
  app: ApplicationConfig,
  rootDir: string,
): Promise<PipelineLayout> {
  const dataset = new Dataset({
    iri: new URL(config.dataset.uri),
    distributions: [],
  });
  const resolve = (file: string) => path.resolve(rootDir, file);
  const outputPath = (outputDir: string) =>
    resolve(new FileWriter({outputDir}).getOutputPath(dataset));
  const baseDir = resolve(app.BASE_CONFIG_DIR);

  const stageGroups: StageGroupLayout[] = [];
  const groups = await scanStageGroups(baseDir, config.overrides?.map(resolve));
  for (const group of groups) {
    const stage = group.stages.at(-1);
    if (!stage) continue;
    stageGroups.push({
      name: group.name,
      shapes: group.shapesFile,
      data: outputPath(path.join(app.STAGE_OUTPUT_DIR, stageName(stage))),
      report: outputPath(reportDir(app.VALIDATION_OUTPUT_DIR, group.name)),
    });
  }
  // Only the output of the pipeline's last stage is written to the output directory.
  const last = stageGroups.at(-1);
  if (last) last.data = outputPath(app.OUTPUT_DIR);

  return {
    name: config.name,
    datasetUri: config.dataset.uri,
    datasetFile: config.dataset.file && resolve(config.dataset.file),
    registryEndpoint: app.REGISTRY_ENDPOINT,
    importDir: resolve(app.IMPORT_DIR),
    validationOutputDir: resolve(app.VALIDATION_OUTPUT_DIR),
    file: path.basename(outputPath(app.OUTPUT_DIR)),
    stageGroups,
  };
}
