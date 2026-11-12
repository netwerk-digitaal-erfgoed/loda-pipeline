import {type ChildProcess, spawn} from 'node:child_process';
import {join} from 'node:path';
import {createInterface} from 'node:readline';
import type {Readable} from 'node:stream';
import type {RunStatus, StageRun} from '../src/types.ts';

/** How many lines of the pipeline's log a run keeps. */
const LOG_LINES = 200;

/** How often a run tells its listeners about its progress, at most. */
const EMIT_INTERVAL_MS = 250;

const LOG_LEVELS: Record<number, string> = {
  10: 'trace',
  20: 'debug',
  30: 'info',
  40: 'warn',
  50: 'error',
  60: 'fatal',
};

/** Runs a pipeline at debug level, at which it logs every event a run follows. */
function pipelineCli(repoDir: string, pipeline: string): ChildProcess {
  return spawn(process.execPath, ['--import', 'tsx', 'src/index.ts', pipeline], {
    cwd: repoDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {...process.env, LOG_LEVEL: 'debug'},
  });
}

/** The source dump of a pipeline, and the shapes to validate it against. */
export interface SourceValidation {
  data: string;
  shapes: string;
  report: string;
}

/**
 * Runs one pipeline at a time, and follows its run through the events it logs.
 * Then validates the source dump the pipeline downloaded.
 */
export class PipelineRunner {
  status?: RunStatus;
  private child?: ChildProcess;
  private stopRequested = false;
  private emitTimer?: NodeJS.Timeout;
  private readonly listeners = new Set<(status: RunStatus) => void>();
  private readonly repoDir: string;
  private readonly onEnd: (pipeline: string) => void;
  private readonly findSource: (
    pipeline: string,
  ) => Promise<SourceValidation | undefined>;

  constructor(
    repoDir: string,
    onEnd: (pipeline: string) => void,
    findSource: (pipeline: string) => Promise<SourceValidation | undefined>,
  ) {
    this.repoDir = repoDir;
    this.onEnd = onEnd;
    this.findSource = findSource;
  }

  get running(): boolean {
    return (
      this.status?.state === 'running' || this.status?.state === 'stopping'
    );
  }

  start(pipeline: string): void {
    if (this.running)
      throw new Error(`${this.status?.pipeline} is still running`);
    const status: RunStatus = {
      pipeline,
      state: 'running',
      startedAt: new Date().toISOString(),
      phase: 'Selecting the dataset',
      stages: [],
      validations: [],
      errors: [],
      log: [],
    };
    this.status = status;
    this.stopRequested = false;
    this.emit();

    this.execute(status)
      .catch(error => {
        status.errors.push((error as Error).message);
        return false;
      })
      .then(succeeded => {
        status.state = this.stopRequested
          ? 'stopped'
          : succeeded
            ? 'succeeded'
            : 'failed';
        status.endedAt = new Date().toISOString();
        this.emit();
        this.onEnd(pipeline);
      });
  }

  /** Stops the run: the pipeline stops the QLever it started when it gets a SIGTERM. */
  stop(): boolean {
    if (!this.running || !this.status) return false;
    this.stopRequested = true;
    this.status.state = 'stopping';
    this.child?.kill('SIGTERM');
    this.emit();
    return true;
  }

  private async execute(status: RunStatus): Promise<boolean> {
    const child = pipelineCli(this.repoDir, status.pipeline);
    const code = await this.wait(status, child);
    status.exitCode = code ?? undefined;
    if (this.stopRequested) return false;

    const validated = await this.validateSource(status);
    return code === 0 && validated !== false;
  }

  /** Validates the source dump, if it is there: whether that succeeded, or undefined if there is no dump. */
  private async validateSource(
    status: RunStatus,
  ): Promise<boolean | undefined> {
    const source = await this.findSource(status.pipeline);
    if (!source || this.stopRequested) return undefined;
    status.phase = 'Validating the source dump';
    this.emit();
    const child = spawn(
      process.execPath,
      ['scripts/validate.ts', source.data, source.shapes, source.report],
      {
        cwd: join(this.repoDir, 'validation-tool'),
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    const code = await this.wait(status, child);
    if (code === 0) return true;
    if (!this.stopRequested)
      status.errors.push(
        `Validating the source dump failed with exit code ${code}`,
      );
    return false;
  }

  /** Follows a child process's output in the log until it exits. */
  private wait(status: RunStatus, child: ChildProcess): Promise<number | null> {
    this.child = child;
    lines(child.stdout!, line => this.onLog(status, line));
    lines(child.stderr!, line => this.onLog(status, line));
    return new Promise(resolve => {
      child.on('error', error => status.errors.push(error.message));
      child.on('close', code => {
        this.child = undefined;
        resolve(code);
      });
    });
  }

  subscribe(listener: (status: RunStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private onEvent(status: RunStatus, event: PipelineEvent) {
    const stage = (name: string): StageRun => {
      let found = status.stages.find(candidate => candidate.name === name);
      if (!found) {
        found = {name, state: 'running', itemsProcessed: 0, quadsGenerated: 0};
        status.stages.push(found);
      }
      return found;
    };

    switch (event.type) {
      case 'datasetStart':
        status.phase = 'Resolving a distribution';
        break;
      case 'importStarted':
        status.phase = 'Importing the data dump';
        break;
      case 'importFailed':
        status.errors.push(`Importing failed: ${event.err.message}`);
        break;
      case 'distributionSelected':
        status.phase = 'Running stages';
        break;
      case 'stageStart':
        stage(event.stage);
        break;
      case 'stageProgress':
        Object.assign(stage(event.stage), {
          itemsProcessed: event.itemsProcessed,
          quadsGenerated: event.quadsGenerated,
        });
        break;
      case 'stageComplete':
        Object.assign(stage(event.stage), {
          state: 'complete',
          itemsProcessed: event.itemsProcessed,
          quadsGenerated: event.quadsGenerated,
          durationMs: event.durationMs,
        });
        break;
      case 'stageFailed':
        Object.assign(stage(event.stage), {
          state: 'failed',
          message: event.err.message,
        });
        break;
      case 'stageSkipped':
        Object.assign(stage(event.stage), {
          state: 'skipped',
          message: event.reason.message,
        });
        break;
      case 'datasetValidated':
        status.validations.push(event.report);
        break;
      case 'datasetSkipped':
        status.phase = `Skipped: ${event.reason.message}`;
        break;
      case 'datasetComplete':
        status.phase = 'Done';
        break;
    }
    this.scheduleEmit();
  }

  private onLog(status: RunStatus, line: string) {
    const entry = parseLog(line);
    if (entry?.component === 'pipeline')
      this.onEvent(status, entry as unknown as PipelineEvent);
    status.log.push(entry ? formatLog(entry) : line);
    if (status.log.length > LOG_LINES)
      status.log.splice(0, status.log.length - LOG_LINES);
    this.scheduleEmit();
  }

  private scheduleEmit() {
    this.emitTimer ??= setTimeout(() => this.emit(), EMIT_INTERVAL_MS);
  }

  private emit() {
    clearTimeout(this.emitTimer);
    this.emitTimer = undefined;
    if (!this.status) return;
    for (const listener of this.listeners) listener(this.status);
  }
}

/** The events of the pipeline that a run follows, as the pipeline's LoggerReporter logs them. */
type PipelineEvent =
  | {
      type:
        | 'datasetStart'
        | 'importStarted'
        | 'distributionSelected'
        | 'datasetComplete';
    }
  | {type: 'importFailed'; err: {message: string}}
  | {type: 'stageStart'; stage: string}
  | {
      type: 'stageProgress';
      stage: string;
      itemsProcessed: number;
      quadsGenerated: number;
    }
  | {
      type: 'stageComplete';
      stage: string;
      itemsProcessed: number;
      quadsGenerated: number;
      durationMs: number;
    }
  | {type: 'stageFailed'; stage: string; err: {message: string}}
  | {type: 'stageSkipped'; stage: string; reason: {message: string}}
  | {type: 'datasetSkipped'; reason: {message: string}}
  | {
      type: 'datasetValidated';
      report: {
        conforms: boolean;
        violations: number;
        quadsValidated: number;
        message?: string;
      };
    };

function lines(stream: Readable, onLine: (line: string) => void) {
  createInterface({input: stream, crlfDelay: Infinity}).on('line', line => {
    if (line.trim()) onLine(line);
  });
}

/** An entry of the pipeline's log, which pino writes as a line of JSON when it does not write to a terminal. */
interface LogEntry {
  level: number;
  time: number;
  msg: string;
  component?: string;
}

function parseLog(line: string): LogEntry | undefined {
  try {
    const entry = JSON.parse(line);
    return typeof entry === 'object' && entry !== null && 'msg' in entry
      ? entry
      : undefined;
  } catch {
    return undefined;
  }
}

function formatLog({level, time, msg}: LogEntry): string {
  return `${new Date(time).toLocaleTimeString()} ${LOG_LEVELS[level] ?? level} ${msg}`;
}
