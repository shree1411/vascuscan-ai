/**
 * SensorBar.tsx — PPG, ECG, and Finger Detection status indicators.
 */
import { Activity, Fingerprint, Wifi } from "lucide-react";
import { useAppStore } from "../store/appStore";

export function SensorBar() {
  const sensorStatus = useAppStore((s) => s.sensorStatus);

  const sensors = [
    {
      label: "PPG SENSOR",
      status: sensorStatus.ppg,
      icon: <Wifi size={11} />,
      isGood: sensorStatus.ppg === "CONNECTED",
    },
    {
      label: "ECG SENSOR",
      status: sensorStatus.ecg,
      icon: <Activity size={11} />,
      isGood: sensorStatus.ecg === "CONNECTED",
    },
    {
      label: "FINGER DETECTED",
      status: sensorStatus.fingerDetected,
      icon: <Fingerprint size={11} />,
      isGood: sensorStatus.fingerDetected === "SIGNAL GOOD",
    },
  ];

  return (
    <div
      className="flex items-center gap-2 px-4 py-2 shrink-0"
      style={{ borderBottom: "1px solid rgba(0,212,255,0.08)" }}
      data-ocid="sensor-status-bar"
    >
      {sensors.map(({ label, status, icon, isGood }) => (
        <div
          key={label}
          className="flex items-center gap-2 px-3 py-1.5 rounded text-xs border"
          style={{ background: "#0d1525", borderColor: "rgba(0,212,255,0.1)" }}
        >
          <span style={{ color: isGood ? "#00cc6a" : "#ef4444" }}>{icon}</span>
          <span
            className="font-mono font-semibold"
            style={{ color: "rgba(255,255,255,0.6)", letterSpacing: "0.05em" }}
          >
            {label}
          </span>
          <span
            className="font-semibold"
            style={{ color: isGood ? "#00cc6a" : "#ef4444" }}
          >
            {status}
          </span>
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: isGood ? "#00cc6a" : "#ef4444" }}
          />
        </div>
      ))}
    </div>
  );
}
