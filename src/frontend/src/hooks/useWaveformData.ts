import { useCallback, useEffect, useRef } from "react";
import { useStore } from "../store/useStore";
import { type WaveformSample, drawSignal } from "../utils/waveformGenerator";

const SAMPLE_RATE = 100; // Hz

interface UseWaveformOptions {
  type: "ppg" | "ecg";
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  heartRate?: number;
  /** @deprecated kept for API compatibility */
  amplitude?: number;
  /** @deprecated kept for API compatibility — waveform always animates now */
  enabled?: boolean;
  /** When true, adds live-sensor noise variation to distinguish real from synthetic */
  isSensorConnected?: boolean;
  /** 0 = clean signal, 1.0 = maximum noise. Default 0.3 */
  noiseIntensity?: number;
  /**
   * 0 = no filter (raw signal), 1 = maximum smoothing / flat signal.
   * Applies a low-pass moving-average pass to each new sample.
   * At filterStrength >= 0.99, signal is forced perfectly flat (baseline).
   * Default 0.3
   */
  filterStrength?: number;
  /** When true, animation loop is paused and canvas is frozen */
  frozen?: boolean;
}

export function useWaveformData({
  type,
  canvasRef,
  heartRate = 78,
  isSensorConnected = false,
  noiseIntensity = 0.3,
  filterStrength = 0.3,
  frozen = false,
}: UseWaveformOptions) {
  const waveformResolution = useStore((s) => s.waveformResolution);

  const bufferRef = useRef<WaveformSample[]>([]);
  const writeHeadRef = useRef(0);
  const animRef = useRef<number | null>(null);
  const tRef = useRef(0);
  // smooth noise walk for live mode
  const noiseRef = useRef(0);
  // keep latest frozen flag accessible inside rAF without re-creating callback
  const frozenRef = useRef(frozen);
  frozenRef.current = frozen;

  // Keep latest noiseIntensity and filterStrength accessible without recreating callback
  const noiseIntensityRef = useRef(noiseIntensity);
  noiseIntensityRef.current = Math.max(0, noiseIntensity);

  const filterStrengthRef = useRef(filterStrength);
  filterStrengthRef.current = Math.max(0, Math.min(1, filterStrength));

  // Running smoothed value for the low-pass filter (persists across frames)
  const smoothedYRef = useRef(0);

  // Pre-fill buffer when resolution changes so there's no blank canvas flash
  useEffect(() => {
    const windowSec = waveformResolution === "5s" ? 5 : 10;
    const bufSize = SAMPLE_RATE * windowSec;
    const freq = heartRate / 60;
    // Fill with static fake signal
    bufferRef.current = Array.from({ length: bufSize }, (_, i) => {
      const t = i / SAMPLE_RATE;
      const y = sampleSignal(type, t, freq, false, 0);
      return { t, y };
    });
    writeHeadRef.current = 0;
    // Sync time reference to end of pre-filled buffer
    tRef.current = bufSize / SAMPLE_RATE;
    // Reset smoothed value to midpoint on resolution change
    smoothedYRef.current = 0;
  }, [type, heartRate, waveformResolution]);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // If frozen, do not update canvas — but still schedule next frame so we
    // can unfreeze responsively without a manual restart.
    if (!frozenRef.current) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const { width, height } = canvas;
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = "#060d18";
        ctx.fillRect(0, 0, width, height);

        const windowSec = waveformResolution === "5s" ? 5 : 10;
        const bufSize = SAMPLE_RATE * windowSec;
        const freq = heartRate / 60;
        const ni = noiseIntensityRef.current;
        const fs = filterStrengthRef.current;

        // Advance time by one sample
        tRef.current += 1 / SAMPLE_RATE;

        // Smooth noise walk — strictly gated to 0 when ni === 0
        if (isSensorConnected) {
          if (ni === 0) {
            noiseRef.current = 0;
          } else {
            noiseRef.current += (Math.random() - 0.5) * 0.04 * ni;
            const cap = 0.12 * ni;
            noiseRef.current = Math.max(-cap, Math.min(cap, noiseRef.current));
          }
        } else {
          noiseRef.current = 0;
        }

        // Per-sample jitter — strictly gated to 0 when ni === 0
        const jitter =
          isSensorConnected && ni > 0 ? (Math.random() - 0.5) * 0.015 * ni : 0;
        const noise = noiseRef.current + jitter;

        // Raw sample
        const rawY = sampleSignal(
          type,
          tRef.current,
          freq,
          isSensorConnected,
          noise,
        );

        // ── Apply low-pass preprocessing filter ───────────────────────────────
        // alpha = filterStrength * 0.95 (so at fs=1.0, alpha=0.95 = very smooth)
        // At fs=0, alpha=0 → pass-through.
        // At fs>=0.99, force perfectly flat baseline.
        let filteredY: number;
        if (fs >= 0.99) {
          // Maximum filter = perfectly flat baseline
          filteredY = 0;
          smoothedYRef.current = 0;
        } else if (fs === 0) {
          filteredY = rawY;
          smoothedYRef.current = rawY;
        } else {
          const alpha = fs * 0.95;
          smoothedYRef.current =
            smoothedYRef.current * alpha + rawY * (1 - alpha);
          filteredY = smoothedYRef.current;
        }

        const sample: WaveformSample = { t: tRef.current, y: filteredY };

        // Write into ring buffer
        if (bufferRef.current.length === bufSize) {
          bufferRef.current[writeHeadRef.current] = sample;
          writeHeadRef.current = (writeHeadRef.current + 1) % bufSize;
        }

        // Reorder ring buffer to chronological order for rendering
        const head = writeHeadRef.current;
        const ordered: WaveformSample[] = [
          ...bufferRef.current.slice(head),
          ...bufferRef.current.slice(0, head),
        ];

        drawSignal({
          ctx,
          samples: ordered,
          width,
          height,
          color: type === "ppg" ? "#00d4ff" : "#22c55e",
          glowColor:
            type === "ppg" ? "rgba(0,212,255,0.45)" : "rgba(34,197,94,0.45)",
          lineWidth: 1.5,
          windowSec,
        });
      }
    }

    animRef.current = requestAnimationFrame(animate);
  }, [type, heartRate, waveformResolution, isSensorConnected, canvasRef]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [animate]);
}

// ─── Inline signal sampler ────────────────────────────────────────────────────

function sampleSignal(
  type: "ppg" | "ecg",
  t: number,
  freq: number,
  _isLive: boolean,
  noise: number,
): number {
  const phase = (t * freq) % 1.0;

  if (type === "ecg") {
    // ── High-Fidelity ECG (Analytical QRS Model) ──────────────────────────
    // P wave
    const p = 0.15 * Math.exp(-Math.pow((phase - 0.1) / 0.02, 2));
    // QRS complex
    const q = -0.1 * Math.exp(-Math.pow((phase - 0.14) / 0.005, 2));
    const r = 1.0 * Math.exp(-Math.pow((phase - 0.16) / 0.008, 2));
    const s = -0.2 * Math.exp(-Math.pow((phase - 0.18) / 0.006, 2));
    // T wave
    const t_wave = 0.35 * Math.exp(-Math.pow((phase - 0.45) / 0.06, 2));
    
    return p + q + r + s + t_wave + noise;
  } else {
    // ── High-Fidelity PPG (Dual-Gaussian/Tanh Pulse) ─────────────────────
    // Primary systolic peak
    const systolic = 0.85 * Math.exp(-Math.pow((phase - 0.2) / 0.08, 2));
    // Dicrotic notch + secondary peak (diastolic)
    const diastolic = 0.25 * Math.exp(-Math.pow((phase - 0.45) / 0.12, 2));
    
    // Smooth pulsatile baseline
    const baseline = 0.05 * Math.sin(2 * Math.PI * 0.15 * t);
    
    return systolic + diastolic + baseline + noise;
  }
}
