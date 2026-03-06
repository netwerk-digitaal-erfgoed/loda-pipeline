import path from 'node:path';
import {
  Pipeline,
  Stage,
  SparqlConstructExecutor,
  SparqlItemSelector,
  ImportResolver,
  SparqlDistributionResolver,
  FileWriter,
  readQueryFile,
} from '@lde/pipeline';
import {createQlever} from '@lde/sparql-qlever';
import {ConsoleReporter} from '@lde/pipeline-console-reporter';
import {scanStages} from './scan-stages.js';
import {createDatasetSelector} from './dataset-selector.js';

export async function buildPipeline(datasetIri: URL, pipelineDir: string) {
  const absoluteDir = path.resolve(pipelineDir);

  // Set up QLever for importing data.
  const qlever = createQlever({
    mode: 'docker',
    image: 'adfreiburg/qlever',
  });

  // Wrap with ImportResolver: tries SPARQL endpoints first, falls back to import.
  const distributionResolver = new ImportResolver(
    new SparqlDistributionResolver(),
    {importer: qlever.importer, server: qlever.server}
  );

  // Resolve dataset.
  const datasetSelector = await createDatasetSelector(datasetIri, absoluteDir);

  // Scan .rq files and build stages in parallel.
  const stageDefs = await scanStages(absoluteDir);
  const stages = await Promise.all(
    stageDefs.map(async def => {
      const [selectorQuery, executors] = await Promise.all([
        readQueryFile(def.selectorFile),
        Promise.all(
          def.executorFiles.map(f => SparqlConstructExecutor.fromFile(f))
        ),
      ]);

      return new Stage({
        name: `Stage ${def.stageNumber}`,
        executors,
        itemSelector: new SparqlItemSelector({query: selectorQuery}),
        batchSize: 1000,
      });
    })
  );

  const pipeline = new Pipeline({
    name: path.basename(absoluteDir),
    datasetSelector,
    distributionResolver,
    stages,
    writers: new FileWriter({outputDir: './output'}),
    reporter: new ConsoleReporter(),
  });

  return {pipeline, distributionResolver};
}
