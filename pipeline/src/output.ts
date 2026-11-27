import {dirname, join, parse} from 'node:path';
import {Dataset} from '@lde/dataset';
import {FileWriter} from '@lde/pipeline';
import {applicationConfig} from './config.js';

export function createFileWriter(): FileWriter {
  return new FileWriter({
    outputDir: applicationConfig.getPath(applicationConfig.OUTPUT_DIR),
  });
}

export interface OutputPaths {
  nt: string;
  ntGz: string;
  edmZip: string;
  manifest: string;
  description: string;
}

export function getOutputPaths(
  fileWriter: FileWriter,
  dataset: Dataset | URL,
): OutputPaths {
  const nt = fileWriter.getOutputPath(
    dataset instanceof URL
      ? new Dataset({iri: dataset, distributions: []})
      : dataset,
  );
  const base = join(dirname(nt), parse(nt).name);
  return {
    nt,
    ntGz: `${nt}.gz`,
    edmZip: `${base}.edm.zip`,
    manifest: `${base}.manifest.json`,
    description: `${base}.description.ttl`,
  };
}
