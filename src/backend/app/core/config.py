import os
from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "VascuScan AI"
    API_V1_STR: str = "/api/v1"
    
    # Paths
    # Current file: src/backend/app/core/config.py
    # Going up 4 levels to reach project root: vascuscan-ai-main/
    BASE_DIR: str = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
    ML_MODELS_DIR: str = os.path.join(BASE_DIR, "src", "backend", "python")
    
    # Model 1 (Form-Only)
    MODEL1_PATH: str = os.path.join(ML_MODELS_DIR, "model1_form.pkl")
    SCALER1_PATH: str = os.path.join(ML_MODELS_DIR, "scaler1_form.pkl")
    ENCODERS1_PATH: str = os.path.join(ML_MODELS_DIR, "encoders1_form.pkl")
    
    # Model 2 (Full Sensor)
    MODEL2_PATH: str = os.path.join(ML_MODELS_DIR, "model2_sensor.pkl")
    SCALER2_PATH: str = os.path.join(ML_MODELS_DIR, "scaler2_sensor.pkl")
    ENCODERS2_PATH: str = os.path.join(ML_MODELS_DIR, "encoders2_sensor.pkl")
    
    # Database
    SQLALCHEMY_DATABASE_URI: str = os.getenv("DATABASE_URL", "sqlite:///./vascuscan.db")
    
    # Supabase
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    SUPABASE_SECRET_KEY: str = os.getenv("SUPABASE_SECRET_KEY", "")
    
    # Features
    FORM_FEATURES: List[str] = [
        "age", "gender", "diabetes_status", "hypertension_status",
        "cholesterol_level", "ldl", "hdl", "smoking_status",
        "family_history", "activity_level", "stress_level",
    ]
    
    SENSOR_FEATURES: List[str] = FORM_FEATURES + [
        "ecg_heart_rate", "ecg_hrv", "ecg_qrs_duration",
        "ppg_peak_amplitude", "ppg_perfusion_index", "ptt",
    ]
    
    CATEGORICAL_FIELDS: List[str] = [
        "gender", "diabetes_status", "hypertension_status",
        "smoking_status", "activity_level", "stress_level",
    ]

    class Config:
        case_sensitive = True

settings = Settings()
