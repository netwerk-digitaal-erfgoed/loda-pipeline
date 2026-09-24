import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import yaml from 'yaml'

interface Config {
  dataset: {
    uri: string
  }
}

export const createDefaultConfig = (): Config => ({
  dataset: {
    uri: ''
  }
})

const getConfigFilePath = (pipelineDir: string) => path.resolve(pipelineDir, "config.yaml")

export function getConfig(pipelineDir: string): Config {
  const configFp = getConfigFilePath(pipelineDir)
  const config = yaml.parse(readFileSync(configFp).toString())
  // TODO error if it doesn't exist
  // TODO validate config as Config type
  return config as Config
}

export function writeConfig(pipelineDir: string, config: Config) {
  const configFp = getConfigFilePath(pipelineDir)
  writeFileSync(configFp, yaml.stringify(config))
}