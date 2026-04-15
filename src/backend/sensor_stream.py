import threading
import time
import serial
import numpy as np
import random
from scipy.signal import butter, filtfilt, find_peaks

class SensorStreamer:
    def __init__(self, port='COM3', baudrate=115200, fs=100, on_waveform=None, on_features=None):
        self.port = port
        self.baudrate = baudrate
        self.fs = fs
        
        self.on_waveform = on_waveform
        self.on_features = on_features
        
        self.running = False
        self.thread = None
        
        self.ecg_buffer = []
        self.ppg_buffer = []
        self.buffer_size = 200 # 2 seconds at 100Hz
        
        self.filter_cutoff = 100.0 # From 0 to 100% (where 100% means heavy filtering cutoff=5Hz)
        self.filter_enabled = False
        
        self.ecg_connected = False
        self.ppg_connected = False
        self._is_simulated = False

    def set_filter_level(self, level):
        """Level from 0 to 100"""
        self.filter_cutoff = float(level)
        self.filter_enabled = self.filter_cutoff > 0

    def lowpass_filter(self, data):
        if not self.filter_enabled:
            return data
            
        try:
            if len(data) <= 15:
                return data
            
            # Map 0-100 slider:
            # 100% -> cutoff = 0.5Hz (very aggresive smoothing/flattening)
            # 0%   -> cutoff = 25Hz (no filtering essentially)
            if self.filter_cutoff >= 100.0:
                # Force near-flat signal by using extremely low cutoff
                cutoff = 0.2 
            else:
                # Mapping 0-100slider to a cutoff freq (100% slider = 2Hz strict cutoff, 1% slider = 25Hz mild cutoff)
                # Improved: Using a steeper curve for better noise rejection
                cutoff = max(1.0, 30.0 - (self.filter_cutoff / 100.0 * 29.0))
            
            b, a = butter(2, cutoff / (0.5 * self.fs), btype='low')
            filtered = filtfilt(b, a, data)
            # Second stage: high-frequency rejection
            b2, a2 = butter(2, 45.0 / (0.5 * self.fs), btype='low')
            return filtfilt(b2, a2, filtered).tolist()
        except Exception:
            return data

    def extract_features(self, ecg, ppg):
        try:
            # find peaks strictly if connected
            ecg_peaks, _ = find_peaks(ecg, distance=40) if self.ecg_connected else ([], [])
            ppg_peaks, _ = find_peaks(ppg, distance=40) if self.ppg_connected else ([], [])
            
            hrv = np.std(np.diff(ecg_peaks)) if len(ecg_peaks) > 1 else 0
            ptt = abs(ppg_peaks[0] - ecg_peaks[0]) / 100 if (len(ecg_peaks) > 0 and len(ppg_peaks) > 0) else 0
            
            hr = 0
            if len(ecg_peaks) > 3:
                # mean rr interval in seconds over last few peaks
                rr_intervals = np.diff(ecg_peaks) / self.fs
                # Filter outliers
                valid_rr = rr_intervals[(rr_intervals > 0.4) & (rr_intervals < 1.5)]
                if len(valid_rr) > 0:
                    hr = int(60.0 / np.mean(valid_rr))
            elif len(ppg_peaks) > 3:
                rr_intervals = np.diff(ppg_peaks) / self.fs
                valid_rr = rr_intervals[(rr_intervals > 0.4) & (rr_intervals < 1.5)]
                if len(valid_rr) > 0:
                    hr = int(60.0 / np.mean(valid_rr))
            
            return {"ecg_hrv": float(hrv), "ptt": float(ptt), "hr": hr}
        except Exception:
            return {"ecg_hrv": 0, "ptt": 0, "hr": 0}

    def start(self):
        self.running = True
        self.thread = threading.Thread(target=self._run_loop, daemon=True)
        self.thread.start()

    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join(timeout=2.0)

    @property
    def is_simulated(self):
        return self._is_simulated

    def _run_loop(self):
        print(f"Attempting to connect to ESP32 on {self.port}...")
        try:
            ser = serial.Serial(self.port, self.baudrate, timeout=1)
            print("Successfully connected to ESP32 Serial!")
            self._is_simulated = False
        except Exception as e:
            print(f"Warning: Could not open {self.port}. Starting in SIMULATION mode. Error: {e}")
            ser = None
            self._is_simulated = True

        feature_counter = 0

        # Math helpers for simulation
        t = 0
        dt = 1.0 / self.fs
        
        while self.running:
            ecg_val, ppg_val = 0, 0
            
            if not self._is_simulated and ser is not None:
                try:
                    line = ser.readline().decode().strip()
                    if line:
                        parts = line.split(",")
                        if len(parts) == 2:
                            raw_e, raw_p = parts[0].strip(), parts[1].strip()
                            # interpret -1, null, or empty as disconnected
                            if not raw_e or raw_e == '-1' or raw_e == 'null':
                                self.ecg_connected = False
                                ecg_val = 0
                            else:
                                self.ecg_connected = True
                                ecg_val = float(raw_e)
                                
                            if not raw_p or raw_p == '-1' or raw_p == 'null':
                                self.ppg_connected = False
                                ppg_val = 0
                            else:
                                self.ppg_connected = True
                                ppg_val = float(raw_p)
                except Exception as e:
                    print(f"Serial connection lost: {e}. Switching to simulation mode.")
                    self._is_simulated = True
                    ser = None
                    time.sleep(1)
                    continue
            else:
                # SIMULATION MODE - Sensors are OFFLINE for hardware status
                self.ecg_connected = False
                self.ppg_connected = False
                
                # Base frequency: ~1.20Hz (72 BPM)
                # Phase 3: Higher medical-grade pulse variation (±8% jitter)
                base_freq = 1.20
                jitter = 0.10 * np.sin(2 * np.pi * 0.25 * t) + np.random.normal(0, 0.02)
                freq = base_freq + jitter
                
                # Smooth rounded medical morphology (200Hz)
                t += dt
                
                # Primary Oscillation
                primary = np.sin(2 * np.pi * freq * t)
                
                # Baseline Drift (Slow)
                wander = 0.03 * np.sin(2 * np.pi * 0.12 * t)
                
                # ── Pulse Transit Time Variation ─────────────────────────────
                # Base PTT ~0.22s, fluctuates with respiratory rate (freq * 0.2)
                ptt_jitter = 0.015 * np.sin(2 * np.pi * freq * 0.2 * t)
                ptt_val = 0.22 + ptt_jitter
                
                # PPG simulation (offset by PTT)
                ppg_t = t - ptt_val
                
                # PPG-like rounded shape using tanh for saturation
                # ECG in this style is often just a sharper pulsatile wave or 
                # a harmonic-rich sine. We use the user's provided harmonic structure.
                
                # ECG simulation
                ecg_h = 0.08 * np.sin(2 * np.pi * freq * t * 6)
                ecg_val = np.tanh(primary + ecg_h * 0.6) + wander
                ecg_val += np.random.normal(0, 0.03) # Subtle realism noise

                # PPG simulation
                ppg_h = 0.25 * np.sin(2 * np.pi * freq * ppg_t * 2 - 0.6)
                ppg_val = np.tanh(primary + ppg_h) + wander * 0.5
                ppg_val += np.random.normal(0, 0.015)
                
                # Normalize and scale
                ecg_val = ecg_val * 0.6
                ppg_val = ppg_val * 0.8

                time.sleep(dt)

            # Accumulate buffers
            self.ecg_buffer.append(ecg_val)
            self.ppg_buffer.append(ppg_val)

            if len(self.ecg_buffer) > self.buffer_size:
                self.ecg_buffer.pop(0)
                self.ppg_buffer.pop(0)

            # Optional: Emit every point immediately for waveforms (if enabled)
            if self.on_waveform:
                # We emit chunks of 5 points at a time to not overwhelm websocket
                if len(self.ecg_buffer) % 5 == 0:
                    status = {
                        'ecg': 'CONNECTED' if self.ecg_connected else 'OFFLINE',
                        'ppg': 'CONNECTED' if self.ppg_connected else 'OFFLINE',
                        'simulated': self._is_simulated
                    }
                    self.on_waveform(
                        self.ecg_buffer[-5:],
                        self.ppg_buffer[-5:],
                        self._is_simulated,
                        status
                    )

            # Analyze for features every 100 samples (1 second)
            feature_counter += 1
            if feature_counter >= 100 and len(self.ecg_buffer) == self.buffer_size:
                # 1. Filter
                f_ecg = self.lowpass_filter(self.ecg_buffer)
                f_ppg = self.lowpass_filter(self.ppg_buffer)
                
                # 2. Extract Features
                feats = self.extract_features(f_ecg, f_ppg)
                
                # 3. Callback
                if self.on_features:
                    # Cast to float for JSON serializability
                    self.on_features({
                        "ecg_hrv": float(feats.get("ecg_hrv", 0)),
                        "ptt": float(feats.get("ptt", 0)),
                        "hr": int(feats.get("hr", 0))
                    })
                    
                feature_counter = 0

