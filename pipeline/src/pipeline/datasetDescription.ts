import {createReadStream} from 'node:fs';
import {readFile, stat} from 'node:fs/promises';
import {basename, relative, sep} from 'node:path';
import {createGunzip} from 'node:zlib';
import handlebars from 'handlebars';
import unzipper from 'unzipper';
import * as z from 'zod';
import {applicationConfig, type PipelineConfig} from '../config.js';
import {Dataset} from '@lde/dataset';
import {scanStageGroups} from './scan-stages.js';

const DistributionFile = z.object({
  numTriples: z.int().positive(),
  numBytes: z.int().positive(),
  contentUrl: z.url(),
});

const DatasetDescriptionData = z.object({
  dataset: z.object({
    id: z.string(),
    title: z.string(),
    creator: z.object({
      uri: z.url(),
      name: z.string(),
    }),
    createdDate: z.iso.date(),
    language: z.union([
      z.object({code: z.string().regex(/^[a-z]{2}$/)}),
      z.object({iri: z.url()}),
    ]),
    sourceDataset: z.url(),
  }),
  distribution: z.object({
    createdDate: z.iso.date(),
    createdDateTime: z.iso.datetime(),
    queryFiles: z.array(z.url({protocol: /^https$/})),
    nt: DistributionFile,
    xml: DistributionFile,
  }),
});

export type DatasetDescriptionData = z.infer<typeof DatasetDescriptionData>;

export type OutputFileFormat = 'nt+gz' | 'xml+zip';

export interface OutputFile<Format = OutputFileFormat> {
  format: Format;
  path: string;
}

export type OutputFileMap = Record<OutputFileFormat, string>;

export class DatasetDescriptionGenerator {
  constructor(
    private readonly templatePath: string,
    private readonly pipelineConfig: PipelineConfig,
  ) {}

  async generate(dataset: Dataset, outputPaths: string[]): Promise<string> {
    const template = await this.getTemplate();
    const templateData: DatasetDescriptionData = DatasetDescriptionData.parse({
      dataset: this.getDatasetMeta(dataset),
      distribution: await this.getDistributionMeta(
        asOutputFileMap(outputPaths),
      ),
    });

    return template(templateData);
  }

  private async getTemplate(): Promise<HandlebarsTemplateDelegate> {
    const templateStr = await readFile(this.templatePath, 'utf-8');
    return handlebars.compile(templateStr, {noEscape: true});
  }

  // TODO: consider using SPARQL construct queries for building this dataset description, rather than going for templating.
  // Reason: using SPARQL construct we can essentially map the original DCAT description to the target one, which relies on much hardcoding.
  // Alternatively we could finish the current setup and mark it as potential improvement...
  private getDatasetMeta(dataset: Dataset): DatasetDescriptionData['dataset'] {
    const configured = this.pipelineConfig.dataset.description;
    const language = configured?.language ?? dataset.language[0];
    return DatasetDescriptionData.def.shape.dataset.parse({
      id: this.pipelineConfig.name,
      title: configured?.title ?? dataset.title['nl'],
      creator: {
        uri: configured?.creator?.uri ?? dataset.creator[0]?.iri.href,
        name: configured?.creator?.name ?? dataset.creator[0]?.name['nl'],
      },
      createdDate: configured?.createdOn,
      language:
        language === undefined
          ? undefined
          : URL.canParse(language)
            ? {iri: language}
            : {code: language},
      sourceDataset: dataset.iri.href,
    } satisfies Partial<DatasetDescriptionData['dataset']>);
  }

  private async getDistributionFileMeta(
    output: OutputFile,
  ): Promise<z.infer<typeof DistributionFile>> {
    const [numTriples, {size: numBytes}] = await Promise.all([
      output.format === 'nt+gz'
        ? countGzipLines(output.path)
        : countZipEntries(output.path, '.edm.xml'),
      stat(output.path),
    ]);
    return DistributionFile.parse({
      numTriples,
      numBytes,
      contentUrl: `${applicationConfig.DISTRIBUTION_BASE}/${basename(output.path)}`,
    });
  }

  private async getQueryFiles(): Promise<string[]> {
    const stageGroups = await scanStageGroups(
      applicationConfig.getPath(applicationConfig.BASE_CONFIG_DIR),
      this.pipelineConfig.overrides,
    );
    const files = new Set(
      stageGroups.flatMap(group =>
        group.stages.flatMap(stage => [
          ...(stage.selectorFile ? [stage.selectorFile] : []),
          ...stage.executorFiles,
        ]),
      ),
    );
    const base = applicationConfig.QUERY_FILES_BASE.replace(/\/?$/, '/');
    return [...files].map(
      file =>
        new URL(
          relative(applicationConfig.ROOT_DIR, file).split(sep).join('/'),
          base,
        ).href,
    );
  }

  private async getDistributionMeta(
    outputFileMap: OutputFileMap,
  ): Promise<DatasetDescriptionData['distribution']> {
    const createdDateTime = new Date().toISOString();
    const [queryFiles, nt, xml] = await Promise.all([
      this.getQueryFiles(),
      this.getDistributionFileMeta({
        format: 'nt+gz',
        path: outputFileMap['nt+gz'],
      }),
      this.getDistributionFileMeta({
        format: 'xml+zip',
        path: outputFileMap['xml+zip'],
      }),
    ]);
    return DatasetDescriptionData.shape.distribution.parse({
      createdDate: createdDateTime.slice(0, 10),
      createdDateTime,
      queryFiles,
      nt,
      xml,
    } satisfies DatasetDescriptionData['distribution']);
  }
}

function asOutputFileMap(outputPaths: string[]): OutputFileMap {
  const xmlPath = outputPaths.find(path => path.endsWith('.edm.zip'));
  if (!xmlPath) {
    throw new Error('Missing .edm.zip output file');
  }
  const ntPath = outputPaths.find(path => path.endsWith('.nt.gz'));
  if (!ntPath) {
    throw new Error('Missing .nt.gz output file');
  }
  return {
    'xml+zip': xmlPath,
    'nt+gz': ntPath,
  };
}

async function countGzipLines(path: string): Promise<number> {
  let lines = 0;
  for await (const chunk of createReadStream(path).pipe(createGunzip())) {
    for (const byte of chunk as Buffer) {
      if (byte === 0x0a) lines++;
    }
  }
  return lines;
}

async function countZipEntries(path: string, suffix: string): Promise<number> {
  const directory = await unzipper.Open.file(path);
  const count = directory.files.filter(
    f => f.type === 'File' && f.path.endsWith(suffix),
  ).length;
  return count;
}
