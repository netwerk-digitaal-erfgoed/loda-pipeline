import {createReadStream, createWriteStream} from 'node:fs';
import {access, rm} from 'node:fs/promises';
import {basename, resolve} from 'node:path';
import {pipeline} from 'node:stream/promises';
import {createGzip} from 'node:zlib';
import type {Dataset} from '@lde/dataset';
import {FileWriter, RunContext, RunWriter, Writer} from '@lde/pipeline';
import type {TaskRunner} from '@lde/task-runner';
import {DockerTaskRunner} from '@lde/task-runner-docker';
import {HttpTaskRunner} from '@lde/task-runner-http';
import type {Logger} from 'pino';
import type {ApplicationConfig, PipelineConfig} from '../config.js';
import {captureManifest, writeManifest} from '../description/manifest.js';
import {describe} from '../description/render.js';
import {getOutputPaths, type OutputPaths} from '../output.js';

const rdf2edmScript = '/app/crawler/rdf2edm.sh';

export function createRdf2EdmTaskRunner(
  outputDir: string,
  config: Pick<
    ApplicationConfig,
    'RDF2EDM_ENV' | 'RDF2EDM_IMAGE' | 'RDF2EDM_AGENT_PORT'
  >,
): TaskRunner<unknown> {
  return config.RDF2EDM_ENV === 'docker'
    ? new DockerTaskRunner({
        image: config.RDF2EDM_IMAGE,
        mountDir: resolve(outputDir),
      })
    : new HttpTaskRunner({cwd: outputDir, port: config.RDF2EDM_AGENT_PORT});
}

/**
 * Writes N-Triples through a {@link FileWriter} and, once a dataset has been
 * processed successfully, converts its file to a zip of EDM XML records with
 * the Europeana rdf2edm tool, run by the task runner in the directory the
 * file writer writes to. Records the run's facts in a manifest, from which the
 * dataset description is rendered.
 */
export class Rdf2EdmWriter implements Writer {
  constructor(
    private readonly fileWriter: FileWriter,
    private readonly taskRunner: TaskRunner<unknown>,
    private readonly logger: Logger,
    private readonly pipelineConfig: PipelineConfig,
  ) {}

  async openRun(context: RunContext): Promise<RunWriter> {
    const run = await this.fileWriter.openRun(context);
    return {
      write: (dataset, quads) => run.write(dataset, quads),
      reset: dataset => run.reset(dataset),
      commit: () => run.commit(),
      abort: error => run.abort(error),
      flush: async (dataset, outcome) => {
        await run.flush(dataset, outcome);
        if (outcome === 'success') {
          await this.finalize(dataset, context);
        }
      },
    };
  }

  private async finalize(dataset: Dataset, context: RunContext) {
    const paths = getOutputPaths(this.fileWriter, dataset);
    await rm(paths.manifest, {force: true});

    try {
      await access(paths.nt);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.logger.warn(
          {dataset: dataset.iri.toString()},
          'No output to convert to EDM XML',
        );
        return;
      }
      throw error;
    }

    const numTriples = await this.gzip(dataset, paths);
    await this.convertEdm(dataset, paths);

    await writeManifest(
      paths.manifest,
      await captureManifest({
        dataset,
        context,
        pipelineConfig: this.pipelineConfig,
        nt: {path: paths.ntGz, numTriples},
        xmlPath: paths.edmZip,
      }),
    );

    try {
      await describe(paths, this.pipelineConfig);
    } catch (error) {
      this.logger.error(
        {dataset: dataset.iri.toString(), error},
        'Generating the dataset description failed; fix and rerun it with pipeline:describe',
      );
    }
  }

  private async convertEdm(dataset: Dataset, paths: OutputPaths) {
    const input = basename(paths.nt);
    const output = `./${basename(paths.edmZip)}`;
    this.logger.info(
      {dataset: dataset.iri.toString(), input, output},
      'Converting to EDM XML',
    );
    const task = await this.taskRunner.run(
      `${rdf2edmScript} -input_file '${input}' -output_file '${output}'`,
    );
    const toolOutput = await this.taskRunner.wait(task);
    this.logger.debug(
      {dataset: dataset.iri.toString(), toolOutput},
      'Converted to EDM XML',
    );
  }

  private async gzip(dataset: Dataset, paths: OutputPaths): Promise<number> {
    this.logger.info(
      {
        dataset: dataset.iri.toString(),
        input: basename(paths.nt),
        output: paths.ntGz,
      },
      'Gzipping N-Triples',
    );
    let lines = 0;
    await pipeline(
      createReadStream(paths.nt),
      async function* (source: AsyncIterable<Buffer>) {
        for await (const chunk of source) {
          for (
            let i = chunk.indexOf(0x0a);
            i !== -1;
            i = chunk.indexOf(0x0a, i + 1)
          ) {
            lines++;
          }
          yield chunk;
        }
      },
      createGzip(),
      createWriteStream(paths.ntGz),
    );
    return lines;
  }
}
