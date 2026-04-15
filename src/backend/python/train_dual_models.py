"""
VASCUSCAN AI — Dual Model Trainer
Trains and saves two independent models:

  Model 1 (Form-Only):
    Inputs:  age, gender, diabetes_status, hypertension_status,
             cholesterol_level, ldl, hdl, smoking_status,
             family_history, activity_level, stress_level (11 features)
    Dataset: data/patient_history_dataset.csv
    Outputs: model1_form.pkl, scaler1_form.pkl, encoders1_form.pkl

  Model 2 (Full Sensor):
    Inputs:  All 11 above + ecg_heart_rate, ecg_hrv, ecg_qrs_duration,
             ppg_peak_amplitude, ppg_perfusion_index, ptt (17 features)
    Dataset: ../balanced_ecg_ppg_dataset.xlsx  (existing)
    Outputs: model2_sensor.pkl, scaler2_sensor.pkl

Risk labels: Low / Moderate / High (3-class)
"""

import logging
import os
import pickle

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("vascuscan.train_dual")

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ── Output paths ─────────────────────────────────────────────────────────────
MODEL1_PATH    = os.path.join(_BASE_DIR, "model1_form.pkl")
SCALER1_PATH   = os.path.join(_BASE_DIR, "scaler1_form.pkl")
ENCODERS1_PATH = os.path.join(_BASE_DIR, "encoders1_form.pkl")

MODEL2_PATH    = os.path.join(_BASE_DIR, "model2_sensor.pkl")
SCALER2_PATH   = os.path.join(_BASE_DIR, "scaler2_sensor.pkl")
ENCODERS2_PATH = os.path.join(_BASE_DIR, "encoders2_sensor.pkl")

# ── Feature schemas ───────────────────────────────────────────────────────────
FORM_FEATURES = [
    "age", "gender", "diabetes_status", "hypertension_status",
    "cholesterol_level", "ldl", "hdl", "smoking_status",
    "family_history", "activity_level", "stress_level",
]

SENSOR_FEATURES = FORM_FEATURES + [
    "ecg_heart_rate", "ecg_hrv", "ecg_qrs_duration",
    "ppg_peak_amplitude", "ppg_perfusion_index", "ptt",
]

CATEGORICAL_FORM = ["gender", "diabetes_status", "hypertension_status", "smoking_status",
                    "activity_level", "stress_level"]

TARGET = "risk_label"


# ── Encoding helpers ─────────────────────────────────────────────────────────

def encode_form_features(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Encode all categorical columns for Model 1. Returns encoded df + encoders dict."""
    df = df.copy()
    encoders = {}

    for col in CATEGORICAL_FORM:
        if col not in df.columns:
            continue
        le = LabelEncoder()
        df[col] = df[col].astype(str)
        le.fit(df[col])
        df[col] = le.transform(df[col])
        encoders[col] = le
        logger.info("  Encoded '%s': classes=%s", col, list(le.classes_))

    return df, encoders


def encode_risk_label(series: pd.Series) -> tuple[np.ndarray, LabelEncoder]:
    """Encode risk_label (Low/Moderate/High → 0/1/2)."""
    le = LabelEncoder()
    le.fit(["High", "Low", "Moderate"])  # alphabetical: High=0, Low=1, Moderate=2
    encoded = le.transform(series.astype(str))
    return encoded, le


# ── Model 1 ──────────────────────────────────────────────────────────────────

def train_model1() -> dict:
    """Train form-only model (11 features, no ECG/PPG)."""
    print("\n" + "="*60)
    print("  MODEL 1: Form-Only (No Sensor)")
    print("="*60)

    # Generate dataset if missing
    data_path = os.path.join(_BASE_DIR, "data", "patient_history_dataset.csv")
    if not os.path.exists(data_path):
        print("[!] Dataset not found — generating patient_history_dataset.csv ...")
        from generate_form_dataset import generate_form_dataset
        os.makedirs(os.path.join(_BASE_DIR, "data"), exist_ok=True)
        df_gen = generate_form_dataset(n_samples=2000)
        df_gen.to_csv(data_path, index=False)
        print(f"[✓] Generated {len(df_gen)} rows → {data_path}")

    df = pd.read_csv(data_path)
    print(f"[✓] Loaded {len(df)} rows from {data_path}")
    print(f"    Risk distribution:\n{df[TARGET].value_counts().to_string()}")

    # Keep only needed columns
    available_features = [f for f in FORM_FEATURES if f in df.columns]
    df = df[available_features + [TARGET]].dropna()

    # Encode categoricals
    df, encoders = encode_form_features(df)

    # Encode target
    y, label_le = encode_risk_label(df[TARGET])
    encoders["risk_label"] = label_le

    X = df[available_features].values.astype(np.float64)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s  = scaler.transform(X_test)

    clf = GradientBoostingClassifier(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.08,
        min_samples_split=5,
        random_state=42,
    )
    clf.fit(X_train_s, y_train)

    y_pred = clf.predict(X_test_s)
    acc = accuracy_score(y_test, y_pred)

    print(f"\n[✓] Model 1 Accuracy: {acc * 100:.2f}%")
    print(classification_report(y_test, y_pred, target_names=label_le.classes_))

    # Save
    with open(MODEL1_PATH, "wb") as f:
        pickle.dump(clf, f)
    with open(SCALER1_PATH, "wb") as f:
        pickle.dump(scaler, f)
    with open(ENCODERS1_PATH, "wb") as f:
        pickle.dump(encoders, f)

    print(f"[✓] Saved model1_form.pkl, scaler1_form.pkl, encoders1_form.pkl")

    return {"accuracy": acc, "features": available_features, "label_classes": list(label_le.classes_)}


# ── Model 2 ──────────────────────────────────────────────────────────────────

def train_model2() -> dict:
    """Train full sensor model (17 features: form + ECG/PPG)."""
    print("\n" + "="*60)
    print("  MODEL 2: Full Sensor (Form + ECG/PPG)")
    print("="*60)

    # Try the xlsx dataset first, then fall back to synthetic generation
    xlsx_path = os.path.join(_BASE_DIR, "..", "balanced_ecg_ppg_dataset.xlsx")
    csv_path  = os.path.join(_BASE_DIR, "data", "full_sensor_dataset.csv")

    if os.path.exists(xlsx_path):
        print(f"[✓] Loading existing dataset: {xlsx_path}")
        df_raw = pd.read_excel(xlsx_path)
        print(f"    Columns: {list(df_raw.columns)}")
    elif os.path.exists(csv_path):
        print(f"[✓] Loading cached dataset: {csv_path}")
        df_raw = pd.read_csv(csv_path)
    else:
        print("[!] No full sensor dataset found — generating synthetic data ...")
        df_raw = _generate_sensor_dataset(n_samples=2000)
        os.makedirs(os.path.join(_BASE_DIR, "data"), exist_ok=True)
        df_raw.to_csv(csv_path, index=False)
        print(f"[✓] Generated and saved to {csv_path}")

    print(f"    Shape: {df_raw.shape}")
    if TARGET in df_raw.columns:
        print(f"    Risk distribution:\n{df_raw[TARGET].value_counts().to_string()}")

    # Normalise column names to match schema
    df_raw.columns = [c.strip().lower().replace(" ", "_") for c in df_raw.columns]

    # Re-map common alternative column names
    col_map = {
        "ecg_heart_rate": ["ecg_heart_rate", "heart_rate", "ecg_hr"],
        "ecg_hrv":        ["ecg_hrv", "hrv", "heart_rate_variability"],
        "ecg_qrs_duration": ["ecg_qrs_duration", "qrs_duration", "qrs"],
        "ppg_peak_amplitude": ["ppg_peak_amplitude", "ppg_amplitude", "peak_amplitude"],
        "ppg_perfusion_index": ["ppg_perfusion_index", "perfusion_index"],
        "ptt": ["ptt", "pulse_transit_time"],
        "risk_label": ["risk_label", "risk", "label", "cardiovascular_risk"],
        "gender": ["gender", "sex"],
        "diabetes_status": ["diabetes_status", "diabetes"],
        "hypertension_status": ["hypertension_status", "hypertension"],
        "smoking_status": ["smoking_status", "smoking"],
        "activity_level": ["activity_level", "activity"],
        "stress_level": ["stress_level", "stress"],
        "cholesterol_level": ["cholesterol_level", "cholesterol"],
        "family_history": ["family_history", "family_heart_disease"],
    }
    for canonical, alts in col_map.items():
        if canonical not in df_raw.columns:
            for alt in alts:
                if alt in df_raw.columns:
                    df_raw.rename(columns={alt: canonical}, inplace=True)
                    break

    # For the xlsx dataset (which has different feature set), handle gracefully
    # Add synthetic ECG/PPG if columns are missing
    for sensor_col in ["ecg_heart_rate", "ecg_hrv", "ecg_qrs_duration",
                        "ppg_peak_amplitude", "ppg_perfusion_index", "ptt"]:
        if sensor_col not in df_raw.columns:
            df_raw[sensor_col] = _synthetic_sensor_column(sensor_col, len(df_raw))
            logger.info("Added synthetic column: %s", sensor_col)

    # For form features that may be missing
    for form_col in FORM_FEATURES:
        if form_col not in df_raw.columns:
            df_raw[form_col] = _synthetic_form_column(form_col, len(df_raw))
            logger.info("Added synthetic column: %s", form_col)

    # Ensure risk_label is present and normalised to Low/Moderate/High
    df_raw = _normalise_risk_label(df_raw)

    available = [f for f in SENSOR_FEATURES if f in df_raw.columns]
    df = df_raw[available + [TARGET]].dropna()
    print(f"[✓] Working dataset: {len(df)} rows × {len(available)} features")

    # Encode categoricals (same as Model 1, plus any sensor categoricals)
    df_enc = df.copy()
    encoders = {}
    cat_cols = [c for c in CATEGORICAL_FORM if c in df_enc.columns]
    for col in cat_cols:
        le = LabelEncoder()
        df_enc[col] = df_enc[col].astype(str)
        le.fit(df_enc[col])
        df_enc[col] = le.transform(df_enc[col])
        encoders[col] = le

    y, label_le = encode_risk_label(df_enc[TARGET])
    encoders["risk_label"] = label_le

    X = df_enc[available].values.astype(np.float64)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s  = scaler.transform(X_test)

    clf = GradientBoostingClassifier(
        n_estimators=200,
        max_depth=5,
        learning_rate=0.08,
        min_samples_split=4,
        random_state=42,
    )
    clf.fit(X_train_s, y_train)

    y_pred = clf.predict(X_test_s)
    acc = accuracy_score(y_test, y_pred)

    print(f"\n[✓] Model 2 Accuracy: {acc * 100:.2f}%")
    print(classification_report(y_test, y_pred, target_names=label_le.classes_))

    with open(MODEL2_PATH, "wb") as f:
        pickle.dump(clf, f)
    with open(SCALER2_PATH, "wb") as f:
        pickle.dump(scaler, f)
    with open(ENCODERS2_PATH, "wb") as f:
        pickle.dump(encoders, f)
    
    # Save the actual feature list used (in order) alongside the model
    meta_path = os.path.join(_BASE_DIR, "model2_features.pkl")
    with open(meta_path, "wb") as f:
        pickle.dump(available, f)

    print(f"[✓] Saved model2_sensor.pkl, scaler2_sensor.pkl, encoders2_sensor.pkl")
    print(f"    Features used: {available}")

    return {"accuracy": acc, "features": available, "label_classes": list(label_le.classes_)}


# ── Helpers for missing columns ───────────────────────────────────────────────

def _synthetic_sensor_column(col_name: str, n: int) -> np.ndarray:
    rng = np.random.default_rng(sum(ord(c) for c in col_name))
    defaults = {
        "ecg_heart_rate": (75, 12, 40, 150),
        "ecg_hrv":        (35, 15, 5, 100),
        "ecg_qrs_duration": (95, 15, 60, 160),
        "ppg_peak_amplitude": (0.60, 0.20, 0.1, 1.0),
        "ppg_perfusion_index": (3.5, 1.5, 0.5, 10.0),
        "ptt": (250, 50, 100, 500),
    }
    mu, sigma, lo, hi = defaults.get(col_name, (0, 1, -10, 10))
    return rng.normal(mu, sigma, n).clip(lo, hi).round(2)


def _synthetic_form_column(col_name: str, n: int) -> np.ndarray:
    rng = np.random.default_rng(sum(ord(c) for c in col_name) + 1)
    if col_name == "family_history":
        return rng.binomial(1, 0.25, n)
    if col_name == "activity_level":
        return rng.choice(["Sedentary", "Light", "Moderate", "Vigorous"], n, p=[0.25, 0.30, 0.35, 0.10])
    if col_name == "stress_level":
        return rng.choice(["Low", "Moderate", "High"], n, p=[0.35, 0.45, 0.20])
    return np.zeros(n)


def _normalise_risk_label(df: pd.DataFrame) -> pd.DataFrame:
    """Convert various risk_label formats to Low/Moderate/High."""
    df = df.copy()
    if TARGET not in df.columns:
        # Try to create from existing numeric columns
        logger.warning("risk_label column missing — assigning synthetic labels")
        df[TARGET] = np.random.choice(["Low", "Moderate", "High"], len(df), p=[0.40, 0.35, 0.25])
        return df

    raw = df[TARGET].astype(str).str.strip()

    def _map(v):
        v = v.lower()
        if v in ("high", "2", "3"):
            return "High"
        if v in ("moderate", "medium", "1"):
            return "Moderate"
        return "Low"

    df[TARGET] = raw.apply(_map)
    return df


def _generate_sensor_dataset(n_samples: int = 2000) -> pd.DataFrame:
    """Fallback: generate a full sensor dataset synthetically."""
    from generate_form_dataset import generate_form_dataset
    df = generate_form_dataset(n_samples=n_samples)
    rng = np.random.default_rng(99)
    df["ecg_heart_rate"]   = rng.normal(75, 12, n_samples).clip(40, 150).round(1)
    df["ecg_hrv"]          = rng.normal(35, 15, n_samples).clip(5, 100).round(2)
    df["ecg_qrs_duration"] = rng.normal(95, 15, n_samples).clip(60, 160).round(1)
    df["ppg_peak_amplitude"] = rng.normal(0.60, 0.20, n_samples).clip(0.1, 1.0).round(3)
    df["ppg_perfusion_index"] = rng.normal(3.5, 1.5, n_samples).clip(0.5, 10.0).round(2)
    df["ptt"] = rng.normal(250, 50, n_samples).clip(100, 500).round(1)
    return df


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("\n🧠 VASCUSCAN AI — Dual Model Training")
    print("=" * 60)

    r1 = train_model1()
    r2 = train_model2()

    print("\n" + "=" * 60)
    print("  TRAINING COMPLETE")
    print("=" * 60)
    print(f"  Model 1 (Form-Only)   accuracy: {r1['accuracy'] * 100:.2f}%  ({len(r1['features'])} features)")
    print(f"  Model 2 (Full Sensor) accuracy: {r2['accuracy'] * 100:.2f}%  ({len(r2['features'])} features)")
    print("\nSaved files:")
    print(f"  {MODEL1_PATH}")
    print(f"  {SCALER1_PATH}")
    print(f"  {ENCODERS1_PATH}")
    print(f"  {MODEL2_PATH}")
    print(f"  {SCALER2_PATH}")
    print(f"  {ENCODERS2_PATH}")
