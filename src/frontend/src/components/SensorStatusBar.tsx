/**
 * SensorStatusBar.tsx — Three sensor status cards + system health indicator.
 * Cards have NO colored border — only a subtle neutral border.
 */
import { Activity, Fingerprint, Wifi } from "lucide-react";
import { useStore } from "../store/useStore";

interface SensorCardProps {
  label: string;
  status: string;
  icon: React.ReactNode;
}

function SensorCard({ label, status, icon }: SensorCardProps) {
  const isGood = status === "CONNECTED";
  const isSim = status === "SIMULATING" || status === "SIMULATED";
  
  return (
    <div
      className="flex items-center gap-2 px-4 py-2 rounded w-fit"
      style={{
        background: "#0d1426",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Status dot */}
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: isGood ? "#22c55e" : isSim ? "#00d4ff" : "#f97316" }}
      />
      {/* Icon — neutral color, not colored */}
      <span style={{ color: "#94a3b8" }}>{icon}</span>
      <div className="flex flex-col leading-tight">
        <span className="text-xs font-semibold text-white">{label}</span>
        <span
          className="text-[10px] font-medium uppercase tracking-tight"
          style={{ color: isGood ? "#4ade80" : isSim ? "#00d4ff" : "#fb923c" }}
        >
          {isGood ? "Connected" : isSim ? "Simulated" : "Offline"}
        </span>
      </div>
    </div>
  );
}

export function SensorStatusBar() {
  const sensorStatus = useStore((s) => s.sensorStatus);

  const allGood =
    sensorStatus.ppg === "CONNECTED" &&
    sensorStatus.ecg === "CONNECTED" &&
    sensorStatus.fingerDetected === "SIGNAL GOOD";

  return (
    <div
      className="flex items-center gap-4 px-4 py-2 shrink-0 border-b"
      style={{ background: "#0a0e1a", borderColor: "#1a2744" }}
      data-ocid="sensor-status-bar"
    >
      <SensorCard
        label="PPG SENSOR"
        status={sensorStatus.ppg}
        icon={<Wifi size={12} />}
      />
      <SensorCard
        label="ECG SENSOR"
        status={sensorStatus.ecg}
        icon={<Activity size={12} />}
      />
      <SensorCard
        label="FINGER DETECTED"
        status={sensorStatus.fingerDetected === "SIGNAL GOOD" ? "CONNECTED" : "OFFLINE"}
        icon={<Fingerprint size={12} />}
      />

      <div className="ml-auto flex items-center gap-1.5">
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: allGood ? "#22c55e" : "#f59e0b" }}
        />
        <span
          className="text-xs font-medium"
          style={{ color: allGood ? "#00d4ff" : "#f59e0b" }}
        >
          {allGood ? "All Systems Operational" : "Sensor Issue Detected"}
        </span>
      </div>
    </div>
  );
}
