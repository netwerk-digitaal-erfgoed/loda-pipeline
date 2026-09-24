import { mkdirSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { buildPipeline } from "./build-pipeline.js";
import { createDefaultConfig, getConfig, writeConfig } from "./config.js";

function init(pipelineDir: string) {
	mkdirSync(pipelineDir, { recursive: true });
	writeConfig(pipelineDir, createDefaultConfig());

	console.log(`Created ${pipelineDir}`);
	console.log("Add selector.rq and executor.rq query files to this directory.");
}

async function run(pipelineDir: string) {
	const config = getConfig(pipelineDir);
	const datasetIri = new URL(config.dataset.uri);

	const { pipeline, distributionResolver } = await buildPipeline(
		datasetIri,
		pipelineDir,
	);

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
		// biome-ignore lint/suspicious/noFallthroughSwitchClause: <explanation>
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
		init(pipelineDir);
		process.exit(0);
	}

	await run(pipelineDir);
}

await main();
