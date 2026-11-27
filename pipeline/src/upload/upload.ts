import {createReadStream} from 'node:fs';
import {access} from 'node:fs/promises';
import {S3Client} from '@aws-sdk/client-s3';
import {Upload} from '@aws-sdk/lib-storage';
import type {Logger} from 'pino';
import {
  applicationConfig,
  type OutputConfig,
  type PipelineConfig,
} from '../config.js';
import {assertOutputsUnchanged} from '../description/render.js';
import {readManifest, RunManifest} from '../description/manifest.js';
import {
  type DistributionFile,
  getDistributionFileName,
} from '../distribution.js';

export interface UploadOptions {
  dryRun: boolean;
  logger: Logger;
  notBefore?: Date;
}

const uploads: {file: DistributionFile; contentType: string}[] = [
  {file: 'ntGz', contentType: 'application/n-triples+gzip'},
  {file: 'edmXmlZip', contentType: 'application/zip'},
  {file: 'description', contentType: 'text/turtle'},
];

export async function upload(
  pipelineConfig: PipelineConfig,
  {dryRun, logger, notBefore}: UploadOptions,
): Promise<void> {
  const {output} = pipelineConfig;
  const manifest = await readManifest(output.paths.manifest);
  if (notBefore && new Date(manifest.run.completedAt) < notBefore) {
    throw new Error(
      `${output.paths.manifest} is from run ${manifest.run.id} at ${manifest.run.completedAt}, not from this run`,
    );
  }
  await assertLatestDescription(manifest, output);

  const objects = uploads.map(({file, contentType}) => ({
    path: output.paths[file],
    key: getDistributionFileName(manifest.pipeline, file),
    contentType,
  }));

  const bucket = applicationConfig.S3_BUCKET;
  if (dryRun) {
    for (const {path, key} of objects) {
      logger.info({path, bucket, key}, 'Would upload; pass --upload to upload');
    }
    return;
  }

  const client = createS3Client();
  try {
    for (const {path, key, contentType} of objects) {
      logger.info({path, bucket, key}, 'Uploading');
      await new Upload({
        client,
        params: {
          Bucket: bucket,
          Key: key,
          Body: createReadStream(path),
          ContentType: contentType,
        },
      }).done();
    }
  } finally {
    client.destroy();
  }
}

function createS3Client(): S3Client {
  const {S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY} = applicationConfig;
  return new S3Client({
    credentials:
      S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY
        ? {
            accessKeyId: S3_ACCESS_KEY_ID,
            secretAccessKey: S3_SECRET_ACCESS_KEY,
          }
        : undefined,
    endpoint: applicationConfig.S3_ENDPOINT,
    region: applicationConfig.S3_REGION,
    forcePathStyle: applicationConfig.S3_FORCE_PATH_STYLE,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}

async function assertLatestDescription(
  manifest: RunManifest,
  output: OutputConfig,
) {
  await assertOutputsUnchanged(manifest, output.dir);
  const description = output.paths.description;
  try {
    await access(description);
  } catch {
    throw new Error(
      `${description} is missing; generate it with pipeline:describe`,
    );
  }
}
