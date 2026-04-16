import { useEffect, useRef } from "react";
import { useStore } from "../store/useStore";

const THRESHOLDS = {
  heartRate: {
    warning: [55, 100],
    critical: [45, 120]
  },
  spo2: {
    warning: 94,
    critical: 90
  },
  timeout: 3000 // 3 seconds to detect signal loss
};

export function useRealTimeAlerts() {
  const vitals = useStore((s) => s.vitals);
  const sensorStatus = useStore((s) => s.sensorStatus);
  const addNotification = useStore((s) => s.addNotification);
  
  const lastUpdate = useRef(Date.now());
  const activeAlerts = useRef<Set<string>>(new Set());

  // Update time tracker whenever vitals change (even simulated)
  useEffect(() => {
    lastUpdate.current = Date.now();
  }, [vitals]);

  useEffect(() => {
    const monitor = () => {
      const now = Date.now();
      const isOnline = sensorStatus.ppg !== "OFFLINE" || sensorStatus.ecg !== "OFFLINE";

      // 1. Check for Signal Loss
      if (isOnline && (now - lastUpdate.current > THRESHOLDS.timeout)) {
        if (!activeAlerts.current.has("signal_lost")) {
          addNotification("Connection lost - Check sensors", "warning");
          activeAlerts.current.add("signal_lost");
        }
      } else {
        activeAlerts.current.delete("signal_lost");
      }

      // 2. Check Physiological Extremes (HR)
      const hr = vitals.heartRate;
      if (hr > THRESHOLDS.heartRate.critical[1]) {
        if (!activeAlerts.current.has("hr_crit_high")) {
          addNotification(`CRITICAL: High Heart Rate (${hr} BPM)`, "warning");
          activeAlerts.current.add("hr_crit_high");
        }
      } else if (hr < THRESHOLDS.heartRate.critical[0]) {
        if (!activeAlerts.current.has("hr_crit_low")) {
          addNotification(`CRITICAL: Low Heart Rate (${hr} BPM)`, "warning");
          activeAlerts.current.add("hr_crit_low");
        }
      } else {
        activeAlerts.current.delete("hr_crit_high");
        activeAlerts.current.delete("hr_crit_low");
      }

      // 3. Check SpO2
      const spo2 = vitals.spo2;
      if (spo2 < THRESHOLDS.spo2.critical) {
        if (!activeAlerts.current.has("spo2_crit")) {
          addNotification(`CRITICAL: Hypoxia Detected (SpO2 ${spo2}%)`, "warning");
          activeAlerts.current.add("spo2_crit");
        }
      } else if (spo2 < THRESHOLDS.spo2.warning) {
        if (!activeAlerts.current.has("spo2_warn")) {
          addNotification(`Warning: Low SpO2 (${spo2}%)`, "info");
          activeAlerts.current.add("spo2_warn");
        }
      } else {
         activeAlerts.current.delete("spo2_crit");
         activeAlerts.current.delete("spo2_warn");
      }
    };

    const interval = setInterval(monitor, 1000);
    return () => clearInterval(interval);
  }, [vitals, sensorStatus, addNotification]);

  return null;
}
