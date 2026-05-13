import pickle
import numpy as np
import os
from typing import Dict, Any, Tuple
from app.core.config import settings

class RiskEngineService:
    """
    Manages loading and execution of VascuScan AI diagnostic models.
    Supports Module 1 (Diagnostic/History) and Module 2 (Live/Sensor) pipelines.
    """
    def __init__(self):
        self.model1, self.scaler1, self.encoders1 = self._load_triple(
            settings.MODEL1_PATH, settings.SCALER1_PATH, settings.ENCODERS1_PATH, "Module 1"
        )
        self.model2, self.scaler2, self.encoders2 = self._load_triple(
            settings.MODEL2_PATH, settings.SCALER2_PATH, settings.ENCODERS2_PATH, "Module 2"
        )

    def _load_triple(self, mp, sp, ep, label) -> Tuple[Any, Any, Any]:
        try:
            if not all(os.path.exists(p) for p in [mp, sp, ep]):
                print(f"[!] Warning: Files for {label} missing.")
                return None, None, None
            with open(mp, "rb") as f: m = pickle.load(f)
            with open(sp, "rb") as f: s = pickle.load(f)
            with open(ep, "rb") as f: e = pickle.load(f)
            return m, s, e
        except Exception as ex:
            print(f"[!] Error loading {label}: {ex}")
            return None, None, None

    def _encode_value(self, col: str, val: Any, encoders: dict) -> float:
        if col not in settings.CATEGORICAL_FIELDS or not encoders or col not in encoders:
            try: return float(val) if val is not None else 0.0
            except: return 0.0
        le = encoders[col]
        raw = str(val).strip() if val is not None else ""
        # Handle categorical mapping (Normalise to training vocab)
        # (Logic ported from legacy app.py _encode_value)
        try: return int(le.transform([raw])[0])
        except: return 0

    def predict_module1(self, patient_data: Dict[str, Any]) -> Dict[str, Any]:
        """Diagnostic Prediction using Patient Registration/History only."""
        if not self.model1: return {"error": "Module 1 not loaded"}
        vec = [self._encode_value(c, patient_data.get(c), self.encoders1) for c in settings.FORM_FEATURES]
        X = np.array(vec).reshape(1, -1)
        X_s = self.scaler1.transform(X)
        probas = self.model1.predict_proba(X_s)[0]
        return self._decode_risk(probas, self.encoders1, "model1_form")

    def predict_module2(self, combined_data: Dict[str, Any]) -> Dict[str, Any]:
        """Live Monitoring Prediction combining Sensors + History."""
        if not self.model2: return {"error": "Module 2 not loaded"}
        vec = [self._encode_value(c, combined_data.get(c), self.encoders2) for c in settings.SENSOR_FEATURES]
        X = np.array(vec).reshape(1, -1)
        X_s = self.scaler2.transform(X)
        probas = self.model2.predict_proba(X_s)[0]
        return self._decode_risk(probas, self.encoders2, "model2_sensor")

    def _decode_risk(self, probas: np.ndarray, encoders: dict, model_id: str) -> Dict[str, Any]:
        label_le = encoders.get("risk_label")
        classes = list(label_le.classes_) if label_le else ["Low", "Moderate", "High"]
        pred_idx = int(np.argmax(probas))
        risk_level = classes[pred_idx]
        proba_dict = {c: round(float(p) * 100, 2) for c, p in zip(classes, probas)}
        
        # Severity calculation
        sev = (proba_dict.get("Moderate", 0) * 0.5) + (proba_dict.get("High", 0) * 1.0)
        
        return {
            "risk_level": risk_level,
            "risk_score": int(sev),
            "probabilities": proba_dict,
            "model_used": model_id
        }

# Singleton instance
risk_engine = RiskEngineService()
