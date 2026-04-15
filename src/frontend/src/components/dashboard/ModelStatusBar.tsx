import { Cpu } from "lucide-react";
import { useAppStore } from "../../store/appStore";

export function ModelStatusBar() {
  const { modelStatus } = useAppStore();

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
      label: "Sensor",
      value: modelStatus.sensor,
      active: modelStatus.sensor === "ONLINE",
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
              background: item.active ? "#22c55e" : "#ef4444",
              boxShadow: item.active ? "0 0 6px #22c55e" : "none",
            }}
          />
          <span style={{ color: "#475569" }}>{item.label}:</span>
          <span
            className="font-semibold"
            style={{ color: item.active ? "#22c55e" : "#ef4444" }}
          >
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}
