import { Pause, Play, Download, Camera } from "lucide-react";
/**
 * WaveformPanel.tsx — Real-time waveform display with Canvas animation.
 * Includes SENSOR ON/OFF badge, 5s/10s resolution toggles,
 * a Freeze/Resume button, Noise Intensity slider, and Signal Filter slider.
 */
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useWaveformData } from "../../hooks/useWaveformData";
import { useStore } from "../../store/useStore";
import type { WaveformResolution } from "../../types";

type WaveformType = "ppg" | "ecg";

interface WaveformPanelProps {
  type: WaveformType;
  resolution: WaveformResolution;
  onResolutionChange: (r: WaveformResolution) => void;
}

function SensorBadge({
  isConnected,
  quality,
  type,
}: { isConnected: boolean; quality?: "GOOD" | "MODERATE" | "POOR" | "OFFLINE"; type: WaveformType }) {
  
  let bg = "rgba(148,163,184,0.10)";
  let dot = "#94a3b8";
  let label = "OFFLINE";
  
  if (isConnected && quality) {
    label = quality;
    if (quality === "GOOD") {
      bg = "rgba(34,197,94,0.10)";
      dot = "#22c55e";
    } else if (quality === "MODERATE") {
      bg = "rgba(234,179,8,0.10)";
      dot = "#eab308";
    } else if (quality === "POOR") {
      bg = "rgba(239,68,68,0.10)";
      dot = "#ef4444";
    }
  }

  return (
    <span
      data-ocid={`${type}-sensor-badge`}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs"
      style={{
        background: bg,
        border: "1px solid transparent",
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: dot }}
      />
      <span style={{ color: "#e2e8f0", fontWeight: 500, fontSize: "0.65rem" }}>
        {label}
      </span>
    </span>
  );
}

function formatTimestamp(): string {
  const now = new Date();
  return now.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Thin slider row — 2px track, small rounded thumb, labeled */
function SliderRow({
  label,
  value,
  onChange,
  accentColor,
  ocid,
  onDecrement,
  onIncrement,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  accentColor: string;
  ocid: string;
  onDecrement?: () => void;
  onIncrement?: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="shrink-0 w-9 uppercase tracking-wide"
        style={{ color: "#64748b", fontSize: "0.6rem" }}
      >
        {label}
      </span>
      {onDecrement && (
        <button
          type="button"
          onClick={onDecrement}
          data-ocid={`${ocid}-decrement`}
          className="h-5 w-5 rounded flex items-center justify-center text-xs shrink-0 transition-colors bg-white/10 hover:bg-white/20"
          style={{ color: accentColor }}
          aria-label={`Decrease ${label}`}
        >
          ◀
        </button>
      )}
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        data-ocid={ocid}
        className="flex-1 appearance-none cursor-pointer rounded-full"
        style={{
          height: "2px",
          accentColor,
          background: `linear-gradient(to right, ${accentColor} ${value * 100}%, #1e2a3a ${value * 100}%)`,
        }}
      />
      {onIncrement && (
        <button
          type="button"
          onClick={onIncrement}
          data-ocid={`${ocid}-increment`}
          className="h-5 w-5 rounded flex items-center justify-center text-xs shrink-0 transition-colors bg-white/10 hover:bg-white/20"
          style={{ color: accentColor }}
          aria-label={`Increase ${label}`}
        >
          ▶
        </button>
      )}
      <span
        className="font-mono w-8 text-right shrink-0"
        style={{ color: "#94a3b8", fontSize: "0.65rem" }}
      >
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}

export function WaveformPanel({
  type,
  onResolutionChange,
}: WaveformPanelProps) {
  const { vitals, scanActive, sensorStatus, waveformResolution, setWaveformResolution } = useStore();
  const label = type === "ppg" ? "PPG WAVEFORM" : "ECG WAVEFORM";
  const accent = type === "ppg" ? "#00d4ff" : "#00e676";
  const resolution = waveformResolution; // Use global state

  const isConnected =
    type === "ppg"
      ? sensorStatus.ppg === "CONNECTED"
      : sensorStatus.ecg === "CONNECTED";
      
  const quality = type === "ppg" ? sensorStatus.ppgQuality : sensorStatus.ecgQuality;
  const confidence = type === "ppg" ? sensorStatus.ppgConfidence : sensorStatus.ecgConfidence;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // ── Freeze state ────────────────────────────────────────────────────────────
  const [frozen, setFrozen] = useState(false);

  // ── Noise intensity (0 = clean, 1 = max noise). Default 0.3 ────────────────
  const [noiseIntensity, setNoiseIntensity] = useState(0.3);

  // ── Filter strength (0 = no filter, 1 = maximum smoothing). Default 0.3 ───
  const [filterStrength, setFilterStrength] = useState(0.3);

  // Sync to backend
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  useEffect(() => {
    socketRef.current = io("http://127.0.0.1:5005", { 
        transports: ["websocket"],
        reconnectionDelayMax: 5000 
    });
    return () => { socketRef.current?.disconnect(); };
  }, []);

  useEffect(() => {
    socketRef.current?.emit("set_filter_level", { level: filterStrength * 100 });
  }, [filterStrength]);

  useWaveformData({
    type,
    canvasRef,
    heartRate: vitals.heartRate,
    amplitude: type === "ppg" ? vitals.perfusionIndex / 5 : 0.8,
    enabled: scanActive,
    isSensorConnected: isConnected,
    frozen,
    noiseIntensity,
    filterStrength,
  });

  // Live timestamp
  const timestampRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const id = setInterval(() => {
      if (timestampRef.current) {
        timestampRef.current.textContent = formatTimestamp();
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Signal param rows
  const signalFeatures = useStore((s) => s.signalFeatures);
  const params =
    type === "ppg"
      ? [
          { label: "PULSE AMP", value: signalFeatures.pulseAmplitude.toFixed(2), unit: "V" },
          { label: "RISE TIME", value: signalFeatures.riseTime, unit: "ms" },
          { label: "DICROTIC NOTCH", value: signalFeatures.dicroticNotch, unit: "" },
          { label: "SKEWNESS", value: signalFeatures.skewness, unit: "" },
          { label: "PERFUSION IDX", value: signalFeatures.perfusion.toFixed(1), unit: "%" },
        ]
      : [
          { label: "HEART RATE", value: signalFeatures.heartRate, unit: "BPM" },
          { label: "RR INTERVAL", value: signalFeatures.rrInterval, unit: "ms" },
          { label: "QRS DURATION", value: signalFeatures.qrsDuration, unit: "ms" },
          { label: "ST SEGMENT", value: signalFeatures.stSegment > 0 ? `+${signalFeatures.stSegment.toFixed(2)}` : signalFeatures.stSegment.toFixed(2), unit: "mV" },
          { label: "HRV INDEX", value: signalFeatures.hrvIndex, unit: "ms" },
        ];

  return (
    <div
      className="rounded-lg border overflow-hidden shrink-0"
      style={{ background: "#0d1120", borderColor: "#1e2a3a" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ borderColor: "#1e2a3a" }}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-bold tracking-widest uppercase"
            style={{ color: "#e2e8f0" }}
          >
            {label}
          </span>
          {scanActive && (
            <span className="text-xs font-medium" style={{ color: accent }}>
              (Live)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-mono"
            style={{ color: "#cbd5e1" }}
            ref={timestampRef}
          >
            {formatTimestamp()}
          </span>

          {/* Sensor ON/OFF badge */}
          <SensorBadge isConnected={isConnected} quality={quality} type={type} />

          {/* Freeze / Resume button */}
          <button
            type="button"
            onClick={() => setFrozen((f) => !f)}
            title={frozen ? "Resume waveform" : "Freeze waveform"}
            data-ocid={`waveform-freeze-${type}`}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors"
            style={
              frozen
                ? {
                    background: `${accent}22`,
                    color: accent,
                    border: `1px solid ${accent}55`,
                  }
                : {
                    background: "#1e2a3a",
                    color: "#94a3b8",
                    border: "1px solid #2a3a4a",
                  }
            }
          >
            {frozen ? (
              <>
                <Play size={10} />
                <span>Resume</span>
              </>
            ) : (
              <>
                <Pause size={10} />
                <span>Freeze</span>
              </>
            )}
          </button>

          {/* Resolution toggles */}
          <div className="flex gap-1">
            {(["5s", "10s", "30s"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setWaveformResolution(r)}
                className="px-2 py-0.5 rounded text-xs font-medium transition-smooth"
                style={
                  resolution === r
                    ? {
                        background: `${accent}22`,
                        color: accent,
                        border: `1px solid ${accent}44`,
                      }
                    : {
                        background: "#1e2a3a",
                        color: "#cbd5e1",
                        border: "1px solid #2a3a4a",
                      }
                }
                data-ocid={`waveform-res-${r}-${type}`}
              >
                {r}
              </button>
            ))}
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-1 border-l pl-2 ml-1" style={{ borderColor: "#1e2a3a" }}>
            <button
              type="button"
              title="Capture Screenshot"
              onClick={() => {
                 if (canvasRef.current) {
                     const link = document.createElement("a");
                     link.download = `vascuscan_${type}_${new Date().getTime()}.png`;
                     link.href = canvasRef.current.toDataURL("image/png");
                     link.click();
                 }
              }}
              className="p-1 rounded text-xs font-medium transition-colors hover:bg-white/10"
              style={{ color: "#94a3b8" }}
            >
              <Camera size={12} />
            </button>
            <button
              type="button"
              title="Export CSV Data"
              onClick={() => {
                 // Simple mock CSV export, a real implementation would pull from buffer
                 const link = document.createElement("a");
                 link.download = `vascuscan_${type}_${new Date().getTime()}.csv`;
                 link.href = "data:text/csv;charset=utf-8,time,value\n0,0\n";
                 link.click();
              }}
              className="p-1 rounded text-xs font-medium transition-colors hover:bg-white/10"
              style={{ color: "#94a3b8" }}
            >
              <Download size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Canvas + Frozen overlay */}
      <div style={{ height: 120, position: "relative" }}>
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "100%", display: "block" }}
          data-ocid={`waveform-canvas-${type}`}
        />
        {frozen && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ background: "rgba(0,0,0,0.18)" }}
          >
            <span
              className="px-2 py-0.5 rounded text-xs font-bold tracking-widest uppercase"
              style={{
                background: `${accent}20`,
                color: accent,
                border: `1px solid ${accent}55`,
                letterSpacing: "0.15em",
              }}
            >
              ❄ FROZEN
            </span>
          </div>
        )}
      </div>
      
      {/* Confidence Bar */}
      <div className="w-full h-1 bg-gray-900 overflow-hidden" title={`Signal Confidence: ${confidence?.toFixed(0) ?? 0}%`}>
        <div 
           className="h-full transition-all duration-500 ease-out" 
           style={{ 
               width: `${confidence ?? 0}%`, 
               background: quality === "GOOD" ? "#22c55e" : quality === "MODERATE" ? "#eab308" : quality === "POOR" ? "#ef4444" : "#475569" 
           }} 
        />
      </div>

      {/* Noise + Filter Sliders */}
      <div
        className="flex flex-col gap-1.5 px-3 py-2 border-t"
        style={{ borderColor: "#1e2a3a", background: "#0a0e1a" }}
      >
        <SliderRow
          label="Noise"
          value={noiseIntensity}
          onChange={setNoiseIntensity}
          accentColor={accent}
          ocid={`noise-slider-${type}`}
          onDecrement={() =>
            setNoiseIntensity((v) =>
              Math.max(0, Number.parseFloat((v - 0.01).toFixed(2))),
            )
          }
          onIncrement={() =>
            setNoiseIntensity((v) =>
              Math.min(1, Number.parseFloat((v + 0.01).toFixed(2))),
            )
          }
        />
        <SliderRow
          label="Filter"
          value={filterStrength}
          onChange={setFilterStrength}
          accentColor={accent}
          ocid={`filter-slider-${type}`}
          onDecrement={() =>
            setFilterStrength((v) =>
              Math.max(0, Number.parseFloat((v - 0.01).toFixed(2))),
            )
          }
          onIncrement={() =>
            setFilterStrength((v) =>
              Math.min(1, Number.parseFloat((v + 0.01).toFixed(2))),
            )
          }
        />
      </div>

      {/* Signal params */}
      <div
        className="grid grid-cols-5 border-t"
        style={{ borderColor: "#1e2a3a" }}
      >
        {params.map((p, i) => (
          <div
            key={p.label}
            className="flex flex-col items-center py-2 text-center"
            style={{ borderRight: i < 4 ? "1px solid #1e2a3a" : "none" }}
          >
            <span className="text-xs" style={{ color: "#94a3b8" }}>
              {p.label}
            </span>
            <span
              className="text-sm font-bold font-mono mt-0.5"
              style={{ color: type === "ppg" ? "#00d4ff" : "#00e676" }}
            >
              {p.value}
            </span>
            <span className="text-xs" style={{ color: "#64748b" }}>
              {p.unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
