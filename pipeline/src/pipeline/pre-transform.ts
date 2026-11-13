import {readdir, readFile} from 'node:fs/promises';
import path from 'node:path';
import {
  type DistributionResolver,
  type NoDistributionAvailable,
  type ProbedDistributions,
  ResolvedDistribution,
} from '@lde/pipeline';

type ResolveCallbacks = Parameters<DistributionResolver['resolve']>[1];

const UPDATE_TIMEOUT = '1800s';

/**
 * Find the SPARQL Update files (.ru) in the override directories, in the order
 * to run them: by file name, and for equal names in directory order.
 */
export async function findPreTransforms(
  overrideDirs: string[] = [],
): Promise<string[]> {
  const files = await Promise.all(
    overrideDirs.map(async dir =>
      (await readdir(dir))
        .filter(file => file.endsWith('.ru'))
        .map(file => path.join(dir, file)),
    ),
  );
  return files
    .flat()
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
}

/**
 * Runs SPARQL Update files against the endpoint of a resolved distribution, so
 * that the stages see the transformed data.
 */
export class PreTransformResolver implements DistributionResolver {
  private readonly inner: DistributionResolver;
  private readonly updateFiles: string[];
  private readonly accessToken?: string;

  constructor(
    inner: DistributionResolver,
    updateFiles: string[],
    accessToken?: string,
  ) {
    this.inner = inner;
    this.updateFiles = updateFiles;
    this.accessToken = accessToken;
  }

  probe(...args: Parameters<DistributionResolver['probe']>) {
    return this.inner.probe(...args);
  }

  async resolve(
    probed: ProbedDistributions,
    callbacks?: ResolveCallbacks,
  ): Promise<ResolvedDistribution | NoDistributionAvailable> {
    const resolved = await this.inner.resolve(probed, callbacks);
    if (resolved instanceof ResolvedDistribution) {
      await this.runUpdates(resolved.distribution.accessUrl);
    }
    return resolved;
  }

  async cleanup(): Promise<void> {
    await this.inner.cleanup?.();
  }

  private async runUpdates(endpoint: URL): Promise<void> {
    for (const file of this.updateFiles) {
      const url = new URL(endpoint);
      url.searchParams.set('timeout', UPDATE_TIMEOUT);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/sparql-update',
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: await readFile(file, 'utf-8'),
      });
      if (!response.ok) {
        throw new Error(
          `Pre-transform ${file} failed with HTTP ${response.status}: ${await response.text()}`,
        );
      }
    }
  }
}
