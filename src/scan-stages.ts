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
 * - selector.rq              → selector for all stages (single-stage pipeline)
 * - selector-N.rq            → selector for stage N
 * - selector-N-M-O.rq        → shared selector for stages N, M, O
 * - executor*.rq             → executor for stage 1 (e.g. executor.rq, executor-aggregation.rq)
 * - executor-N*.rq           → executor for stage N (e.g. executor-2.rq, executor-2-aggregation.rq)
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
    } else if (base.startsWith('executor')) {
      const stageNumber = parseExecutorStage(base);
      const list = executors.get(stageNumber) ?? [];
      list.push(file);
      executors.set(stageNumber, list);
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

/**
 * Extract the stage number from an executor filename (without extension).
 *
 * "executor"              → 1
 * "executor-foo"          → 1  (no leading digit after "executor-")
 * "executor-2"            → 2
 * "executor-2-aggregation"→ 2  (leading digit is the stage number)
 */
function parseExecutorStage(base: string): number {
  const suffix = base.slice('executor'.length);
  if (suffix === '') return 1;
  // suffix starts with "-"; check if the first segment is a number.
  const firstSegment = suffix.slice(1).split('-')[0];
  const num = parseInt(firstSegment, 10);
  return Number.isNaN(num) ? 1 : num;
}
