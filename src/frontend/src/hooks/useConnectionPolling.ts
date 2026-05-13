import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { useStore } from "../store/useStore";
import type { VitalSigns } from "../types/index";

export function useConnectionPolling() {
  const backendUrl = "http://127.0.0.1:5005";
  const setModelStatus = useStore((s) => s.setModelStatus);
  const setSensorStatus = useStore((s) => s.setSensorStatus);
  const addNotification = useStore((s) => s.addNotification);
  
  const lastStatus = useRef({ ecg: "", ppg: "" });

  useEffect(() => {
    const socket = io(backendUrl, { 
        transports: ["polling"],
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
       const ecgQual = status.ecg_quality || "OFFLINE";
       const ppgQual = status.ppg_quality || "OFFLINE";
       
       const ecgConf = status.ecg_confidence || 0;
       const ppgConf = status.ppg_confidence || 0;
       
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

       setSensorStatus({
         ecg: ecgStat as any,
         ppg: ppgStat as any,
         ecgQuality: ecgQual as any,
         ppgQuality: ppgQual as any,
         ecgConfidence: ecgConf,
         ppgConfidence: ppgConf,
         fingerDetected: (ppgStat === "CONNECTED" && ppgQual !== "POOR") ? "SIGNAL GOOD" : "NO SIGNAL"
       });
<<<<<<< HEAD
=======
       
       setModelStatus({
           sensor: "ONLINE",
           cnn: "ACTIVE",
           lstm: "ACTIVE",
       } as any);
>>>>>>> 6e34c4d (Production-grade ICU monitor upgrade: AI risk and signal quality engine)

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
                  riskScore: Math.round(data.risk_score),
                  riskLevel: data.risk_level,
                  blockageProbability: Math.round(data.risk_score * 0.8),
                  aiConfidence: Math.round(data.probabilities[data.risk_level] ?? 85),
                  modelUsed: "model2_sensor",
                  probabilities: data.probabilities
             }
          });
        }
    });
    socket.on("vitals_update", (data) => {
        const store = useStore.getState();
        const vitalsUpdate: Partial<VitalSigns> = {};
        if (data.ecg_hr > 0) vitalsUpdate.heartRate = data.ecg_hr;
        if (data.ptt > 0) vitalsUpdate.ptt = data.ptt;
        if (data.est_systolic > 0) vitalsUpdate.systolic = data.est_systolic;
        if (data.est_diastolic > 0) vitalsUpdate.diastolic = data.est_diastolic;
        if (data.perfusion_index > 0) vitalsUpdate.perfusionIndex = data.perfusion_index;
        if (data.spo2 > 0) vitalsUpdate.spo2 = data.spo2;
        
        if (Object.keys(vitalsUpdate).length > 0) {
            store.updateVitals(vitalsUpdate);
        }

        store.updateSignalFeatures({
            pulseAmplitude: data.amp ?? store.signalFeatures.pulseAmplitude,
            riseTime: data.rise ?? store.signalFeatures.riseTime,
            dicroticNotch: data.dicrotic_notch ?? store.signalFeatures.dicroticNotch,
            skewness: data.skewness?.toString() ?? store.signalFeatures.skewness,
            hrvIndex: data.hrv ?? store.signalFeatures.hrvIndex,
            perfusion: data.perfusion_index ?? store.signalFeatures.perfusion,
            qrsDuration: data.qrs_duration ?? store.signalFeatures.qrsDuration,
            stSegment: data.st_segment ?? store.signalFeatures.stSegment,
            rrInterval: data.rr ?? store.signalFeatures.rrInterval,
            estSystolicBp: data.est_systolic ?? store.signalFeatures.estSystolicBp,
            estDiastolicBp: data.est_diastolic ?? store.signalFeatures.estDiastolicBp,
            ptt: data.ptt ?? store.signalFeatures.ptt,
            heartRate: data.ecg_hr ?? store.signalFeatures.heartRate,
            vascularStiffness: data.vascular_stiffness ?? store.signalFeatures.vascularStiffness,
        });
    });

    return () => {
      socket.disconnect();
    };
  }, []);
}
