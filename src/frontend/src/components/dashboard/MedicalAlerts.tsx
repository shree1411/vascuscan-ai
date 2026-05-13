import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useStore } from "../../store/useStore";

interface Alert {
  id: number;
  message: string;
  type: "warning" | "critical";
}

let alertCounter = 0;

export function MedicalAlerts() {
  const notifications = useStore((s) => s.notifications);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  // Convert system notifications that are critical/warnings into dashboard banner alerts
  useEffect(() => {
    const latest = notifications[notifications.length - 1];
    if (latest) {
      if (
        latest.message.includes("CRITICAL") ||
        latest.message.includes("Arrhythmia") ||
        latest.message.includes("Poor Signal")
      ) {
        const id = ++alertCounter;
        setAlerts((prev) => [
          ...prev,
          { id, message: latest.message, type: latest.message.includes("CRITICAL") ? "critical" : "warning" },
        ]);
        // Auto dismiss after 5s
        setTimeout(() => {
          setAlerts((prev) => prev.filter((a) => a.id !== id));
        }, 5000);
      }
    }
  }, [notifications]);

  if (alerts.length === 0) return null;

  return (
    <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-40 flex flex-col gap-2 w-[400px]">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="flex items-center gap-3 p-3 rounded-lg shadow-2xl border bg-opacity-95"
          style={{
            backgroundColor: alert.type === "critical" ? "#450a0a" : "#422006",
            borderColor: alert.type === "critical" ? "#dc2626" : "#ea580c",
          }}
        >
          <div
            className="p-1.5 rounded-full"
            style={{ backgroundColor: alert.type === "critical" ? "#7f1d1d" : "#7c2d12" }}
          >
            <AlertTriangle
              size={18}
              color={alert.type === "critical" ? "#fca5a5" : "#fdba74"}
            />
          </div>
          <span
            className="flex-1 font-bold text-sm tracking-wide"
            style={{ color: alert.type === "critical" ? "#fecaca" : "#fed7aa" }}
          >
            {alert.message}
          </span>
          <button
            onClick={() => setAlerts((prev) => prev.filter((a) => a.id !== alert.id))}
            className="opacity-70 hover:opacity-100 transition-opacity"
            aria-label="Dismiss Alert"
          >
            <X size={14} color={alert.type === "critical" ? "#fca5a5" : "#fdba74"} />
          </button>
        </div>
      ))}
    </div>
  );
}
