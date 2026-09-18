import {mkdirSync, readFile, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {buildPipeline} from './build-pipeline.js';
import { parseArgs } from 'node:util';
import yaml from 'yaml';
import { pipeline } from 'node:stream';

interface Config {
  dataset: {
    uri: string
  }
}

const createDefaultConfig = (): Config => ({
  dataset: {
    uri: ''
  }
})

const getConfigFilePath = (pipelineDir: string) => path.resolve(pipelineDir, "config.yaml")

function getConfig(pipelineDir: string): Config {
  const configFp = getConfigFilePath(pipelineDir)
  const config = yaml.parse(readFileSync(configFp).toString())
  // TODO error if it doesn't exist
  // TODO validate config as Config type
  return config as Config
}

function writeConfig(pipelineDir: string, config: Config) {
  const configFp = getConfigFilePath(pipelineDir)
  writeFileSync(configFp, yaml.stringify(config))
}

function init(pipelineDir: string) {
  mkdirSync(pipelineDir, {recursive: true});
  writeConfig(pipelineDir, createDefaultConfig())

  console.log(`Created ${pipelineDir}`);
  console.log('Add selector.rq and executor.rq query files to this directory.');
}

async function run(pipelineDir: string) {
  const config = getConfig(pipelineDir)
  const datasetIri = new URL(config.dataset.uri)

  const {pipeline, distributionResolver} = await buildPipeline(
    datasetIri,
    pipelineDir
  );

  try {
    await pipeline.run();
  } finally {
    await distributionResolver.cleanup();
  }
}

async function main() {
  const {
    positionals
  } = parseArgs({ allowPositionals: true })

  let command: string | undefined
  let dirName: string

  switch (positionals.length) {
    // biome-ignore lint/suspicious/noFallthroughSwitchClause: <explanation>
    case 2:
      command = positionals.shift()
    case 1:
      dirName = positionals.shift() as string
      break
    default:
      console.error(
      'Usage:\n' +
        '  npx tsx src/index.ts <dataset-uri>        Run pipeline\n' +
        '  npx tsx src/index.ts init <dataset-uri>    Create pipeline directory'
      );
      process.exit(1);
  }
  // const datasetUri = command === 'init' ? process.argv[3] : command;
  const pipelineDir = path.resolve('pipelines', dirName);

  if (command === 'init') {
    init(pipelineDir)
    process.exit(0);
  }

  await run(pipelineDir)
}

await main()