"""
VASCUSCAN AI — Synthetic Dataset Generator
Generates 1600 realistic cardiovascular samples for model training and testing.
"""

import logging
import os
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger("vascuscan.dataset")

_DEFAULT_OUTPUT = os.path.join(
    os.path.dirname(__file__), "data", "cardio_dataset_1600.csv"
)


# ---------------------------------------------------------------------------
# Dataset generation
# ---------------------------------------------------------------------------

def generate_cardio_dataset(n_samples: int = 1600, seed: int = 42) -> pd.DataFrame:
    """
    Generate a synthetic cardiovascular dataset with realistic feature distributions.

    Feature distributions are calibrated to match published epidemiological data.
    Risk labels are derived from a scoring function that mirrors clinical guidelines.

    Args:
        n_samples: Number of rows to generate (default 1600).
        seed:      Random seed for reproducibility.

    Returns:
        DataFrame with one row per patient sample and a binary risk_label column.
    """
    rng = np.random.default_rng(seed)

    # ------------------------------------------------------------------
    # Demographics
    # ------------------------------------------------------------------
    age = rng.normal(loc=55, scale=15, size=n_samples).clip(18, 85).astype(int)
    gender = rng.binomial(1, 0.50, size=n_samples)  # 1=M, 0=F

    # ------------------------------------------------------------------
    # Medical history
    # ------------------------------------------------------------------
    diabetes_status = rng.binomial(1, 0.15, size=n_samples)        # 15% prevalence
    hypertension_status = rng.binomial(1, 0.30, size=n_samples)    # 30% prevalence
    smoking_status = rng.binomial(1, 0.20, size=n_samples)         # 20% prevalence

    # Lipid panel — correlated: high cholesterol tends toward high LDL, low HDL
    cholesterol_base = rng.normal(loc=195, scale=40, size=n_samples).clip(100, 400)
    ldl = (cholesterol_base * 0.55 + rng.normal(0, 20, n_samples)).clip(50, 300)
    hdl = (80 - cholesterol_base * 0.15 + rng.normal(0, 12, n_samples)).clip(20, 100)
    cholesterol_level = cholesterol_base.round(1)
    ldl = ldl.round(1)
    hdl = hdl.round(1)

    # ------------------------------------------------------------------
    # ECG features
    # ------------------------------------------------------------------
    # HRV decreases with age and hypertension
    hrv_base = rng.normal(loc=35, scale=15, size=n_samples)
    hrv_penalty = hypertension_status * 8 + (age > 60).astype(int) * 5
    ecg_hrv = (hrv_base - hrv_penalty).clip(5, 100).round(2)

    # QRS duration increases slightly with cardiac disease
    qrs_base = rng.normal(loc=95, scale=15, size=n_samples)
    qrs_penalty = diabetes_status * 5 + hypertension_status * 5
    ecg_qrs_duration = (qrs_base + qrs_penalty).clip(60, 160).round(1)

    # ------------------------------------------------------------------
    # PPG features
    # ------------------------------------------------------------------
    ppg_peak_amplitude = rng.normal(loc=0.60, scale=0.20, size=n_samples).clip(0.1, 1.0).round(3)
    perfusion_index = rng.normal(loc=3.5, scale=1.5, size=n_samples).clip(0.5, 10.0).round(2)

    # PTT decreases with higher blood pressure (stiffer vessels)
    ptt_base = rng.normal(loc=250, scale=50, size=n_samples)
    ptt_penalty = hypertension_status * 30 + (age > 60).astype(int) * 20
    ptt = (ptt_base - ptt_penalty).clip(100, 500).round(1)

    # ------------------------------------------------------------------
    # Risk label calculation
    # ------------------------------------------------------------------
    score = np.zeros(n_samples, dtype=int)
    score += (age > 60).astype(int) * 2
    score += hypertension_status * 2
    score += diabetes_status * 2
    score += (cholesterol_level > 200).astype(int)
    score += (ldl > 130).astype(int)
    score += (hdl < 40).astype(int)
    score += smoking_status
    score += (ecg_hrv < 20).astype(int)
    score += (ecg_qrs_duration > 120).astype(int)
    score += (perfusion_index < 1.5).astype(int)

    risk_label = (score >= 4).astype(int)

    # Add ~5% label noise for realistic training challenge
    noise_mask = rng.random(n_samples) < 0.05
    risk_label[noise_mask] = 1 - risk_label[noise_mask]

    # ------------------------------------------------------------------
    # Assemble DataFrame
    # ------------------------------------------------------------------
    df = pd.DataFrame({
        "age": age,
        "gender": gender,                      # 1=M, 0=F
        "diabetes_status": diabetes_status,
        "hypertension_status": hypertension_status,
        "cholesterol_level": cholesterol_level,
        "ldl": ldl,
        "hdl": hdl,
        "smoking_status": smoking_status,
        "ecg_hrv": ecg_hrv,
        "ecg_qrs_duration": ecg_qrs_duration,
        "ppg_peak_amplitude": ppg_peak_amplitude,
        "perfusion_index": perfusion_index,
        "ptt": ptt,
        "risk_label": risk_label,
    })

    high_risk_pct = risk_label.mean() * 100
    logger.info(
        "Generated %d samples — %.1f%% high risk, %.1f%% low risk",
        n_samples, high_risk_pct, 100 - high_risk_pct,
    )

    return df


# ---------------------------------------------------------------------------
# Save helper
# ---------------------------------------------------------------------------

def save_dataset(df: pd.DataFrame, output_path: Optional[str] = None) -> str:
    """
    Save the dataset DataFrame to a CSV file.

    Args:
        df:          DataFrame to save.
        output_path: Destination file path.
                     Defaults to src/backend/python/data/cardio_dataset_1600.csv.

    Returns:
        Absolute path of the saved file.
    """
    dest = output_path or _DEFAULT_OUTPUT
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    df.to_csv(dest, index=False)
    logger.info("Dataset saved to %s (%d rows)", dest, len(df))
    return dest


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse

    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

    parser = argparse.ArgumentParser(description="Generate VASCUSCAN AI synthetic cardiovascular dataset")
    parser.add_argument("--samples", type=int, default=1600, help="Number of samples to generate")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument("--output", default=None, help="Output CSV path")
    args = parser.parse_args()

    df = generate_cardio_dataset(n_samples=args.samples, seed=args.seed)
    path = save_dataset(df, output_path=args.output)

    print(f"\nDataset generated: {len(df)} rows → {path}")
    print(f"Risk label distribution:")
    print(f"  Low risk  (0): {(df['risk_label'] == 0).sum()} ({(df['risk_label'] == 0).mean()*100:.1f}%)")
    print(f"  High risk (1): {(df['risk_label'] == 1).sum()} ({(df['risk_label'] == 1).mean()*100:.1f}%)")
    print()
    print(df.describe().round(2).to_string())
