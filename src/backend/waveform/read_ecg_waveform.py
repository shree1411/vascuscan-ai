import os
import glob
import wfdb
import numpy as np
import matplotlib.pyplot as plt

# ==============================================================================
# VASCUSCAN AI - BIOMEDICAL WAVEFORM VISUALIZATION
# ==============================================================================
# This script reads raw and filtered ECG data from the ECG-ID Database.
# It automatically detects available records and generates professional
# biomedical plots for future CNN-LSTM preprocessing integration.
# ==============================================================================

# Define paths
from pathlib import Path

# backend folder
BASE_DIR = Path(__file__).resolve().parent.parent

# datasets folder
DATASET_DIR = BASE_DIR / "datasets" / "ecgiddb"
# Output folder for saved waveform plots
OUTPUT_DIR = BASE_DIR / "waveform" / "output"

# Create output folder if missing
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

print("Dataset Directory:", DATASET_DIR)

def ensure_dir(directory):
    """Ensure the target directory exists."""
    if not os.path.exists(directory):
        os.makedirs(directory)

def get_available_records():
    """Scan the ECG-ID directory to find valid records."""
    if not os.path.exists(DATASET_DIR):
        raise FileNotFoundError(f"ECG-ID dataset directory not found at: {DATASET_DIR}")
        
    search_pattern = os.path.join(DATASET_DIR, "Person_*", "*.dat")
    dat_files = glob.glob(search_pattern)
    
    # Extract record paths (without the .dat extension required by wfdb)
    records = [f.replace('.dat', '') for f in dat_files]
    records.sort()
    
    if not records:
        raise ValueError(f"No records found in the ECG-ID directory: {DATASET_DIR}")
        
    return records

def plot_ecg_waveform(record_path, output_filename):
    """Load and plot the ECG record with professional biomedical styling."""
    print(f"Loading record: {record_path}")
    
    # 3. Load raw ECG signal and filtered ECG signal
    try:
        record = wfdb.rdrecord(record_path)
    except Exception as e:
        print(f"Error reading record {record_path}: {e}")
        return
        
    signals = record.p_signal
    sig_names = record.sig_name
    fs = record.fs
    
    # 4. Print signal shape, names, and frequency
    print("-" * 50)
    print(f"Record: {os.path.basename(os.path.dirname(record_path))}/{os.path.basename(record_path)}")
    print(f"Signal Shape: {signals.shape}")
    print(f"Signal Names: {sig_names}")
    print(f"Sampling Frequency (fs): {fs} Hz")
    print("-" * 50)
    
    # Ensure we have both channels (ECG-ID database usually has 'ECG I' and 'ECG I filtered')
    if signals.shape[1] >= 2:
        raw_ecg = signals[:, 0]
        filtered_ecg = signals[:, 1]
        raw_name = sig_names[0]
        filtered_name = sig_names[1]
    else:
        # Fallback if only one channel is present
        raw_ecg = signals[:, 0]
        filtered_ecg = signals[:, 0]
        raw_name = sig_names[0]
        filtered_name = sig_names[0] + " (Duplicate)"

    # Create time axis in seconds
    time_sec = np.arange(len(raw_ecg)) / fs
    
    # Limit to first 3 seconds for clear morphology visualization
    plot_limit = int(3 * fs)
    t_plot = time_sec[:plot_limit]
    raw_plot = raw_ecg[:plot_limit]
    filt_plot = filtered_ecg[:plot_limit]

    # 6. Use clean biomedical plotting style
    plt.style.use('dark_background')
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(14, 8), sharex=True)
    
    # 7. Comments explaining ECG morphology and QRS complexes
    # ---------------------------------------------------------
    # RAW ECG MORPHOLOGY:
    # The raw ECG signal often contains baseline wander (due to respiration)
    # and high-frequency noise (from powerline interference or muscle artifacts).
    # The sharpest peaks represent the QRS complexes (ventricular depolarization),
    # which are critical for heart rate variability (HRV) analysis.
    # ---------------------------------------------------------
    
    # Plot 1: Raw ECG Waveform
    ax1.plot(t_plot, raw_plot, color='#ff4d4d', linewidth=1.5)
    ax1.set_title(f"RAW ECG WAVEFORM ({raw_name})", fontsize=14, fontweight='bold', color='white', pad=15)
    ax1.set_ylabel("Amplitude (mV)", fontsize=12)
    ax1.grid(True, color='#333333', linestyle='--', alpha=0.7)
    ax1.spines['top'].set_visible(False)
    ax1.spines['right'].set_visible(False)
    
    # ---------------------------------------------------------
    # FILTERED ECG MORPHOLOGY:
    # The filtered ECG signal removes baseline drift using high-pass filters 
    # and suppresses high-frequency noise using low-pass filters. 
    # This isolates true physiological features (P-wave, QRS complex, T-wave),
    # producing clean inputs essential for the future CNN-LSTM deep learning model.
    # ---------------------------------------------------------
    
    # Plot 2: Filtered ECG Waveform
    ax2.plot(t_plot, filt_plot, color='#00d4ff', linewidth=1.5)
    ax2.set_title(f"FILTERED ECG WAVEFORM ({filtered_name})", fontsize=14, fontweight='bold', color='white', pad=15)
    ax2.set_xlabel("Time (Seconds)", fontsize=12)
    ax2.set_ylabel("Amplitude (mV)", fontsize=12)
    ax2.grid(True, color='#333333', linestyle='--', alpha=0.7)
    ax2.spines['top'].set_visible(False)
    ax2.spines['right'].set_visible(False)

    plt.tight_layout()
    
    # 8. Save plots into src/backend/waveform/output/
    ensure_dir(OUTPUT_DIR)
    save_path = os.path.join(OUTPUT_DIR, output_filename)
    plt.savefig(save_path, dpi=300, bbox_inches='tight', facecolor='#0a0e1a')
    plt.close()
    
    print(f"Successfully saved plot to: {save_path}\n")

if __name__ == "__main__":
    try:
        print("Starting VascuScan AI Waveform Visualization Pipeline...")
        
        # 1 & 2. Read ECG waveform data and automatically detect available records
        records = get_available_records()
        print(f"Found {len(records)} ECG records in the database.")
        
        # Process the first few records as a demonstration
        max_demos = 3
        demo_records = records[:max_demos]
        
        for rec in demo_records:
            filename = f"ecg_visualization_{os.path.basename(os.path.dirname(rec))}_{os.path.basename(rec)}.png"
            # 3 & 4 & 5. Load, print stats, and plot raw/filtered ECG waveforms
            plot_ecg_waveform(rec, filename)
                
        print("Visualization pipeline completed successfully.")
        
    except Exception as e:
        # 10. Add error handling for missing records or incorrect paths
        print(f"\n[ERROR] Pipeline Failed: {str(e)}")
        print("Please ensure the ECG-ID database is correctly extracted in the datasets directory.")
