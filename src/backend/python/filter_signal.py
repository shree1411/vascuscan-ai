"""
VASCUSCAN AI — Signal Filtering
Low-pass Butterworth filter and noise removal pipeline for ECG/PPG signals.
"""

import logging
from typing import List

import numpy as np
from scipy import signal as sp_signal

logger = logging.getLogger("vascuscan.filter")


# ---------------------------------------------------------------------------
# Core filter primitives
# ---------------------------------------------------------------------------

def butter_lowpass_filter(
    data: List[float],
    cutoff: float,
    fs: float = 250.0,
    order: int = 4,
) -> List[float]:
    """
    Apply a zero-phase Butterworth low-pass filter.

    Args:
        data:   Input signal samples.
        cutoff: Filter cutoff frequency in Hz.
                Typical values: 40 Hz for ECG, 10 Hz for PPG.
        fs:     Sampling frequency in Hz (default 250 Hz).
        order:  Filter order (higher = sharper roll-off, default 4).

    Returns:
        Filtered signal as a list of floats.
    """
    if len(data) < (order * 3 + 1):
        # Not enough samples to filter — return as-is
        return data

    nyquist = 0.5 * fs
    normal_cutoff = min(cutoff / nyquist, 0.99)  # must be < 1
    b, a = sp_signal.butter(order, normal_cutoff, btype="low", analog=False)
    filtered = sp_signal.filtfilt(b, a, np.asarray(data, dtype=np.float64))
    return filtered.tolist()


def baseline_wander_removal(signal_data: List[float], fs: float = 250.0) -> List[float]:
    """
    Remove slow baseline drift via a high-pass filter at 0.5 Hz.

    Args:
        signal_data: Raw input signal.
        fs:          Sampling frequency in Hz.

    Returns:
        Detrended signal as a list of floats.
    """
    if len(signal_data) < 20:
        return signal_data

    nyquist = 0.5 * fs
    cutoff = 0.5 / nyquist
    b, a = sp_signal.butter(2, cutoff, btype="high", analog=False)
    detrended = sp_signal.filtfilt(b, a, np.asarray(signal_data, dtype=np.float64))
    return detrended.tolist()


def notch_filter(signal_data: List[float], freq: float = 50.0, fs: float = 250.0) -> List[float]:
    """
    Remove power-line interference (50 Hz or 60 Hz) using an IIR notch filter.

    Args:
        signal_data: Input signal.
        freq:        Notch frequency in Hz (50 Hz EU / 60 Hz US).
        fs:          Sampling frequency in Hz.

    Returns:
        Signal with notch frequency attenuated.
    """
    if len(signal_data) < 10:
        return signal_data

    w0 = freq / (0.5 * fs)
    if w0 >= 1.0:
        logger.warning("Notch frequency %g Hz exceeds Nyquist — skipping", freq)
        return signal_data

    b, a = sp_signal.iirnotch(w0, Q=30)
    filtered = sp_signal.filtfilt(b, a, np.asarray(signal_data, dtype=np.float64))
    return filtered.tolist()


# ---------------------------------------------------------------------------
# High-level noise filter
# ---------------------------------------------------------------------------

def apply_noise_filter(
    ecg_data: List[float],
    ppg_data: List[float],
    noise_intensity: float = 1.0,
    filter_strength: float = 0.5,
) -> dict:
    """
    Apply adaptive noise filtering to ECG and PPG signals.

    This is the main entry point called by the API and WebSocket handler.

    Args:
        ecg_data:        Raw ECG samples from sensor.
        ppg_data:        Raw PPG samples from sensor.
        noise_intensity: 0.0 → perfectly clean (return smooth baseline only).
                         1.0 → raw signal, no noise reduction.
                         Values in between interpolate filter aggressiveness.
        filter_strength: Additional filter strength knob (0–1).
                         0 = minimal filtering, 1 = maximum filtering.

    Returns:
        {
            "ecg_filtered":   List[float],
            "ppg_filtered":   List[float],
            "filter_applied": bool,
        }
    """
    noise_intensity = float(np.clip(noise_intensity, 0.0, 1.0))
    filter_strength = float(np.clip(filter_strength, 0.0, 1.0))

    # ---- Perfect clean signal (noise_intensity == 0) --------------------
    if noise_intensity == 0.0:
        ecg_clean = _smooth_baseline(ecg_data)
        ppg_clean = _smooth_baseline(ppg_data)
        return {
            "ecg_filtered": ecg_clean,
            "ppg_filtered": ppg_clean,
            "filter_applied": True,
        }

    if not ecg_data and not ppg_data:
        return {"ecg_filtered": [], "ppg_filtered": [], "filter_applied": False}

    # ---- Adaptive cutoff based on noise_intensity -----------------------
    # Lower noise_intensity → lower cutoff → more aggressive filtering
    ecg_cutoff = 5.0 + (40.0 - 5.0) * noise_intensity          # 5–40 Hz
    ppg_cutoff = 2.0 + (10.0 - 2.0) * noise_intensity           # 2–10 Hz

    # filter_strength further reduces the cutoff
    ecg_cutoff *= (1.0 - 0.4 * filter_strength)
    ppg_cutoff *= (1.0 - 0.4 * filter_strength)

    ecg_out = list(ecg_data)
    ppg_out = list(ppg_data)

    # ECG pipeline: baseline wander → notch → low-pass
    if len(ecg_out) > 10:
        ecg_out = baseline_wander_removal(ecg_out)
        ecg_out = notch_filter(ecg_out, freq=50.0)
        ecg_out = butter_lowpass_filter(ecg_out, cutoff=ecg_cutoff)

    # PPG pipeline: low-pass only (baseline wander matters less for PPG)
    if len(ppg_out) > 10:
        ppg_out = butter_lowpass_filter(ppg_out, cutoff=ppg_cutoff)

    return {
        "ecg_filtered": ecg_out,
        "ppg_filtered": ppg_out,
        "filter_applied": True,
    }


def _smooth_baseline(data: List[float]) -> List[float]:
    """
    Return the very smooth trend of a signal (near-DC component).
    Used when noise_intensity == 0 to produce a perfectly flat/clean output.
    """
    if not data:
        return []
    arr = np.asarray(data, dtype=np.float64)
    # Use a wide moving average to extract only the slow baseline
    window = max(len(arr) // 4, 3)
    kernel = np.ones(window) / window
    if len(arr) >= window:
        smoothed = np.convolve(arr, kernel, mode="same")
    else:
        smoothed = np.full_like(arr, np.mean(arr))
    return smoothed.tolist()
