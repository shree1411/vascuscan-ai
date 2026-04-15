"""
VASCUSCAN AI — SQLAlchemy ORM Models
All database tables for patients, sensor data, risk assessments, and audit logs.
"""

from datetime import datetime, date
from typing import Optional
import json

from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------

class User(db.Model):
    """Application user — doctors, patients, admins."""

    __tablename__ = "users"

    id: int = db.Column(db.Integer, primary_key=True)
    username: str = db.Column(db.String(80), unique=True, nullable=False)
    email: str = db.Column(db.String(120), unique=True, nullable=False)
    password_hash: str = db.Column(db.String(256), nullable=False)
    role: str = db.Column(db.String(20), nullable=False, default="doctor")  # patient/doctor/admin
    created_at: datetime = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "role": self.role,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# ---------------------------------------------------------------------------
# Patient
# ---------------------------------------------------------------------------

class Patient(db.Model):
    """Core patient demographic record."""

    __tablename__ = "patients"

    id: int = db.Column(db.Integer, primary_key=True)
    user_id: Optional[int] = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    patient_id: str = db.Column(db.String(20), unique=True, nullable=False)  # VSC-0001

    first_name: str = db.Column(db.String(80), nullable=False)
    last_name: str = db.Column(db.String(80), nullable=False)
    date_of_birth: Optional[date] = db.Column(db.Date, nullable=True)
    age: Optional[int] = db.Column(db.Integer, nullable=True)
    gender: Optional[str] = db.Column(db.String(10), nullable=True)  # M/F/Other
    blood_type: Optional[str] = db.Column(db.String(5), nullable=True)

    phone: Optional[str] = db.Column(db.String(20), nullable=True)
    email: Optional[str] = db.Column(db.String(120), nullable=True)
    address: Optional[str] = db.Column(db.Text, nullable=True)

    height_cm: Optional[float] = db.Column(db.Float, nullable=True)
    weight_kg: Optional[float] = db.Column(db.Float, nullable=True)
    bmi: Optional[float] = db.Column(db.Float, nullable=True)  # auto-calculated

    created_at: datetime = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at: datetime = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    medical_history = db.relationship("MedicalHistory", backref="patient", uselist=False, lazy=True)
    vital_signs = db.relationship("VitalSigns", backref="patient", lazy=True)
    sensor_data = db.relationship("SensorData", backref="patient", lazy=True)
    risk_assessments = db.relationship("RiskAssessment", backref="patient", lazy=True)
    scan_sessions = db.relationship("ScanSession", backref="patient", lazy=True)
    lifestyle = db.relationship("Lifestyle", backref="patient", uselist=False, lazy=True)
    family_history = db.relationship("FamilyHistory", backref="patient", uselist=False, lazy=True)
    previous_events = db.relationship("PreviousEvents", backref="patient", lazy=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "patient_id": self.patient_id,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "full_name": f"{self.first_name} {self.last_name}",
            "date_of_birth": self.date_of_birth.isoformat() if self.date_of_birth else None,
            "age": self.age,
            "gender": self.gender,
            "blood_type": self.blood_type,
            "phone": self.phone,
            "email": self.email,
            "address": self.address,
            "height_cm": self.height_cm,
            "weight_kg": self.weight_kg,
            "bmi": self.bmi,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


# ---------------------------------------------------------------------------
# Medical History
# ---------------------------------------------------------------------------

class MedicalHistory(db.Model):
    """Medical history and comorbidities for a patient."""

    __tablename__ = "medical_history"

    id: int = db.Column(db.Integer, primary_key=True)
    patient_id: int = db.Column(db.Integer, db.ForeignKey("patients.id"), nullable=False)

    diabetes_status: bool = db.Column(db.Boolean, default=False, nullable=False)
    hypertension_status: bool = db.Column(db.Boolean, default=False, nullable=False)
    cholesterol_level: Optional[float] = db.Column(db.Float, nullable=True)  # mg/dL total
    ldl: Optional[float] = db.Column(db.Float, nullable=True)               # mg/dL
    hdl: Optional[float] = db.Column(db.Float, nullable=True)               # mg/dL
    smoking_status: bool = db.Column(db.Boolean, default=False, nullable=False)
    alcohol_use: bool = db.Column(db.Boolean, default=False, nullable=False)
    previous_cardiac_events: bool = db.Column(db.Boolean, default=False, nullable=False)
    family_history_cardiac: bool = db.Column(db.Boolean, default=False, nullable=False)

    medications: Optional[str] = db.Column(db.Text, nullable=True)
    allergies: Optional[str] = db.Column(db.Text, nullable=True)
    notes: Optional[str] = db.Column(db.Text, nullable=True)

    created_at: datetime = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at: datetime = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "patient_id": self.patient_id,
            "diabetes_status": self.diabetes_status,
            "hypertension_status": self.hypertension_status,
            "cholesterol_level": self.cholesterol_level,
            "ldl": self.ldl,
            "hdl": self.hdl,
            "smoking_status": self.smoking_status,
            "alcohol_use": self.alcohol_use,
            "previous_cardiac_events": self.previous_cardiac_events,
            "family_history_cardiac": self.family_history_cardiac,
            "medications": self.medications,
            "allergies": self.allergies,
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


# ---------------------------------------------------------------------------
# Vital Signs
# ---------------------------------------------------------------------------

class VitalSigns(db.Model):
    """Snapshot of patient vital signs at a point in time."""

    __tablename__ = "vital_signs"

    id: int = db.Column(db.Integer, primary_key=True)
    patient_id: int = db.Column(db.Integer, db.ForeignKey("patients.id"), nullable=False)

    heart_rate: Optional[float] = db.Column(db.Float, nullable=True)      # bpm
    spo2: Optional[float] = db.Column(db.Float, nullable=True)            # %
    systolic_bp: Optional[float] = db.Column(db.Float, nullable=True)     # mmHg
    diastolic_bp: Optional[float] = db.Column(db.Float, nullable=True)    # mmHg
    ptt: Optional[float] = db.Column(db.Float, nullable=True)             # ms pulse transit time
    perfusion_index: Optional[float] = db.Column(db.Float, nullable=True) # %

    recorded_at: datetime = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    source: str = db.Column(db.String(20), default="sensor", nullable=False)  # manual/sensor

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "patient_id": self.patient_id,
            "heart_rate": self.heart_rate,
            "spo2": self.spo2,
            "systolic_bp": self.systolic_bp,
            "diastolic_bp": self.diastolic_bp,
            "ptt": self.ptt,
            "perfusion_index": self.perfusion_index,
            "recorded_at": self.recorded_at.isoformat() if self.recorded_at else None,
            "source": self.source,
        }


# ---------------------------------------------------------------------------
# Sensor Data
# ---------------------------------------------------------------------------

class SensorData(db.Model):
    """Raw and processed ECG/PPG sensor readings."""

    __tablename__ = "sensor_data"

    id: int = db.Column(db.Integer, primary_key=True)
    patient_id: int = db.Column(db.Integer, db.ForeignKey("patients.id"), nullable=False)

    # Raw waveform arrays stored as JSON strings
    ecg_raw: Optional[str] = db.Column(db.Text, nullable=True)   # JSON array of floats
    ppg_raw: Optional[str] = db.Column(db.Text, nullable=True)   # JSON array of floats

    # ECG extracted features
    ecg_hrv: Optional[float] = db.Column(db.Float, nullable=True)          # ms RMSSD
    ecg_qrs_duration: Optional[float] = db.Column(db.Float, nullable=True) # ms
    ecg_rr_interval: Optional[float] = db.Column(db.Float, nullable=True)  # ms
    ecg_st_segment: Optional[float] = db.Column(db.Float, nullable=True)   # mV

    # PPG extracted features
    ppg_peak_amplitude: Optional[float] = db.Column(db.Float, nullable=True)  # normalized 0-1
    ppg_rise_time: Optional[float] = db.Column(db.Float, nullable=True)        # ms
    ppg_dicrotic_notch: Optional[float] = db.Column(db.Float, nullable=True)   # 0-1 or None
    ppg_skewness: Optional[float] = db.Column(db.Float, nullable=True)

    # Derived
    perfusion_index: Optional[float] = db.Column(db.Float, nullable=True)
    ptt: Optional[float] = db.Column(db.Float, nullable=True)  # ms

    # Quality/filter metadata
    noise_level: float = db.Column(db.Float, default=1.0, nullable=False)    # 0-1
    filter_strength: float = db.Column(db.Float, default=0.5, nullable=False) # 0-1
    sensor_connected: bool = db.Column(db.Boolean, default=False, nullable=False)

    recorded_at: datetime = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "patient_id": self.patient_id,
            "ecg_raw": json.loads(self.ecg_raw) if self.ecg_raw else None,
            "ppg_raw": json.loads(self.ppg_raw) if self.ppg_raw else None,
            "ecg_hrv": self.ecg_hrv,
            "ecg_qrs_duration": self.ecg_qrs_duration,
            "ecg_rr_interval": self.ecg_rr_interval,
            "ecg_st_segment": self.ecg_st_segment,
            "ppg_peak_amplitude": self.ppg_peak_amplitude,
            "ppg_rise_time": self.ppg_rise_time,
            "ppg_dicrotic_notch": self.ppg_dicrotic_notch,
            "ppg_skewness": self.ppg_skewness,
            "perfusion_index": self.perfusion_index,
            "ptt": self.ptt,
            "noise_level": self.noise_level,
            "filter_strength": self.filter_strength,
            "sensor_connected": self.sensor_connected,
            "recorded_at": self.recorded_at.isoformat() if self.recorded_at else None,
        }


# ---------------------------------------------------------------------------
# Risk Assessment
# ---------------------------------------------------------------------------

class RiskAssessment(db.Model):
    """AI cardiovascular risk prediction result for a patient."""

    __tablename__ = "risk_assessments"

    id: int = db.Column(db.Integer, primary_key=True)
    patient_id: int = db.Column(db.Integer, db.ForeignKey("patients.id"), nullable=False)
    scan_session_id: Optional[int] = db.Column(
        db.Integer, db.ForeignKey("scan_sessions.id"), nullable=True
    )

    risk_level: str = db.Column(db.String(20), nullable=False)  # low/moderate/high
    risk_score: float = db.Column(db.Float, nullable=False)     # 0-100
    blockage_probability: float = db.Column(db.Float, nullable=False)  # 0-1
    ai_confidence: float = db.Column(db.Float, nullable=False)         # 0-1

    model_used: str = db.Column(db.String(40), default="rule_based", nullable=False)
    features_json: Optional[str] = db.Column(db.Text, nullable=True)  # JSON object
    assessment_notes: Optional[str] = db.Column(db.Text, nullable=True)

    created_at: datetime = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "patient_id": self.patient_id,
            "scan_session_id": self.scan_session_id,
            "risk_level": self.risk_level,
            "risk_score": self.risk_score,
            "blockage_probability": self.blockage_probability,
            "ai_confidence": self.ai_confidence,
            "model_used": self.model_used,
            "features": json.loads(self.features_json) if self.features_json else None,
            "assessment_notes": self.assessment_notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# ---------------------------------------------------------------------------
# Scan Session
# ---------------------------------------------------------------------------

class ScanSession(db.Model):
    """A monitoring session during which ECG/PPG data is collected."""

    __tablename__ = "scan_sessions"

    id: int = db.Column(db.Integer, primary_key=True)
    patient_id: int = db.Column(db.Integer, db.ForeignKey("patients.id"), nullable=False)

    start_time: datetime = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    end_time: Optional[datetime] = db.Column(db.DateTime, nullable=True)
    duration_seconds: Optional[int] = db.Column(db.Integer, nullable=True)

    status: str = db.Column(db.String(20), default="active", nullable=False)  # active/completed/cancelled
    sensor_connected: bool = db.Column(db.Boolean, default=False, nullable=False)
    data_quality: float = db.Column(db.Float, default=0.0, nullable=False)  # 0-1

    created_at: datetime = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Relationship to risk assessments
    risk_assessments = db.relationship("RiskAssessment", backref="scan_session", lazy=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "patient_id": self.patient_id,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "duration_seconds": self.duration_seconds,
            "status": self.status,
            "sensor_connected": self.sensor_connected,
            "data_quality": self.data_quality,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# ---------------------------------------------------------------------------
# Lifestyle
# ---------------------------------------------------------------------------

class Lifestyle(db.Model):
    """Patient lifestyle factors."""

    __tablename__ = "lifestyle"

    id: int = db.Column(db.Integer, primary_key=True)
    patient_id: int = db.Column(db.Integer, db.ForeignKey("patients.id"), nullable=False)

    exercise_frequency: Optional[str] = db.Column(db.String(20), nullable=True)  # none/light/moderate/heavy
    diet_quality: Optional[str] = db.Column(db.String(20), nullable=True)        # poor/fair/good/excellent
    stress_level: Optional[int] = db.Column(db.Integer, nullable=True)           # 1-10
    sleep_hours: Optional[float] = db.Column(db.Float, nullable=True)
    occupation: Optional[str] = db.Column(db.String(100), nullable=True)
    bmi_category: Optional[str] = db.Column(db.String(30), nullable=True)        # underweight/normal/overweight/obese

    created_at: datetime = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at: datetime = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "patient_id": self.patient_id,
            "exercise_frequency": self.exercise_frequency,
            "diet_quality": self.diet_quality,
            "stress_level": self.stress_level,
            "sleep_hours": self.sleep_hours,
            "occupation": self.occupation,
            "bmi_category": self.bmi_category,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


# ---------------------------------------------------------------------------
# Family History
# ---------------------------------------------------------------------------

class FamilyHistory(db.Model):
    """Patient family cardiac history."""

    __tablename__ = "family_history"

    id: int = db.Column(db.Integer, primary_key=True)
    patient_id: int = db.Column(db.Integer, db.ForeignKey("patients.id"), nullable=False)

    father_cardiac: bool = db.Column(db.Boolean, default=False, nullable=False)
    mother_cardiac: bool = db.Column(db.Boolean, default=False, nullable=False)
    siblings_cardiac: bool = db.Column(db.Boolean, default=False, nullable=False)
    grandparents_cardiac: bool = db.Column(db.Boolean, default=False, nullable=False)
    other_conditions: Optional[str] = db.Column(db.Text, nullable=True)

    created_at: datetime = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "patient_id": self.patient_id,
            "father_cardiac": self.father_cardiac,
            "mother_cardiac": self.mother_cardiac,
            "siblings_cardiac": self.siblings_cardiac,
            "grandparents_cardiac": self.grandparents_cardiac,
            "other_conditions": self.other_conditions,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# ---------------------------------------------------------------------------
# Previous Events
# ---------------------------------------------------------------------------

class PreviousEvents(db.Model):
    """Past cardiac events for a patient."""

    __tablename__ = "previous_events"

    id: int = db.Column(db.Integer, primary_key=True)
    patient_id: int = db.Column(db.Integer, db.ForeignKey("patients.id"), nullable=False)

    event_type: str = db.Column(db.String(30), nullable=False)  # heart_attack/stroke/angina/other
    event_date: Optional[date] = db.Column(db.Date, nullable=True)
    treatment: Optional[str] = db.Column(db.Text, nullable=True)
    outcome: Optional[str] = db.Column(db.Text, nullable=True)
    notes: Optional[str] = db.Column(db.Text, nullable=True)

    created_at: datetime = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "patient_id": self.patient_id,
            "event_type": self.event_type,
            "event_date": self.event_date.isoformat() if self.event_date else None,
            "treatment": self.treatment,
            "outcome": self.outcome,
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# ---------------------------------------------------------------------------
# Audit Log
# ---------------------------------------------------------------------------

class AuditLog(db.Model):
    """HIPAA-compliant audit trail for all data access and mutations."""

    __tablename__ = "audit_logs"

    id: int = db.Column(db.Integer, primary_key=True)
    user_id: Optional[int] = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)

    action: str = db.Column(db.String(80), nullable=False)     # e.g. CREATE_PATIENT, LOGIN
    resource: str = db.Column(db.String(80), nullable=False)   # e.g. patients
    resource_id: Optional[str] = db.Column(db.String(40), nullable=True)

    ip_address: Optional[str] = db.Column(db.String(45), nullable=True)
    timestamp: datetime = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    details: Optional[str] = db.Column(db.Text, nullable=True)  # JSON string

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "action": self.action,
            "resource": self.resource,
            "resource_id": self.resource_id,
            "ip_address": self.ip_address,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "details": json.loads(self.details) if self.details else None,
        }
