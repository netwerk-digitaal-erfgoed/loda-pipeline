import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import filenamifyUrl from 'filenamify-url';
import {buildPipeline} from './build-pipeline.js';

const command = process.argv[2];
const datasetUri = command === 'init' ? process.argv[3] : command;

if (!datasetUri) {
  console.error(
    'Usage:\n' +
      '  npx tsx src/index.ts <dataset-uri>        Run pipeline\n' +
      '  npx tsx src/index.ts init <dataset-uri>    Create pipeline directory'
  );
  process.exit(1);
}

const datasetIri = new URL(datasetUri);
const dirName = filenamifyUrl(datasetUri, {replacement: '-'});
const pipelineDir = path.resolve('pipelines', dirName);

if (command === 'init') {
  await mkdir(pipelineDir, {recursive: true});
  console.log(`Created ${pipelineDir}`);
  console.log('Add selector.rq and executor.rq query files to this directory.');
  process.exit(0);
}

const {pipeline, distributionResolver} = await buildPipeline(
  datasetIri,
  pipelineDir
);

try {
  await pipeline.run();
} finally {
  await distributionResolver.cleanup();
}
