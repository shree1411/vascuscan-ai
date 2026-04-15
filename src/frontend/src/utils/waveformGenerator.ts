// ─── Simple PPG signal: gentle sine-based wave, low amplitude ─────────────────
// Produces a smooth undulating wave — no spiky Gaussian morphology.
// Amplitude is expressed as a fraction of canvas height (0..1 scale).

function ppgSample(
  t: number,
  heartRate: number,
  isLive: boolean,
  noiseVal: number,
  noiseIntensity = 1,
): number {
  const freq = heartRate / 60; // beats per second
  // Primary sine wave
  const primary = Math.sin(2 * Math.PI * freq * t);
  // Subtle second harmonic for slight asymmetry (dicrotic shoulder feel)
  const harmonic = 0.18 * Math.sin(4 * Math.PI * freq * t - 0.4);
  const base = primary + harmonic;
  // Live noise variation — STRICTLY gated to 0 when noiseIntensity===0
  const ni = Math.max(0, noiseIntensity);
  const noise =
    isLive && ni > 0 ? noiseVal + (Math.random() - 0.5) * 0.015 * ni : 0;
  return base + noise;
}

// ─── Simple ECG signal: sine-based gentle wave ────────────────────────────────
// Simulates the rhythmic up-down of a simple ECG baseline. Clean, not jagged.

function ecgSample(
  t: number,
  heartRate: number,
  isLive: boolean,
  noiseVal: number,
  noiseIntensity = 1,
): number {
  const freq = heartRate / 60;
  // Sharper primary sine to give a slight QRS feel without Gaussian spikes
  const primary = Math.sin(2 * Math.PI * freq * t);
  // Add very small third harmonic for subtle waveform texture
  const harmonic = 0.08 * Math.sin(6 * Math.PI * freq * t);
  const base = primary + harmonic;
  // Live noise variation — STRICTLY gated to 0 when noiseIntensity===0
  const ni = Math.max(0, noiseIntensity);
  const noise =
    isLive && ni > 0 ? noiseVal + (Math.random() - 0.5) * 0.012 * ni : 0;
  return base + noise;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface GeneratorOptions {
  heartRate: number;
  sampleRate: number; // Hz
  windowSec: number;
  amplitude?: number;
  isLive?: boolean;
  /** 0 = no noise, 1 = full noise. Default 1 */
  noiseIntensity?: number;
}

export interface WaveformSample {
  t: number;
  y: number;
}

export function buildPPGBuffer(opts: GeneratorOptions): WaveformSample[] {
  const { heartRate, sampleRate, windowSec, isLive = false } = opts;
  const ni = Math.max(0, opts.noiseIntensity ?? 1);
  const n = Math.round(sampleRate * windowSec);
  let noise = 0;
  return Array.from({ length: n }, (_, i) => {
    const t = i / sampleRate;
    // Smooth noise walk for live mode — STRICTLY gated when ni===0
    if (isLive) {
      if (ni === 0) {
        noise = 0;
      } else {
        noise += (Math.random() - 0.5) * 0.04 * ni;
        const cap = 0.12 * ni;
        noise = Math.max(-cap, Math.min(cap, noise));
      }
    }
    return { t, y: ppgSample(t, heartRate, isLive, noise, ni) };
  });
}

export function buildECGBuffer(opts: GeneratorOptions): WaveformSample[] {
  const { heartRate, sampleRate, windowSec, isLive = false } = opts;
  const ni = Math.max(0, opts.noiseIntensity ?? 1);
  const n = Math.round(sampleRate * windowSec);
  let noise = 0;
  return Array.from({ length: n }, (_, i) => {
    const t = i / sampleRate;
    if (isLive) {
      if (ni === 0) {
        noise = 0;
      } else {
        noise += (Math.random() - 0.5) * 0.03 * ni;
        const cap = 0.1 * ni;
        noise = Math.max(-cap, Math.min(cap, noise));
      }
    }
    return { t, y: ecgSample(t, heartRate, isLive, noise, ni) };
  });
}

// ─── Canvas render ────────────────────────────────────────────────────────────

export interface DrawOpts {
  ctx: CanvasRenderingContext2D;
  samples: WaveformSample[];
  width: number;
  height: number;
  color: string;
  glowColor: string;
  lineWidth?: number;
  writeHead?: number;
  /** Number of seconds visible in this window — controls grid layout */
  windowSec?: number;
}

export function drawSignal(opts: DrawOpts): void {
  const {
    ctx,
    samples,
    width,
    height,
    color,
    glowColor,
    lineWidth = 1.5,
    windowSec,
  } = opts;
  if (samples.length < 2) return;

  // Window seconds determines grid layout
  const win = windowSec ?? Math.round(samples.length / 100);
  const is10s = win >= 10;

  // ── Grid ──────────────────────────────────────────────────────────────────
  // 5s  → 5 vertical divisions (1 line/second), 6 horizontal rows
  // 10s → 5 vertical divisions (1 line/2 seconds = wider), 4 horizontal rows
  //
  // Colors: light blue rgba(100,200,255,α)
  //   minor lines: α = 0.20
  //   major lines: α = 0.35

  ctx.save();
  ctx.lineWidth = 0.5;

  if (!is10s) {
    // ── 5s mode: 5 columns (1s each), 6 rows ──────────────────────────────
    const cols = 5;
    const rows = 6;

    // Vertical lines
    for (let col = 0; col <= cols; col++) {
      const x = (col / cols) * width;
      ctx.strokeStyle = "rgba(100,200,255,0.20)";
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Horizontal lines
    for (let row = 0; row <= rows; row++) {
      const y = (row / rows) * height;
      ctx.strokeStyle = "rgba(100,200,255,0.20)";
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  } else {
    // ── 10s mode: 5 columns (2s each = wider), 4 rows, major lines brighter ─
    const cols = 5;
    const rows = 4;

    // Vertical lines — all are major in 10s mode (wider divisions)
    for (let col = 0; col <= cols; col++) {
      const x = (col / cols) * width;
      ctx.strokeStyle = "rgba(100,200,255,0.35)";
      ctx.lineWidth = col % cols === 0 ? 0.5 : 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Horizontal lines
    for (let row = 0; row <= rows; row++) {
      const y = (row / rows) * height;
      ctx.strokeStyle = "rgba(100,200,255,0.35)";
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  ctx.restore();

  // ── Waveform ───────────────────────────────────────────────────────────────
  // Signal occupies bottom 25% of canvas height — stays near baseline.
  // y values from generators are in range [-1.18..1.18]. We map:
  //   +1.18 → waveTop  (signal peak)
  //   -1.18 → baseline (signal trough)
  // where baseline = 78% from top, waveTop = 55% from top → occupies ~23% height.

  const SIGNAL_MAX = 1.25; // slightly above sine peak to add headroom
  const baselineY = height * 0.78; // baseline position — bottom area
  const waveTopY = height * 0.52; // highest point of signal
  const signalH = baselineY - waveTopY; // pixel height for signal range

  const n = samples.length;

  ctx.save();
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 6;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();

  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * width;
    // Map y value → canvas Y: +SIGNAL_MAX → waveTopY, -SIGNAL_MAX → below baseline
    const normalised = (samples[i].y + SIGNAL_MAX) / (2 * SIGNAL_MAX); // 0..1, 1=top
    const cy = baselineY - normalised * signalH;
    if (i === 0) ctx.moveTo(x, cy);
    else ctx.lineTo(x, cy);
  }
  ctx.stroke();

  // Leading-edge cursor dot
  const dotIdx = n - 1;
  const dotX = width;
  const dotNorm = (samples[dotIdx].y + SIGNAL_MAX) / (2 * SIGNAL_MAX);
  const dotY = baselineY - dotNorm * signalH;
  ctx.shadowBlur = 14;
  ctx.shadowColor = color;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(dotX - 2, dotY, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
