import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {ImportResolver, SparqlDistributionResolver} from '@lde/pipeline';
import {createQlever} from '@lde/sparql-qlever';
import type {ApplicationConfig} from '../config.js';

export async function createQleverImportResolver(
  importsDir: string,
  qleverMemoryGb: number,
  qleverEnv: ApplicationConfig['QLEVER_ENV'],
  qleverImage: string,
): Promise<ImportResolver> {
  // Set up QLever for importing data.
  await mkdir(importsDir, {recursive: true});

  const qleverOptions = {
    dataDir: resolve(importsDir),
    serverOptions: {'memory-max-size': `${qleverMemoryGb}G`},
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

  // Always import data dumps into QLever rather than using remote SPARQL endpoints.
  return new ImportResolver(new SparqlDistributionResolver(), {
    importer: qlever.importer,
    server: qlever.server,
    strategy: 'import',
  });
}
