import {resolve} from 'node:path';
import {FileWriter} from '@lde/pipeline';
import {ShaclValidator} from '@lde/pipeline-shacl-validator';

export function createShaclValidator(
  shapesPath: string,
  outputDir: string,
): ShaclValidator {
  return new ShaclValidator({
    shapesFile: resolve(shapesPath),
    reportWriters: [new FileWriter({outputDir})],
  });
}
