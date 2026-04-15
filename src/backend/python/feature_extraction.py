"""
VASCUSCAN AI — Feature Extraction
Extract cardiovascular biomarkers from filtered ECG and PPG waveforms.
"""

import logging
import math
import statistics
from typing import Dict, List, Optional, Tuple

import numpy as np
from scipy import signal as sp_signal

logger = logging.getLogger("vascuscan.features")

# Sampling frequency default — ESP32 sends at 250 Hz
DEFAULT_FS = 250.0


# ---------------------------------------------------------------------------
# Peak detection
# ---------------------------------------------------------------------------

def detect_peaks(
    signal_data: List[float],
    fs: float = DEFAULT_FS,
    min_distance: float = 0.3,
) -> List[int]:
    """
    Detect peaks in a cardiac signal.

    Args:
        signal_data:  Filtered signal samples.
        fs:           Sampling frequency in Hz.
        min_distance: Minimum time between consecutive peaks in seconds
                      (prevents double detection of the same beat).

    Returns:
        List of sample indices where peaks occur.
    """
    if len(signal_data) < 5:
        return []

    arr = np.asarray(signal_data, dtype=np.float64)
    min_samples = int(min_distance * fs)
    height_threshold = np.percentile(arr, 60)  # only detect prominent peaks

    peaks, _ = sp_signal.find_peaks(
        arr,
        distance=max(min_samples, 1),
        height=height_threshold,
        prominence=np.std(arr) * 0.5,
    )
    return peaks.tolist()


# ---------------------------------------------------------------------------
# HRV calculations
# ---------------------------------------------------------------------------

def _rr_intervals_from_peaks(peak_indices: List[int], fs: float) -> List[float]:
    """Convert peak sample indices to RR intervals in milliseconds."""
    if len(peak_indices) < 2:
        return []
    return [(peak_indices[i + 1] - peak_indices[i]) / fs * 1000.0
            for i in range(len(peak_indices) - 1)]


def calculate_hrv(rr_intervals: List[float]) -> float:
    """
    Heart Rate Variability — RMSSD (Root Mean Square of Successive Differences).

    Args:
        rr_intervals: List of RR intervals in milliseconds.

    Returns:
        RMSSD in milliseconds.  Returns 0.0 if insufficient data.
    """
    if len(rr_intervals) < 2:
        return 0.0
    successive_diffs = [rr_intervals[i + 1] - rr_intervals[i]
                        for i in range(len(rr_intervals) - 1)]
    return math.sqrt(sum(d ** 2 for d in successive_diffs) / len(successive_diffs))


def calculate_hrv_index(rr_intervals: List[float]) -> float:
    """
    HRV Geometric Index ≈ total NN count / max histogram bin count.
    Higher values indicate more variable (healthier) heart rate.

    Returns:
        HRV index float.  Returns 0.0 if insufficient data.
    """
    if len(rr_intervals) < 10:
        return 0.0

    # Build histogram with 7.8125 ms bins (standard triangular index)
    bin_width = 7.8125
    min_rr = min(rr_intervals)
    max_rr = max(rr_intervals)
    n_bins = max(int((max_rr - min_rr) / bin_width) + 1, 1)
    hist, _ = np.histogram(rr_intervals, bins=n_bins)
    max_bin = int(np.max(hist))
    if max_bin == 0:
        return 0.0
    return len(rr_intervals) / max_bin


# ---------------------------------------------------------------------------
# ECG feature extraction
# ---------------------------------------------------------------------------

def extract_ecg_features(ecg_signal: List[float], fs: float = DEFAULT_FS) -> dict:
    """
    Extract key ECG biomarkers from a filtered ECG waveform.

    Returns:
        {
          qrs_duration:  float  (ms)
          rr_interval:   float  (ms)
          hrv:           float  (ms RMSSD)
          hrv_index:     float
          st_segment:    float  (normalised amplitude, 0 = isoelectric)
          heart_rate:    float  (bpm estimated from RR)
          normal_ranges: dict
        }
    """
    if not ecg_signal:
        return _ecg_defaults()

    arr = np.asarray(ecg_signal, dtype=np.float64)
    r_peaks = detect_peaks(ecg_signal, fs=fs, min_distance=0.3)

    if len(r_peaks) < 2:
        return _ecg_defaults()

    rr_ms = _rr_intervals_from_peaks(r_peaks, fs)
    mean_rr = float(np.mean(rr_ms)) if rr_ms else 857.0
    heart_rate = 60_000.0 / mean_rr if mean_rr > 0 else 70.0

    # QRS duration: estimate width at half-prominence of each R-peak
    qrs_widths = []
    for idx in r_peaks:
        left = max(0, idx - int(0.06 * fs))   # 60 ms before peak
        right = min(len(arr) - 1, idx + int(0.06 * fs))
        peak_val = arr[idx]
        half = peak_val / 2.0
        # Walk left and right from peak to find QRS onset/offset
        l_bound = left
        r_bound = right
        for j in range(idx, left, -1):
            if arr[j] < half:
                l_bound = j
                break
        for j in range(idx, right):
            if arr[j] < half:
                r_bound = j
                break
        width_ms = (r_bound - l_bound) / fs * 1000.0
        if 40 < width_ms < 200:  # plausible QRS width
            qrs_widths.append(width_ms)

    qrs_duration = float(np.mean(qrs_widths)) if qrs_widths else 95.0

    # ST segment: amplitude ~160 ms after R-peak relative to isoelectric line
    st_samples = []
    isoelectric = float(np.percentile(arr, 10))  # approx PR baseline
    for idx in r_peaks:
        st_idx = idx + int(0.16 * fs)
        if st_idx < len(arr):
            st_samples.append(float(arr[st_idx]) - isoelectric)

    st_segment = float(np.mean(st_samples)) if st_samples else 0.0

    hrv = calculate_hrv(rr_ms)
    hrv_idx = calculate_hrv_index(rr_ms)

    return {
        "qrs_duration": round(qrs_duration, 1),
        "rr_interval": round(mean_rr, 1),
        "hrv": round(hrv, 2),
        "hrv_index": round(hrv_idx, 3),
        "st_segment": round(st_segment, 4),
        "heart_rate": round(heart_rate, 1),
        "normal_ranges": {
            "qrs_duration": "60–120 ms",
            "rr_interval": "600–1200 ms (50–100 bpm)",
            "hrv": "> 20 ms (higher = healthier)",
            "st_segment": "-0.1 to +0.1 mV",
        },
    }


def _ecg_defaults() -> dict:
    """Return typical resting values when signal is too short to analyse."""
    return {
        "qrs_duration": 95.0,
        "rr_interval": 857.0,
        "hrv": 35.0,
        "hrv_index": 3.5,
        "st_segment": 0.0,
        "heart_rate": 70.0,
        "normal_ranges": {
            "qrs_duration": "60–120 ms",
            "rr_interval": "600–1200 ms",
            "hrv": "> 20 ms",
            "st_segment": "-0.1 to +0.1 mV",
        },
    }


# ---------------------------------------------------------------------------
# PPG feature extraction
# ---------------------------------------------------------------------------

def extract_ppg_features(ppg_signal: List[float], fs: float = DEFAULT_FS) -> dict:
    """
    Extract PPG biomarkers from a filtered photoplethysmography waveform.

    Returns:
        {
          peak_amplitude:    float  (normalised 0–1)
          rise_time:         float  (ms, trough → peak)
          dicrotic_notch:    float | None  (normalised amplitude if detected)
          waveform_skewness: float
          perfusion_index:   float  (%)
          normal_ranges:     dict
        }
    """
    if not ppg_signal:
        return _ppg_defaults()

    arr = np.asarray(ppg_signal, dtype=np.float64)
    peaks = detect_peaks(ppg_signal, fs=fs, min_distance=0.3)

    if not peaks:
        return _ppg_defaults()

    # Normalise signal 0–1 for amplitude-independent metrics
    arr_min = arr.min()
    arr_max = arr.max()
    amplitude_range = arr_max - arr_min
    if amplitude_range < 1e-6:
        return _ppg_defaults()

    arr_norm = (arr - arr_min) / amplitude_range

    # Peak amplitudes
    peak_amplitudes = [float(arr_norm[idx]) for idx in peaks]
    mean_peak_amp = float(np.mean(peak_amplitudes))

    # Rise times: time from preceding trough to peak
    rise_times_ms = []
    for pk in peaks:
        search_start = max(0, pk - int(0.5 * fs))
        trough_idx = int(np.argmin(arr_norm[search_start:pk])) + search_start
        rise_samples = pk - trough_idx
        if rise_samples > 0:
            rise_times_ms.append(rise_samples / fs * 1000.0)

    mean_rise_time = float(np.mean(rise_times_ms)) if rise_times_ms else 150.0

    # Dicrotic notch detection: local minimum between two consecutive peaks
    dicrotic_values = []
    for i in range(len(peaks) - 1):
        pk1 = peaks[i]
        pk2 = peaks[i + 1]
        between = arr_norm[pk1:pk2]
        if len(between) < 3:
            continue
        notch_idx = int(np.argmin(between))
        notch_val = float(between[notch_idx])
        # Notch is valid if it sits between the two peaks in amplitude
        if arr_norm[pk1] * 0.2 < notch_val < arr_norm[pk1] * 0.8:
            dicrotic_values.append(notch_val)

    dicrotic_notch: Optional[float] = (
        round(float(np.mean(dicrotic_values)), 3) if dicrotic_values else None
    )

    # Waveform skewness
    waveform_skewness = float(np.mean([
        _skewness(arr_norm[peaks[i]:peaks[i + 1]].tolist())
        for i in range(len(peaks) - 1)
        if peaks[i + 1] - peaks[i] > 2
    ])) if len(peaks) >= 2 else 0.0

    # Perfusion index: (systolic - diastolic) / systolic * 100
    troughs = []
    for i in range(len(peaks) - 1):
        seg = arr[peaks[i]:peaks[i + 1]]
        troughs.append(float(seg.min()))

    if troughs:
        mean_sys = float(arr_max)
        mean_dia = float(np.mean(troughs))
        perfusion_index = round((mean_sys - mean_dia) / mean_sys * 100.0, 2) if mean_sys > 0 else 3.5
    else:
        perfusion_index = 3.5

    return {
        "peak_amplitude": round(mean_peak_amp, 3),
        "rise_time": round(mean_rise_time, 1),
        "dicrotic_notch": dicrotic_notch,
        "waveform_skewness": round(waveform_skewness, 4),
        "perfusion_index": perfusion_index,
        "normal_ranges": {
            "peak_amplitude": "0.4–0.9 normalised",
            "rise_time": "100–300 ms",
            "dicrotic_notch": "0.2–0.6 normalised (if present)",
            "perfusion_index": "0.02–20 %",
        },
    }


def _ppg_defaults() -> dict:
    return {
        "peak_amplitude": 0.6,
        "rise_time": 150.0,
        "dicrotic_notch": 0.35,
        "waveform_skewness": 0.0,
        "perfusion_index": 3.5,
        "normal_ranges": {},
    }


def _skewness(data: List[float]) -> float:
    """Compute statistical skewness of a segment."""
    if len(data) < 3:
        return 0.0
    try:
        mean = statistics.mean(data)
        std = statistics.stdev(data)
        if std == 0:
            return 0.0
        n = len(data)
        return sum(((x - mean) / std) ** 3 for x in data) * n / ((n - 1) * (n - 2))
    except Exception:
        return 0.0


# ---------------------------------------------------------------------------
# Pulse Transit Time
# ---------------------------------------------------------------------------

def calculate_ptt(
    ecg_signal: List[float],
    ppg_signal: List[float],
    fs: float = DEFAULT_FS,
) -> float:
    """
    Compute Pulse Transit Time — the delay between ECG R-peak and PPG systolic peak.

    PTT is an indirect estimate of arterial blood pressure and vascular compliance.

    Returns:
        Mean PTT in milliseconds.  Returns 250.0 ms (typical resting value) if
        insufficient peaks are detected.
    """
    r_peaks = detect_peaks(ecg_signal, fs=fs, min_distance=0.3)
    p_peaks = detect_peaks(ppg_signal, fs=fs, min_distance=0.3)

    if not r_peaks or not p_peaks:
        return 250.0

    # For each R-peak, find the nearest subsequent PPG peak
    ptts: List[float] = []
    ppg_arr = np.asarray(p_peaks)
    for r_idx in r_peaks:
        # PPG peak must come after R-peak (physiologically correct)
        later = ppg_arr[ppg_arr > r_idx]
        if len(later) == 0:
            continue
        nearest_ppg = int(later[0])
        delay_ms = (nearest_ppg - r_idx) / fs * 1000.0
        # Physiologically plausible PTT: 100–500 ms
        if 100.0 <= delay_ms <= 500.0:
            ptts.append(delay_ms)

    return round(float(np.mean(ptts)), 1) if ptts else 250.0


# ---------------------------------------------------------------------------
# Combined feature extraction
# ---------------------------------------------------------------------------

def extract_all_features(
    ecg_signal: List[float],
    ppg_signal: List[float],
    fs: float = DEFAULT_FS,
) -> dict:
    """
    Extract the complete feature set from ECG and PPG signals for risk prediction.

    Returns:
        {
          ecg:        dict (ECG features),
          ppg:        dict (PPG features),
          ptt:        float,
          heart_rate: float,
          spo2:       float  (estimated — requires calibration for accuracy),
        }
    """
    ecg_features = extract_ecg_features(ecg_signal, fs=fs)
    ppg_features = extract_ppg_features(ppg_signal, fs=fs)
    ptt = calculate_ptt(ecg_signal, ppg_signal, fs=fs)

    # SpO2 estimation from PPG AC/DC ratio (simplified — real calibration needed)
    spo2 = _estimate_spo2(ppg_signal)

    return {
        "ecg": ecg_features,
        "ppg": ppg_features,
        "ptt": ptt,
        "heart_rate": ecg_features.get("heart_rate", 70.0),
        "spo2": spo2,
    }


def _estimate_spo2(ppg_signal: List[float]) -> float:
    """
    Rough SpO2 estimate from single-wavelength PPG (requires two wavelengths for accuracy).
    Returns 98.0 as a safe default when a proper IR/RED ratio is unavailable.
    """
    if not ppg_signal:
        return 98.0
    arr = np.asarray(ppg_signal, dtype=np.float64)
    dc = float(np.mean(arr))
    if dc == 0:
        return 98.0
    ac_rms = float(np.std(arr))
    ratio = ac_rms / dc
    # Empirical curve — for demo mode only
    spo2 = max(90.0, min(100.0, 110.0 - 25.0 * ratio))
    return round(spo2, 1)
