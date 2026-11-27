import {parseArgs} from 'node:util';
import pino from 'pino';
import {getPipelineConfig} from '../config.js';
import {upload} from './upload.js';

const {positionals, values} = parseArgs({
  allowPositionals: true,
  options: {upload: {type: 'boolean', default: false}},
});
if (positionals.length !== 1) {
  console.error('Usage: npm run pipeline:upload -- <name> [--upload]');
  process.exit(1);
}

const pipelineConfig = await getPipelineConfig(positionals[0]);
await upload(pipelineConfig, {
  dryRun: !values.upload,
  logger: pino({name: 'upload'}),
});
