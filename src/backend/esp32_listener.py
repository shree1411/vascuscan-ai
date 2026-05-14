import serial
import serial.tools.list_ports
import json
import time
import threading
import sys

# ==============================================================================
# VASCUSCAN AI - BIOMEDICAL SERIAL LISTENER
# ==============================================================================
# Real-time serial listener for ESP32 hardware. Parses high-frequency JSON
# telemetry containing ECG and PPG signals, tracks connection states, and
# acts as the primary hardware bridge for future FastAPI WebSocket integration.
# ==============================================================================

class SensorState:
    """Global real-time sensor state object."""
    def __init__(self):
        self.ecg_connected = False
        self.ppg_connected = False
        self.finger_detected = False
        self.ecg = 0
        self.ppg = 0
        self.ir = 0
        self.timestamp = 0
        
        # Track previous states to avoid spamming logs (trigger-on-change)
        self._prev_ecg_connected = False
        self._prev_ppg_connected = False
        self._prev_finger_detected = False

    def update(self, data: dict):
        """Update state with parsed JSON data and trigger state change logs."""
        self.ecg_connected = data.get("ecg_connected", False)
        self.ppg_connected = data.get("ppg_connected", False)
        self.finger_detected = data.get("finger_detected", False)
        self.ecg = data.get("ecg", 0)
        self.ppg = data.get("ppg", 0)
        self.ir = data.get("ir", 0)
        self.timestamp = data.get("timestamp", 0)
        
        self._check_state_changes()

    def _check_state_changes(self):
        """Print clear logs only on critical clinical state transitions."""
        if self.ecg_connected != self._prev_ecg_connected:
            print("\n[ECG ONLINE]" if self.ecg_connected else "\n[ECG OFFLINE]")
            self._prev_ecg_connected = self.ecg_connected
            
        if self.ppg_connected != self._prev_ppg_connected:
            print("\n[PPG ONLINE]" if self.ppg_connected else "\n[PPG OFFLINE]")
            self._prev_ppg_connected = self.ppg_connected
            
        if self.finger_detected != self._prev_finger_detected:
            print("\n[FINGER DETECTED]" if self.finger_detected else "\n[FINGER REMOVED]")
            self._prev_finger_detected = self.finger_detected

# 6. Global Real-Time Sensor State Object
global_sensor_state = SensorState()

class ESP32Listener:
    def __init__(self, baudrate=115200):
        # 2. Serial settings
        self.baudrate = baudrate
        self.serial_port = None
        self.running = False
        self.thread = None

    def find_serial_port(self):
        """Auto-detect the ESP32 COM/tty port across different OS environments."""
        ports = serial.tools.list_ports.comports()
        for port in ports:
            # Match common ESP32 USB-to-UART bridge identifiers
            if "CP210" in port.description or "CH340" in port.description or "tty.usb" in port.device:
                return port.device
        
        # MacOS strict fallback
        if sys.platform == "darwin":
            import glob
            usb_ports = glob.glob("/dev/tty.usbserial*") + glob.glob("/dev/tty.usbmodem*")
            if usb_ports:
                return usb_ports[0]
                
        # Windows fallback (Just grab the first active port if ambiguous)
        if ports:
            return ports[0].device
            
        return None

    def connect(self):
        """Attempt to connect to the ESP32 over serial."""
        port_name = self.find_serial_port()
        if not port_name:
            print("[SYSTEM] No ESP32 biomedical device found. Waiting...")
            return False

        try:
            self.serial_port = serial.Serial(port_name, self.baudrate, timeout=1)
            print(f"[SYSTEM] Hardware Connected: ESP32 on {port_name} at {self.baudrate} baud.")
            return True
        except serial.SerialException as e:
            print(f"[ERROR] Failed to establish physical connection: {e}")
            return False

    def read_loop(self):
        """Background thread executing the real-time telemetry ingestion."""
        while self.running:
            if self.serial_port and self.serial_port.is_open:
                try:
                    # 1. Read live JSON packets
                    line = self.serial_port.readline().decode('utf-8', errors='ignore').strip()
                    
                    if not line:
                        continue
                        
                    # Ignore non-JSON ESP32 C++ debug statements (e.g. [SYSTEM] Booting...)
                    if not line.startswith('{'):
                        continue
                        
                    # 5. Detect malformed packets safely without crashing the backend
                    try:
                        # 3. Parse JSON payload
                        data = json.loads(line)
                        
                        # Apply to Global State and trigger logs
                        global_sensor_state.update(data)
                        
                        # 4. Continuously print parsed sensor states on a single line
                        sys.stdout.write(f"\rRaw Signals -> ECG: {global_sensor_state.ecg:4d} | PPG: {global_sensor_state.ppg:6d} | IR: {global_sensor_state.ir:6d}")
                        sys.stdout.flush()
                        
                        # 7. Prepare the architecture for future FastAPI WebSocket broadcasting
                        # TODO: When migrating to FastAPI, inject the callback here:
                        # await websocket_broadcast("live_waveform", global_sensor_state.__dict__)
                        
                    except json.JSONDecodeError:
                        print(f"\n[WARNING] Dropped malformed packet: {line}")
                        
                except serial.SerialException:
                    # 8. Reconnection handling if ESP32 physical wire disconnects
                    print("\n[CRITICAL] ESP32 Device Disconnected! Entering recovery mode.")
                    self.serial_port.close()
                    self.serial_port = None
            else:
                # Polling reconnect
                time.sleep(2)
                self.connect()

    def start(self):
        """Boot the non-blocking background thread."""
        self.running = True
        self.thread = threading.Thread(target=self.read_loop, daemon=True)
        self.thread.start()
        print("[SYSTEM] VascuScan AI Biomedical Serial Listener Started.")

    def stop(self):
        """Safely wind down the physical hardware connections."""
        self.running = False
        if self.serial_port and self.serial_port.is_open:
            self.serial_port.close()
        if self.thread:
            self.thread.join()
        print("\n[SYSTEM] Listener Stopped.")

if __name__ == "__main__":
    listener = ESP32Listener(baudrate=115200)
    listener.start()
    
    try:
        # Prevent main thread from exiting while background daemon runs
        while True:
            time.sleep(0.1)
    except KeyboardInterrupt:
        listener.stop()
        sys.exit(0)
