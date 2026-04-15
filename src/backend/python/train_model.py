"""
VASCUSCAN AI — Model Training
Trains a Random Forest classifier on the cardiovascular dataset.

Saves three files alongside this script (relative paths, Render-compatible):
  heart_risk_model.pkl  — trained RandomForestClassifier
  label_encoders.pkl    — dict of LabelEncoder objects for categorical fields
  scaler.pkl            — StandardScaler for numeric features

CRITICAL: Both heart_risk_model.pkl AND label_encoders.pkl are always saved
together. The encoders are required by predict.py to transform categorical
inputs before running inference.
"""

import json
import logging
import os
import pickle
from datetime import datetime
from typing import Optional

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler

logger = logging.getLogger("vascuscan.train")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

FEATURE_COLUMNS = [
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
TARGET_COLUMN = "risk_label"  # 0 = low risk, 1 = high risk

# Categorical columns that get LabelEncoder treatment
CATEGORICAL_COLUMNS = [
    "gender",
    "diabetes_status",
    "hypertension_status",
    "smoking_status",
    "cholesterol_level",
]

_BASE_DIR        = os.path.dirname(os.path.abspath(__file__))
_DEFAULT_DATASET = os.path.join(_BASE_DIR, "data", "cardio_dataset_1600.csv")

# Output paths — same directory as this script so predict.py can find them
MODEL_PATH    = os.path.join(_BASE_DIR, "heart_risk_model.pkl")
ENCODERS_PATH = os.path.join(_BASE_DIR, "label_encoders.pkl")
SCALER_PATH   = os.path.join(_BASE_DIR, "scaler.pkl")
_MODEL_DIR    = os.path.join(_BASE_DIR, "models")
_METADATA_PATH = os.path.join(_MODEL_DIR, "model_metadata.json")


# ---------------------------------------------------------------------------
# Dataset loading
# ---------------------------------------------------------------------------

def load_dataset(filepath: Optional[str] = None) -> pd.DataFrame:
    """
    Load and validate the cardiovascular training dataset.

    Args:
        filepath: Path to CSV file.  Defaults to data/cardio_dataset_1600.csv.

    Returns:
        Raw DataFrame (categorical columns left as strings for encoder fitting).
    """
    path = filepath or _DEFAULT_DATASET

    if not os.path.exists(path):
        raise FileNotFoundError(
            f"Dataset not found at {path}. Run 'python generate_dataset.py' first."
        )

    df = pd.read_csv(path)
    logger.info("Loaded dataset: %d rows, %d columns from %s", len(df), len(df.columns), path)

    # Drop rows missing any required column
    required = FEATURE_COLUMNS + [TARGET_COLUMN]
    available = [c for c in required if c in df.columns]
    df = df[available].dropna()
    logger.info("After dropping nulls: %d rows remain", len(df))

    return df


# ---------------------------------------------------------------------------
# Categorical encoding helpers
# ---------------------------------------------------------------------------

def _normalise_column(df: pd.DataFrame, col: str) -> pd.DataFrame:
    """
    Normalise raw dataset values for a categorical column into consistent
    string labels that match what the LabelEncoder will be trained on.
    """
    df = df.copy()

    if col == "gender":
        df[col] = df[col].apply(
            lambda v: "M" if str(v).strip().upper() in ("M", "MALE") else "F"
        )

    elif col in ("diabetes_status", "hypertension_status", "smoking_status"):
        def _to_yes_no(v):
            if isinstance(v, bool):
                return "Yes" if v else "No"
            if isinstance(v, (int, float)):
                return "Yes" if v else "No"
            if isinstance(v, str):
                return "Yes" if v.lower() in ("true", "yes", "1") else "No"
            return "No"
        df[col] = df[col].apply(_to_yes_no)

    elif col == "cholesterol_level":
        def _to_chol_category(v):
            # If already a meaningful string category, normalise capitalisation
            if isinstance(v, str) and not _is_numeric_str(v):
                lv = v.strip().lower()
                mapping = {"high": "High", "borderline": "Borderline", "normal": "Normal"}
                return mapping.get(lv, v.strip())
            # If numeric (mg/dL), bin it
            try:
                n = float(v)
                if n < 200:
                    return "Normal"
                elif n < 240:
                    return "Borderline"
                else:
                    return "High"
            except (TypeError, ValueError):
                return "Normal"
        df[col] = df[col].apply(_to_chol_category)

    return df


def _is_numeric_str(s) -> bool:
    try:
        float(s)
        return True
    except (ValueError, TypeError):
        return False


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

def train_and_save_model(dataset_path: Optional[str] = None) -> dict:
    """
    Train a Random Forest classifier and save model + encoders + scaler.

    Steps:
      1. Load dataset
      2. Normalise and fit LabelEncoders for categorical columns
      3. Encode the full dataset using those encoders
      4. Split 80/20 train/test
      5. Fit StandardScaler on training set
      6. Train RandomForestClassifier
      7. Evaluate on test set
      8. Save heart_risk_model.pkl, label_encoders.pkl, scaler.pkl, metadata

    Args:
        dataset_path: Optional path to dataset CSV.

    Returns:
        Training metadata dict (accuracy, precision, recall, f1, trained_at, …).
    """
    df = load_dataset(dataset_path)

    # --- Step 1: Normalise and fit LabelEncoders ---
    encoders: dict = {}
    for col in CATEGORICAL_COLUMNS:
        if col not in df.columns:
            continue
        df = _normalise_column(df, col)
        le = LabelEncoder()
        le.fit(df[col].astype(str))
        encoders[col] = le
        df[col] = le.transform(df[col].astype(str))
        logger.info("LabelEncoder for '%s': classes = %s", col, list(le.classes_))

    X = df[FEATURE_COLUMNS].values.astype(np.float64)
    y = df[TARGET_COLUMN].values.astype(int)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    # --- Step 2: Scale numeric features ---
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled  = scaler.transform(X_test)

    # --- Step 3: Train ---
    clf = RandomForestClassifier(
        n_estimators=100,
        max_depth=10,
        min_samples_split=4,
        random_state=42,
        n_jobs=-1,
    )
    clf.fit(X_train_scaled, y_train)
    logger.info("Training complete — %d trees", clf.n_estimators)

    # --- Step 4: Evaluate ---
    y_pred    = clf.predict(X_test_scaled)
    accuracy  = float(accuracy_score(y_test, y_pred))
    precision = float(precision_score(y_test, y_pred, zero_division=0))
    recall    = float(recall_score(y_test, y_pred, zero_division=0))
    f1        = float(f1_score(y_test, y_pred, zero_division=0))
    report    = classification_report(y_test, y_pred, output_dict=True)

    feature_importance = {
        col: round(float(imp), 5)
        for col, imp in zip(FEATURE_COLUMNS, clf.feature_importances_)
    }

    metadata = {
        "accuracy": round(accuracy, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "feature_importance": feature_importance,
        "classification_report": report,
        "trained_at": datetime.utcnow().isoformat(),
        "dataset_rows": len(df),
        "train_size": len(X_train),
        "test_size": len(X_test),
        "model_params": clf.get_params(),
        "categorical_encoders": {col: list(enc.classes_) for col, enc in encoders.items()},
    }

    # --- Step 5: Save model, encoders, scaler ---

    # heart_risk_model.pkl
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(clf, f)
    print(f"[✓] Saved model      → {MODEL_PATH}")
    logger.info("Model saved to %s (accuracy=%.3f)", MODEL_PATH, accuracy)

    # label_encoders.pkl — dict { column_name: LabelEncoder }
    with open(ENCODERS_PATH, "wb") as f:
        pickle.dump(encoders, f)
    print(f"[✓] Saved encoders   → {ENCODERS_PATH}")
    logger.info("Encoders saved to %s  keys=%s", ENCODERS_PATH, list(encoders.keys()))

    # scaler.pkl
    with open(SCALER_PATH, "wb") as f:
        pickle.dump(scaler, f)
    print(f"[✓] Saved scaler     → {SCALER_PATH}")
    logger.info("Scaler saved to %s", SCALER_PATH)

    # model_metadata.json (for status endpoint)
    os.makedirs(_MODEL_DIR, exist_ok=True)
    with open(_METADATA_PATH, "w") as f:
        json.dump(metadata, f, indent=2, default=str)
    print(f"[✓] Saved metadata   → {_METADATA_PATH}")
    logger.info("Metadata saved to %s", _METADATA_PATH)

    return metadata


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse

    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    parser = argparse.ArgumentParser(description="Train VASCUSCAN AI cardiovascular risk model")
    parser.add_argument("--dataset", default=None, help="Path to training CSV")
    args = parser.parse_args()

    result = train_and_save_model(dataset_path=args.dataset)
    print(f"\nTraining complete.")
    print(f"  Accuracy:  {result['accuracy']:.3f}")
    print(f"  Precision: {result['precision']:.3f}")
    print(f"  Recall:    {result['recall']:.3f}")
    print(f"  F1 Score:  {result['f1']:.3f}")
    print(f"  Dataset rows: {result['dataset_rows']}")
    print(f"\nTop features by importance:")
    sorted_imp = sorted(result["feature_importance"].items(), key=lambda x: -x[1])
    for feat, imp in sorted_imp[:5]:
        print(f"  {feat:30s}  {imp:.4f}")
    print(f"\nEncoder classes:")
    for col, classes in result["categorical_encoders"].items():
        print(f"  {col:30s}  {classes}")
