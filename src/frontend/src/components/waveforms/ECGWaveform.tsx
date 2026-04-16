import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useWaveformData } from "../../hooks/useWaveformData";
import { useStore } from "../../store/useStore";

const BASE_METRICS = [
  { label: "QRS DURATION", value: "92 ms" },
  { label: "RR INTERVAL", value: "769 ms" },
  { label: "ST SEGMENT", value: "+0.08 mV" },
  { label: "HRV INDEX", value: "42 ms" },
];

function SensorBadge({ isConnected }: { isConnected: boolean }) {
  return (
    <span
      data-ocid="ecg-sensor-badge"
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs"
      style={{
        background: isConnected
          ? "rgba(34,197,94,0.10)"
          : "rgba(249,115,22,0.10)",
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: isConnected ? "#22c55e" : "#f97316" }}
      />
      <span style={{ color: "#94a3b8", fontWeight: 300, fontSize: "0.65rem" }}>
        {isConnected ? "SENSOR ON" : "SENSOR OFF"}
      </span>
    </span>
  );
}

/** Shared thin slider style used for both Noise and Filter sliders */
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
        className="text-xs shrink-0 w-9 uppercase tracking-wide"
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
          background: `linear-gradient(to right, ${accentColor} ${value * 100}%, #1a2744 ${value * 100}%)`,
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
        className="text-xs font-mono w-8 text-right shrink-0"
        style={{ color: "#94a3b8", fontSize: "0.65rem" }}
      >
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}

export default function ECGWaveform() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [resolution, setResolution] = useState<"5s" | "10s">("5s");
  const [frozen, setFrozen] = useState(false);
  const [noiseIntensity, setNoiseIntensity] = useState(0.3);
  const [filterStrength, setFilterStrength] = useState(0.3);

  const ecgStatus = useStore((s) => s.sensorStatus.ecg);
  const isConnected = ecgStatus === "CONNECTED";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  useWaveformData({
    type: "ecg",
    canvasRef,
    heartRate: 78,
    amplitude: 1,
    isSensorConnected: isConnected,
    frozen,
    noiseIntensity,
    filterStrength,
  });

  const handleResolution = (r: "5s" | "10s") => {
    setResolution(r);
    useStore.getState().setWaveformResolution(r);
  };

  return (
    <div className="bg-[#0d1426] border border-[#1a2744] rounded-lg p-3">
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <span className="text-[#22c55e] text-xs font-semibold uppercase tracking-wider">
          ECG Waveform
        </span>
        <div className="flex items-center gap-2">
          <SensorBadge isConnected={isConnected} />

          {/* Freeze button */}
          <button
            type="button"
            onClick={() => setFrozen((f) => !f)}
            title={frozen ? "Resume" : "Freeze"}
            data-ocid="ecg-freeze-btn"
            className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
            style={
              frozen
                ? {
                    background: "rgba(34,197,94,0.15)",
                    color: "#22c55e",
                    border: "1px solid rgba(34,197,94,0.4)",
                  }
                : {
                    background: "#1a2744",
                    color: "#94a3b8",
                    border: "1px solid #2a3a4a",
                  }
            }
          >
            {frozen ? (
              <>
                <Play size={9} />
                <span>Resume</span>
              </>
            ) : (
              <>
                <Pause size={9} />
                <span>Freeze</span>
              </>
            )}
          </button>

          <div className="flex gap-1">
            {(["5s", "10s"] as const).map((r) => (
              <button
                key={r}
                type="button"
                data-ocid={`ecg-res-${r}`}
                onClick={() => handleResolution(r)}
                className={`px-2 py-0.5 rounded text-xs ${
                  resolution === r
                    ? "bg-[#22c55e] text-black font-semibold"
                    : "bg-[#1a2744] text-[#cbd5e1]"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Canvas + frozen overlay */}
      <div style={{ position: "relative" }}>
        <canvas
          ref={canvasRef}
          data-ocid="ecg-canvas"
          style={{ width: "100%", height: "150px", display: "block" }}
        />
        {frozen && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ background: "rgba(0,0,0,0.18)" }}
          >
            <span
              className="px-2 py-0.5 rounded text-xs font-bold tracking-widest"
              style={{
                background: "rgba(34,197,94,0.15)",
                color: "#22c55e",
                border: "1px solid rgba(34,197,94,0.4)",
              }}
            >
              ❄ FROZEN
            </span>
          </div>
        )}
      </div>

      {/* Sliders: Noise + Filter */}
      <div className="flex flex-col gap-1.5 mt-1.5 mb-1">
        <SliderRow
          label="Noise"
          value={noiseIntensity}
          onChange={setNoiseIntensity}
          accentColor="#22c55e"
          ocid="ecg-noise-slider"
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
          accentColor="#22c55e"
          ocid="ecg-filter-slider"
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

      {/* Metric boxes */}
      <div className="flex gap-2 mt-1">
        {BASE_METRICS.map((m) => (
          <div
            key={m.label}
            className="bg-[#0a0e1a] border border-[#1a2744] rounded p-2 flex-1 text-center"
          >
            <p className="text-[#94a3b8] text-xs uppercase leading-tight">
              {m.label}
            </p>
            <p className="text-white font-bold text-sm mt-0.5">{m.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
