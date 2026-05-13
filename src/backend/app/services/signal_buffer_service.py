from collections import deque
from typing import List, Dict
import threading

class SignalBufferService:
    """
    Manages thread-safe windowed buffers for ECG and PPG waveforms.
    Provides methods to append and retrieve slices for feature extraction.
    """
    def __init__(self, max_samples: int = 1000):
        self.ecg_buffer = deque(maxlen=max_samples)
        self.ppg_buffer = deque(maxlen=max_samples)
        self._lock = threading.Lock()

    def append_ecg(self, samples: List[float]):
        with self._lock:
            for s in samples:
                self.ecg_buffer.append(s)

    def append_ppg(self, samples: List[float]):
        with self._lock:
            for s in samples:
                self.ppg_buffer.append(s)

    def get_ecg_window(self, n: int = 500) -> List[float]:
        with self._lock:
            return list(self.ecg_buffer)[-n:] if len(self.ecg_buffer) >= n else list(self.ecg_buffer)

    def get_ppg_window(self, n: int = 500) -> List[float]:
        with self._lock:
            return list(self.ppg_buffer)[-n:] if len(self.ppg_buffer) >= n else list(self.ppg_buffer)

    def clear(self):
        with self._lock:
            self.ecg_buffer.clear()
            self.ppg_buffer.clear()

# Singleton instance for the application
signal_buffer = SignalBufferService(max_samples=2000)
