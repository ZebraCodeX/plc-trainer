import { TagDatabase } from './tagdb';
import { executeOutput, evalSeries, type RunContext } from './runtime';
import { initialProcessState, tickProcess, type ProcessState } from './process';
import type { Project, Program, Routine } from './model';
import type { StProgram } from '../st/ast';
import { parseSt } from '../st/parser';
import { executeSt } from '../st/interpreter';

export interface EngineHooks {
  afterScan?: (engine: PlcEngine) => void;
}

export class PlcEngine {
  db: TagDatabase;
  project: Project;
  scanCount = 0;
  running = false;
  scanTimeMs = 20;
  hooks: EngineHooks = {};

  private processStates = new Map<string, ProcessState>();
  private instrState = new Map<string, number>();
  private stCache = new Map<string, StProgram>();
  private stErrors = new Map<string, string[]>();
  private listeners = new Set<() => void>();
  private handle: ReturnType<typeof setInterval> | null = null;
  private callDepth = 0;

  constructor(project: Project) {
    this.project = project;
    this.db = new TagDatabase(project.tags);
    this.syncProcessStates();
  }

  /** Reload definitions from the project (structure change). */
  setProject(project: Project): void {
    this.project = project;
    this.db.load(project.tags);
    this.syncProcessStates();
    this.stCache.clear();
    this.stErrors.clear();
    this.instrState.clear();
    this.emit();
  }

  /** Refresh only the compiled ST cache (source change). */
  invalidatePrograms(): void {
    this.stCache.clear();
    this.stErrors.clear();
  }

  private syncProcessStates(): void {
    const keep = new Map<string, ProcessState>();
    for (const comp of this.project.process) {
      keep.set(comp.id, this.processStates.get(comp.id) ?? initialProcessState(comp.type));
    }
    this.processStates = keep;
  }

  getProcessState(id: string): ProcessState | undefined {
    return this.processStates.get(id);
  }

  setProcessValue(id: string, key: string, value: number): void {
    const s = this.processStates.get(id);
    if (s) s[key] = value;
  }

  reset(): void {
    this.db.resetValues();
    this.processStates.clear();
    this.syncProcessStates();
    this.instrState.clear();
    this.scanCount = 0;
    this.emit();
  }

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  private emit(): void {
    for (const l of this.listeners) l();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    if (typeof setInterval !== 'undefined') {
      this.handle = setInterval(() => this.step(), this.scanTimeMs);
    }
    this.emit();
  }

  stop(): void {
    this.running = false;
    if (this.handle !== null) {
      clearInterval(this.handle);
      this.handle = null;
    }
    this.emit();
  }

  toggle(): void {
    if (this.running) this.stop();
    else this.start();
  }

  setScanTime(ms: number): void {
    this.scanTimeMs = Math.max(1, Math.min(1000, ms));
    if (this.running) {
      this.stop();
      this.start();
    }
  }

  /** Execute a single scan. */
  step(dt = this.scanTimeMs): void {
    for (const program of this.project.programs) {
      const main = program.routines.find((r) => r.id === program.mainRoutineId) ?? program.routines[0];
      if (main) this.executeRoutine(main, program);
    }

    const api = {
      read: (ref: string | undefined) => {
        if (!ref) return 0;
        const v = this.db.readScalar(ref);
        if (typeof v === 'number') return v;
        if (typeof v === 'boolean') return v ? 1 : 0;
        return 0;
      },
      readBool: (ref: string | undefined) => {
        if (!ref) return false;
        return this.db.readScalar(ref) === true;
      },
      write: (ref: string | undefined, value: number | boolean) => {
        if (ref) this.db.writeScalar(ref, value);
      },
      dt,
    };

    for (const comp of this.project.process) {
      const s = this.processStates.get(comp.id);
      if (!s) continue;
      tickProcess(comp.type, comp.props, comp.bindings, s, api);
    }

    this.scanCount += 1;
    this.hooks.afterScan?.(this);
    this.emit();
  }

  private executeRoutine(routine: Routine, program: Program): void {
    let ctx: RunContext = {
      db: this.db,
      programId: program.id,
      dt: this.scanTimeMs,
      scan: this.scanCount,
      state: this.instrState,
      callRoutine: (name) => this.callRoutine(name, program),
    };
    ctx = { ...ctx };

    if (routine.type === 'st') {
      const compiled = this.compileSt(routine);
      if (compiled) executeSt(ctx, compiled);
      return;
    }

    for (const rung of routine.rungs) {
      let power = evalSeries(ctx, rung.condition);
      if (rung.outputs.some((o) => o.op.toUpperCase() === 'AFI')) power = false;
      for (const out of rung.outputs) executeOutput(ctx, out, power);
    }
  }

  private callRoutine(name: string, program: Program): void {
    if (this.callDepth > 16) return;
    const routine =
      program.routines.find((r) => r.name.toUpperCase() === name.toUpperCase()) ??
      this.project.programs
        .flatMap((p) => p.routines)
        .find((r) => r.name.toUpperCase() === name.toUpperCase());
    if (!routine) return;
    this.callDepth += 1;
    try {
      this.executeRoutine(routine, program);
    } finally {
      this.callDepth -= 1;
    }
  }

  private compileSt(routine: Routine): StProgram | null {
    const cached = this.stCache.get(routine.id);
    if (cached) return cached;
    const { program, diagnostics } = parseSt(routine.stSource);
    this.stErrors.set(
      routine.id,
      diagnostics.filter((d) => d.severity === 'error').map((d) => `Line ${d.line}: ${d.message}`),
    );
    this.stCache.set(routine.id, program);
    return program;
  }

  getStErrors(routineId: string): string[] {
    return this.stErrors.get(routineId) ?? [];
  }

  /** Build a run context, optionally with fresh edge-detection state (for analysis). */
  makeRunContext(programId = '', freshState = false): RunContext {
    return {
      db: this.db,
      programId,
      dt: this.scanTimeMs,
      scan: this.scanCount,
      state: freshState ? new Map() : this.instrState,
    };
  }

  /** Compile diagnostics without running. */
  validateSt(routineId: string, source: string): string[] {
    const { diagnostics } = parseSt(source);
    const errors = diagnostics.filter((d) => d.severity === 'error').map((d) => `Line ${d.line}: ${d.message}`);
    this.stErrors.set(routineId, errors);
    return errors;
  }
}
