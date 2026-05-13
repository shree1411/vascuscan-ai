// ─── Canvas render ────────────────────────────────────────────────────────────

export interface WaveformSample {
  t: number;
  y: number;
}

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
  ctx.shadowBlur = 4;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.0;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();

  // Curvey interpolation: loop through points and use midpoints as curve anchors
  for (let i = 0; i < n - 1; i++) {
    const x = (i / (n - 1)) * width;
    const norm = (samples[i].y + SIGNAL_MAX) / (2 * SIGNAL_MAX);
    const cy = baselineY - norm * signalH;

    const nextX = ((i + 1) / (n - 1)) * width;
    const nextNorm = (samples[i + 1].y + SIGNAL_MAX) / (2 * SIGNAL_MAX);
    const nextCy = baselineY - nextNorm * signalH;

    const midX = (x + nextX) / 2;
    const midY = (cy + nextCy) / 2;

    if (i === 0) {
      ctx.moveTo(x, cy);
    } else {
      // Curve from previous midpoint THROUGH current point TO the next midpoint
      ctx.quadraticCurveTo(x, cy, midX, midY);
    }
  }

  // Draw the very last segment to reach the edge
  const lastIdx = n - 1;
  const lx = width;
  const lnorm = (samples[lastIdx].y + SIGNAL_MAX) / (2 * SIGNAL_MAX);
  const lcy = baselineY - lnorm * signalH;
  ctx.lineTo(lx, lcy);

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
