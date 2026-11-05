import {readFile} from 'node:fs/promises';
import path from 'node:path';
import envSchema, {type JSONSchemaType} from 'env-schema';
import yaml from 'yaml';
import * as z from 'zod';

const PipelineConfig = z.object({
  dataset: z.object({
    uri: z.url(),
    file: z.string().optional(),
  }),
  bindings: z.record(z.string(), z.string()).optional(),
  selector: z
    .object({
      path: z.string().optional(),
    })
    .optional(),
});

type NamelessPipelineConfig = z.infer<typeof PipelineConfig>;

export type PipelineConfig = NamelessPipelineConfig & {name: string};

const PipelinesConfig = z.object({
  pipelines: z.record(z.string(), PipelineConfig),
});

// Global application configurations, regardless of pipeline.
export interface ApplicationConfig {
  REGISTRY_ENDPOINT: string;
  BASE_CONFIG_DIR: string;
  IMPORT_DIR: string;
  OUTPUT_DIR: string;
  VALIDATION_EDM_SHAPES_PATH: string;
  VALIDATION_OUTPUT_DIR: string;
  QLEVER_ENV: 'docker' | 'native' | 'remote';
  QLEVER_IMAGE: string;
  QLEVER_MEMORY_GB: number;
  STAGE_BATCH_SIZE: number;
  STAGE_MAX_CONCURRENCY: number;
}

const applicationConfigSchema: JSONSchemaType<ApplicationConfig> = {
  type: 'object',
  required: [],
  properties: {
    REGISTRY_ENDPOINT: {
      type: 'string',
      default:
        'https://triplestore.netwerkdigitaalerfgoed.nl/repositories/registry',
    },
    BASE_CONFIG_DIR: {type: 'string', default: 'base'},
    IMPORT_DIR: {type: 'string', default: 'imports'},
    OUTPUT_DIR: {type: 'string', default: 'output'},
    VALIDATION_EDM_SHAPES_PATH: {
      type: 'string',
      default: 'base/edm_ext_shacl_shapes.ttl',
    },
    VALIDATION_OUTPUT_DIR: {type: 'string', default: 'output/validation'},
    QLEVER_ENV: {
      type: 'string',
      enum: ['docker', 'native', 'remote'],
      default: 'docker',
    },
    QLEVER_IMAGE: {type: 'string', default: 'adfreiburg/qlever:commit-a14e0a0'},
    QLEVER_MEMORY_GB: {type: 'integer', minimum: 1, default: 8},
    STAGE_BATCH_SIZE: {type: 'integer', minimum: 10, default: 2000},
    STAGE_MAX_CONCURRENCY: {type: 'integer', minimum: 1, default: 30},
  },
};

export const applicationConfig = envSchema<ApplicationConfig>({
  schema: applicationConfigSchema,
  dotenv: true,
});

const getConfigFilePath = () => path.resolve('pipelines.yaml');

export async function getPipelineConfig(name: string): Promise<PipelineConfig> {
  const configPath = getConfigFilePath();
  const configAll = await readFile(configPath, 'utf-8')
    .then(yaml.parse)
    .then(PipelinesConfig.parse);
  const config = Object.entries(configAll.pipelines)
    .map(([name, config]) => ({
      name,
      ...config,
    }))
    .find(config => config.name === name);
  if (!config) {
    throw Error(`No pipeline config was found by the name ${name}`);
  }
  return config;
}
