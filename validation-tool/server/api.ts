import {readFile, stat} from 'node:fs/promises';
import type {ServerResponse} from 'node:http';
import {join, relative, resolve} from 'node:path';
import filenamifyUrl from 'filenamify-url';
import type {Plugin} from 'vite';
import {parse} from 'yaml';
import type {
  Checkpoint,
  Counts,
  Pipeline,
  PipelineDetails,
  RecordDescription,
  RecordSample,
} from '../src/types.ts';
import {countFile, summarizeReport} from './rdf.ts';
import {describeRecord, recordsOfClass, toTurtle} from './records.ts';
import {findSourceDump} from './source.ts';

export interface ValidationApiOptions {
  /** The pipeline repository, with pipelines.yaml and base/. */
  repoDir: string;
  /** The pipeline's IMPORT_DIR, where it downloads the source dumps. */
  importDir: string;
  /** The pipeline's REGISTRY_ENDPOINT. */
  registryEndpoint: string;
  /** The pipeline's OUTPUT_DIR. */
  outputDir: string;
  /** The pipeline's STAGE_OUTPUT_DIR. */
  stageOutputDir: string;
  /** The pipeline's VALIDATION_OUTPUT_DIR. */
  validationOutputDir: string;
}

/** The stage whose output is the pipeline's SCHEMA-AP-NDE data: the last stage in base/nde-schema-ap. */
const SCHEMA_AP_STAGE = 'Stage 10';

const CREATIVE_WORK = 'https://schema.org/CreativeWork';
const PROVIDED_CHO = 'http://www.europeana.eu/schemas/edm/ProvidedCHO';

/** How many example records reach EDM, and how many do not. */
const SAMPLES_IN_EDM = 10;
const SAMPLES_NOT_IN_EDM = 5;

/** Where a checkpoint's report and data are. */
interface CheckpointFiles {
  id: Checkpoint['id'];
  label: string;
  shapes: string;
  report: string;
  /** The data the report is about. */
  data?: string;
  /** Why there is no data, if there is none. */
  missing: string;
  /** The file to count classes and properties from, and how. */
  countsFile: string;
  counts: (path: string) => Promise<Counts>;
  hint: string;
}

interface PipelineConfig extends Pipeline {
  /** The pipeline's dataset file, with the dataset's distributions instead of the registry's. */
  datasetFile?: string;
}

/** Serves the pipelines and their validation reports, counts and records under /api. */
export function validationApi(options: ValidationApiOptions): Plugin {
  const cache = new Map<string, {mtimeMs: number; value: unknown}>();

  // Reports and data files only change when the pipeline or the validation script runs again.
  async function cached<T>(path: string, key: string, compute: () => Promise<T>) {
    const {mtimeMs} = await stat(path);
    const hit = cache.get(`${path}\u0000${key}`);
    if (hit?.mtimeMs === mtimeMs) return hit.value as T;
    const value = await compute();
    cache.set(`${path}\u0000${key}`, {mtimeMs, value});
    return value;
  }

  async function optional<T>(
    path: string | undefined,
    compute: (path: string) => Promise<T>,
    key = '',
  ): Promise<T | undefined> {
    if (path === undefined) return undefined;
    try {
      return await cached(path, key, () => compute(path));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw error;
    }
  }

  async function pipelines(): Promise<PipelineConfig[]> {
    const config = parse(await readFile(join(options.repoDir, 'pipelines.yaml'), 'utf8')) as {
      pipelines: Record<string, {dataset: {uri: string; file?: string}}>;
    };
    return Object.entries(config.pipelines).map(([name, pipeline]) => ({
      name,
      datasetUri: pipeline.dataset.uri,
      datasetFile: pipeline.dataset.file && join(options.repoDir, pipeline.dataset.file),
    }));
  }

  // The access URLs of a dataset rarely change, so look its dump up once.
  const sourceDumps = new Map<string, Promise<string | undefined>>();
  function sourceDump(pipeline: PipelineConfig): Promise<string | undefined> {
    let dump = sourceDumps.get(pipeline.name);
    if (!dump) {
      dump = findSourceDump(
        options.importDir,
        pipeline.datasetUri,
        options.registryEndpoint,
        pipeline.datasetFile,
      );
      dump.catch(() => sourceDumps.delete(pipeline.name));
      sourceDumps.set(pipeline.name, dump);
    }
    return dump;
  }

  async function checkpointFiles(pipeline: PipelineConfig): Promise<CheckpointFiles[]> {
    const file = `${filenamifyUrl(pipeline.datasetUri, {replacement: '-'})}.nt`;
    const sourceReport = join(options.validationOutputDir, 'source', file);
    const fromTool = (path: string) => relative(join(options.repoDir, 'validation-tool'), path);
    const run = `npm start -- ${pipeline.name}`;
    const dump =
      (await sourceDump(pipeline)) ??
      (await optional(`${sourceReport}.summary.json`, readSummary))?.dataFile;

    return [
      {
        id: 'source',
        label: 'Source',
        shapes: 'nde-schema-ap',
        report: sourceReport,
        data: dump,
        missing: `The source dump is not in ${options.importDir}. Run: ${run}`,
        countsFile: `${sourceReport}.summary.json`,
        counts: async path => {
          const {triples, classes, properties} = await readSummary(path);
          return {triples, classes, properties};
        },
        hint: `cd validation-tool && npm run validate -- '${dump ? fromTool(dump) : '<source dump>'}' '${fromTool(
          join(options.repoDir, 'base', 'nde-schema-ap', 'shapes.ttl'),
        )}' '${fromTool(sourceReport)}'`,
      },
      {
        id: 'nde-schema-ap',
        label: 'After pre-transform',
        shapes: 'nde-schema-ap',
        report: join(options.validationOutputDir, 'nde-schema-ap', file),
        data: join(options.stageOutputDir, SCHEMA_AP_STAGE, file),
        missing: `No data. Run: ${run}`,
        countsFile: join(options.stageOutputDir, SCHEMA_AP_STAGE, file),
        counts: countFile,
        hint: run,
      },
      {
        id: 'edm',
        label: 'Pipeline output',
        shapes: 'edm',
        report: join(options.validationOutputDir, 'edm', file),
        data: join(options.outputDir, file),
        missing: `No data. Run: ${run}`,
        countsFile: join(options.outputDir, file),
        counts: countFile,
        hint: run,
      },
    ];
  }

  async function details(pipeline: PipelineConfig): Promise<PipelineDetails> {
    const checkpoints: Checkpoint[] = [];
    for (const files of await checkpointFiles(pipeline)) {
      const report = await optional(files.report, summarizeReport);
      const counts = await optional(files.countsFile, files.counts);
      checkpoints.push({
        id: files.id,
        label: files.label,
        shapes: files.shapes,
        report,
        counts,
        ...(!(report && counts) && {hint: files.hint}),
      });
    }
    return {name: pipeline.name, datasetUri: pipeline.datasetUri, checkpoints};
  }

  /** Example records, from the SCHEMA-AP-NDE data: some that reach EDM, some that do not. */
  async function samples(pipeline: PipelineConfig): Promise<RecordSample[]> {
    const [, schemaAp, edm] = (await checkpointFiles(pipeline)).map(files => files.data);
    const records =
      (await optional(schemaAp, path => recordsOfClass(path, CREATIVE_WORK), 'records')) ?? [];
    const inEdm = new Set(
      (
        (await optional(edm, path => recordsOfClass(path, PROVIDED_CHO), 'records')) ?? []
      ).map(cho => cho.replace(/#cho$/, '')),
    );
    return [
      ...records.filter(iri => inEdm.has(iri)).slice(0, SAMPLES_IN_EDM),
      ...records.filter(iri => !inEdm.has(iri)).slice(0, SAMPLES_NOT_IN_EDM),
    ].map(iri => ({iri, inEdm: inEdm.has(iri)}));
  }

  async function describe(pipeline: PipelineConfig, record: string): Promise<RecordDescription> {
    const versions = [];
    for (const files of await checkpointFiles(pipeline)) {
      const quads = await optional(files.data, path => describeRecord(path, record), record);
      versions.push({
        id: files.id,
        label: files.label,
        triples: quads?.length ?? 0,
        ...(quads ? {turtle: await toTurtle(quads, record)} : {missing: files.missing}),
      });
    }
    return {iri: record, versions};
  }

  return {
    name: 'loda-validation-api',
    configureServer(server) {
      server.middlewares.use('/api/pipelines', async (req, res) => {
        try {
          const url = new URL(req.url ?? '/', 'http://localhost');
          const [name, view] = url.pathname.slice(1).split('/').map(decodeURIComponent);
          const all = await pipelines();
          if (!name) {
            return json(
              res,
              all.map(({name, datasetUri}): Pipeline => ({name, datasetUri})),
            );
          }

          const pipeline = all.find(candidate => candidate.name === name);
          if (!pipeline) return json(res, {error: `No pipeline ${name}`}, 404);
          if (view === 'records') {
            const record = url.searchParams.get('iri');
            return json(res, record ? await describe(pipeline, record) : await samples(pipeline));
          }
          return json(res, await details(pipeline));
        } catch (error) {
          return json(res, {error: (error as Error).message}, 500);
        }
      });
    },
  };
}

async function readSummary(path: string): Promise<Counts & {dataFile: string}> {
  return JSON.parse(await readFile(path, 'utf8'));
}

function json(res: ServerResponse, body: unknown, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export function repoPaths(repoDir: string): ValidationApiOptions {
  return {
    repoDir,
    importDir: resolve(repoDir, process.env.IMPORT_DIR ?? 'imports'),
    registryEndpoint:
      process.env.REGISTRY_ENDPOINT ??
      'https://triplestore.netwerkdigitaalerfgoed.nl/repositories/registry',
    outputDir: resolve(repoDir, process.env.OUTPUT_DIR ?? 'output'),
    stageOutputDir: resolve(repoDir, process.env.STAGE_OUTPUT_DIR ?? 'output/stages'),
    validationOutputDir: resolve(
      repoDir,
      process.env.VALIDATION_OUTPUT_DIR ?? 'output/validation',
    ),
  };
}
