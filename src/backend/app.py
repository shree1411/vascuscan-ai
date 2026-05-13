from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO
import os
import pickle
import numpy as np
import glob
import json
import serial.tools.list_ports
from collections import deque
from sensor_stream import SensorStreamer
from feature_extraction import extract_all_features

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading', logger=False, engineio_logger=False)

# ── Global Real-Time Store ───────────────────────────────────────────────────
latest_sensor_data = {}
latest_prediction = {}
ecg_waveform_buffer = deque(maxlen=500)
ppg_waveform_buffer = deque(maxlen=500)
sensor_connected = False
active_patient_context = None 

# ── Paths ────────────────────────────────────────────────────────────────────
_PYTHON_DIR = os.path.join(os.path.dirname(__file__), "python")

MODEL1_PATH    = os.path.join(_PYTHON_DIR, "model1_form.pkl")
SCALER1_PATH   = os.path.join(_PYTHON_DIR, "scaler1_form.pkl")
ENCODERS1_PATH = os.path.join(_PYTHON_DIR, "encoders1_form.pkl")

MODEL2_PATH    = os.path.join(_PYTHON_DIR, "model2_sensor.pkl")
SCALER2_PATH   = os.path.join(_PYTHON_DIR, "scaler2_sensor.pkl")
ENCODERS2_PATH = os.path.join(_PYTHON_DIR, "encoders2_sensor.pkl")

# ── Feature order for each model ─────────────────────────────────────────────
FORM_FEATURES = [
    "age", "gender", "diabetes_status", "hypertension_status",
    "cholesterol_level", "ldl", "hdl", "smoking_status",
    "family_history", "activity_level", "stress_level",
]

SENSOR_FEATURES = FORM_FEATURES + [
    "ecg_heart_rate", "ecg_hrv", "ecg_qrs_duration",
    "ppg_peak_amplitude", "ppg_perfusion_index", "ptt",
]

# Categorical fields that need LabelEncoder transform
CATEGORICAL_FIELDS = {
    "gender", "diabetes_status", "hypertension_status",
    "smoking_status", "activity_level", "stress_level",
}

# ── Load both models ──────────────────────────────────────────────────────────

def _load_triple(model_path, scaler_path, encoders_path, label):
    """Load (model, scaler, encoders) triple, return (None,None,None) on failure."""
    try:
        with open(model_path, "rb") as f:
            m = pickle.load(f)
        with open(scaler_path, "rb") as f:
            s = pickle.load(f)
        with open(encoders_path, "rb") as f:
            e = pickle.load(f)
        print(f"[✓] {label} loaded successfully")
        return m, s, e
    except Exception as ex:
        print(f"[!] Warning: Could not load {label}. Error: {ex}")
        return None, None, None


print("Loading VascuScan AI Models...")
model1, scaler1, encoders1 = _load_triple(MODEL1_PATH, SCALER1_PATH, ENCODERS1_PATH, "Model 1 (Form-Only)")
model2, scaler2, encoders2 = _load_triple(MODEL2_PATH, SCALER2_PATH, ENCODERS2_PATH, "Model 2 (Full Sensor)")

# ── Categorical encoding helper ───────────────────────────────────────────────

def _encode_value(col: str, val, encoders: dict):
    """Encode a single feature value using the model's LabelEncoder if applicable."""
    if col not in CATEGORICAL_FIELDS or encoders is None or col not in encoders:
        try:
            return float(val) if val is not None else 0.0
        except (TypeError, ValueError):
            return 0.0

    le = encoders[col]
    raw = str(val).strip() if val is not None else ""

    # Normalise to training vocabulary
    if col == "gender":
        raw = "Male" if raw.upper() in ("M", "MALE")   else "Female"
    elif col == "diabetes_status":
        mapping = {"no": "No", "none": "No", "0": "No",
                   "type 1": "Type 1", "type1": "Type 1",
                   "type 2": "Type 2", "type2": "Type 2",
                   "prediabetes": "Prediabetes"}
        raw = mapping.get(raw.lower(), "No")
    elif col == "hypertension_status":
        mapping = {"no": "No", "none": "No", "0": "No",
                   "treated": "Treated", "untreated": "Untreated"}
        raw = mapping.get(raw.lower(), "No")
    elif col == "smoking_status":
        mapping = {"never": "Never", "former": "Former",
                   "current": "Current", "yes": "Current", "no": "Never"}
        raw = mapping.get(raw.lower(), "Never")
    elif col == "activity_level":
        mapping = {"sedentary": "Sedentary", "light": "Light",
                   "moderate": "Moderate", "vigorous": "Vigorous"}
        raw = mapping.get(raw.lower(), "Moderate")
    elif col == "stress_level":
        mapping = {"low": "Low", "moderate": "Moderate", "high": "High"}
        raw = mapping.get(raw.lower(), "Low")

    try:
        return int(le.transform([raw])[0])
    except ValueError:
        # Unknown class — use class 0 as safe fallback
        return 0


def _build_feature_vector(data: dict, feature_list: list, encoders: dict) -> list:
    """Build an ordered numeric feature vector from JSON request data."""
    return [_encode_value(col, data.get(col), encoders) for col in feature_list]


def _decode_prediction(probas: np.ndarray, encoders: dict) -> dict:
    """Convert model output probabilities to a JSON-ready prediction dict."""
    label_le = encoders.get("risk_label")
    if label_le is not None:
        classes = list(label_le.classes_)   # e.g. ['High', 'Low', 'Moderate']
    else:
        classes = ["Low", "Moderate", "High"]

    pred_idx = int(np.argmax(probas))
    risk_level = classes[pred_idx] if pred_idx < len(classes) else "Unknown"
    proba_dict = {c: round(float(p) * 100, 2)
                  for c, p in zip(classes, probas)}

    # Calculate actual severity index instead of model confidence
    mod_p = proba_dict.get("Moderate", 0)
    high_p = proba_dict.get("High", 0)
    severity_pct = round((mod_p * 0.5) + (high_p * 1.0), 1)

    return {
        "risk_level":    risk_level,
        "risk_score":    round(severity_pct / 100.0, 3),
        "risk_percentage": severity_pct,
        "probabilities": proba_dict,
    }


def safe_get(data, key, default=0):
    try:
        return float(data.get(key, default))
    except (ValueError, TypeError):
        return float(default)

# ── WebSocket & Global State Helpers ──────────────────────────────────────────

def handle_waveform(ecg_chunk, ppg_chunk, is_simulated, status_dict):
    global sensor_connected
    # Update circular buffers for both signals
    for val in ecg_chunk:
        ecg_waveform_buffer.append(val)
    for val in ppg_chunk:
        ppg_waveform_buffer.append(val)
    
    sensor_connected = (status_dict.get('ecg') == 'CONNECTED' or status_dict.get('ppg') == 'CONNECTED')
    
    socketio.emit('waveform_update', {
        'ecg': ecg_chunk,
        'ppg': ppg_chunk,
        'is_simulated': is_simulated,
        'sensor_status': status_dict
    })
    
    # Compatibility event for user's sample frontend
    socketio.emit("sensor_data", {
        "ecg": int(ecg_chunk[-1]),
        "ir": int(ppg_chunk[-1]),
        "red": int(ppg_chunk[-1]), # Placeholder
        "hr": float(latest_sensor_data.get("ecg_hr", 72)),
        "spo2": float(latest_sensor_data.get("spo2", 98))
    })


def handle_features(features):
    """Updates global state using standardized extraction module every ~1s."""
    global latest_sensor_data, latest_prediction, active_patient_context
    
    try:
        # Convert buffers to lists for analysis
        ecg_sig = list(ecg_waveform_buffer)
        ppg_sig = list(ppg_waveform_buffer)
        
        # Call the new specialized extraction module
        advanced_feats = extract_all_features(ecg_sig, ppg_sig, fs=100)
        
        # 0. Emit specialized event for user logic
        socketio.emit("features", advanced_feats)
        
        # 1. Filter and Map Results
        rr = advanced_feats.get("RR", 0.82)
        ecg_hr = 60.0 / rr if rr > 0 else 72.0
        
        # Range Filter (Requirement 8)
        if ecg_hr > 180 or ecg_hr < 40:
            ecg_hr = 0
            
        # 2. Update Global Store (Requirement 2 and new module mapping)
        latest_sensor_data = {
            "ecg_hr": round(ecg_hr, 1),
            "ppg_hr": safe_get(features, "ppg_hr", ecg_hr),
            "spo2":   safe_get(features, "spo2", 98.0),
            "rr":     round(rr, 3),
            "hrv":    round(advanced_feats.get("HRV", 0), 4),
            "ptt":    round(advanced_feats.get("PTT", 0), 3),
            "amp":    round(advanced_feats.get("AMP", 0), 1),
            "rise":   round(advanced_feats.get("RISE", 0), 3)
        }

        # 3. Model Routing (Requirement 1)
        if active_patient_context:
            data = {**active_patient_context, **latest_sensor_data}
            
            # Map for 17-feature model compatibility
            data['ecg_heart_rate'] = ecg_hr
            data['ecg_hrv'] = latest_sensor_data["hrv"]
            data['ptt'] = latest_sensor_data["ptt"]
            data['ppg_peak_amplitude'] = latest_sensor_data["amp"]
            data['ecg_qrs_duration'] = 80 # default
            data['ppg_perfusion_index'] = 2.0 # default
            
            # Model Override Preference
            pref = active_patient_context.get("preferred_model", "auto")
            
            if (pref == "auto" and ecg_hr > 0 and model2 is not None) or pref == "model2":
                model_to_use = model2
                scaler_to_use = scaler2
                encoder_to_use = encoders2
                feat_list = SENSOR_FEATURES
                model_id = "model2_sensor"
            else:
                model_to_use = model1
                scaler_to_use = scaler1
                encoder_to_use = encoders1
                feat_list = FORM_FEATURES
                model_id = "model1_form"

            # Build Vector and Predict
            vec = _build_feature_vector(data, feat_list, encoder_to_use)
            X = np.array(vec, dtype=np.float64).reshape(1, -1)
            X_s = scaler_to_use.transform(X)
            
            probas = model_to_use.predict_proba(X_s)[0]
            result = _decode_prediction(probas, encoder_to_use)
            
            latest_prediction = {
                "risk_score": int(result["risk_percentage"]),
                "probabilities": {
                    "low": result["probabilities"].get("Low", 0),
                    "moderate": result["probabilities"].get("Moderate", 0),
                    "high": result["probabilities"].get("High", 0)
                },
                "risk_level": result["risk_level"],
                "model_used": model_id
            }

            socketio.emit('prediction_update', {
                **latest_prediction,
                **latest_sensor_data
            })
            
    except Exception as e:
        print(f"Integrated feature extraction error: {e}")


def find_serial_port():
    """Attempt to find a valid USB serial port on Mac, Linux or Windows."""
    # Try common Mac/Linux patterns first
    patterns = [
        '/dev/tty.usbserial*', 
        '/dev/tty.usbmodem*', 
        '/dev/ttyUSB*', 
        '/dev/ttyACM*',
        '/dev/tty.SLAB_USBtoUART*'
    ]
    for p in patterns:
        ports = glob.glob(p)
        if ports:
            print(f"[✓] Auto-detected serial port: {ports[0]}")
            return ports[0]
    
    # Check for COM3 specifically as a fallback (Windows style)
    return 'COM3'

# ── Sensor streamer ───────────────────────────────────────────────────────────
streamer = SensorStreamer(
    port=find_serial_port(),
    on_waveform=handle_waveform,
    on_features=handle_features,
    force_simulate=False  # Allow actual hardware connection
)
streamer.start()

@socketio.on('set_filter_level')
def on_set_filter_level(data):
    try:
        level = float(data.get('level', 0))
        streamer.set_filter_level(level)
    except Exception as e:
        print(f"Error setting filter: {e}")

# ── History Persistence ───────────────────────────────────────────────────────
HISTORY_FILE = os.path.join(_PYTHON_DIR, "data", "history.json")

def _load_history():
    if not os.path.exists(HISTORY_FILE):
        return []
    try:
        with open(HISTORY_FILE, "r") as f:
            return json.load(f)
    except:
        return []

def _save_history(history):
    try:
        with open(HISTORY_FILE, "w") as f:
            json.dump(history, f, indent=2)
    except Exception as e:
        print(f"Error saving history: {e}")

@app.route('/api/history', methods=['GET', 'POST'])
def handle_history():
    if request.method == 'POST':
        try:
            sessions = request.json or []
            _save_history(sessions)
            return jsonify({"status": "Success", "message": "History saved"})
        except Exception as e:
            return jsonify({"status": "Error", "message": str(e)}), 500
    else:
        return jsonify(_load_history())

# ── Port Management ───────────────────────────────────────────────────────────

@app.route('/api/ports', methods=['GET'])
def list_ports():
    try:
        ports = serial.tools.list_ports.comports()
        return jsonify([p.device for p in ports])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/set-port', methods=['POST'])
def set_port():
    try:
        data = request.json or {}
        new_port = data.get('port')
        if new_port:
            streamer.stop()
            streamer.port = new_port
            streamer.start()
            return jsonify({"status": "Success", "message": f"Switched to port {new_port}"})
        return jsonify({"error": "No port provided"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route('/api/realtime-data', methods=['GET'])
def get_realtime_data():
    """Unified polling endpoint for all live dashboard data."""
    return jsonify({
        "connected": sensor_connected,
        "vitals": latest_sensor_data,
        "ecg_waveform": list(ecg_waveform_buffer),
        "prediction": latest_prediction,
        "is_simulated": streamer._is_simulated,
        "patient_info": active_patient_context if active_patient_context else {}
    })


@app.route('/api/status', methods=['GET'])
def get_sensor_status():
    try:
        return jsonify({
            "status": "Success",
            "ecg_connected": bool(streamer.ecg_connected),
            "ppg_connected": bool(streamer.ppg_connected),
            "is_simulated": bool(streamer.is_simulated),
            "any_ready": bool(streamer.ecg_connected or streamer.ppg_connected or streamer.is_simulated)
        })
    except Exception as e:
        return jsonify({"status": "Error", "message": str(e)}), 500


# ── API endpoints ─────────────────────────────────────────────────────────────

@app.route('/api/patient/context', methods=['POST'])
def set_patient_context():
    """Manually set the patient history context in the backend."""
    global active_patient_context
    try:
        data = request.json or {}
        active_patient_context = data
        return jsonify({"status": "Success", "message": "Patient context updated", "data": active_patient_context})
    except Exception as e:
        return jsonify({"status": "Error", "message": str(e)}), 400


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy",
        "message": "VascuScan AI Backend is running",
        "model1_loaded": model1 is not None,
        "model2_loaded": model2 is not None,
        "sensor_simulated": streamer._is_simulated,
    })


@app.route('/api/predict-form', methods=['POST'])
def predict_form():
    """
    Model 1 — Form-Only prediction (no sensor required).
    Accepts 11 clinical features from the patient registration form.
    Always returns a prediction; sensor data not needed.
    """
    if model1 is None or scaler1 is None:
        return jsonify({"error": "Model 1 (Form-Only) is not loaded."}), 500

    try:
        data = request.json or {}

        vec = _build_feature_vector(data, FORM_FEATURES, encoders1)
        X   = np.array(vec, dtype=np.float64).reshape(1, -1)
        X_s = scaler1.transform(X)

        probas = model1.predict_proba(X_s)[0]
        result = _decode_prediction(probas, encoders1)

        return jsonify({
            **result,
            "model_used":      "model1_form",
            "model_label":     "Clinical Risk Model (No Sensor)",
            "features_used":   FORM_FEATURES,
            "message":         "Prediction from patient history — no sensor required.",
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route('/api/predict', methods=['POST'])
def predict_sensor():
    """
    Model 2 — Full prediction (form + live ECG/PPG sensor data).
    Accepts clinical form features and stores context for background streaming.
    """
    global active_patient_context

    if model2 is None or scaler2 is None:
        return jsonify({"error": "Model 2 (Full Sensor) is not loaded."}), 500

    try:
        data = request.json or {}
        active_patient_context = data

        vec = _build_feature_vector(data, SENSOR_FEATURES, encoders2)
        X   = np.array(vec, dtype=np.float64).reshape(1, -1)
        X_s = scaler2.transform(X)

        probas = model2.predict_proba(X_s)[0]
        result = _decode_prediction(probas, encoders2)

        return jsonify({
            **result,
            "model_used":  "model2_sensor",
            "model_label": "Full Sensor AI Model (ECG + PPG)",
            "features_used": SENSOR_FEATURES,
            "message":     "Prediction from patient history + live sensor signals.",
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 400

if __name__ == '__main__':
    # Start the background data streamer (Simulation or Serial)
    streamer = SensorStreamer(socketio)
    
    # Run server (Disable reloader to prevent duplicate threads on macOS)
    socketio.run(app, host='0.0.0.0', port=5005, debug=False, use_reloader=False, allow_unsafe_werkzeug=True)
