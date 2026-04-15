"""
VASCUSCAN AI — Cardiovascular Risk Prediction
Loads the trained Random Forest model (heart_risk_model.pkl) and label encoders
(label_encoders.pkl) using pickle. Falls back to rule-based scoring when the
pkl files do not exist yet.

CRITICAL: Both heart_risk_model.pkl AND label_encoders.pkl must be loaded
together. The encoders transform categorical inputs before prediction.
"""

import json
import logging
import os
import pickle
from typing import Any, Dict, Optional

logger = logging.getLogger("vascuscan.predict")

# ---------------------------------------------------------------------------
# File paths — relative to this file so deployment to Render works out of box
# ---------------------------------------------------------------------------

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH    = os.path.join(_BASE_DIR, "heart_risk_model.pkl")
ENCODERS_PATH = os.path.join(_BASE_DIR, "label_encoders.pkl")
SCALER_PATH   = os.path.join(_BASE_DIR, "scaler.pkl")
METADATA_PATH = os.path.join(_BASE_DIR, "models", "model_metadata.json")

# Module-level cache — loaded once on first call
_model    = None
_encoders: Optional[Dict[str, Any]] = None
_scaler   = None
_loaded   = False   # True after a load attempt (even if files missing)


# ---------------------------------------------------------------------------
# Feature constants
# ---------------------------------------------------------------------------

_FEATURE_ORDER = [
    "age",
    "gender",
    "diabetes_status",
    "hypertension_status",
    "cholesterol_level",
    "ldl",
    "hdl",
    "smoking_status",
    "ecg_hrv",
    "ecg_qrs_duration",
    "ppg_peak_amplitude",
    "perfusion_index",
    "ptt",
]

# Categorical fields handled by LabelEncoder
_CATEGORICAL_FIELDS = {
    "gender",
    "diabetes_status",
    "hypertension_status",
    "smoking_status",
    "cholesterol_level",
}


# ---------------------------------------------------------------------------
# Model loading
# ---------------------------------------------------------------------------

def load_model() -> bool:
    """
    Load heart_risk_model.pkl and label_encoders.pkl (+ optional scaler.pkl)
    from the same directory as this file.

    CRITICAL: Both model and encoders are always loaded together.

    Returns:
        True if both files were loaded successfully, False otherwise.
    """
    global _model, _encoders, _scaler, _loaded

    if _loaded:
        return _model is not None and _encoders is not None

    _loaded = True  # mark attempted even if files are missing

    # Check both required files exist
    model_missing    = not os.path.exists(MODEL_PATH)
    encoders_missing = not os.path.exists(ENCODERS_PATH)

    if model_missing or encoders_missing:
        missing = []
        if model_missing:
            missing.append("heart_risk_model.pkl")
        if encoders_missing:
            missing.append("label_encoders.pkl")
        logger.warning(
            "Prediction model not ready — missing: %s. "
            "Run train_model.py to generate the pkl files. "
            "Using rule-based fallback.",
            ", ".join(missing),
        )
        return False

    try:
        with open(MODEL_PATH, "rb") as f:
            _model = pickle.load(f)
        logger.info("Loaded model from %s", MODEL_PATH)

        with open(ENCODERS_PATH, "rb") as f:
            _encoders = pickle.load(f)
        logger.info("Loaded encoders from %s", ENCODERS_PATH)

        # Scaler is optional — was added in a later training run
        if os.path.exists(SCALER_PATH):
            with open(SCALER_PATH, "rb") as f:
                _scaler = pickle.load(f)
            logger.info("Loaded scaler from %s", SCALER_PATH)

        return True

    except Exception as exc:
        logger.error("Failed to load model/encoders: %s — using rule-based fallback", exc)
        _model = None
        _encoders = None
        _scaler = None
        return False


# ---------------------------------------------------------------------------
# Feature encoding
# ---------------------------------------------------------------------------

def _encode_features(features: Dict[str, Any]) -> list:
    """
    Encode raw feature dict into the ordered numeric vector expected by the model.

    Categorical fields (gender, diabetes_status, hypertension_status,
    smoking_status, cholesterol_level) are transformed using their respective
    LabelEncoder stored in label_encoders.pkl.

    All other fields are cast to float.
    """
    encoded = []
    for col in _FEATURE_ORDER:
        val = features.get(col)

        if col in _CATEGORICAL_FIELDS and _encoders and col in _encoders:
            encoder = _encoders[col]
            try:
                # Normalise the raw value to the same type the encoder saw
                str_val = _normalise_categorical(col, val)
                encoded.append(int(encoder.transform([str_val])[0]))
            except (ValueError, Exception) as e:
                # Unknown category — fall back to 0 to avoid hard crash
                logger.warning("LabelEncoder.transform failed for %s=%r: %s; using 0", col, val, e)
                encoded.append(0)
        else:
            encoded.append(float(val) if val is not None else 0.0)

    return encoded


def _normalise_categorical(col: str, val: Any) -> str:
    """
    Convert a raw categorical value to the string form the encoder expects.

    Training conventions:
      gender            → "M" or "F"
      diabetes_status   → "Yes" or "No"
      hypertension_status → "Yes" or "No"
      smoking_status    → "Yes" or "No"
      cholesterol_level → "Normal", "Borderline", "High"  (string in dataset)
    """
    if col == "gender":
        return "M" if str(val).strip().upper() in ("M", "MALE") else "F"

    if col in ("diabetes_status", "hypertension_status", "smoking_status"):
        if isinstance(val, bool):
            return "Yes" if val else "No"
        if isinstance(val, int):
            return "Yes" if val else "No"
        if isinstance(val, str):
            return "Yes" if val.lower() in ("true", "yes", "1") else "No"
        return "No"

    if col == "cholesterol_level":
        # If already a string category, pass through as-is
        if isinstance(val, str) and not _is_numeric(val):
            return val.strip()
        # If numeric, bin it into the training categories
        try:
            v = float(val)
            if v < 200:
                return "Normal"
            elif v < 240:
                return "Borderline"
            else:
                return "High"
        except (TypeError, ValueError):
            return "Normal"

    return str(val)


def _is_numeric(s: str) -> bool:
    try:
        float(s)
        return True
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# Rule-based fallback
# ---------------------------------------------------------------------------

def _rule_based_predict(features: Dict[str, Any]) -> Dict[str, Any]:
    """
    Score cardiovascular risk using clinically motivated weighted rules.
    Used when pkl files have not been trained yet or loading fails.

    Scoring:
      age > 60            +20
      hypertension        +15
      diabetes            +15
      cholesterol > 200   +10
      smoking             +10
      ldl > 130           +10
      hdl < 40            +10
      ecg_hrv < 20        +10  (low HRV = high risk)
    Maximum score: 100
    """
    score = 0.0

    age = float(features.get("age") or 40)
    if age > 60:
        score += 20

    if features.get("hypertension_status"):
        score += 15

    if features.get("diabetes_status"):
        score += 15

    chol_raw = features.get("cholesterol_level")
    try:
        chol = float(chol_raw)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        # String category like "High" / "Normal"
        if isinstance(chol_raw, str):
            chol = {"high": 250, "borderline": 210, "normal": 180}.get(
                chol_raw.lower(), 180
            )
        else:
            chol = 180.0
    if chol > 200:
        score += 10

    if features.get("smoking_status"):
        score += 10

    ldl = float(features.get("ldl") or 100)
    if ldl > 130:
        score += 10

    hdl = float(features.get("hdl") or 50)
    if hdl < 40:
        score += 10

    hrv = float(features.get("ecg_hrv") or 35)  # type: ignore[arg-type]
    if hrv < 20:
        score += 10

    risk_score = min(score, 100.0)
    risk_level = (
        "low"      if risk_score < 30
        else "moderate" if risk_score < 60
        else "high"
    )
    mid = abs(risk_score - (15 if risk_level == "low" else 45 if risk_level == "moderate" else 80))
    confidence = round(0.70 + 0.25 * (1 - mid / 100), 3)

    return {
        "risk_level": risk_level,
        "risk_score": round(risk_score / 100, 3),   # 0–1 scale
        "confidence": confidence,
        "blockage_probability": round(risk_score / 100 * 0.8, 3),
        "features_used": list(features.keys()),
        "model_type": "Rule-Based",
    }


# ---------------------------------------------------------------------------
# Main prediction function
# ---------------------------------------------------------------------------

def risk_predict(features: Dict[str, Any]) -> Dict[str, Any]:
    """
    Predict cardiovascular risk from a feature dictionary.

    Args:
        features: {
            age, gender, diabetes_status, hypertension_status,
            cholesterol_level, ldl, hdl, smoking_status,
            ecg_hrv, ecg_qrs_duration, ppg_peak_amplitude,
            perfusion_index, ptt
        }

    Returns:
        {
            risk_level:           "low" | "moderate" | "high",
            risk_score:           float  0–1,
            confidence:           float  0–1,
            blockage_probability: float  0–1,
            features_used:        list[str],
            model_type:           "Random Forest" | "Rule-Based",
        }
    """
    model_ready = load_model()

    if not model_ready:
        return _rule_based_predict(features)

    try:
        import numpy as np  # type: ignore[import-untyped]

        feature_vec = _encode_features(features)
        X = np.array(feature_vec, dtype=np.float64).reshape(1, -1)

        # Apply scaler if available
        X_input = _scaler.transform(X) if _scaler is not None else X

        probas = _model.predict_proba(X_input)[0]  # type: ignore[union-attr]  # shape: (n_classes,)
        # Class order from training: index 1 = high risk
        high_risk_proba = float(probas[1]) if len(probas) > 1 else float(probas[0])
        confidence = round(float(np.max(probas)), 3)

        risk_score = round(high_risk_proba, 3)
        risk_level = (
            "low"      if high_risk_proba < 0.30
            else "moderate" if high_risk_proba < 0.60
            else "high"
        )

        return {
            "risk_level": risk_level,
            "risk_score": risk_score,
            "confidence": confidence,
            "blockage_probability": round(high_risk_proba * 0.8, 3),
            "features_used": _FEATURE_ORDER,
            "model_type": "Random Forest",
        }

    except Exception as exc:
        logger.error("Model inference failed: %s — falling back to rule-based", exc)
        return _rule_based_predict(features)


# ---------------------------------------------------------------------------
# Model status
# ---------------------------------------------------------------------------

def get_model_status() -> Dict[str, Any]:
    """
    Return the current status of the prediction model.

    Returns:
        {
            loaded:         bool,
            model_ready:    bool,
            model_type:     str,
            model_path:     str,
            encoders_path:  str,
            accuracy:       float | None,
            last_trained:   str | None  (ISO timestamp),
        }
    """
    model_ready = load_model()

    base = {
        "loaded": model_ready,
        "model_ready": model_ready,
        "model_type": "Random Forest" if model_ready else "Rule-Based (fallback)",
        "model_path": MODEL_PATH,
        "encoders_path": ENCODERS_PATH,
        "accuracy": None,
        "last_trained": None,
    }

    if model_ready and os.path.exists(METADATA_PATH):
        try:
            with open(METADATA_PATH, "r") as f:
                meta = json.load(f)
            base["accuracy"] = meta.get("accuracy")
            base["last_trained"] = meta.get("trained_at")
        except Exception:
            pass

    return base
