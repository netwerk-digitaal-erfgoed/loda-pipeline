import {readFile} from 'node:fs/promises';
import path from 'node:path';
import envSchema, {type JSONSchemaType} from 'env-schema';
import filenamifyUrl from 'filenamify-url';
import yaml from 'yaml';
import * as z from 'zod';
import {
  type DistributionFile,
  getDistributionFileName,
} from './distribution.js';

const PipelineConfig = z.object({
  dataset: z.object({
    uri: z.url(),
    file: z.string().optional(),
    description: z
      .object({
        title: z.string().optional(),
        createdDate: z.iso.date().optional(),
        creator: z
          .object({
            uri: z.url().optional(),
            name: z.string().optional(),
          })
          .optional(),
        language: z
          .string()
          .regex(/^[a-z]{2}$/)
          .optional(),
      })
      .optional(),
  }),
  bindings: z.record(z.string(), z.string()).optional(),
  overrides: z.array(z.string()).optional(),
});

type NamelessPipelineConfig = z.infer<typeof PipelineConfig>;

export type PipelineConfig = NamelessPipelineConfig & {
  name: string;
  output: OutputConfig;
};

export type OutputFile = 'nt' | DistributionFile | 'manifest';

export interface OutputConfig {
  dir: string;
  files: Record<OutputFile, string>;
  paths: Record<OutputFile, string>;
}

/** Mirrors `FileWriter.getFilename` of `@lde/pipeline`, without the extension. */
export function getOutputBaseName(datasetUri: string): string {
  return filenamifyUrl(new URL(datasetUri).toString(), {replacement: '-'});
}

export function createOutputConfig(
  dir: string,
  datasetUri: string,
): OutputConfig {
  const baseName = getOutputBaseName(datasetUri);
  const files: Record<OutputFile, string> = {
    nt: `${baseName}.nt`,
    ntGz: getDistributionFileName(baseName, 'ntGz'),
    edmXmlZip: getDistributionFileName(baseName, 'edmXmlZip'),
    description: getDistributionFileName(baseName, 'description'),
    manifest: `${baseName}.manifest.json`,
  };
  return {
    dir,
    files,
    paths: {
      nt: path.join(dir, files.nt),
      ntGz: path.join(dir, files.ntGz),
      edmXmlZip: path.join(dir, files.edmXmlZip),
      description: path.join(dir, files.description),
      manifest: path.join(dir, files.manifest),
    },
  };
}

const PipelinesConfig = z.object({
  pipelines: z.record(z.string(), PipelineConfig),
});

// Global application configurations, regardless of pipeline.
export interface ApplicationConfig {
  REGISTRY_ENDPOINT: string;
  BASE_CONFIG_DIR: string;
  ROOT_DIR: string;
  IMPORT_DIR: string;
  OUTPUT_DIR: string;
  STAGE_OUTPUT_DIR: string;
  VALIDATION_OUTPUT_DIR: string;
  DISTRIBUTION_BASE: string;
  QUERY_FILES_BASE: string;
  S3_ENDPOINT: string;
  S3_REGION: string;
  S3_BUCKET: string;
  S3_FORCE_PATH_STYLE: boolean;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
  QLEVER_ENV: 'docker' | 'native' | 'remote';
  QLEVER_IMAGE: string;
  QLEVER_MEMORY_GB: number;
  RDF2EDM_ENV: 'docker' | 'remote';
  RDF2EDM_IMAGE: string;
  RDF2EDM_AGENT_PORT: number;
  STAGE_BATCH_SIZE: number;
  STAGE_MAX_CONCURRENCY: number;

  getPath(...relative: string[]): string;
}

const applicationConfigSchema: JSONSchemaType<
  Omit<ApplicationConfig, 'getPath'>
> = {
  type: 'object',
  required: [],
  properties: {
    REGISTRY_ENDPOINT: {
      type: 'string',
      default:
        'https://triplestore.netwerkdigitaalerfgoed.nl/repositories/registry',
    },
    ROOT_DIR: {type: 'string', default: '.'},
    BASE_CONFIG_DIR: {type: 'string', default: 'pipelines/generic'},
    IMPORT_DIR: {type: 'string', default: 'imports'},
    OUTPUT_DIR: {type: 'string', default: 'output'},
    STAGE_OUTPUT_DIR: {type: 'string', default: 'output/stages'},
    VALIDATION_OUTPUT_DIR: {type: 'string', default: 'output/validation'},
    DISTRIBUTION_BASE: {
      type: 'string',
      default: 'https://files.nde.nl/europeana',
    },
    QUERY_FILES_BASE: {
      type: 'string',
      default:
        'https://github.com/netwerk-digitaal-erfgoed/loda-pipeline/blob/main',
    },
    S3_ENDPOINT: {type: 'string', default: 'https://objectstore.surf.nl'},
    S3_REGION: {type: 'string', default: 'us-east-1'},
    S3_BUCKET: {type: 'string', default: 'europeana'},
    S3_FORCE_PATH_STYLE: {type: 'boolean', default: true},
    S3_ACCESS_KEY_ID: {type: 'string', nullable: true},
    S3_SECRET_ACCESS_KEY: {type: 'string', nullable: true},
    QLEVER_ENV: {
      type: 'string',
      enum: ['docker', 'native', 'remote'],
      default: 'docker',
    },
    QLEVER_IMAGE: {type: 'string', default: 'adfreiburg/qlever:commit-a14e0a0'},
    QLEVER_MEMORY_GB: {type: 'integer', minimum: 1, default: 8},
    RDF2EDM_ENV: {
      type: 'string',
      enum: ['docker', 'remote'],
      default: 'docker',
    },
    RDF2EDM_IMAGE: {type: 'string', default: 'loda-rdf2edm'},
    RDF2EDM_AGENT_PORT: {type: 'integer', default: 7071},
    STAGE_BATCH_SIZE: {type: 'integer', minimum: 10, default: 2000},
    STAGE_MAX_CONCURRENCY: {type: 'integer', minimum: 1, default: 30},
  },
};

/** The application config, from the environment and the `.env` file in `rootDir`. */
export function readApplicationConfig(
  envDir = process.cwd(),
): ApplicationConfig {
  const config = envSchema<Omit<ApplicationConfig, 'getPath'>>({
    schema: applicationConfigSchema,
    dotenv: {path: path.join(envDir, '.env')},
  });
  return {
    ...config,
    getPath: (...relative: string[]) => path.join(config.ROOT_DIR, ...relative),
  };
}

export const applicationConfig = readApplicationConfig();

const getConfigFilePath = () => applicationConfig.getPath('pipelines.yaml');

export async function getPipelineConfigs(): Promise<PipelineConfig[]> {
  const configPath = getConfigFilePath();
  const configAll = await readFile(configPath, 'utf-8')
    .then(yaml.parse)
    .then(PipelinesConfig.parse);
  return Object.entries(configAll.pipelines).map(([name, config]) => ({
    name,
    ...config,
    output: createOutputConfig(
      applicationConfig.getPath(applicationConfig.OUTPUT_DIR),
      config.dataset.uri,
    ),
  }));
}

export async function getPipelineConfig(name: string): Promise<PipelineConfig> {
  const config = (await getPipelineConfigs()).find(
    config => config.name === name,
  );
  if (!config) {
    throw Error(`No pipeline config was found by the name ${name}`);
  }
  return config;
}
