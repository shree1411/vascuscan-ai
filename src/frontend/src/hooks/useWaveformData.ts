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
  const lastRemoteTime = useRef(0);
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
    const windowSec = waveformResolution === "5s" ? 5 : waveformResolution === "30s" ? 30 : 10;
    const bufSize = SAMPLE_RATE * windowSec;
    const freq = (heartRate || 75) / 60;
    // Fill with flatline
    bufferRef.current = Array.from({ length: bufSize }, (_, i) => {
      const t = i / SAMPLE_RATE;
      return { t, y: 0 };
    });
    writeHeadRef.current = 0;
    // Sync time reference to end of pre-filled buffer
    tRef.current = bufSize / SAMPLE_RATE;
    // Reset smoothed value to midpoint on resolution change
    smoothedYRef.current = 0;
  }, [type, waveformResolution]); // Removed heartRate to prevent resets during jitters

  useEffect(() => {
    const handleRemoteData = (e: any) => {
        if (frozenRef.current) return;
        const data = e.detail;
        const chunk = type === "ppg" ? data.ppg : data.ecg;
        if (!chunk || chunk.length === 0) return;

        const fs = filterStrengthRef.current;
        const windowSec = waveformResolution === "5s" ? 5 : waveformResolution === "30s" ? 30 : 10;
        const bufSize = SAMPLE_RATE * windowSec;

        chunk.forEach((val: number) => {
            // scale 0-1023 to ~ -1..1 range for drawSignal
            let scaledY = ((val - 512) / 256); 
            
            // Apply smoothing filter if needed
            if (fs >= 0.99) {
              scaledY = 0;
            } else {
              smoothedYRef.current = smoothedYRef.current * fs + scaledY * (1 - fs);
              scaledY = smoothedYRef.current;
            }

            const sample = { t: tRef.current, y: scaledY };
            tRef.current += 1 / SAMPLE_RATE;

            if (bufferRef.current.length === bufSize) {
                bufferRef.current[writeHeadRef.current] = sample;
                writeHeadRef.current = (writeHeadRef.current + 1) % bufSize;
            }
        });
        
        // Flag that we are receiving real data so the local generator stays quiet
        lastRemoteTime.current = Date.now();
    };

    window.addEventListener('sensor_waveform' as any, handleRemoteData);
    return () => window.removeEventListener('sensor_waveform' as any, handleRemoteData);
  }, [type, waveformResolution]);

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

        const windowSec = waveformResolution === "5s" ? 5 : waveformResolution === "30s" ? 30 : 10;
        const bufSize = SAMPLE_RATE * windowSec;
        const ni = noiseIntensityRef.current;
        const fs = filterStrengthRef.current;

        // If we haven't received remote data in the last 200ms, push baseline 0 to decay gracefully
        if (Date.now() - lastRemoteTime.current > 200) {
            tRef.current += 1 / SAMPLE_RATE;
            const rawY = 0; // Baseline flatline

            let filteredY: number;
            if (fs >= 0.99) {
                filteredY = 0;
            } else {
                smoothedYRef.current = smoothedYRef.current * fs + rawY * (1 - fs);
                filteredY = smoothedYRef.current;
            }

            const sample = { t: tRef.current, y: filteredY };
            if (bufferRef.current.length === bufSize) {
                bufferRef.current[writeHeadRef.current] = sample;
                writeHeadRef.current = (writeHeadRef.current + 1) % bufSize;
            }
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

