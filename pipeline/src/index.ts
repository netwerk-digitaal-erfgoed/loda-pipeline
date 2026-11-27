import {parseArgs} from 'node:util';
import pino from 'pino';
import {getPipelineConfig, PipelineConfig} from './config.js';
import {build} from './pipeline/build.js';
import {upload} from './upload/upload.js';

async function main() {
  const {positionals, values} = parseArgs({
    allowPositionals: true,
    options: {upload: {type: 'boolean', default: false}},
  });

  if (positionals.length !== 1) {
    console.error('Usage: npm run pipeline:start -- <name> [--upload]');
  }
  const datasetName = positionals[0];
  const pipelineConfig: PipelineConfig = await getPipelineConfig(datasetName);

  const {pipeline, distributionResolver} = await build(pipelineConfig);

  const startedAt = new Date();
  try {
    await pipeline.run();
  } finally {
    await distributionResolver.cleanup();
  }

  await upload(pipelineConfig, {
    dryRun: !values.upload,
    logger: pino({name: 'upload'}),
    notBefore: startedAt,
  });
}

await main();
