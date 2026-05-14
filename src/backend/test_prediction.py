# ============================================================
# VASCUSCAN AI - ADVANCED PREDICTION TEST CLIENT
# ============================================================
#
# PURPOSE:
# - Sends patient + ECG + PPG data to backend API
# - Receives AI cardiovascular risk prediction
# - Displays confidence scores
# - Displays biomedical interpretations
# - Shows threshold warnings
#
# ============================================================

import requests
import json
import requests
# ============================================================
# FASTAPI / FLASK BACKEND URL
# ============================================================

API_URL = "http://127.0.0.1:5000/api/predict"

# ============================================================
# PATIENT DEMOGRAPHIC INFORMATION
# ============================================================

patient_data = {

    # --------------------------------------------------------
    # BASIC DEMOGRAPHICS
    # --------------------------------------------------------

    "patient_id": "VS-2026-001",

    "name": "John Doe",

    "age": 45,

    "gender": 1,                 # 0 = Male, 1 = Female

    "height_cm": 175,

    "weight_kg": 82,

    "bmi": 26.8,

    # --------------------------------------------------------
    # MEDICAL HISTORY
    # --------------------------------------------------------

    "diabetes_status": 1,

    "hypertension_status": 1,

    "smoking_status": 1,

    "alcohol_consumption": 0,

    "family_history": 1,

    "previous_cardiac_issue": 0,

    # --------------------------------------------------------
    # LIFESTYLE FACTORS
    # --------------------------------------------------------

    "activity_level": 1,         # 1=Low 2=Medium 3=High

    "stress_level": 3,           # 1=Low 2=Medium 3=High

    "sleep_hours": 5,

    # --------------------------------------------------------
    # BLOOD / CLINICAL VALUES
    # --------------------------------------------------------

    "cholesterol_total": 225,

    "ldl": 145,

    "hdl": 42,

    "triglycerides": 210,

    "fasting_glucose": 128,

    # --------------------------------------------------------
    # ECG FEATURES
    # --------------------------------------------------------

    "ecg_heart_rate": 92,

    "ecg_rr_interval": 720,

    "ecg_qrs_duration": 118,

    "ecg_st_segment": 0.12,

    "ecg_hrv_index": 28,

    "ecg_signal_quality": "GOOD",

    # --------------------------------------------------------
    # PPG FEATURES
    # --------------------------------------------------------

    "ppg_peak_amplitude": 0.82,

    "ppg_rise_time": 183,

    "ppg_perfusion_index": 1.1,

    "ppg_dicrotic_notch": 0.71,

    "ppg_waveform_skewness": 0.42,

    "ppg_signal_quality": "MODERATE",

    # --------------------------------------------------------
    # COMBINED ECG + PPG FEATURES
    # --------------------------------------------------------

    "ptt": 170,

    "estimated_systolic_bp": 148,

    "estimated_diastolic_bp": 96,

    "vascular_stiffness_index": 1.8,

    # --------------------------------------------------------
    # LIVE SYSTEM STATUS
    # --------------------------------------------------------

    "sensor_status": "CONNECTED",

    "confidence_score": 92.4
}

# ============================================================
# THRESHOLD CHECKS
# ============================================================

print("\n================================================")
print("VASCUSCAN AI - LIVE RISK ANALYSIS")
print("================================================\n")

print("Analyzing Patient Data...\n")

# ------------------------------------------------------------
# HEART RATE ANALYSIS
# ------------------------------------------------------------

hr = patient_data["ecg_heart_rate"]

if hr > 100:
    print("⚠ Tachycardia Detected")

elif hr < 60:
    print("⚠ Bradycardia Detected")

else:
    print("✓ Heart Rate Normal")

# ------------------------------------------------------------
# HRV ANALYSIS
# ------------------------------------------------------------

hrv = patient_data["ecg_hrv_index"]

if hrv < 30:
    print("⚠ Low HRV - Possible Cardiovascular Stress")

else:
    print("✓ HRV Within Normal Range")

# ------------------------------------------------------------
# PTT ANALYSIS
# ------------------------------------------------------------

ptt = patient_data["ptt"]

if ptt < 180:
    print("⚠ Reduced Pulse Transit Time")
    print("⚠ Possible Arterial Stiffness")

else:
    print("✓ PTT Within Normal Range")

# ------------------------------------------------------------
# BLOOD PRESSURE ANALYSIS
# ------------------------------------------------------------

sbp = patient_data["estimated_systolic_bp"]

dbp = patient_data["estimated_diastolic_bp"]

if sbp > 140 or dbp > 90:
    print("⚠ Hypertension Risk Detected")

else:
    print("✓ Blood Pressure Stable")

# ------------------------------------------------------------
# PERFUSION ANALYSIS
# ------------------------------------------------------------

pi = patient_data["ppg_perfusion_index"]

if pi < 0.5:
    print("⚠ Poor Peripheral Perfusion")

else:
    print("✓ Perfusion Index Acceptable")

# ============================================================
# SEND REQUEST TO BACKEND
# ============================================================

print("\nSending Data To AI Prediction Engine...\n")

try:

    response = requests.post(
        API_URL,
        json=patient_data
    )

    # ========================================================
    # SUCCESS RESPONSE
    # ========================================================

    if response.status_code == 200:

        result = response.json()

        print("================================================")
        print("AI PREDICTION RESULT")
        print("================================================\n")

        print(f"Patient ID           : {patient_data['patient_id']}")

        print(f"Patient Name         : {patient_data['name']}")

        print(f"Predicted Risk Level : {result['risk_level']}")

        print(f"Risk Percentage      : {result['risk_percentage']}%")

        print(f"AI Confidence        : {result['confidence']}%")

        print("\n------------------------------------------------")
        print("CLASS PROBABILITIES")
        print("------------------------------------------------")

        print(f"Low Risk      : {result['probabilities']['low']}%")

        print(f"Moderate Risk : {result['probabilities']['moderate']}%")

        print(f"High Risk     : {result['probabilities']['high']}%")

        print("\n------------------------------------------------")
        print("AI BIOMEDICAL INTERPRETATION")
        print("------------------------------------------------")

        for factor in result["top_risk_factors"]:

            print(f"• {factor}")

        print("\n------------------------------------------------")
        print("SIGNAL QUALITY STATUS")
        print("------------------------------------------------")

        print(f"ECG Quality : {patient_data['ecg_signal_quality']}")

        print(f"PPG Quality : {patient_data['ppg_signal_quality']}")

        print(f"Sensor State: {patient_data['sensor_status']}")

        print("\n================================================")
        print("REAL-TIME ANALYSIS COMPLETED")
        print("================================================")

    # ========================================================
    # BACKEND ERROR
    # ========================================================

    else:

        print(f"❌ Backend Error {response.status_code}")

        print(response.text)

# ============================================================
# CONNECTION ERROR
# ============================================================

except requests.exceptions.ConnectionError:

    print("❌ CONNECTION ERROR")

    print("Backend server is not running.")

    print("\nPlease verify:")

    print("1. Flask/FastAPI server is active")

    print("2. Correct API port is used")

    print("3. API endpoint exists")

    print("4. Firewall is not blocking requests")

# ============================================================
# TIMEOUT ERROR
# ============================================================

except requests.exceptions.Timeout:

    print("❌ REQUEST TIMEOUT")

    print("Backend took too long to respond.")

# ============================================================
# UNKNOWN ERROR
# ============================================================

except Exception as e:

    print("❌ UNKNOWN ERROR OCCURRED")

    print(str(e))