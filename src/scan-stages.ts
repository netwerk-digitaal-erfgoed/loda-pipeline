import {readdir} from 'node:fs/promises';
import path from 'node:path';

export interface StageDefinition {
  stageNumber: number;
  selectorFile: string;
  executorFiles: string[];
}

/**
 * Scan a pipeline directory for .rq files and return stage definitions.
 *
 * Filename patterns:
 * - selector.rq         → selector for all stages (single-stage pipeline)
 * - selector-N.rq       → selector for stage N
 * - selector-N-M-O.rq   → shared selector for stages N, M, O
 * - executor.rq         → executor for stage 1 (single-stage pipeline)
 * - executor-N.rq       → executor for stage N
 */
export async function scanStages(dir: string): Promise<StageDefinition[]> {
  const files = await readdir(dir);
  const rqFiles = files.filter(f => f.endsWith('.rq'));

  // Map each stage number to its selector file.
  const selectorForStage = new Map<number, string>();
  let wildcardSelector: string | undefined;
  const executors = new Map<number, string[]>();

  for (const file of rqFiles) {
    const base = file.replace('.rq', '');

    if (base === 'selector') {
      wildcardSelector = file;
    } else if (base.startsWith('selector-')) {
      const nums = base.slice('selector-'.length).split('-').map(Number);
      if (nums.some(Number.isNaN)) continue;
      for (const num of nums) {
        selectorForStage.set(num, file);
      }
    } else if (base === 'executor') {
      const list = executors.get(1) ?? [];
      list.push(file);
      executors.set(1, list);
    } else if (base.startsWith('executor-')) {
      const num = parseInt(base.slice('executor-'.length), 10);
      if (Number.isNaN(num)) continue;
      const list = executors.get(num) ?? [];
      list.push(file);
      executors.set(num, list);
    }
  }

  // Group executors that share the same selector file into a single stage.
  const stagesBySelector = new Map<string, StageDefinition>();

  for (const [num, execs] of executors) {
    const selectorFile = selectorForStage.get(num) ?? wildcardSelector;
    if (!selectorFile) {
      throw new Error(`No selector found for stage ${num} in ${dir}`);
    }

    const existing = stagesBySelector.get(selectorFile);
    if (existing) {
      existing.stageNumber = Math.min(existing.stageNumber, num);
      existing.executorFiles.push(...execs.map(f => path.join(dir, f)));
    } else {
      stagesBySelector.set(selectorFile, {
        stageNumber: num,
        selectorFile: path.join(dir, selectorFile),
        executorFiles: execs.map(f => path.join(dir, f)),
      });
    }
  }

  const stages = [...stagesBySelector.values()];
  for (const stage of stages) {
    stage.executorFiles.sort();
  }
  stages.sort((a, b) => a.stageNumber - b.stageNumber);
  return stages;
}
