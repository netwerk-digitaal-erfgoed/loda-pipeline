import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {Distribution} from '@lde/dataset';
import {
  ImportResolver,
  SparqlDistributionResolver,
  type StageOutputResolver,
} from '@lde/pipeline';
import {createQlever, type Importer, type Server} from '@lde/sparql-qlever';
import type {ApplicationConfig} from '../config.js';

export async function createQleverResolvers(
  importsDir: string,
  qleverMemoryGb: number,
  qleverEnv: ApplicationConfig['QLEVER_ENV'],
  qleverImage: string,
): Promise<{
  distributionResolver: ImportResolver;
  stageOutputResolver: StageOutputResolver;
}> {
  // Set up QLever for importing data.
  await mkdir(importsDir, {recursive: true});

  const qleverOptions = {
    dataDir: resolve(importsDir),
    serverOptions: {
      'memory-max-size': `${qleverMemoryGb}G`,
    },
  };

  const qlever = createQlever(
    qleverEnv === 'docker'
      ? {
          ...qleverOptions,
          mode: 'docker',
          image: qleverImage,
          containerName: 'loda-qlever',
        }
      : {...qleverOptions, mode: qleverEnv},
  );

  return {
    // Always import data dumps into QLever rather than using remote SPARQL endpoints.
    distributionResolver: new ImportResolver(new SparqlDistributionResolver(), {
      importer: qlever.importer,
      server: qlever.server,
      strategy: 'import',
    }),
    stageOutputResolver: new QleverStageOutputResolver(
      qlever.importer,
      qlever.server,
    ),
  };
}

/**
 * Serves the output of a chained stage from the QLever that served the dataset,
 * by replacing its index: the next stage only reads the output of the one
 * before it.
 */
class QleverStageOutputResolver implements StageOutputResolver {
  constructor(
    private readonly importer: Importer,
    private readonly server: Server<unknown>,
  ) {}

  async resolve(outputPath: string): Promise<Distribution> {
    await this.server.stop();
    const result = await this.importer.import([
      Distribution.localFile(outputPath),
    ]);
    if (result.type !== 'successful') {
      throw new Error(
        `Importing the stage output ${outputPath} failed: ${result.type === 'failed' ? result.error : 'not supported'}`,
      );
    }
    await this.server.start();

    return Distribution.sparql(this.server.queryEndpoint);
  }

  async cleanup(): Promise<void> {
    // The distribution resolver stops the server.
  }
}
