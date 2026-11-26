import {createReadStream, createWriteStream} from 'node:fs';
import {access, writeFile} from 'node:fs/promises';
import {basename, dirname, join, parse, resolve} from 'node:path';
import {pipeline} from 'node:stream/promises';
import {createGzip} from 'node:zlib';
import type {Dataset} from '@lde/dataset';
import {FileWriter, RunContext, RunWriter, Writer} from '@lde/pipeline';
import type {TaskRunner} from '@lde/task-runner';
import {DockerTaskRunner} from '@lde/task-runner-docker';
import {HttpTaskRunner} from '@lde/task-runner-http';
import type {Logger} from 'pino';
import type {ApplicationConfig} from '../config.js';
import {DatasetDescriptionGenerator} from './datasetDescription.js';

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
    private readonly descriptionGenerator: DatasetDescriptionGenerator,
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
          const outputPaths = await this.convert(dataset);
          if (!outputPaths) {
            return; // TODO: or throw
          }
          await this.generateDescription(dataset, outputPaths);
        }
      },
    };
  }

  private async convert(dataset: Dataset): Promise<string[] | null> {
    const paths: string[] = [];
    const outputPath = this.fileWriter.getOutputPath(dataset);

    try {
      await access(outputPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.logger.warn(
          {dataset: dataset.iri.toString()},
          'No output to convert to EDM XML',
        );
        return null;
      }
      throw error;
    }

    paths.push(await this.gzip(dataset, outputPath));
    paths.push(await this.convertEdm(dataset, outputPath));
    return paths;
  }

  private async convertEdm(
    dataset: Dataset,
    outputPath: string,
  ): Promise<string> {
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
    return join(dirname(outputPath), output);
  }

  private async gzip(dataset: Dataset, inputPath: string): Promise<string> {
    const output = `${inputPath}.gz`;
    this.logger.info(
      {dataset: dataset.iri.toString(), input: basename(inputPath), output},
      'Gzipping N-Triples',
    );
    await pipeline(
      createReadStream(inputPath),
      createGzip(),
      createWriteStream(output),
    );

    return output;
  }

  private async generateDescription(dataset: Dataset, outputPaths: string[]) {
    const description = await this.descriptionGenerator.generate(
      dataset,
      outputPaths,
    );
    const outputPath = this.fileWriter.getOutputPath(dataset);
    const output = join(
      dirname(outputPath),
      `${parse(outputPath).name}.description.ttl`,
    );
    await writeFile(output, description);
  }
}
