import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import envSchema, { type JSONSchemaType } from "env-schema";
import yaml from "yaml";
import * as z from "zod";

// Configuration for an individual pipeline
const PipelineConfig = z.object({
	name: z.string(),
	directory: z.string(),
	dataset: z.object({
		uri: z.url(),
	}),
});

export type PipelineConfig = z.infer<typeof PipelineConfig>;

// Global application configurations, regardless of pipeline.
export interface ApplicationConfig {
	REGISTRY_ENDPOINT: string;
	IMPORT_DIR: string;
	OUTPUT_DIR: string;
	VALIDATION_EDM_SHAPES_PATH: string;
	VALIDATION_OUTPUT_DIR: string;
	QLEVER_MEMORY_GB: number;
	STAGE_BATCH_SIZE: number;
	STAGE_MAX_CONCURRENCY: number;
}

const applicationConfigSchema: JSONSchemaType<ApplicationConfig> = {
	type: "object",
	required: [],
	properties: {
		REGISTRY_ENDPOINT: {
			type: "string",
			default:
				"https://triplestore.netwerkdigitaalerfgoed.nl/repositories/registry",
		},
		IMPORT_DIR: { type: "string", default: "imports" },
		OUTPUT_DIR: { type: "string", default: "output" },
		VALIDATION_EDM_SHAPES_PATH: {
			type: "string",
			default: "pipelines/generic/edm_ext_shacl_shapes.ttl",
		},
		VALIDATION_OUTPUT_DIR: { type: "string", default: "output/validation" },
		QLEVER_MEMORY_GB: { type: "integer", minimum: 1, default: 8 },
		STAGE_BATCH_SIZE: { type: "integer", minimum: 10, default: 2000 },
		STAGE_MAX_CONCURRENCY: { type: "integer", minimum: 1, default: 30 },
	},
};

export const applicationConfig = envSchema<ApplicationConfig>({
	schema: applicationConfigSchema,
	dotenv: true,
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
