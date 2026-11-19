import {access} from 'node:fs/promises';
import {basename, parse, resolve} from 'node:path';
import type {Dataset} from '@lde/dataset';
import {FileWriter, RunContext, RunWriter, Writer} from '@lde/pipeline';
import type {TaskRunner} from '@lde/task-runner';
import {DockerTaskRunner} from '@lde/task-runner-docker';
import {HttpTaskRunner} from '@lde/task-runner-http';
import type {Logger} from 'pino';
import type {ApplicationConfig} from '../config.js';

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
 * file writer writes to.
 */
export class Rdf2EdmWriter implements Writer {
  constructor(
    private readonly fileWriter: FileWriter,
    private readonly taskRunner: TaskRunner<unknown>,
    private readonly logger: Logger,
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
          await this.convert(dataset);
        }
      },
    };
  }

  private async convert(dataset: Dataset): Promise<void> {
    const outputPath = this.fileWriter.getOutputPath(dataset);

    try {
      await access(outputPath);
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

    const input = basename(outputPath);
    const output = `./${parse(outputPath).name}.edm.zip`;
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
}
