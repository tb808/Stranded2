export interface FixedStepCallbacks {
  fixedUpdate(dtSeconds: number): void;
  frameUpdate(alpha: number, elapsedSeconds: number): void;
}

export class FixedStepLoop {
  private readonly stepSeconds: number;
  private readonly callbacks: FixedStepCallbacks;
  private accumulator = 0;
  private lastTimeMs = 0;
  private running = false;

  public constructor(callbacks: FixedStepCallbacks, updatesPerSecond = 60) {
    this.callbacks = callbacks;
    this.stepSeconds = 1 / updatesPerSecond;
  }

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTimeMs = performance.now();
    requestAnimationFrame(this.tick);
  }

  public stop(): void {
    this.running = false;
  }

  private readonly tick = (timeMs: number): void => {
    if (!this.running) return;
    const elapsedSeconds = Math.min(0.25, Math.max(0, (timeMs - this.lastTimeMs) / 1_000));
    this.lastTimeMs = timeMs;
    this.accumulator += elapsedSeconds;

    let catchupSteps = 0;
    while (this.accumulator >= this.stepSeconds && catchupSteps < 5) {
      this.callbacks.fixedUpdate(this.stepSeconds);
      this.accumulator -= this.stepSeconds;
      catchupSteps += 1;
    }
    if (catchupSteps === 5) this.accumulator = 0;

    this.callbacks.frameUpdate(this.accumulator / this.stepSeconds, elapsedSeconds);
    requestAnimationFrame(this.tick);
  };
}
