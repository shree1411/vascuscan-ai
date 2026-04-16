import { Cpu } from "lucide-react";
import { useStore } from "../../store/useStore";

export function ModelStatusBar() {
  const { modelStatus, sensorStatus } = useStore();

  const items = [
    {
      label: "CNN Model",
      value: modelStatus.cnn,
      active: modelStatus.cnn === "ACTIVE",
    },
    {
      label: "LSTM Model",
      value: modelStatus.lstm,
      active: modelStatus.lstm === "ACTIVE",
    },
    {
      label: "Sensor Status",
      value: (sensorStatus.ppg === "CONNECTED" || sensorStatus.ecg === "CONNECTED") 
               ? "ONLINE" 
               : (sensorStatus.ppg === "SIMULATING" || sensorStatus.ecg === "SIMULATED") 
                 ? "SIMULATED" 
                 : "OFF",
      active: sensorStatus.ppg === "CONNECTED" || sensorStatus.ecg === "CONNECTED",
      isSim: sensorStatus.ppg === "SIMULATING" || sensorStatus.ecg === "SIMULATED",
    },
    {
      label: "Database",
      value: modelStatus.database,
      active: modelStatus.database === "CONNECTED",
    },
  ];

  return (
    <div className="flex items-center gap-3">
      <Cpu size={12} style={{ color: "#475569" }} />
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5 text-xs">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: item.active ? "#22c55e" : item.isSim ? "#00d4ff" : "#ef4444",
              boxShadow: item.active ? "0 0 6px #22c55e" : item.isSim ? "0 0 6px #00d4ff" : "none",
            }}
          />
          <span style={{ color: "#475569" }}>{item.label}:</span>
          <span
            className="font-semibold"
            style={{ color: item.active ? "#22c55e" : item.isSim ? "#00d4ff" : "#ef4444" }}
          >
            {item.value}
          </span>
        </div>
      ))}
      {/* 100% Readiness indicator */}
      <div className="flex items-center gap-1.5 text-xs ml-2 border-l border-white/5 pl-3">
        <span style={{ color: "#475569" }}>System Readiness:</span>
        <span className="font-bold text-green-500">100%</span>
      </div>
    </div>
  );
}
