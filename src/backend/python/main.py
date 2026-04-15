"""
VASCUSCAN AI — Flask Application Entry Point
Main server file with all API endpoints, WebSocket events, and background tasks.
"""

import json
import logging
import math
import os
import random
import threading
import time
from datetime import datetime
from typing import Any, Optional

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    get_jwt_identity,
    jwt_required,
)
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_socketio import SocketIO, emit

from config import get_config
from models import (
    AuditLog,
    FamilyHistory,
    Lifestyle,
    MedicalHistory,
    Patient,
    PreviousEvents,
    RiskAssessment,
    ScanSession,
    SensorData,
    User,
    VitalSigns,
    db,
)

load_dotenv()

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger("vascuscan")

# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------

app = Flask(__name__)
cfg = get_config()
app.config.from_object(cfg)

# Extensions
db.init_app(app)
bcrypt = Bcrypt(app)
jwt = JWTManager(app)
CORS(app, origins=cfg.CORS_ORIGINS)
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=[cfg.RATELIMIT_DEFAULT],
    storage_uri=cfg.RATELIMIT_STORAGE_URL,
)
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode=cfg.SOCKETIO_ASYNC_MODE,
    logger=False,
    engineio_logger=False,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _audit(action: str, resource: str, resource_id: Optional[str] = None, details: Optional[dict] = None) -> None:
    """Write an audit log entry. Best-effort — never raises."""
    try:
        identity = None
        try:
            from flask_jwt_extended import get_jwt_identity  # local re-import avoids circular
            identity = get_jwt_identity()
        except Exception:
            pass
        entry = AuditLog(
            user_id=int(identity) if identity else None,
            action=action,
            resource=resource,
            resource_id=str(resource_id) if resource_id else None,
            ip_address=request.remote_addr,
            details=json.dumps(details) if details else None,
        )
        db.session.add(entry)
        db.session.commit()
    except Exception as exc:
        logger.warning("Audit log failed: %s", exc)


def _next_patient_id() -> str:
    """Generate sequential VSC-XXXX patient identifier."""
    last = db.session.query(Patient).order_by(Patient.id.desc()).first()
    next_num = (last.id + 1) if last else 1
    return f"VSC-{next_num:04d}"


def _calc_bmi(height_cm: Optional[float], weight_kg: Optional[float]) -> Optional[float]:
    if height_cm and weight_kg and height_cm > 0:
        return round(weight_kg / ((height_cm / 100) ** 2), 1)
    return None


# ---------------------------------------------------------------------------
# Error handlers
# ---------------------------------------------------------------------------

@app.errorhandler(400)
def bad_request(e):
    return jsonify({"error": "Bad request", "message": str(e)}), 400


@app.errorhandler(401)
def unauthorized(e):
    return jsonify({"error": "Unauthorized", "message": str(e)}), 401


@app.errorhandler(403)
def forbidden(e):
    return jsonify({"error": "Forbidden", "message": str(e)}), 403


@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Not found", "message": str(e)}), 404


@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Internal server error", "message": str(e)}), 500


# ---------------------------------------------------------------------------
# Auth endpoints — /api/auth
# ---------------------------------------------------------------------------

@app.route("/api/auth/register", methods=["POST"])
def auth_register():
    data = request.get_json(force=True)
    username = data.get("username", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    role = data.get("role", "doctor")

    if not username or not email or not password:
        return jsonify({"error": "username, email, and password are required"}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already registered"}), 409

    pw_hash = bcrypt.generate_password_hash(password).decode("utf-8")
    user = User(username=username, email=email, password_hash=pw_hash, role=role)
    db.session.add(user)
    db.session.commit()

    token = create_access_token(identity=str(user.id))
    _audit("REGISTER", "users", user.id)
    return jsonify({"token": token, "user": user.to_dict()}), 201


@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    data = request.get_json(force=True)
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    user = User.query.filter_by(email=email).first()
    if not user or not bcrypt.check_password_hash(user.password_hash, password):
        return jsonify({"error": "Invalid email or password"}), 401

    token = create_access_token(identity=str(user.id))
    _audit("LOGIN", "users", user.id)
    return jsonify({"token": token, "user": user.to_dict()}), 200


@app.route("/api/auth/me", methods=["GET"])
@jwt_required()
def auth_me():
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify({"user": user.to_dict()}), 200


# ---------------------------------------------------------------------------
# Patient endpoints — /api/patients
# ---------------------------------------------------------------------------

@app.route("/api/patients", methods=["GET"])
@jwt_required()
def list_patients():
    patients = Patient.query.order_by(Patient.created_at.desc()).all()
    result = []
    for p in patients:
        d = p.to_dict()
        latest_vitals = (
            VitalSigns.query.filter_by(patient_id=p.id)
            .order_by(VitalSigns.recorded_at.desc())
            .first()
        )
        d["latest_vitals"] = latest_vitals.to_dict() if latest_vitals else None
        latest_risk = (
            RiskAssessment.query.filter_by(patient_id=p.id)
            .order_by(RiskAssessment.created_at.desc())
            .first()
        )
        d["latest_risk"] = latest_risk.to_dict() if latest_risk else None
        result.append(d)
    return jsonify({"patients": result, "total": len(result)}), 200


@app.route("/api/patients", methods=["POST"])
@jwt_required()
def create_patient():
    data = request.get_json(force=True)

    height = data.get("height_cm")
    weight = data.get("weight_kg")

    patient = Patient(
        patient_id=_next_patient_id(),
        first_name=data.get("first_name", ""),
        last_name=data.get("last_name", ""),
        date_of_birth=datetime.strptime(data["date_of_birth"], "%Y-%m-%d").date()
        if data.get("date_of_birth")
        else None,
        age=data.get("age"),
        gender=data.get("gender"),
        blood_type=data.get("blood_type"),
        phone=data.get("phone"),
        email=data.get("email"),
        address=data.get("address"),
        height_cm=height,
        weight_kg=weight,
        bmi=_calc_bmi(height, weight),
    )
    db.session.add(patient)
    db.session.flush()  # get patient.id before commit

    # Medical history sub-record
    med = MedicalHistory(
        patient_id=patient.id,
        diabetes_status=bool(data.get("diabetes_status", False)),
        hypertension_status=bool(data.get("hypertension_status", False)),
        cholesterol_level=data.get("cholesterol_level"),
        ldl=data.get("ldl"),
        hdl=data.get("hdl"),
        smoking_status=bool(data.get("smoking_status", False)),
        alcohol_use=bool(data.get("alcohol_use", False)),
        previous_cardiac_events=bool(data.get("previous_cardiac_events", False)),
        family_history_cardiac=bool(data.get("family_history_cardiac", False)),
        medications=data.get("medications"),
        allergies=data.get("allergies"),
        notes=data.get("notes"),
    )
    db.session.add(med)
    db.session.commit()

    _audit("CREATE_PATIENT", "patients", patient.id)
    return jsonify({"patient": patient.to_dict()}), 201


@app.route("/api/patients/<string:patient_id>", methods=["GET"])
@jwt_required()
def get_patient(patient_id: str):
    patient = Patient.query.filter_by(patient_id=patient_id).first()
    if not patient:
        return jsonify({"error": "Patient not found"}), 404

    data = patient.to_dict()
    data["medical_history"] = patient.medical_history.to_dict() if patient.medical_history else None
    data["lifestyle"] = patient.lifestyle.to_dict() if patient.lifestyle else None
    data["family_history"] = patient.family_history.to_dict() if patient.family_history else None
    data["previous_events"] = [e.to_dict() for e in patient.previous_events]
    data["latest_vitals"] = (
        VitalSigns.query.filter_by(patient_id=patient.id)
        .order_by(VitalSigns.recorded_at.desc())
        .first()
    )
    if data["latest_vitals"]:
        data["latest_vitals"] = data["latest_vitals"].to_dict()
    data["latest_risk"] = (
        RiskAssessment.query.filter_by(patient_id=patient.id)
        .order_by(RiskAssessment.created_at.desc())
        .first()
    )
    if data["latest_risk"]:
        data["latest_risk"] = data["latest_risk"].to_dict()

    _audit("VIEW_PATIENT", "patients", patient_id)
    return jsonify({"patient": data}), 200


@app.route("/api/patients/<string:patient_id>", methods=["PUT"])
@jwt_required()
def update_patient(patient_id: str):
    patient = Patient.query.filter_by(patient_id=patient_id).first()
    if not patient:
        return jsonify({"error": "Patient not found"}), 404

    data = request.get_json(force=True)
    fields = [
        "first_name", "last_name", "age", "gender", "blood_type",
        "phone", "email", "address", "height_cm", "weight_kg",
    ]
    for f in fields:
        if f in data:
            setattr(patient, f, data[f])

    if patient.height_cm and patient.weight_kg:
        patient.bmi = _calc_bmi(patient.height_cm, patient.weight_kg)

    db.session.commit()
    _audit("UPDATE_PATIENT", "patients", patient_id)
    return jsonify({"patient": patient.to_dict()}), 200


@app.route("/api/patients/<string:patient_id>", methods=["DELETE"])
@jwt_required()
def delete_patient(patient_id: str):
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if not user or user.role != "admin":
        return jsonify({"error": "Admin role required"}), 403

    patient = Patient.query.filter_by(patient_id=patient_id).first()
    if not patient:
        return jsonify({"error": "Patient not found"}), 404

    db.session.delete(patient)
    db.session.commit()
    _audit("DELETE_PATIENT", "patients", patient_id)
    return jsonify({"message": "Patient deleted"}), 200


# ---------------------------------------------------------------------------
# Vitals endpoints
# ---------------------------------------------------------------------------

@app.route("/api/patients/<string:patient_id>/vitals", methods=["POST"])
@jwt_required()
def save_vitals(patient_id: str):
    patient = Patient.query.filter_by(patient_id=patient_id).first()
    if not patient:
        return jsonify({"error": "Patient not found"}), 404

    data = request.get_json(force=True)
    v = VitalSigns(
        patient_id=patient.id,
        heart_rate=data.get("heart_rate"),
        spo2=data.get("spo2"),
        systolic_bp=data.get("systolic_bp"),
        diastolic_bp=data.get("diastolic_bp"),
        ptt=data.get("ptt"),
        perfusion_index=data.get("perfusion_index"),
        source=data.get("source", "sensor"),
    )
    db.session.add(v)
    db.session.commit()
    return jsonify({"vitals": v.to_dict()}), 201


@app.route("/api/patients/<string:patient_id>/vitals", methods=["GET"])
@jwt_required()
def get_vitals(patient_id: str):
    patient = Patient.query.filter_by(patient_id=patient_id).first()
    if not patient:
        return jsonify({"error": "Patient not found"}), 404

    latest = (
        VitalSigns.query.filter_by(patient_id=patient.id)
        .order_by(VitalSigns.recorded_at.desc())
        .first()
    )
    return jsonify({"vitals": latest.to_dict() if latest else None}), 200


# ---------------------------------------------------------------------------
# Sensor endpoints
# ---------------------------------------------------------------------------

@app.route("/api/sensor/data", methods=["POST"])
@jwt_required()
def ingest_sensor_data():
    """Accept raw ECG/PPG arrays, filter, extract features, and save."""
    from filter_signal import apply_noise_filter
    from feature_extraction import extract_all_features

    data = request.get_json(force=True)
    patient_id_str = data.get("patient_id")
    patient = Patient.query.filter_by(patient_id=patient_id_str).first() if patient_id_str else None

    ecg_raw = data.get("ecg", [])
    ppg_raw = data.get("ppg", [])
    noise_intensity = float(data.get("noise_intensity", 1.0))
    filter_strength = float(data.get("filter_strength", 0.5))

    # Filter
    filtered = apply_noise_filter(ecg_raw, ppg_raw, noise_intensity, filter_strength)
    ecg_clean = filtered["ecg_filtered"]
    ppg_clean = filtered["ppg_filtered"]

    # Feature extraction
    features = extract_all_features(ecg_clean, ppg_clean)

    # Persist if patient known
    if patient:
        sd = SensorData(
            patient_id=patient.id,
            ecg_raw=json.dumps(ecg_raw[:500]),   # store up to 500 samples
            ppg_raw=json.dumps(ppg_raw[:500]),
            ecg_hrv=features.get("ecg", {}).get("hrv"),
            ecg_qrs_duration=features.get("ecg", {}).get("qrs_duration"),
            ecg_rr_interval=features.get("ecg", {}).get("rr_interval"),
            ecg_st_segment=features.get("ecg", {}).get("st_segment"),
            ppg_peak_amplitude=features.get("ppg", {}).get("peak_amplitude"),
            ppg_rise_time=features.get("ppg", {}).get("rise_time"),
            ppg_dicrotic_notch=features.get("ppg", {}).get("dicrotic_notch"),
            ppg_skewness=features.get("ppg", {}).get("waveform_skewness"),
            perfusion_index=features.get("ppg", {}).get("perfusion_index"),
            ptt=features.get("ptt"),
            noise_level=noise_intensity,
            filter_strength=filter_strength,
            sensor_connected=True,
        )
        db.session.add(sd)
        db.session.commit()

    return jsonify({"features": features, "filter_applied": filtered["filter_applied"]}), 200


@app.route("/api/sensors/configure", methods=["POST"])
@jwt_required()
def configure_sensor():
    data = request.get_json(force=True)
    # Store config in app context for current session
    app.config["SENSOR_CONFIG"] = {
        "sensor_type": data.get("sensor_type", "esp32"),
        "endpoint": data.get("endpoint", "/dev/ttyUSB0"),
        "baud_rate": int(data.get("baud_rate", 115200)),
        "sample_rate": int(data.get("sample_rate", 250)),
    }
    return jsonify({"status": "configured", "config": app.config["SENSOR_CONFIG"]}), 200


@app.route("/api/sensor/status", methods=["GET"])
def sensor_status():
    connected = app.config.get("SENSOR_CONNECTED", False)
    return jsonify({"connected": connected, "demo_mode": not connected}), 200


# ---------------------------------------------------------------------------
# Risk Assessment endpoints
# ---------------------------------------------------------------------------

@app.route("/api/patients/<string:patient_id>/predict", methods=["POST"])
@jwt_required()
def predict_risk(patient_id: str):
    from predict import risk_predict

    patient = Patient.query.filter_by(patient_id=patient_id).first()
    if not patient:
        return jsonify({"error": "Patient not found"}), 404

    data = request.get_json(force=True)
    features = {
        "age": data.get("age", patient.age or 40),
        "gender": data.get("gender", patient.gender or "M"),
        "diabetes_status": data.get("diabetes_status", False),
        "hypertension_status": data.get("hypertension_status", False),
        "cholesterol_level": data.get("cholesterol_level", 180),
        "ldl": data.get("ldl", 100),
        "hdl": data.get("hdl", 50),
        "smoking_status": data.get("smoking_status", False),
        "ecg_hrv": data.get("ecg_hrv", 35),
        "ecg_qrs_duration": data.get("ecg_qrs_duration", 95),
        "ppg_peak_amplitude": data.get("ppg_peak_amplitude", 0.6),
        "perfusion_index": data.get("perfusion_index", 3.5),
        "ptt": data.get("ptt", 250),
    }

    result = risk_predict(features)

    # Determine active scan session if any
    active_session = (
        ScanSession.query.filter_by(patient_id=patient.id, status="active")
        .order_by(ScanSession.start_time.desc())
        .first()
    )

    assessment = RiskAssessment(
        patient_id=patient.id,
        scan_session_id=active_session.id if active_session else None,
        risk_level=result["risk_level"],
        risk_score=result["risk_score"],
        blockage_probability=result["blockage_probability"],
        ai_confidence=result["ai_confidence"],
        model_used=result.get("model_type", "rule_based"),
        features_json=json.dumps(features),
    )
    db.session.add(assessment)
    db.session.commit()

    # Emit real-time update
    socketio.emit("risk_update", {
        "patient_id": patient_id,
        "assessment": assessment.to_dict(),
    })

    _audit("PREDICT_RISK", "risk_assessments", assessment.id, {"patient_id": patient_id})
    return jsonify({"assessment": assessment.to_dict()}), 200


@app.route("/api/patients/<string:patient_id>/risk-history", methods=["GET"])
@jwt_required()
def risk_history(patient_id: str):
    patient = Patient.query.filter_by(patient_id=patient_id).first()
    if not patient:
        return jsonify({"error": "Patient not found"}), 404

    assessments = (
        RiskAssessment.query.filter_by(patient_id=patient.id)
        .order_by(RiskAssessment.created_at.desc())
        .all()
    )
    return jsonify({"risk_history": [a.to_dict() for a in assessments]}), 200


# ---------------------------------------------------------------------------
# Scan Session endpoints
# ---------------------------------------------------------------------------

@app.route("/api/scans/start", methods=["POST"])
@jwt_required()
def start_scan():
    data = request.get_json(force=True)
    patient_id_str = data.get("patient_id")
    patient = Patient.query.filter_by(patient_id=patient_id_str).first()
    if not patient:
        return jsonify({"error": "Patient not found"}), 404

    session = ScanSession(
        patient_id=patient.id,
        status="active",
        sensor_connected=app.config.get("SENSOR_CONNECTED", False),
    )
    db.session.add(session)
    db.session.commit()
    return jsonify({"session": session.to_dict()}), 201


@app.route("/api/scans/<int:session_id>/stop", methods=["POST"])
@jwt_required()
def stop_scan(session_id: int):
    session = ScanSession.query.get(session_id)
    if not session:
        return jsonify({"error": "Scan session not found"}), 404

    session.end_time = datetime.utcnow()
    session.status = "completed"
    if session.start_time:
        delta = session.end_time - session.start_time
        session.duration_seconds = int(delta.total_seconds())

    db.session.commit()
    return jsonify({"session": session.to_dict()}), 200


@app.route("/api/patients/<string:patient_id>/scans", methods=["GET"])
@jwt_required()
def patient_scans(patient_id: str):
    patient = Patient.query.filter_by(patient_id=patient_id).first()
    if not patient:
        return jsonify({"error": "Patient not found"}), 404

    scans = (
        ScanSession.query.filter_by(patient_id=patient.id)
        .order_by(ScanSession.start_time.desc())
        .all()
    )
    return jsonify({"scans": [s.to_dict() for s in scans]}), 200


# ---------------------------------------------------------------------------
# History endpoints
# ---------------------------------------------------------------------------

@app.route("/api/history", methods=["GET"])
@jwt_required()
def all_history():
    """All scan sessions with patient info and risk assessments."""
    sessions = ScanSession.query.order_by(ScanSession.start_time.desc()).all()
    result = []
    for s in sessions:
        d = s.to_dict()
        d["patient"] = s.patient.to_dict() if s.patient else None
        d["risk_assessments"] = [r.to_dict() for r in s.risk_assessments]
        result.append(d)
    return jsonify({"history": result, "total": len(result)}), 200


@app.route("/api/patients/<string:patient_id>/history", methods=["GET"])
@jwt_required()
def patient_history(patient_id: str):
    patient = Patient.query.filter_by(patient_id=patient_id).first()
    if not patient:
        return jsonify({"error": "Patient not found"}), 404

    scans = (
        ScanSession.query.filter_by(patient_id=patient.id)
        .order_by(ScanSession.start_time.desc())
        .all()
    )
    vitals = (
        VitalSigns.query.filter_by(patient_id=patient.id)
        .order_by(VitalSigns.recorded_at.desc())
        .limit(20)
        .all()
    )
    risks = (
        RiskAssessment.query.filter_by(patient_id=patient.id)
        .order_by(RiskAssessment.created_at.desc())
        .all()
    )
    return jsonify({
        "patient": patient.to_dict(),
        "scans": [s.to_dict() for s in scans],
        "vitals": [v.to_dict() for v in vitals],
        "risk_assessments": [r.to_dict() for r in risks],
    }), 200


# ---------------------------------------------------------------------------
# Reports endpoint
# ---------------------------------------------------------------------------

@app.route("/api/patients/<string:patient_id>/report", methods=["GET"])
@jwt_required()
def patient_report(patient_id: str):
    import csv
    import io

    patient = Patient.query.filter_by(patient_id=patient_id).first()
    if not patient:
        return jsonify({"error": "Patient not found"}), 404

    export_format = request.args.get("export_format", "json")

    latest_vitals = (
        VitalSigns.query.filter_by(patient_id=patient.id)
        .order_by(VitalSigns.recorded_at.desc())
        .first()
    )
    latest_risk = (
        RiskAssessment.query.filter_by(patient_id=patient.id)
        .order_by(RiskAssessment.created_at.desc())
        .first()
    )
    scans = (
        ScanSession.query.filter_by(patient_id=patient.id)
        .order_by(ScanSession.start_time.desc())
        .all()
    )

    report = {
        "generated_at": datetime.utcnow().isoformat(),
        "patient": patient.to_dict(),
        "medical_history": patient.medical_history.to_dict() if patient.medical_history else None,
        "latest_vitals": latest_vitals.to_dict() if latest_vitals else None,
        "latest_risk": latest_risk.to_dict() if latest_risk else None,
        "scan_history": [s.to_dict() for s in scans],
    }

    if export_format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["field", "value"])
        p = patient.to_dict()
        for k, v in p.items():
            writer.writerow([k, v])
        from flask import Response
        return Response(
            output.getvalue(),
            mimetype="text/csv",
            headers={"Content-Disposition": f"attachment;filename=report_{patient_id}.csv"},
        )

    _audit("EXPORT_REPORT", "patients", patient_id, {"format": export_format})
    return jsonify({"report": report}), 200


# ---------------------------------------------------------------------------
# Dataset endpoints
# ---------------------------------------------------------------------------

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")


@app.route("/api/dataset/upload", methods=["POST"])
@jwt_required()
def upload_dataset():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    import pandas as pd

    file = request.files["file"]
    os.makedirs(DATA_DIR, exist_ok=True)
    dest = os.path.join(DATA_DIR, "uploaded_dataset.csv")
    file.save(dest)

    df = pd.read_csv(dest)
    preview = df.head(5).to_dict(orient="records")
    return jsonify({
        "status": "uploaded",
        "rows": len(df),
        "columns": list(df.columns),
        "preview": preview,
    }), 200


@app.route("/api/dataset/info", methods=["GET"])
@jwt_required()
def dataset_info():
    import pandas as pd

    default_path = os.path.join(DATA_DIR, "cardio_dataset_1600.csv")
    uploaded_path = os.path.join(DATA_DIR, "uploaded_dataset.csv")

    for path in [uploaded_path, default_path]:
        if os.path.exists(path):
            df = pd.read_csv(path)
            return jsonify({
                "path": path,
                "rows": len(df),
                "columns": list(df.columns),
                "file": os.path.basename(path),
            }), 200

    return jsonify({"error": "No dataset found. Run generate_dataset.py first."}), 404


@app.route("/api/dataset/train", methods=["POST"])
@jwt_required()
def trigger_training():
    def _train_bg():
        from train_model import train_and_save_model
        with app.app_context():
            try:
                result = train_and_save_model()
                socketio.emit("training_complete", result)
                logger.info("Model training completed: accuracy=%.3f", result.get("accuracy", 0))
            except Exception as exc:
                logger.error("Training failed: %s", exc)
                socketio.emit("training_error", {"error": str(exc)})

    t = threading.Thread(target=_train_bg, daemon=True)
    t.start()
    return jsonify({"status": "training_started"}), 202


# ---------------------------------------------------------------------------
# WebSocket events
# ---------------------------------------------------------------------------

@socketio.on("connect")
def handle_connect():
    logger.info("WebSocket client connected: %s", request.sid)
    emit("status", {"message": "Connected to VASCUSCAN AI backend"})


@socketio.on("disconnect")
def handle_disconnect():
    logger.info("WebSocket client disconnected: %s", request.sid)


@socketio.on("sensor_data")
def handle_sensor_data(data: dict):
    """Receive raw sensor packet, filter+extract, broadcast processed data."""
    from filter_signal import apply_noise_filter
    from feature_extraction import extract_all_features

    ecg = data.get("ecg", [])
    ppg = data.get("ppg", [])
    noise_intensity = float(data.get("noise_intensity", 1.0))
    filter_strength = float(data.get("filter_strength", 0.5))

    filtered = apply_noise_filter(ecg, ppg, noise_intensity, filter_strength)
    features = extract_all_features(filtered["ecg_filtered"], filtered["ppg_filtered"])

    emit("processed_data", {"features": features, "filtered": filtered})
    emit("vitals_update", {
        "heart_rate": features.get("heart_rate", 72),
        "spo2": features.get("spo2", 98.0),
        "timestamp": datetime.utcnow().isoformat(),
    })
    app.config["SENSOR_CONNECTED"] = True
    socketio.emit("sensor_status", {"connected": True})


@socketio.on("start_scan")
def handle_start_scan(data: dict):
    emit("scan_started", {"timestamp": datetime.utcnow().isoformat()})


@socketio.on("stop_scan")
def handle_stop_scan(data: dict):
    emit("scan_stopped", {"timestamp": datetime.utcnow().isoformat()})


# ---------------------------------------------------------------------------
# Demo sensor background thread
# ---------------------------------------------------------------------------

_demo_running = False
_demo_thread: Optional[threading.Thread] = None


def simulate_sensor_data() -> None:
    """Broadcast synthetic ECG/PPG data every 100 ms for demo mode."""
    t = 0.0
    while _demo_running:
        t += 0.1
        # Simple ECG-like waveform: sine with sharp R-peak pulse
        ecg_sample = (
            0.05 * math.sin(2 * math.pi * 1.2 * t)
            + (0.8 * math.exp(-((t % (1 / 1.2)) - 0.15) ** 2 / 0.001))
        )
        ppg_sample = 0.5 + 0.4 * math.sin(2 * math.pi * 1.2 * t - 0.3)

        payload = {
            "ecg": [round(ecg_sample + random.gauss(0, 0.01), 4)],
            "ppg": [round(ppg_sample + random.gauss(0, 0.005), 4)],
            "heart_rate": 72 + int(3 * math.sin(t / 10)),
            "spo2": round(98.0 + 0.5 * math.sin(t / 20), 1),
            "timestamp": datetime.utcnow().isoformat(),
        }
        socketio.emit("sensor_data_demo", payload)
        time.sleep(0.1)


def start_demo_mode() -> None:
    global _demo_running, _demo_thread
    _demo_running = True
    _demo_thread = threading.Thread(target=simulate_sensor_data, daemon=True)
    _demo_thread.start()
    logger.info("Demo sensor simulation started")


# ---------------------------------------------------------------------------
# Application entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        logger.info("Database tables created/verified")

    # Start demo mode if no real sensor is configured
    start_demo_mode()

    port = cfg.PORT
    logger.info("Starting VASCUSCAN AI backend on port %d", port)
    socketio.run(app, host="0.0.0.0", port=port, debug=cfg.DEBUG)
