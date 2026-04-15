import requests
import json

# The Flask API URL
url = "http://127.0.0.1:5000/api/predict"

# 1. Modify these patient values to see how the predictions change!
patient_data = {
    "age": 45,                  # Patient Age
    "gender": 1,                # 0 for Male, 1 for Female
    "diabetes_status": 1,       # 0 for No, 1 for Yes
    "hypertension_status": 0,   # 0 for No, 1 for Yes
    "cholesterol_level": 220,   # Number (e.g. 150-300)
    "ldl": 130,                 # LDL Level
    "hdl": 45,                  # HDL Level
    "smoking_status": 1,        # 0 for Non-smoker, 1 for Smoker
    "family_history": 1,        # 0 for No, 1 for Yes
    "activity_level": 1,        # 1=Low, 2=Medium, 3=High
    "stress_level": 2,          # 1=Low, 2=Medium, 3=High
    
    # Sensor Data
    "ecg_heart_rate": 82,       
    "ecg_hrv": 50,              
    "ecg_qrs_duration": 95,     
    "ppg_peak_amplitude": 1.0,  
    "ppg_perfusion_index": 2.2, 
    "ptt": 130                  
}

print("Predicting Blockage Risk for patient data...\n")

# 2. Send the POST request to the local Flask backend
try:
    response = requests.post(url, json=patient_data)
    
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Prediction Successful!")
        print(f"Risk Level: {result['risk_level']}")
        print(f"Risk Percentage: {result['risk_percentage']}%\n")
        
        print("Class Probabilities:")
        print(f"- Low: {result['probabilities']['low']}%")
        print(f"- Medium: {result['probabilities']['medium']}%")
        print(f"- High: {result['probabilities']['high']}%")
    else:
        print(f"❌ Error {response.status_code}: {response.text}")

except requests.exceptions.ConnectionError:
    print("❌ Connection Error: Is the Flask server running on port 5000?")
