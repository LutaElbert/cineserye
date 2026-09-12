import { readFileSync } from 'node:fs';
import os from 'node:os';

const clip = (value, limit = 400) => String(value ?? '').slice(0, limit);
const readCounter = (path) => { try { return readFileSync(path, 'utf8').trim(); } catch { return null; } };
export default class DiagnosticReporter {
  ids = new WeakMap();
  nextId = 0;
  outstanding = new Map();
  id(step) { if (!this.ids.has(step)) this.ids.set(step, ++this.nextId); return this.ids.get(step); }
  emit(kind, value) { console.log(`CI_DIAG ${JSON.stringify({ kind, wall: Date.now(), ...value })}`); }
  resources() {
    this.emit('resources', { cpuCount: os.cpus().length, load: os.loadavg(), freeMemory: os.freemem(), totalMemory: os.totalmem(),
      cpuStat: readCounter('/sys/fs/cgroup/cpu.stat'), cpuMax: readCounter('/sys/fs/cgroup/cpu.max'),
      memoryCurrent: readCounter('/sys/fs/cgroup/memory.current'), memoryMax: readCounter('/sys/fs/cgroup/memory.max'),
      memoryEvents: readCounter('/sys/fs/cgroup/memory.events'), cpuPressure: readCounter('/proc/pressure/cpu'),
      memoryPressure: readCounter('/proc/pressure/memory') });
  }
  identity(test, result) { return { testId: test.id, title: test.title, project: test.parent.project().name, worker: result.workerIndex, retry: result.retry }; }
  onBegin(config, suite) {
    this.emit('begin', { tests: suite.allTests().length, workers: config.workers, node: process.version, platform: process.platform, arch: process.arch });
    this.resources(); this.timer = setInterval(() => this.resources(), 10_000); this.timer.unref();
  }
  onTestBegin(test, result) {
    this.outstanding.set(test.id, new Set());
    this.emit('test-begin', { ...this.identity(test, result), startedAt: result.startTime, reportedTimeoutMs: test.timeout });
  }
  onStepBegin(test, result, step) {
    const id = this.id(step); this.outstanding.get(test.id)?.add(id);
    this.emit('step-begin', { ...this.identity(test, result), id, parent: step.parent ? this.id(step.parent) : null,
      title: clip(step.title, 180), category: step.category, location: step.location,
      elapsedTestMs: Date.now() - result.startTime.getTime(), reportedTimeoutMs: test.timeout });
  }
  onStepEnd(test, result, step) {
    const id = this.id(step); this.outstanding.get(test.id)?.delete(id);
    this.emit('step-end', { ...this.identity(test, result), id, duration: step.duration,
      error: step.error ? clip(step.error.message) : null });
  }
  onTestEnd(test, result) {
    this.emit('test-end', { ...this.identity(test, result), status: result.status, expectedStatus: test.expectedStatus,
      duration: result.duration, errors: result.errors.map(error => clip(error.message)), outstanding: [...this.outstanding.get(test.id) ?? []] });
  }
  onError(error) { this.emit('error', { message: clip(error.message) }); }
  onEnd(result) { clearInterval(this.timer); this.resources(); this.emit('end', { status: result.status, duration: result.duration }); }
}
