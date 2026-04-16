/**
 * VitalsPanel.tsx — Live vitals display with increment/decrement controls.
 */
import { useStore } from "../../store/useStore";
import type { VitalSigns } from "../../types";

interface VitalCardProps {
  label: string;
  value: string;
  unit: string;
  color: string;
  onIncrement: () => void;
  onDecrement: () => void;
  ocid: string;
}

function VitalCard({
  label,
  value,
  unit,
  color,
  onIncrement,
  onDecrement,
  ocid,
}: VitalCardProps) {
  return (
    <div
      className="border-b px-3 py-3"
      style={{ borderColor: "#1e2a3a" }}
      data-ocid={ocid}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
            style={{ background: color }}
          />
          <span
            className="text-xs font-semibold tracking-wider uppercase"
            style={{ color: "#64748b" }}
          >
            {label}
          </span>
        </div>
        <button
          type="button"
          onClick={onIncrement}
          className="flex items-center justify-center w-5 h-5 rounded text-xs font-bold transition-smooth hover:bg-white/10"
          style={{ color: "#64748b", border: "1px solid #2a3a4a" }}
          data-ocid={`${ocid}-inc`}
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <span className="text-2xl font-bold font-mono" style={{ color }}>
            {value}
          </span>
          <span className="text-xs ml-1" style={{ color: "#475569" }}>
            {unit}
          </span>
        </div>
        <button
          type="button"
          onClick={onDecrement}
          className="flex items-center justify-center w-5 h-5 rounded text-xs font-bold transition-smooth hover:bg-white/10"
          style={{ color: "#64748b", border: "1px solid #2a3a4a" }}
          data-ocid={`${ocid}-dec`}
          aria-label={`Decrease ${label}`}
        >
          −
        </button>
      </div>
    </div>
  );
}

export function VitalsPanel() {
  const vitals = useStore((s) => s.vitals);
  const adjustVital = useStore((s) => s.adjustVital);

  const clampedAdjust = (key: keyof VitalSigns, delta: number) => {
    adjustVital(key, delta);
  };

  return (
    <div className="flex flex-col">
      <div className="px-3 py-2 border-b" style={{ borderColor: "#1e2a3a" }}>
        <span
          className="text-xs font-bold tracking-widest uppercase"
          style={{ color: "#94a3b8" }}
        >
          Live Vitals
        </span>
      </div>

      <VitalCard
        label="Heart Rate"
        value={String(vitals.heartRate)}
        unit="BPM"
        color="#ef4444"
        onIncrement={() => clampedAdjust("heartRate", 1)}
        onDecrement={() => clampedAdjust("heartRate", -1)}
        ocid="vital-heart-rate"
      />
      <VitalCard
        label="SpO2"
        value={String(vitals.spo2)}
        unit="%"
        color="#00d4ff"
        onIncrement={() => clampedAdjust("spo2", 1)}
        onDecrement={() => clampedAdjust("spo2", -1)}
        ocid="vital-spo2"
      />
      <VitalCard
        label="Blood Pressure"
        value={`${vitals.systolic}/${vitals.diastolic}`}
        unit="mmHg"
        color="#a855f7"
        onIncrement={() => {
          clampedAdjust("systolic", 1);
          clampedAdjust("diastolic", 1);
        }}
        onDecrement={() => {
          clampedAdjust("systolic", -1);
          clampedAdjust("diastolic", -1);
        }}
        ocid="vital-blood-pressure"
      />
      <VitalCard
        label="Pulse Transit Time"
        value={String(vitals.ptt)}
        unit="ms"
        color="#eab308"
        onIncrement={() => clampedAdjust("ptt", 5)}
        onDecrement={() => clampedAdjust("ptt", -5)}
        ocid="vital-ptt"
      />
      <VitalCard
        label="Perfusion Index"
        value={vitals.perfusionIndex.toFixed(1)}
        unit="%"
        color="#22c55e"
        onIncrement={() => clampedAdjust("perfusionIndex", 0.1)}
        onDecrement={() => clampedAdjust("perfusionIndex", -0.1)}
        ocid="vital-perfusion"
      />

      <div
        className="px-3 py-2 border-b text-xs"
        style={{ borderColor: "#1e2a3a", color: "#334155" }}
      >
        Adjustment
      </div>
    </div>
  );
}
