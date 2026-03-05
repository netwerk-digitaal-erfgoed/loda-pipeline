import path from 'node:path';
import {buildPipeline} from './build-pipeline.js';

const datasetName = process.argv[2];
if (!datasetName) {
  console.error('Usage: npx tsx src/index.ts <dataset-name>');
  process.exit(1);
}

const pipelineDir = path.resolve('pipelines', datasetName);

const {pipeline, distributionResolver} = await buildPipeline(pipelineDir);

try {
  await pipeline.run();
} finally {
  await distributionResolver.cleanup();
}
