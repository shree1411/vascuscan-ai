import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { useStore } from "../store/useStore";
import type { VitalSigns } from "../types/index";

export function useConnectionPolling() {
  const setSensorStatus = useStore((s) => s.setSensorStatus);
  const addNotification = useStore((s) => s.addNotification);
  
  const lastStatus = useRef({ ecg: "", ppg: "" });

  useEffect(() => {
    const backendUrl = (import.meta as any).env.VITE_BACKEND_URL || "/";
    const socket = io(backendUrl, { 
        transports: ["websocket"],
        reconnectionDelayMax: 5000 
    });

    // Phase 4: Initial Hardware Sync (Fetch once on mount)
    fetch(`${backendUrl.endsWith("/") ? backendUrl : backendUrl + "/" }api/status`)
      .then(res => res.json())
      .then(data => {
        if (data.status === "Success") {
            const isSim = data.is_simulated;
            setSensorStatus({
                ppg: isSim ? "SIMULATING" : data.ppg_connected ? "CONNECTED" : "OFFLINE",
                ecg: isSim ? "SIMULATING" : data.ecg_connected ? "CONNECTED" : "OFFLINE",
                fingerDetected: (data.ppg_connected || isSim) ? "SIGNAL GOOD" : "NO SIGNAL"
            });
        }
      })
      .catch(() => {
          setSensorStatus({ ppg: "OFFLINE", ecg: "OFFLINE", fingerDetected: "NO SIGNAL" });
      });

    socket.on("connect", () => {
      addNotification("System backend connected", "success");
    });

    socket.on("disconnect", () => {
      addNotification("System backend disconnected", "warning");
      setSensorStatus({ ppg: "OFFLINE", ecg: "OFFLINE", fingerDetected: "NO SIGNAL" });
    });

    socket.on("waveform_update", (data) => {
       const status = data.sensor_status || {};
       const ecgStat = status.ecg || "OFFLINE";
       const ppgStat = status.ppg || "OFFLINE";
       
       // Handle notifications for status changes
       if (ecgStat !== lastStatus.current.ecg) {
         if (ecgStat === "CONNECTED") addNotification("ECG sensor connected", "success");
         else addNotification("ECG sensor offline", "warning");
       }
       if (ppgStat !== lastStatus.current.ppg) {
         if (ppgStat === "CONNECTED") addNotification("PPG sensor connected", "success");
         else addNotification("PPG sensor offline", "warning");
       }
       lastStatus.current = { ecg: ecgStat, ppg: ppgStat };

       const isSim = status.simulated === true;
       const finalEcgStat = isSim ? "SIMULATING" : ecgStat;
       const finalPpgStat = isSim ? "SIMULATING" : ppgStat;

       setSensorStatus({
         ecg: finalEcgStat as any,
         ppg: finalPpgStat as any,
         fingerDetected: (ppgStat === "CONNECTED" || isSim) ? "SIGNAL GOOD" : "NO SIGNAL"
       });

       window.dispatchEvent(new CustomEvent('sensor_waveform', { detail: data }));
    });

    socket.on("prediction_update", (data) => {
       const store = useStore.getState();
        if (data.model_used === "model2_sensor") {
          // Update Live Vitals coming straight from the feature extractor
          const vitalsUpdate: Partial<VitalSigns> = {};
          if (data.hr > 0) vitalsUpdate.heartRate = data.hr;
          if (data.ptt > 0) vitalsUpdate.ptt = data.ptt;
          if (data.spo2 > 0) vitalsUpdate.spo2 = data.spo2;
          
          if (Object.keys(vitalsUpdate).length > 0) {
              store.updateVitals(vitalsUpdate);
          }

          // Update detailed signal features for analysis panel
          store.updateSignalFeatures({
              pulseAmplitude: data.pulse_amp ?? store.signalFeatures.pulseAmplitude,
              riseTime: data.rise_time ?? store.signalFeatures.riseTime,
              dicroticNotch: data.dicrotic_notch ?? store.signalFeatures.dicroticNotch,
              skewness: data.skewness ?? store.signalFeatures.skewness,
              hrvIndex: data.ecg_hrv ?? store.signalFeatures.hrvIndex,
              perfusion: data.perfusion ?? store.signalFeatures.perfusion,
          });

          // Update risk based on features
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
