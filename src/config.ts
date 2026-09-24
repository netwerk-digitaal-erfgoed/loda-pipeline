import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvFile } from "node:process";
import yaml from "yaml";
import * as z from "zod";
import { StageConfig } from "./pipeline/stage.js";

loadEnvFile();

// Configuration for an individual pipeline
const PipelineConfig = z.object({
	name: z.string(),
	directory: z.string(),
	dataset: z.object({
		uri: z.url(),
	}),
});

export type PipelineConfig = z.infer<typeof PipelineConfig>;

// Global application configurations, regardless of pipeline
const ApplicationConfig = z.object({
	registry_endpoint: z.url(),
	imports_directory: z.string().default(path.resolve("imports")),
	// Stage configuration, including batch size and concurrency. See its definition for defaults
	stage: StageConfig,
});

export type ApplicationConfig = z.infer<typeof ApplicationConfig>;

export const applicationConfig = ApplicationConfig.parse({
	registry_endpoint: process.env.REGISTRY_ENDPOINT,
	imports_directory: process.env.IMPORT_DIR,
	// TODO handle numberic values properly via Zod
	stage: {
		batchSize: process.env.STAGE_BATCH_SIZE
			? parseInt(process.env.STAGE_BATCH_SIZE, 10)
			: undefined,
		maxConcurrency: process.env.STAGE_MAX_CONCURRENCY
			? parseInt(process.env.STAGE_MAX_CONCURRENCY, 10)
			: undefined,
	},
});

const getConfigFilePath = (pipelineDir: string) =>
	path.resolve(pipelineDir, "config.yaml");

export async function getPipelineConfig(
	pipelineDir: string,
): Promise<PipelineConfig> {
	const configPath = getConfigFilePath(pipelineDir);
	return await readFile(configPath, "utf-8")
		.then(yaml.parse)
		.then((obj) =>
			PipelineConfig.parse({
				name: path.basename(pipelineDir),
				directory: path.resolve(pipelineDir),
				...obj,
			}),
		);
}

export async function initPipelineConfig(pipelineDir: string): Promise<void> {
	const configFp = getConfigFilePath(pipelineDir);
	const defaultConfig = createDefaultPipelineConfig();
	return writeFile(configFp, yaml.stringify(defaultConfig));
}

const createDefaultPipelineConfig = (): PipelineConfig =>
	PipelineConfig.parse({
		dataset: {
			uri: "",
		},
	});
