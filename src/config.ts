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
	registryEndpoint: z.url(),
	importsDir: z.string().default(path.resolve("imports")),
	outputDir: z.string().default(path.resolve("output")),
	validationEdmShapesPath: z.string(),
	validationOutputDir: z.string(),
	// Stage configuration, including batch size and concurrency. See its definition for defaults
	stage: StageConfig,
});

export type ApplicationConfig = z.infer<typeof ApplicationConfig>;

const resolveOrUndefined = (val: string | undefined): string | undefined =>
	val ? path.resolve(val) : undefined;

const asNumberOrUndefined = (val: string | undefined): number | undefined =>
	val ? parseInt(val, 10) : undefined;

export const applicationConfig = ApplicationConfig.parse({
	registryEndpoint: process.env.REGISTRY_ENDPOINT,
	importsDir: resolveOrUndefined(process.env.IMPORT_DIR),
	outputDir: resolveOrUndefined(process.env.OUTPUT_DIR),
	validationEdmShapesPath: resolveOrUndefined(
		process.env.VALIDATION_EDM_SHAPES_PATH,
	),
	validationOutputDir: resolveOrUndefined(process.env.VALIDATION_OUTPUT_DIR),
	stage: {
		batchSize: asNumberOrUndefined(process.env.STAGE_BATCH_SIZE),
		maxConcurrency: asNumberOrUndefined(process.env.STAGE_MAX_CONCURRENCY),
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
