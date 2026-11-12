import {readFile, stat} from 'node:fs/promises';
import type {ServerResponse} from 'node:http';
import {join} from 'node:path';
import type {Plugin} from 'vite';
import type {
  Checkpoint,
  Counts,
  Pipeline,
  PipelineDetails,
  RecordDescription,
  RecordDetails,
  RecordVersion,
  RecordSample,
} from '../src/types.ts';
import {type PipelineLayout, readLayouts} from './layout.ts';
import {PipelineRunner} from './pipeline.ts';
import {countFile, readReport, summarizeReport} from './rdf.ts';
import {describeRecord, ownNode, recordsOfClass, toTree, toTurtle} from './records.ts';
import {findSourceDump} from './source.ts';

export interface ValidationApiOptions {
  /** The pipeline repository, with pipelines.yaml and base/. */
  repoDir: string;
}

/** The files the pipelines' layout depends on. */
const LAYOUT_FILES = ['pipelines.yaml', '.env', 'base', 'overrides'];

const STAGE_GROUP_LABELS: Record<string, string> = {
  'nde-schema-ap': 'SCHEMA-AP-NDE',
  edm: 'EDM',
};

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

function sourceReportFile(pipeline: PipelineLayout): string {
  return join(pipeline.validationOutputDir, 'source', pipeline.file);
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

  // Reading the layouts scans the stage directories, so read them again only when the files they depend on change.
  let layouts: Promise<PipelineLayout[]> | undefined;
  function pipelines(): Promise<PipelineLayout[]> {
    if (!layouts) {
      layouts = readLayouts(options.repoDir);
      layouts.catch(() => (layouts = undefined));
    }
    return layouts;
  }

  // The access URLs of a dataset rarely change, so look its dump up once.
  const sourceDumps = new Map<string, Promise<string | undefined>>();
  function sourceDump(pipeline: PipelineLayout): Promise<string | undefined> {
    let dump = sourceDumps.get(pipeline.name);
    if (!dump) {
      dump = findSourceDump(
        pipeline.importDir,
        pipeline.datasetUri,
        pipeline.registryEndpoint,
        pipeline.datasetFile,
      );
      dump.catch(() => sourceDumps.delete(pipeline.name));
      sourceDumps.set(pipeline.name, dump);
    }
    return dump;
  }

  /** The source, validated against the shapes of the pipeline's first stage group, then each group's output. */
  async function checkpointFiles(pipeline: PipelineLayout): Promise<CheckpointFiles[]> {
    const [first] = pipeline.stageGroups;
    const sourceReport = sourceReportFile(pipeline);
    const run = 'Run the pipeline first.';
    const dump =
      (await sourceDump(pipeline)) ??
      (await optional(`${sourceReport}.summary.json`, readSummary))?.dataFile;

    return [
      {
        id: 'source',
        label: 'Source',
        shapes: first.name,
        report: sourceReport,
        data: dump,
        missing: `The source dump is not in ${pipeline.importDir}. ${run}`,
        countsFile: `${sourceReport}.summary.json`,
        counts: async path => {
          const {triples, duplicates, classes, properties} = await readSummary(path);
          return {triples, duplicates, classes, properties};
        },
        hint: dump ? `The source dump is not validated yet. ${run}` : `No source dump. ${run}`,
      },
      ...pipeline.stageGroups.map(
        (group): CheckpointFiles => ({
          id: group.name as Checkpoint['id'],
          label: STAGE_GROUP_LABELS[group.name] ?? group.name,
          shapes: group.name,
          report: group.report,
          data: group.data,
          missing: `No data. ${run}`,
          countsFile: group.data,
          counts: countFile,
          hint: `No data. ${run}`,
        }),
      ),
    ];
  }

  async function details(pipeline: PipelineLayout): Promise<PipelineDetails> {
    const checkpoints: Checkpoint[] = [];
    for (const files of await checkpointFiles(pipeline)) {
      const parsed = await optional(files.report, readReport, 'report');
      const report = parsed && summarizeReport(parsed);
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
  async function samples(pipeline: PipelineLayout): Promise<RecordSample[]> {
    const files = await checkpointFiles(pipeline);
    const [schemaAp, edm] = ['nde-schema-ap', 'edm'].map(
      id => files.find(candidate => candidate.id === id)?.data,
    );
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

  async function describeVersion(files: CheckpointFiles, record: string): Promise<RecordVersion> {
    const quads = await optional(files.data, path => describeRecord(path, record), record);
    return {
      id: files.id,
      label: files.label,
      triples: quads?.length ?? 0,
      ...(quads
        ? {turtle: await toTurtle(quads), tree: toTree(quads, record)}
        : {missing: files.missing}),
    };
  }

  async function describe(pipeline: PipelineLayout, record: string): Promise<RecordDescription> {
    const versions = [];
    for (const files of await checkpointFiles(pipeline)) {
      versions.push(await describeVersion(files, record));
    }
    return {iri: record, versions};
  }

  /** A record in one checkpoint's data, with the validation results about it and its own nodes. */
  async function recordDetails(
    pipeline: PipelineLayout,
    record: string,
    checkpoint: string,
  ): Promise<RecordDetails | undefined> {
    const files = (await checkpointFiles(pipeline)).find(files => files.id === checkpoint);
    if (!files) return undefined;
    const report = await optional(files.report, readReport, 'report');
    return {
      iri: record,
      version: await describeVersion(files, record),
      results: report?.results.filter(result => ownNode(result.focusNode, record)),
    };
  }

  const runner = new PipelineRunner(
    options.repoDir,
    pipeline => {
      layouts = undefined;
      sourceDumps.delete(pipeline);
    },
    async name => {
      const pipeline = (await pipelines()).find(candidate => candidate.name === name);
      if (!pipeline) return undefined;
      // The pipeline may just have downloaded the dump.
      sourceDumps.delete(name);
      const data = await sourceDump(pipeline);
      if (!data) return undefined;
      return {data, shapes: pipeline.stageGroups[0].shapes, report: sourceReportFile(pipeline)};
    },
  );

  return {
    name: 'loda-validation-api',
    configureServer(server) {
      const layoutFiles = LAYOUT_FILES.map(file => join(options.repoDir, file));
      server.watcher.add(layoutFiles);
      server.watcher.on('all', (_event, path) => {
        if (layoutFiles.some(file => path === file || path.startsWith(`${file}/`))) {
          layouts = undefined;
        }
      });
      server.httpServer?.once('close', () => runner.stop());

      server.middlewares.use('/api/run', async (req, res) => {
        try {
          if (req.method === 'GET') return follow(runner, res);
          if (req.method === 'DELETE') return json(res, {stopped: runner.stop()});
          if (req.method !== 'POST') return json(res, {error: 'Method not allowed'}, 405);

          const name = new URL(req.url ?? '/', 'http://localhost').searchParams.get('pipeline');
          if (!(await pipelines()).some(candidate => candidate.name === name)) {
            return json(res, {error: `No pipeline ${name}`}, 404);
          }
          if (runner.running) {
            return json(res, {error: `${runner.status?.pipeline} is still running`}, 409);
          }
          runner.start(name!);
          return json(res, runner.status, 202);
        } catch (error) {
          return json(res, {error: (error as Error).message}, 500);
        }
      });

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
          if (view === 'record') {
            const record = url.searchParams.get('iri');
            const checkpoint = url.searchParams.get('checkpoint');
            if (!record || !checkpoint) return json(res, {error: 'Give an iri and a checkpoint'}, 400);
            const details = await recordDetails(pipeline, record, checkpoint);
            if (!details) return json(res, {error: `No checkpoint ${checkpoint}`}, 404);
            return json(res, details);
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

/** Streams the status of the latest run as server-sent events, starting with where it is now. */
function follow(runner: PipelineRunner, res: ServerResponse) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  const send = (status: unknown) => res.write(`data: ${JSON.stringify(status ?? null)}\n\n`);
  send(runner.status);
  const unsubscribe = runner.subscribe(send);
  res.on('close', unsubscribe);
}
