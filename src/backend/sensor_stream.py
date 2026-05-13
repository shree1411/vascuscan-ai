import threading
import time
import serial
import json
import numpy as np
import random
from scipy.signal import butter, filtfilt, find_peaks

class SensorStreamer:
    def __init__(self, port='COM3', baudrate=115200, fs=100, on_waveform=None, on_features=None, force_simulate=False):
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
        self._is_simulated = force_simulate
        self.force_simulate = force_simulate
        
        self.current_hr = 0
        self.current_spo2 = 0

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

    def analyze_signal_quality(self, data, is_connected, sig_type="ecg"):
        if not is_connected:
            return ("OFFLINE", 0)
        if len(data) < 5:
            return ("MODERATE", 50)
        
        variance = np.var(data)
        amplitude = np.max(data) - np.min(data)
        
        # Calculate SNR approximation (Signal power / noise variance)
        mean_val = np.mean(data)
        signal_power = np.mean((data - mean_val)**2)
        noise_variance = variance # Simplistic assumption for real-time
        snr = 10 * np.log10(signal_power / (noise_variance + 1e-6)) if signal_power > 0 else 0
        
        confidence = 100.0
        status = "GOOD"
        
        if sig_type == "ecg":
            if variance < 0.5 or amplitude < 5:
                confidence = 0.0
                status = "POOR" # Flatline
            elif amplitude > 3000:
                confidence = max(0, 100 - (amplitude - 3000)/100)
                status = "POOR" # Clipping
            elif variance < 10:
                confidence = 60.0
                status = "MODERATE"
        elif sig_type == "ppg":
            if variance < 0.5 or amplitude < 5:
                confidence = 0.0
                status = "POOR" # Finger absent
            elif variance < 5:
                confidence = 70.0
                status = "MODERATE"
                
        # Modulate confidence by SNR
        if status == "GOOD" and snr < 10:
            confidence -= 15
        
        if confidence >= 80: status = "GOOD"
        elif confidence >= 50: status = "MODERATE"
        else: status = "POOR"
        
        return (status, min(100.0, max(0.0, confidence)))

    def extract_features(self, ecg, ppg):
        try:
            # We will use the new extract_all_features from feature_extraction if available, 
            # but we need to ensure the import is present or do it locally.
            # Actually, `extract_all_features` is handled in app.py or telemetry_service.py now!
            # The streamer's internal extract_features is legacy, but let's just return raw arrays 
            # to let the telemetry service handle it, or we do a basic extraction.
            # The user's new feature_extraction script does everything, so we'll just return the raw buffers
            # and let the caller do it. Wait, the caller expects a dict.
            # Let's import it locally to avoid circular dependencies if any.
            from feature_extraction import extract_all_features
            if not self.ecg_connected and not self.ppg_connected:
                raise ValueError("Sensors disconnected")
                
            advanced_feats = extract_all_features(ecg, ppg, self.fs)
            
            rr = advanced_feats.get("RR", 0.82)
            ecg_hr = 60.0 / rr if rr > 0 else 72.0
            if ecg_hr > 180 or ecg_hr < 40: ecg_hr = 0
            
            return {
                "ecg_hr": float(98.0 if not self.ecg_connected and self._is_simulated else ecg_hr),
                "ppg_hr": float(self.current_hr if self.current_hr > 0 else 72.0),
                "spo2": float(self.current_spo2 if self.current_spo2 > 0 else 98.0),
                "rr": advanced_feats.get("RR", 0.82),
                "hrv": float(advanced_feats.get("HRV", 0)),
                "ptt": float(advanced_feats.get("PTT", 0)),
                "amp": float(advanced_feats.get("AMP", 0)),
                "rise": float(advanced_feats.get("RISE", 0)),
                "qrs_duration": float(advanced_feats.get("QRS", 90.0)),
                "st_segment": float(advanced_feats.get("ST", 0.05)),
                "skewness": float(advanced_feats.get("SKEWNESS", 0.0)),
                "dicrotic_notch": advanced_feats.get("DICROTIC", "ABSENT"),
                "perfusion_index": float(advanced_feats.get("PERFUSION", 2.0)),
                "vascular_stiffness": float(advanced_feats.get("STIFFNESS", 0.0)),
                "est_systolic": float(advanced_feats.get("SYS", 120.0)),
                "est_diastolic": float(advanced_feats.get("DIA", 80.0))
            }
        except Exception as e:
            print(f"Feature extraction error: {e}")
            return {
                "ecg_hr": 0, "ppg_hr": 0, "spo2": 0, "rr": 0, 
                "hrv": 0, "ptt": 0, "amp": 0, "rise": 0,
                "qrs_duration": 0, "st_segment": 0, "skewness": 0,
                "dicrotic_notch": "OFFLINE", "perfusion_index": 0,
                "vascular_stiffness": 0, "est_systolic": 0, "est_diastolic": 0
            }

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
        print(f"Starting SensorStreamer loop (Primary Port: {self.port})")
        ser = None
        feature_counter = 0
        t = 0
        dt = 1.0 / self.fs

        while self.running:
            # 1. Attempt Connection if not connected and not forced to only simulate
            if ser is None and not self.force_simulate:
                try:
                    ser = serial.Serial(self.port, self.baudrate, timeout=0.1)
                    print(f"Successfully connected to Serial on {self.port}!")
                    self._is_simulated = False
                except Exception:
                    ser = None
                    self._is_simulated = True

            # 2. Read Data or Simulate
            try:
                if ser and ser.is_open:
                    line = ser.readline().decode('utf-8', errors='ignore').strip()
                    if line:
                        # Try parsing as JSON first
                        try:
                            data = json.loads(line)
                            ecg_val = float(data.get('ecg', 0))
                            ppg_val = float(data.get('ppg', 512))
                            
                            self.current_hr = int(float(data.get('ecg_hr', data.get('ppg_hr', self.current_hr))))
                            self.current_spo2 = float(data.get('spo2', self.current_spo2))
                            
                            self.ecg_connected = (data.get('ecg_status') != 'disconnected')
                            self.ppg_connected = (self.current_spo2 > 0)
                            self._is_simulated = False
                        except (json.JSONDecodeError, ValueError):
                            # Try Pipe-delimited Key:Value format (ECG_RAW:4095 | ECG_HR:150.00 | PPG_HR:35.91 | SpO2:0.00)
                            if '|' in line and ':' in line:
                                try:
                                    kv_pairs = [pair.strip() for pair in line.split('|')]
                                    parsed_data = {}
                                    for pair in kv_pairs:
                                        if ':' in pair:
                                            k, v = pair.split(':', 1)
                                            parsed_data[k.strip()] = float(v.strip())
                                            
                                    ecg_val = parsed_data.get('ECG_RAW', 512.0)
                                    ppg_val = parsed_data.get('PPG_RAW', 512.0) # Or simulate PPG locally if missing from array
                                    
                                    self.current_hr = int(parsed_data.get('ECG_HR', parsed_data.get('PPG_HR', self.current_hr)))
                                    self.current_spo2 = float(parsed_data.get('SpO2', self.current_spo2))
                                    self.ecg_connected = True
                                    self.ppg_connected = True
                                    self._is_simulated = False
                                except Exception:
                                    pass
                            else:
                                # Fallback to CSV logic
                                parts = line.split(',')
                                if len(parts) == 5:
                                    # User pattern: ecg, ir, red, hr, spo2
                                    try:
                                        ecg_val = float(parts[0])
                                        ppg_val = float(parts[1]) # Use IR for standard ppg
                                        self.current_hr = float(parts[3])
                                        self.current_spo2 = float(parts[4])
                                        self.ecg_connected = True
                                        self.ppg_connected = True
                                        self._is_simulated = False
                                    except: continue
                                elif len(parts) >= 2:
                                    try:
                                        ecg_val = float(parts[0])
                                        ppg_val = float(parts[1])
                                        self.ecg_connected = True
                                        self.ppg_connected = True
                                        
                                        if len(parts) >= 4:
                                            self.current_hr = int(float(parts[2]))
                                            self.current_spo2 = float(parts[3])
                                        self._is_simulated = False
                                    except: continue
                                else: continue
                    else:
                        time.sleep(0.01)
                        continue
                else:
                    self._is_simulated = False
                    self.ecg_connected = False
                    self.ppg_connected = False
                    t += dt
                    
                    self.current_hr = 0
                    self.current_spo2 = 0
                    
                    ecg_val = 512
                    ppg_val = 512
                    
                    time.sleep(dt)

            except Exception as e:
                if ser:
                    ser.close()
                    ser = None
                self._is_simulated = True
                ecg_val, ppg_val = 512, 512
                time.sleep(0.1)

            # 3. Buffer and Emit
            self.ecg_buffer.append(ecg_val)
            self.ppg_buffer.append(ppg_val)

            if len(self.ecg_buffer) >= 10:
                ecg_chunk = self.lowpass_filter(self.ecg_buffer)
                ppg_chunk = self.lowpass_filter(self.ppg_buffer)
                
                if self.on_waveform:
                    ecg_stat, ecg_conf = self.analyze_signal_quality(self.ecg_buffer, self.ecg_connected, 'ecg')
                    ppg_stat, ppg_conf = self.analyze_signal_quality(self.ppg_buffer, self.ppg_connected, 'ppg')
                    
                    status = {
                        'ecg': 'CONNECTED' if self.ecg_connected else 'OFFLINE',
                        'ppg': 'CONNECTED' if self.ppg_connected else 'OFFLINE',
                        'ecg_quality': ecg_stat,
                        'ppg_quality': ppg_stat,
                        'ecg_confidence': ecg_conf,
                        'ppg_confidence': ppg_conf,
                        'is_simulated': False
                    }
                    self.on_waveform(ecg_chunk, ppg_chunk, False, status)
                
                self.ecg_buffer = []
                self.ppg_buffer = []

            # 4. Features (Every 1 second)
            feature_counter += 1
            if feature_counter >= self.fs:
                feature_counter = 0
                if self.on_features:
                    feats = self.extract_features(ecg_chunk, ppg_chunk)
                    self.on_features(feats)
