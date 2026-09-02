import type { AssetService } from "../assets/AssetService";

export type AudioBus = "ambience" | "sfx" | "ui";

export class AudioService {
  private context: AudioContext | null = null;
  private readonly gains = new Map<AudioBus, GainNode>();
  private readonly busVolumes = new Map<AudioBus, number>([["ambience", 1], ["sfx", 1], ["ui", 1]]);
  private readonly bufferCache = new Map<string, Promise<AudioBuffer | null>>();
  private master: GainNode | null = null;
  private masterVolume = 1;
  private oceanOscillator: OscillatorNode | null = null;
  private oceanGain: GainNode | null = null;
  private oceanFilter: BiquadFilterNode | null = null;
  private oceanIntensity = 0.3;
  private unlocked = false;

  public constructor(private readonly assets: AssetService) {}

  public async unlock(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.masterVolume;
      this.master.connect(this.context.destination);
      for (const bus of ["ambience", "sfx", "ui"] as const) {
        const gain = this.context.createGain();
        gain.gain.value = this.busVolumes.get(bus) ?? 1;
        gain.connect(this.master);
        this.gains.set(bus, gain);
      }
    }
    if (this.context.state !== "running") await this.context.resume();
    this.unlocked = true;
  }

  public setMasterVolume(value: number): void {
    this.masterVolume = Math.max(0, Math.min(1, value));
    if (this.master) this.master.gain.value = this.masterVolume;
  }

  public setBusVolume(bus: AudioBus, value: number): void {
    const normalized = Math.max(0, Math.min(1, value));
    this.busVolumes.set(bus, normalized);
    const gain = this.gains.get(bus);
    if (gain) gain.gain.value = normalized;
  }

  public async play(id: string, bus: AudioBus = "sfx", volume = 1): Promise<void> {
    if (!this.unlocked || !this.context) return;
    const url = this.assets.getUrl(id);
    const gain = this.gains.get(bus);
    if (!url || !gain) return;
    try {
      let pendingBuffer = this.bufferCache.get(id);
      if (!pendingBuffer) {
        pendingBuffer = fetch(url)
          .then(async (response) => response.ok ? this.context?.decodeAudioData(await response.arrayBuffer()) ?? null : null)
          .catch(() => null);
        this.bufferCache.set(id, pendingBuffer);
      }
      const buffer = await pendingBuffer;
      if (!buffer) return;
      const source = this.context.createBufferSource();
      const localGain = this.context.createGain();
      localGain.gain.value = volume;
      source.buffer = buffer;
      source.connect(localGain);
      localGain.connect(gain);
      source.start();
    } catch (error) {
      console.warn(`Audio ${id} konnte nicht abgespielt werden.`, error);
    }
  }

  public startOceanAmbience(): void {
    if (!this.context || !this.unlocked || this.oceanOscillator) return;
    const oscillator = this.context.createOscillator();
    const noiseGain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    oscillator.type = "sine";
    oscillator.frequency.value = 72;
    filter.type = "lowpass";
    filter.frequency.value = 150 + this.oceanIntensity * 90;
    noiseGain.gain.value = 0.006 + this.oceanIntensity * 0.015;
    oscillator.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.gains.get("ambience") ?? this.context.destination);
    oscillator.start();
    this.oceanOscillator = oscillator;
    this.oceanGain = noiseGain;
    this.oceanFilter = filter;
  }

  public setOceanIntensity(value: number): void {
    const intensity = Math.max(0, Math.min(1, value));
    if (Math.abs(intensity - this.oceanIntensity) < 0.001) return;
    this.oceanIntensity = intensity;
    if (!this.context) return;
    const now = this.context.currentTime;
    this.oceanGain?.gain.setTargetAtTime(0.006 + intensity * 0.015, now, 1.2);
    this.oceanFilter?.frequency.setTargetAtTime(150 + intensity * 90, now, 1.2);
  }

  public stopOceanAmbience(): void {
    if (!this.oceanOscillator) return;
    this.oceanOscillator.stop();
    this.oceanOscillator.disconnect();
    this.oceanFilter?.disconnect();
    this.oceanGain?.disconnect();
    this.oceanOscillator = null;
    this.oceanGain = null;
    this.oceanFilter = null;
  }

  public dispose(): void {
    this.stopOceanAmbience();
    this.bufferCache.clear();
    this.gains.clear();
    this.master = null;
    this.unlocked = false;
    if (this.context) void this.context.close();
    this.context = null;
  }
}
