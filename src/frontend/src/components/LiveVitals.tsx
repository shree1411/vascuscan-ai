/**
 * LiveVitals.tsx — Right sidebar with live vital signs, adjustment buttons, and AI model status.
 */
import { Activity, Droplets, Heart, Timer, Zap } from "lucide-react";
import { useStore } from "../store/useStore";
import type { VitalSigns } from "../types";

interface AdjustConfig {
  key: keyof VitalSigns;
  delta: number;
  clamp?: [number, number];
}

interface VitalCardProps {
  label: string;
  value: string;
  unit: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: React.ReactNode;
  dataOcid: string;
  onDecrement: () => void;
  onIncrement: () => void;
}

function AdjustBtn({
  onClick,
  children,
}: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-6 h-6 rounded flex items-center justify-center text-white text-sm hover:opacity-80 transition-colors"
      style={{ background: "#1a2744" }}
    >
      {children}
    </button>
  );
}

function VitalCard({
  label,
  value,
  unit,
  color,
  bgColor,
  borderColor,
  icon,
  dataOcid,
  onDecrement,
  onIncrement,
}: VitalCardProps) {
  return (
    <div
      className="border rounded p-2.5"
      style={{ background: "#0a0e1a", borderColor: "#1a2744" }}
      data-ocid={dataOcid}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded flex-shrink-0 flex items-center justify-center"
          style={{ background: bgColor, border: `1px solid ${borderColor}` }}
        >
          {icon}
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <p
            className="text-xs uppercase font-medium"
            style={{ color: "#64748b" }}
          >
            {label}
          </p>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold leading-tight" style={{ color }}>
              {value}
            </span>
            <span className="text-xs" style={{ color: "#475569" }}>
              {unit}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-1 flex-shrink-0">
          <AdjustBtn onClick={onIncrement}>+</AdjustBtn>
          <AdjustBtn onClick={onDecrement}>−</AdjustBtn>
        </div>
      </div>
    </div>
  );
}

interface StatusItemProps {
  label: string;
  status: string;
  color: string;
  dotColor?: string;
}

function StatusItem({
  label,
  status,
  color,
  dotColor = "#22c55e",
}: StatusItemProps) {
  return (
    <div className="flex items-center justify-between text-xs py-1">
      <span style={{ color: "#94a3b8" }}>{label}</span>
      <span className="flex items-center gap-1" style={{ color }}>
        <span
          className="w-1.5 h-1.5 rounded-full inline-block"
          style={{ background: dotColor }}
        />
        {status}
      </span>
    </div>
  );
}

export function LiveVitals() {
  const vitals = useStore((s) => s.vitals);
  const modelStatus = useStore((s) => s.modelStatus);
  const adjustVital = useStore((s) => s.adjustVital);

  const bpValue = `${vitals.systolic}/${vitals.diastolic}`;

  const adjust = (config: AdjustConfig, sign: 1 | -1) => {
    adjustVital(config.key, config.delta * sign);
  };

  return (
    <aside
      className="w-60 flex-shrink-0 flex flex-col gap-2 p-3 overflow-y-auto border-l"
      style={{ background: "#0d1426", borderColor: "#1a2744" }}
      data-ocid="live-vitals-sidebar"
    >
      <p
        className="text-xs font-semibold uppercase tracking-wider border-b pb-2 mb-1"
        style={{ color: "#00d4ff", borderColor: "#1a2744" }}
      >
        LIVE VITALS
      </p>

      <VitalCard
        label="HEART RATE"
        value={String(vitals.heartRate)}
        unit="BPM"
        color="#f87171"
        bgColor="rgba(239,68,68,0.12)"
        borderColor="rgba(239,68,68,0.3)"
        icon={<Heart size={13} style={{ color: "#f87171" }} />}
        dataOcid="vital-heart-rate"
        onDecrement={() => adjust({ key: "heartRate", delta: 1 }, -1)}
        onIncrement={() => adjust({ key: "heartRate", delta: 1 }, 1)}
      />

      <VitalCard
        label="SpO2"
        value={String(vitals.spo2)}
        unit="%"
        color="#00d4ff"
        bgColor="rgba(0,212,255,0.12)"
        borderColor="rgba(0,212,255,0.3)"
        icon={<Droplets size={13} style={{ color: "#00d4ff" }} />}
        dataOcid="vital-spo2"
        onDecrement={() => adjust({ key: "spo2", delta: 1 }, -1)}
        onIncrement={() => adjust({ key: "spo2", delta: 1 }, 1)}
      />

      <VitalCard
        label="BLOOD PRESSURE"
        value={bpValue}
        unit="mmHg"
        color="#c084fc"
        bgColor="rgba(168,85,247,0.12)"
        borderColor="rgba(168,85,247,0.3)"
        icon={<Activity size={13} style={{ color: "#c084fc" }} />}
        dataOcid="vital-bp"
        onDecrement={() => {
          adjust({ key: "systolic", delta: 1 }, -1);
          adjust({ key: "diastolic", delta: 1 }, -1);
        }}
        onIncrement={() => {
          adjust({ key: "systolic", delta: 1 }, 1);
          adjust({ key: "diastolic", delta: 1 }, 1);
        }}
      />

      <VitalCard
        label="PULSE TRANSIT TIME"
        value={String(vitals.ptt)}
        unit="ms"
        color="#facc15"
        bgColor="rgba(234,179,8,0.12)"
        borderColor="rgba(234,179,8,0.3)"
        icon={<Timer size={13} style={{ color: "#facc15" }} />}
        dataOcid="vital-ptt"
        onDecrement={() => adjust({ key: "ptt", delta: 5 }, -1)}
        onIncrement={() => adjust({ key: "ptt", delta: 5 }, 1)}
      />

      <VitalCard
        label="PERFUSION INDEX"
        value={vitals.perfusionIndex.toFixed(1)}
        unit=""
        color="#4ade80"
        bgColor="rgba(34,197,94,0.12)"
        borderColor="rgba(34,197,94,0.3)"
        icon={<Zap size={13} style={{ color: "#4ade80" }} />}
        dataOcid="vital-perfusion"
        onDecrement={() => adjust({ key: "perfusionIndex", delta: 0.1 }, -1)}
        onIncrement={() => adjust({ key: "perfusionIndex", delta: 0.1 }, 1)}
      />

      {/* AI Model Status */}
      <div
        className="border-t pt-2 mt-2"
        style={{ borderColor: "#1a2744" }}
        data-ocid="ai-model-status"
      >
        <p
          className="text-xs uppercase tracking-wider mb-1"
          style={{ color: "#64748b" }}
        >
          AI MODEL STATUS
        </p>
        <StatusItem
          label="CNN Model"
          status={modelStatus.cnn}
          color="#4ade80"
        />
        <StatusItem
          label="LSTM Model"
          status={modelStatus.lstm}
          color="#4ade80"
        />
        <StatusItem
          label="Sensor"
          status={modelStatus.sensor}
          color="#4ade80"
        />
        <StatusItem
          label="Database"
          status={modelStatus.database}
          color="#00d4ff"
          dotColor="#00d4ff"
        />
        <div className="flex items-center justify-between text-xs py-1">
          <span style={{ color: "#94a3b8" }}>Accuracy</span>
          <span style={{ color: "#00d4ff" }}>
            {modelStatus.accuracy.toFixed(1)}%
          </span>
        </div>
      </div>
    </aside>
  );
}
