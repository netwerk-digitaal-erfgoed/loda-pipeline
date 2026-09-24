import { mkdir } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import {
	applicationConfig,
	getPipelineConfig,
	initPipelineConfig,
} from "./config.js";
import { build } from "./pipeline/build.js";

async function init(pipelineDir: string): Promise<void> {
	await mkdir(pipelineDir, { recursive: true });
	await initPipelineConfig(pipelineDir);

	console.log(`Created ${pipelineDir}`);
	console.log("Add selector.rq and executor.rq query files to this directory.");
}

async function run(pipelineDir: string): Promise<void> {
	const pipelineConfig = await getPipelineConfig(pipelineDir);

	const { pipeline, distributionResolver } = await build({
		app: applicationConfig,
		pipeline: pipelineConfig,
	});

	try {
		await pipeline.run();
	} finally {
		await distributionResolver.cleanup();
	}
}

async function main() {
	const { positionals } = parseArgs({ allowPositionals: true });

	let command: string | undefined;
	let dirName: string;

	switch (positionals.length) {
		case 2:
			command = positionals.shift();
		case 1:
			dirName = positionals.shift() as string;
			break;
		default:
			console.error(
				"Usage:\n" +
					"  npx tsx src/index.ts <dataset-uri>        Run pipeline\n" +
					"  npx tsx src/index.ts init <dataset-uri>    Create pipeline directory",
			);
			process.exit(1);
	}
	// const datasetUri = command === 'init' ? process.argv[3] : command;
	const pipelineDir = path.resolve("pipelines", dirName);

	if (command === "init") {
		await init(pipelineDir);
		process.exit(0);
	}

	await run(pipelineDir);
}

await main();
