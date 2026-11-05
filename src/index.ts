import {parseArgs} from 'node:util';
import {getPipelineConfig, PipelineConfig} from './config.js';
import {build} from './pipeline/build.js';

async function main() {
  const {positionals} = parseArgs({allowPositionals: true});

  if (positionals.length !== 1) {
    console.error('Usage: npx tsx src/index.ts <name>');
  }
  const datasetName = positionals[0];
  const pipelineConfig: PipelineConfig = await getPipelineConfig(datasetName);

  const {pipeline, distributionResolver} = await build(pipelineConfig);

  try {
    await pipeline.run();
  } finally {
    await distributionResolver.cleanup();
  }
}

await main();
