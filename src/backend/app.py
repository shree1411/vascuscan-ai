"""
VASCUSCAN AI — Flask Backend (Dual-Model Edition)

Two prediction modes:
  POST /api/predict-form   → Model 1 (form-only, 11 features, no sensor needed)
  POST /api/predict        → Model 2 (full, 17 features, requires ECG/PPG data)

GET  /api/health  → health check + model status
Realtime WebSocket: 'waveform_update', 'prediction_update'
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO
import os
import pickle
import numpy as np
from sensor_stream import SensorStreamer

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

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

# ── Active patient context for real-time background predictions ───────────────
global_active_patient_context = None

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
    risk_pct   = round(float(probas[pred_idx]) * 100, 2)

    proba_dict = {c: round(float(p) * 100, 2)
                  for c, p in zip(classes, probas)}

    return {
        "risk_level":    risk_level,
        "risk_score":    round(float(probas[pred_idx]), 3),
        "risk_percentage": risk_pct,
        "probabilities": proba_dict,
    }


# ── WebSocket helpers ─────────────────────────────────────────────────────────

def handle_waveform(ecg_chunk, ppg_chunk, is_simulated, status_dict):
    socketio.emit('waveform_update', {
        'ecg': ecg_chunk,
        'ppg': ppg_chunk,
        'is_simulated': is_simulated,
        'sensor_status': status_dict
    })


def handle_features(features):
    """Called every ~1 s by SensorStreamer — runs Model 2 prediction in background."""
    global global_active_patient_context
    if model2 is None or global_active_patient_context is None:
        return
    try:
        data = global_active_patient_context.copy()
        data['ecg_hrv'] = features.get('ecg_hrv', data.get('ecg_hrv', 0))
        data['ptt']     = features.get('ptt',     data.get('ptt', 0))

        vec = _build_feature_vector(data, SENSOR_FEATURES, encoders2)
        X   = np.array(vec, dtype=np.float64).reshape(1, -1)
        X_s = scaler2.transform(X)
        probas = model2.predict_proba(X_s)[0]
        result = _decode_prediction(probas, encoders2)

        socketio.emit('prediction_update', {
            "risk_level":      result["risk_level"],
            "risk_percentage": result["risk_percentage"],
            "risk_score":      result["risk_score"],
            "probabilities":   result["probabilities"],
            "ecg_hrv":         data.get('ecg_hrv', 0),
            "ptt":             data.get('ptt', 0),
            "hr":              features.get("hr", 0),
            "model_used":      "model2_sensor",
        })
    except Exception as e:
        print(f"Background prediction error: {e}")


# ── Sensor streamer ───────────────────────────────────────────────────────────
streamer = SensorStreamer(
    port='COM3',
    on_waveform=handle_waveform,
    on_features=handle_features,
)
streamer.start()

@socketio.on('set_filter_level')
def on_set_filter_level(data):
    try:
        level = float(data.get('level', 0))
        streamer.set_filter_level(level)
    except Exception as e:
        print(f"Error setting filter: {e}")

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
    Accepts all 17 features. Also stores context for background streaming.
    """
    global global_active_patient_context

    if model2 is None or scaler2 is None:
        return jsonify({"error": "Model 2 (Full Sensor) is not loaded."}), 500

    try:
        data = request.json or {}
        global_active_patient_context = data

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
    socketio.run(app, host='127.0.0.1', port=5000, debug=True, allow_unsafe_werkzeug=True)
