import {parseArgs} from 'node:util';
import {getPipelineConfig} from '../config.js';
import {describe} from './render.js';

const {positionals} = parseArgs({allowPositionals: true});
if (positionals.length !== 1) {
  console.error('Usage: npm run pipeline:describe -- <name>');
  process.exit(1);
}

const pipelineConfig = await getPipelineConfig(positionals[0]);
const output = await describe(pipelineConfig);
console.log(`Wrote ${output}`);

export * from './manifest.js';
export * from './render.js';
