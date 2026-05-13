import numpy as np
from scipy.signal import find_peaks
from scipy.stats import skew
from typing import Dict, List, Any

class FeatureExtractionService:
    """
    Handles advanced signal processing for ECG and PPG waveforms.
    Calculates RR intervals, HRV, PTT, QRS Duration, ST Segment, PI, Dicrotic Notch, Skewness, and estimated BP.
    """
    def __init__(self, fs: int = 100):
        self.fs = fs

    def extract_all(self, ecg: List[float], ppg: List[float]) -> Dict[str, Any]:
        try:
            if not ecg or not ppg or len(ecg) < self.fs * 2 or len(ppg) < self.fs * 2:
                return self._empty_features()

            ecg_arr = np.array(ecg)
            ppg_arr = np.array(ppg)

            # --- ECG Features ---
            ecg_peaks, _ = find_peaks(ecg_arr, distance=int(self.fs * 0.4))
            
            if len(ecg_peaks) < 2:
                return self._empty_features()

            rr_intervals = np.diff(ecg_peaks) / self.fs
            mean_rr = np.mean(rr_intervals)
            hr = 60.0 / mean_rr if mean_rr > 0 else 0
            hrv = np.sqrt(np.mean(np.square(np.diff(rr_intervals)))) * 1000 if len(rr_intervals) > 1 else 0

            # QRS Duration (Heuristic: peak width at half prominence)
            # Standard QRS is 80-120ms
            qrs_duration = 90.0 # Default fallback
            if len(ecg_peaks) > 0:
                # Approximate QRS width using a localized window around the first peak
                idx = ecg_peaks[0]
                window = ecg_arr[max(0, idx-10):min(len(ecg_arr), idx+10)]
                qrs_duration = np.sum(window > np.mean(window)) * (1000 / self.fs)
                qrs_duration = max(60, min(qrs_duration, 140)) # clamp to realistic ms

            # ST Segment (Heuristic: value ~40ms after assumed S wave)
            st_segment = 0.0
            if len(ecg_peaks) > 0:
                idx = ecg_peaks[0]
                st_idx = min(len(ecg_arr)-1, idx + int(0.08 * self.fs)) # 80ms after R peak
                st_segment = ecg_arr[st_idx]

            # --- PPG Features ---
            ppg_peaks, _ = find_peaks(ppg_arr, distance=int(self.fs * 0.4))
            ppg_troughs, _ = find_peaks(-ppg_arr, distance=int(self.fs * 0.4))

            amp = np.max(ppg_arr) - np.min(ppg_arr)
            
            # Rise Time
            rise_time = 0.0
            if len(ppg_peaks) > 0 and len(ppg_troughs) > 0:
                # Find a trough that precedes a peak
                valid_pairs = [(t, p) for t in ppg_troughs for p in ppg_peaks if t < p]
                if valid_pairs:
                    t, p = valid_pairs[0]
                    rise_time = (p - t) * (1000 / self.fs)

            # Perfusion Index (PI) = AC / DC * 100
            dc_ppg = np.mean(ppg_arr)
            ac_ppg = amp
            pi = (ac_ppg / dc_ppg * 100) if dc_ppg != 0 else 0.0

            # Dicrotic Notch Detection
            # Look for secondary small peak or inflection after main peak
            dicrotic_notch = "ABSENT"
            if len(ppg_peaks) > 0:
                for p_idx in ppg_peaks:
                    search_window = ppg_arr[p_idx:min(len(ppg_arr), p_idx + int(self.fs * 0.3))]
                    secondary_peaks, _ = find_peaks(search_window)
                    if len(secondary_peaks) > 0:
                        dicrotic_notch = "PRESENT"
                        break

            # Waveform Skewness
            skewness = skew(ppg_arr)
            skew_status = "NORMAL" if -1.0 <= skewness <= 1.0 else "IRREGULAR"

            # --- Combined Features ---
            # Pulse Transit Time (PTT)
            ptt = 0.0
            if len(ecg_peaks) > 0 and len(ppg_peaks) > 0:
                matching_ppg = [p for p in ppg_peaks if p > ecg_peaks[0]]
                if matching_ppg:
                    ptt = (matching_ppg[0] - ecg_peaks[0]) * (1000 / self.fs)

            # Blood Pressure Estimation
            # Simple heuristic based on PTT and assumed baseline. 
            # Note: Explicitly labeled as an estimate in UI.
            # Baseline ~ 120/80. PTT inversely correlates with BP.
            est_systolic = 120.0
            est_diastolic = 80.0
            if ptt > 0:
                est_systolic = 120.0 + (250.0 - ptt) * 0.15
                est_diastolic = 80.0 + (250.0 - ptt) * 0.08

            return {
                "ecg_heart_rate": round(hr, 1),
                "ecg_rr_interval": round(mean_rr * 1000, 1),
                "ecg_qrs_duration": round(qrs_duration, 1),
                "ecg_st_segment": round(st_segment, 3),
                "ecg_hrv": round(float(hrv), 2),
                
                "ppg_peak_amplitude": round(float(amp), 2),
                "ppg_rise_time": round(float(rise_time), 1),
                "ppg_perfusion_index": round(float(pi), 2),
                "ppg_dicrotic_notch": dicrotic_notch,
                "ppg_waveform_skewness": skew_status,
                
                "ptt": round(float(ptt), 2),
                "est_systolic_bp": round(est_systolic, 1),
                "est_diastolic_bp": round(est_diastolic, 1)
            }

        except Exception as e:
            print(f"Feature extraction error: {e}")
            return self._empty_features()

    def _empty_features(self) -> Dict[str, Any]:
        return {
            "ecg_heart_rate": 0, "ecg_rr_interval": 0, "ecg_qrs_duration": 0, "ecg_st_segment": 0, "ecg_hrv": 0,
            "ppg_peak_amplitude": 0, "ppg_rise_time": 0, "ppg_perfusion_index": 0, 
            "ppg_dicrotic_notch": "UNKNOWN", "ppg_waveform_skewness": "UNKNOWN",
            "ptt": 0, "est_systolic_bp": 0, "est_diastolic_bp": 0
        }

feature_extractor = FeatureExtractionService(fs=100)
