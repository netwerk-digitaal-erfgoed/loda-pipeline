import {readFile, stat, writeFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import handlebars from 'handlebars';
import * as z from 'zod';
import {applicationConfig, type PipelineConfig} from '../config.js';
import type {OutputPaths} from '../output.js';
import {readManifest, type RunManifest} from './manifest.js';

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

export const descriptionTemplatePath = () =>
  applicationConfig.getPath(
    applicationConfig.BASE_CONFIG_DIR,
    'datasetdescription.ttl.hbs',
  );

export async function describe(
  paths: OutputPaths,
  pipelineConfig: PipelineConfig,
): Promise<string> {
  const manifest = await readManifest(paths.manifest);
  await assertOutputsUnchanged(manifest, dirname(paths.manifest));

  await writeFile(
    paths.description,
    await renderDescription(manifest, pipelineConfig),
  );
  return paths.description;
}

export async function renderDescription(
  manifest: RunManifest,
  pipelineConfig: PipelineConfig,
  templatePath = descriptionTemplatePath(),
): Promise<string> {
  const template = handlebars.compile(await readFile(templatePath, 'utf-8'), {
    noEscape: true,
  });

  return template(
    DatasetDescriptionData.parse({
      dataset: toDatasetValues(manifest, pipelineConfig),
      distribution: toDistributionValues(manifest),
    }),
  );
}

function toDatasetValues(
  {source}: RunManifest,
  pipelineConfig: PipelineConfig,
): DatasetDescriptionData['dataset'] {
  const configured = pipelineConfig.dataset.description;

  return DatasetDescriptionData.shape.dataset.parse({
    id: pipelineConfig.name,
    title: configured?.title ?? source.title['nl'],
    creator: {
      uri: configured?.creator?.uri ?? source.creator[0]?.iri,
      name: configured?.creator?.name ?? source.creator[0]?.name['nl'],
    },
    createdDate: configured?.createdDate,
    language: toLanguageValue(configured?.language ?? source.language[0]),
    sourceDataset: source.iri,
  } satisfies Partial<DatasetDescriptionData['dataset']>);
}

function toLanguageValue(
  language: string,
): DatasetDescriptionData['dataset']['language'] | undefined {
  if (!language) {
    return undefined;
  }
  return URL.canParse(language) ? {iri: language} : {code: language};
}

function toDistributionValues({
  run,
  queryFiles,
  outputs,
}: RunManifest): DatasetDescriptionData['distribution'] {
  const contentUrl = (file: string) =>
    `${applicationConfig.DISTRIBUTION_BASE}/${file}`;
  return {
    createdDate: run.completedAt.slice(0, 10),
    createdDateTime: run.completedAt,
    queryFiles,
    nt: {
      numTriples: outputs.nt.numTriples,
      numBytes: outputs.nt.numBytes,
      contentUrl: contentUrl(outputs.nt.file),
    },
    xml: {
      numTriples: outputs.xml.numRecords,
      numBytes: outputs.xml.numBytes,
      contentUrl: contentUrl(outputs.xml.file),
    },
  };
}

async function assertOutputsUnchanged(
  manifest: RunManifest,
  dir: string,
): Promise<void> {
  for (const output of Object.values(manifest.outputs)) {
    const {size} = await stat(join(dir, output.file));

    if (size !== output.numBytes) {
      throw new Error(
        `${output.file} is ${size} bytes, but run ${manifest.run.id} recorded ${output.numBytes}`,
      );
    }
  }
}
