"""
VASCUSCAN AI — Serial Port Reader
Reads ECG/PPG data from ESP32 via USB serial connection.
Provides both real (SerialReader) and simulated (MockSerialReader) interfaces.
"""

import logging
import math
import queue
import random
import threading
import time
from datetime import datetime
from typing import List, Optional

logger = logging.getLogger("vascuscan.serial")


class SerialReader:
    """
    Reads ECG and PPG data from an ESP32 over a serial/USB connection.

    Expected data format from ESP32 (one of):
      - "ECG:0.123,PPG:0.456\\n"
      - JSON: {"ecg": 0.123, "ppg": 0.456}
    """

    def __init__(self, port: str = "/dev/ttyUSB0", baud_rate: int = 115200) -> None:
        self.port = port
        self.baud_rate = baud_rate
        self._serial = None
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self.data_queue: queue.Queue = queue.Queue(maxsize=10_000)

    # ------------------------------------------------------------------
    # Connection management
    # ------------------------------------------------------------------

    def connect(self) -> bool:
        """Open the serial port. Returns True on success."""
        try:
            import serial  # pyserial — only import when actually used
            self._serial = serial.Serial(
                port=self.port,
                baudrate=self.baud_rate,
                timeout=1,
            )
            logger.info("Serial port %s opened at %d baud", self.port, self.baud_rate)
            return True
        except Exception as exc:
            logger.error("Failed to open serial port %s: %s", self.port, exc)
            return False

    def disconnect(self) -> None:
        """Close the serial port gracefully."""
        if self._serial and self._serial.is_open:
            self._serial.close()
            logger.info("Serial port %s closed", self.port)

    # ------------------------------------------------------------------
    # Data reading
    # ------------------------------------------------------------------

    def _parse_line(self, raw: str) -> Optional[dict]:
        """
        Parse a single line from the serial port.
        Supports: "ECG:0.123,PPG:0.456" and JSON {"ecg": ..., "ppg": ...}.
        Returns dict with {ecg, ppg, timestamp} or None if unparseable.
        """
        raw = raw.strip()
        if not raw:
            return None

        # Try JSON first
        if raw.startswith("{"):
            try:
                import json
                d = json.loads(raw)
                return {
                    "ecg": float(d.get("ecg", 0)),
                    "ppg": float(d.get("ppg", 0)),
                    "timestamp": datetime.utcnow().isoformat(),
                }
            except Exception:
                pass

        # Try "ECG:val,PPG:val" format
        try:
            parts = {k: float(v) for k, v in (p.split(":") for p in raw.split(","))}
            ecg_key = next((k for k in parts if "ecg" in k.lower()), None)
            ppg_key = next((k for k in parts if "ppg" in k.lower()), None)
            if ecg_key and ppg_key:
                return {
                    "ecg": parts[ecg_key],
                    "ppg": parts[ppg_key],
                    "timestamp": datetime.utcnow().isoformat(),
                }
        except Exception:
            pass

        logger.debug("Unrecognised serial line: %r", raw)
        return None

    def read_loop(self) -> None:
        """Continuous blocking read loop — runs in background thread."""
        while not self._stop_event.is_set():
            if not self._serial or not self._serial.is_open:
                time.sleep(0.1)
                continue
            try:
                raw_bytes = self._serial.readline()
                if raw_bytes:
                    line = raw_bytes.decode("utf-8", errors="replace")
                    sample = self._parse_line(line)
                    if sample:
                        try:
                            self.data_queue.put_nowait(sample)
                        except queue.Full:
                            # Drop oldest sample to make room
                            try:
                                self.data_queue.get_nowait()
                            except queue.Empty:
                                pass
                            self.data_queue.put_nowait(sample)
            except Exception as exc:
                logger.warning("Serial read error: %s", exc)
                time.sleep(0.05)

    # ------------------------------------------------------------------
    # Thread control
    # ------------------------------------------------------------------

    def start(self) -> bool:
        """Connect and start the read thread. Returns True if connected."""
        ok = self.connect()
        if not ok:
            return False
        self._stop_event.clear()
        self._thread = threading.Thread(target=self.read_loop, daemon=True, name="SerialReader")
        self._thread.start()
        logger.info("SerialReader thread started")
        return True

    def stop(self) -> None:
        """Signal stop and join the read thread."""
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.0)
        self.disconnect()
        logger.info("SerialReader stopped")

    # ------------------------------------------------------------------
    # Data access
    # ------------------------------------------------------------------

    def get_data(self) -> List[dict]:
        """Drain and return all queued samples as a list."""
        samples: List[dict] = []
        while True:
            try:
                samples.append(self.data_queue.get_nowait())
            except queue.Empty:
                break
        return samples

    def is_connected(self) -> bool:
        """Return True if the serial port is open."""
        return bool(self._serial and self._serial.is_open)


# ---------------------------------------------------------------------------
# Mock / Simulated Reader
# ---------------------------------------------------------------------------

class MockSerialReader:
    """
    Simulates ESP32 ECG/PPG output when no hardware is connected.
    Generates realistic cardiac waveforms using trigonometric synthesis.
    Shares the same interface as SerialReader.
    """

    def __init__(
        self,
        port: str = "MOCK",
        baud_rate: int = 115200,
        sample_rate: int = 250,
        heart_rate_bpm: float = 72.0,
    ) -> None:
        self.port = port
        self.baud_rate = baud_rate
        self.sample_rate = sample_rate
        self.heart_rate_bpm = heart_rate_bpm

        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self.data_queue: queue.Queue = queue.Queue(maxsize=10_000)
        self._t = 0.0  # running time counter

    # ------------------------------------------------------------------
    # Waveform generation
    # ------------------------------------------------------------------

    def _ecg_sample(self, t: float) -> float:
        """
        Synthesise a simplified ECG sample at time t (seconds).
        Produces a baseline with a sharp R-peak every ~1/HR seconds.
        """
        period = 60.0 / self.heart_rate_bpm
        phase = t % period
        # P wave
        p = 0.15 * math.exp(-((phase - 0.15) ** 2) / 0.002)
        # QRS complex
        r = 1.0 * math.exp(-((phase - 0.35) ** 2) / 0.0003)
        q = -0.15 * math.exp(-((phase - 0.30) ** 2) / 0.0008)
        s = -0.20 * math.exp(-((phase - 0.40) ** 2) / 0.0008)
        # T wave
        tw = 0.35 * math.exp(-((phase - 0.55) ** 2) / 0.006)
        noise = random.gauss(0, 0.02)
        return p + q + r + s + tw + noise

    def _ppg_sample(self, t: float) -> float:
        """Synthesise a simplified PPG sample at time t (seconds)."""
        period = 60.0 / self.heart_rate_bpm
        phase = t % period
        # Systolic peak with a dicrotic notch
        systolic = 0.9 * math.exp(-((phase - 0.25) ** 2) / 0.004)
        dicrotic = 0.3 * math.exp(-((phase - 0.45) ** 2) / 0.003)
        baseline = 0.1 * math.sin(2 * math.pi * 0.15 * t)  # slow respiration
        noise = random.gauss(0, 0.01)
        return 0.2 + systolic + dicrotic + baseline + noise

    # ------------------------------------------------------------------
    # Read loop
    # ------------------------------------------------------------------

    def _read_loop(self) -> None:
        interval = 1.0 / self.sample_rate
        while not self._stop_event.is_set():
            sample = {
                "ecg": round(self._ecg_sample(self._t), 5),
                "ppg": round(self._ppg_sample(self._t), 5),
                "timestamp": datetime.utcnow().isoformat(),
            }
            try:
                self.data_queue.put_nowait(sample)
            except queue.Full:
                try:
                    self.data_queue.get_nowait()
                except queue.Empty:
                    pass
                self.data_queue.put_nowait(sample)

            self._t += interval
            time.sleep(interval)

    # ------------------------------------------------------------------
    # Thread control (same interface as SerialReader)
    # ------------------------------------------------------------------

    def connect(self) -> bool:
        logger.info("MockSerialReader: simulating sensor at %d Hz", self.sample_rate)
        return True

    def disconnect(self) -> None:
        pass

    def start(self) -> bool:
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._read_loop, daemon=True, name="MockSerial")
        self._thread.start()
        logger.info("MockSerialReader started (%d Hz, %d BPM)", self.sample_rate, int(self.heart_rate_bpm))
        return True

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.0)
        logger.info("MockSerialReader stopped")

    def get_data(self) -> List[dict]:
        samples: List[dict] = []
        while True:
            try:
                samples.append(self.data_queue.get_nowait())
            except queue.Empty:
                break
        return samples

    def is_connected(self) -> bool:
        return not self._stop_event.is_set()


# ---------------------------------------------------------------------------
# Standalone demo
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="VASCUSCAN serial reader demo")
    parser.add_argument("--port", default="MOCK", help="Serial port or MOCK")
    parser.add_argument("--baud", type=int, default=115200)
    parser.add_argument("--duration", type=int, default=5, help="Seconds to run")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)

    reader: SerialReader | MockSerialReader
    if args.port == "MOCK":
        reader = MockSerialReader()
    else:
        reader = SerialReader(port=args.port, baud_rate=args.baud)

    reader.start()
    print(f"Reading from {args.port} for {args.duration} seconds …")

    start = time.time()
    count = 0
    while time.time() - start < args.duration:
        samples = reader.get_data()
        for s in samples:
            count += 1
            if count % 50 == 0:
                print(f"  ECG={s['ecg']:.4f}  PPG={s['ppg']:.4f}  @ {s['timestamp']}")
        time.sleep(0.1)

    reader.stop()
    print(f"Done. Received {count} samples in {args.duration}s.")
