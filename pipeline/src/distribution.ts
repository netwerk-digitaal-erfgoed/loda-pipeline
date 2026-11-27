const distributionExtensions = {
  ntGz: 'nt.gz',
  edmXmlZip: 'edmxml.zip',
  description: 'datasetdescription.ttl',
} as const;

export type DistributionFile = keyof typeof distributionExtensions;

export function getDistributionFileName(
  baseName: string,
  file: DistributionFile,
): string {
  return `${baseName}.${distributionExtensions[file]}`;
}

export function getDistributionUrl(
  distributionBase: string,
  pipelineName: string,
  file: DistributionFile,
): string {
  return `${distributionBase.replace(/\/$/, '')}/${getDistributionFileName(pipelineName, file)}`;
}
