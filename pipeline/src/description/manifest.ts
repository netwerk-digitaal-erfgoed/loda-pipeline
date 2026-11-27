import {stat} from 'node:fs/promises';
import {relative, sep} from 'node:path';
import type {Dataset} from '@lde/dataset';
import type {RunContext} from '@lde/pipeline';
import unzipper from 'unzipper';
import {applicationConfig, type PipelineConfig} from '../config.js';
import {scanStageGroups} from '../pipeline/scan-stages.js';
import {readFile, rename, writeFile} from 'node:fs/promises';
import * as z from 'zod';

const LanguageMap = z.record(z.string(), z.string());

const OutputFile = z.object({
  file: z.string(),
  numBytes: z.int().nonnegative(),
});

export const RunManifest = z.object({
  version: z.literal(1),
  pipeline: z.string(),
  run: z.object({
    id: z.string(),
    startedAt: z.iso.datetime({offset: true}),
    completedAt: z.iso.datetime({offset: true}),
  }),
  source: z.object({
    iri: z.url(),
    title: LanguageMap,
    language: z.array(z.string()),
    creator: z.array(z.object({iri: z.url(), name: LanguageMap})),
  }),
  queryFiles: z.array(z.url()),
  outputs: z.object({
    nt: OutputFile.extend({numTriples: z.int().nonnegative()}),
    xml: OutputFile.extend({numRecords: z.int().nonnegative()}),
  }),
});

export type RunManifest = z.infer<typeof RunManifest>;

export interface CaptureInput {
  dataset: Dataset;
  context: RunContext;
  pipelineConfig: PipelineConfig;
  numTriples: number;
}

export async function captureManifest({
  dataset,
  context,
  pipelineConfig,
  numTriples,
}: CaptureInput): Promise<RunManifest> {
  const {files, paths} = pipelineConfig.output;
  const ntPath = paths.ntGz;
  const xmlPath = paths.edmXmlZip;
  const [queryFiles, ntStat, xmlStat, numRecords] = await Promise.all([
    getQueryFiles(pipelineConfig.overrides),
    stat(ntPath),
    stat(xmlPath),
    countZipEntries(xmlPath, '.edm.xml'),
  ]);
  return {
    version: 1,
    pipeline: pipelineConfig.name,
    run: {
      id: context.runId,
      startedAt: context.startedAt,
      completedAt: new Date().toISOString(),
    },
    source: {
      iri: dataset.iri.href,
      title: dataset.title,
      language: dataset.language,
      creator: dataset.creator.map(creator => ({
        iri: creator.iri.href,
        name: creator.name,
      })),
    },
    queryFiles,
    outputs: {
      nt: {
        file: files.ntGz,
        numBytes: ntStat.size,
        numTriples,
      },
      xml: {
        file: files.edmXmlZip,
        numBytes: xmlStat.size,
        numRecords,
      },
    },
  };
}

async function getQueryFiles(overrides?: string[]): Promise<string[]> {
  const stageGroups = await scanStageGroups(
    applicationConfig.getPath(applicationConfig.BASE_CONFIG_DIR),
    overrides,
  );
  const files = new Set(
    stageGroups.flatMap(group =>
      group.stages.flatMap(stage => [
        ...(stage.selectorFile ? [stage.selectorFile] : []),
        ...stage.executorFiles,
      ]),
    ),
  );
  const base = applicationConfig.QUERY_FILES_BASE.replace(/\/?$/, '/');
  return [...files].map(
    file =>
      new URL(
        relative(applicationConfig.ROOT_DIR, file).split(sep).join('/'),
        base,
      ).href,
  );
}

async function countZipEntries(path: string, suffix: string): Promise<number> {
  const directory = await unzipper.Open.file(path);
  return directory.files.filter(
    f => f.type === 'File' && f.path.endsWith(suffix),
  ).length;
}

export async function writeManifest(
  path: string,
  manifest: RunManifest,
): Promise<void> {
  const tempPath = `${path}.tmp`;
  await writeFile(tempPath, JSON.stringify(manifest, null, 2));
  await rename(tempPath, path);
}

export async function readManifest(path: string): Promise<RunManifest> {
  return RunManifest.parse(JSON.parse(await readFile(path, 'utf-8')));
}
