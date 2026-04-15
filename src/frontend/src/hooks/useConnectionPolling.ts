import { useEffect } from "react";
import { io } from "socket.io-client";
import { useAppStore } from "../store/appStore";

export function useConnectionPolling() {
  const setModelStatus = useAppStore((s) => s.setModelStatus);
  const setSensorStatus = useAppStore((s) => s.setSensorStatus);
  const updatePatientPrediction = useAppStore((s) => s.updatePatientPrediction);
  const currentPatientId = useAppStore((s) => s.currentPatientId);

  useEffect(() => {
    // We use a relative path so the Vite proxy can handle the WebSocket upgrade.
    const socket = io("/", {
        reconnectionDelayMax: 5000,
    });

    socket.on("connect", () => {
      setModelStatus({
        database: "CONNECTED",
        accuracy: 94.2
      } as any);
    });

    socket.on("disconnect", () => {
      setModelStatus({
        cnn: "OFFLINE",
        lstm: "OFFLINE",
        sensor: "DISCONNECTED",
        database: "DISCONNECTED",
        accuracy: 0.0
      } as any);
      setSensorStatus({
        ppg: "DISCONNECTED",
        ecg: "DISCONNECTED",
        fingerDetected: "NO SIGNAL"
      });
    });

    socket.on("waveform_update", (data) => {
       // Independent sensor evaluation based on connection state
       const ecgStat = data.ecg_connected ? "CONNECTED" : "OFFLINE";
       const ppgStat = data.ppg_connected ? "CONNECTED" : "OFFLINE";
       
       setSensorStatus({
         ecg: ecgStat,
         ppg: ppgStat,
         fingerDetected: data.ppg_connected ? "SIGNAL GOOD" : "NO SIGNAL"
       });
       
       // Update AI Status to OFF if both are disconnected, ACTIVE if either is connected
       const anyConnected = data.ecg_connected || data.ppg_connected;
       setModelStatus({
           sensor: anyConnected ? "ONLINE" : "OFFLINE",
           cnn: anyConnected ? "ACTIVE" : "OFFLINE",
           lstm: anyConnected ? "ACTIVE" : "OFFLINE",
       } as any);

       window.dispatchEvent(new CustomEvent('sensor_waveform', { detail: data }));
    });

    socket.on("prediction_update", (data) => {
       const store = useAppStore.getState();
       if (data.model_used === "model2_sensor") {
         // Update Live Vitals coming straight from the feature extractor
         if (data.hr > 0) {
             store.updateVitals({ heartRate: data.hr });
         }
         // Predict risk based on features
         store.updatePatient(store.currentPatientId, {
            riskAssessment: {
                 riskScore: Math.round(data.risk_score * 100),
                 riskLevel: data.risk_level,
                 blockageProbability: Math.round(data.risk_percentage),
                 aiConfidence: Math.round(data.probabilities[data.risk_level] ?? 85),
                 modelUsed: "model2_sensor",
                 probabilities: data.probabilities
            }
         });
       }
    });

    return () => {
      socket.disconnect();
    };
  }, []);
}
