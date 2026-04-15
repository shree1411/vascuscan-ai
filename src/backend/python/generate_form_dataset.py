"""
VASCUSCAN AI — Dataset 1: Patient History (Form-Only)
Generates a realistic cardiovascular dataset with ONLY clinical/form features.
No ECG or PPG sensor data is included.
This matches the label_encoders.pkl schema exactly.

Features (11):
  age, gender, diabetes_status, hypertension_status, cholesterol_level,
  ldl, hdl, smoking_status, family_history, activity_level, stress_level

Target (3-class):
  risk_label: Low / Moderate / High
"""

import logging
import os

import numpy as np
import pandas as pd

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("vascuscan.generate_form")

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_DEFAULT_OUTPUT = os.path.join(_BASE_DIR, "data", "patient_history_dataset.csv")

FORM_FEATURES = [
    "age", "gender", "diabetes_status", "hypertension_status",
    "cholesterol_level", "ldl", "hdl", "smoking_status",
    "family_history", "activity_level", "stress_level",
]
TARGET_COLUMN = "risk_label"


def generate_form_dataset(n_samples: int = 2000, seed: int = 42) -> pd.DataFrame:
    """
    Generate a synthetic patient-history-only dataset with 3-class risk labels.
    Distributions are calibrated to published epidemiological data.
    Risk labels: Low / Moderate / High  (roughly 40/35/25 split)
    """
    rng = np.random.default_rng(seed)

    # ── Demographics ────────────────────────────────────────────────────
    age = rng.normal(loc=52, scale=16, size=n_samples).clip(18, 85).astype(int)
    gender_raw = rng.choice(["Male", "Female"], size=n_samples, p=[0.50, 0.50])

    # ── Medical conditions ───────────────────────────────────────────────
    diabetes_raw = rng.choice(
        ["No", "Prediabetes", "Type 1", "Type 2"],
        size=n_samples,
        p=[0.68, 0.15, 0.05, 0.12],
    )
    hypertension_raw = rng.choice(
        ["No", "Treated", "Untreated"],
        size=n_samples,
        p=[0.60, 0.25, 0.15],
    )
    smoking_raw = rng.choice(
        ["Never", "Former", "Current"],
        size=n_samples,
        p=[0.55, 0.25, 0.20],
    )

    # ── Lipid panel (correlated) ─────────────────────────────────────────
    chol_base = rng.normal(loc=195, scale=42, size=n_samples).clip(100, 400).round(1)
    ldl = (chol_base * 0.55 + rng.normal(0, 22, n_samples)).clip(50, 300).round(1)
    hdl = (82 - chol_base * 0.15 + rng.normal(0, 12, n_samples)).clip(20, 100).round(1)

    # ── Family history (boolean) ─────────────────────────────────────────
    family_history = rng.binomial(1, 0.25, size=n_samples)  # 25% prevalence

    # ── Lifestyle ────────────────────────────────────────────────────────
    activity_raw = rng.choice(
        ["Sedentary", "Light", "Moderate", "Vigorous"],
        size=n_samples,
        p=[0.25, 0.30, 0.35, 0.10],
    )
    stress_raw = rng.choice(
        ["Low", "Moderate", "High"],
        size=n_samples,
        p=[0.35, 0.45, 0.20],
    )

    # ── Risk label scoring ────────────────────────────────────────────────
    # Encode for scoring only (not stored as-is), match real clinical weights
    has_diabetes     = (diabetes_raw != "No").astype(int)
    has_hypertension = (hypertension_raw != "No").astype(int)
    is_smoker        = (smoking_raw == "Current").astype(int)
    is_sedentary     = (activity_raw == "Sedentary").astype(int)
    high_stress      = (stress_raw == "High").astype(int)

    score = np.zeros(n_samples)
    score += (age > 60).astype(float) * 2.5
    score += (age > 45).astype(float) * 1.0
    score += has_hypertension * 2.0
    score += has_diabetes * 2.0
    score += (chol_base > 240).astype(float) * 1.5
    score += (ldl > 160).astype(float) * 1.5
    score += (hdl < 40).astype(float) * 1.0
    score += is_smoker * 1.5
    score += family_history * 1.0
    score += is_sedentary * 0.8
    score += high_stress * 0.8
    score += rng.normal(0, 0.5, n_samples)  # realistic noise

    # Map to 3-class labels
    low_thresh      = np.percentile(score, 42)
    moderate_thresh = np.percentile(score, 77)
    risk_label = np.where(
        score < low_thresh, "Low",
        np.where(score < moderate_thresh, "Moderate", "High")
    )

    df = pd.DataFrame({
        "age": age,
        "gender": gender_raw,
        "diabetes_status": diabetes_raw,
        "hypertension_status": hypertension_raw,
        "cholesterol_level": chol_base,
        "ldl": ldl,
        "hdl": hdl,
        "smoking_status": smoking_raw,
        "family_history": family_history,
        "activity_level": activity_raw,
        "stress_level": stress_raw,
        TARGET_COLUMN: risk_label,
    })

    counts = df[TARGET_COLUMN].value_counts()
    logger.info(
        "Generated %d samples — Low: %d, Moderate: %d, High: %d",
        n_samples,
        counts.get("Low", 0),
        counts.get("Moderate", 0),
        counts.get("High", 0),
    )
    return df


if __name__ == "__main__":
    os.makedirs(os.path.join(_BASE_DIR, "data"), exist_ok=True)
    df = generate_form_dataset(n_samples=2000)
    df.to_csv(_DEFAULT_OUTPUT, index=False)
    print(f"\n[✓] Saved {len(df)} rows → {_DEFAULT_OUTPUT}")
    print(f"\nRisk distribution:")
    print(df["risk_label"].value_counts().to_string())
    print(f"\nFeatures: {FORM_FEATURES}")
