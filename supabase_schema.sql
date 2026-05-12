-- VASCUSCAN AI Supabase PostgreSQL Schema

-- Patients Table
CREATE TABLE IF NOT EXISTS patient (
    id SERIAL PRIMARY KEY,
    patient_id VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    date_of_birth DATE,
    age INTEGER,
    gender VARCHAR(50),
    blood_type VARCHAR(10),
    height_cm FLOAT,
    weight_kg FLOAT,
    bmi FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Sensor Sessions (Test Sessions)
CREATE TABLE IF NOT EXISTS sensorsession (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES patient(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    status VARCHAR(50) DEFAULT 'active',
    data_quality FLOAT DEFAULT 0.0
);

-- Vital Signs (Processed sensor records)
CREATE TABLE IF NOT EXISTS vitalsign (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES patient(id) ON DELETE CASCADE,
    heart_rate FLOAT NOT NULL,
    spo2 FLOAT NOT NULL,
    systolic_bp FLOAT,
    diastolic_bp FLOAT,
    ptt FLOAT,
    perfusion_index FLOAT,
    source VARCHAR(100) DEFAULT 'sensor',
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Risk Assessments (Predictions)
CREATE TABLE IF NOT EXISTS riskassessment (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES patient(id) ON DELETE CASCADE,
    risk_level VARCHAR(50) NOT NULL,
    risk_score FLOAT NOT NULL,
    blockage_probability FLOAT NOT NULL,
    ai_confidence FLOAT NOT NULL,
    model_used VARCHAR(100) DEFAULT 'rule_based',
    features_json TEXT,
    assessment_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Raw Sensor Records (for high frequency data if needed)
CREATE TABLE IF NOT EXISTS sensor_records (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES patient(id) ON DELETE CASCADE,
    session_id INTEGER REFERENCES sensorsession(id) ON DELETE CASCADE,
    ecg_value FLOAT NOT NULL,
    ppg_value FLOAT NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add Indexes for performance
CREATE INDEX idx_patient_patient_id ON patient(patient_id);
CREATE INDEX idx_vitalsign_patient_id ON vitalsign(patient_id);
CREATE INDEX idx_riskassessment_patient_id ON riskassessment(patient_id);
CREATE INDEX idx_sensorsession_patient_id ON sensorsession(patient_id);
CREATE INDEX idx_sensor_records_session_id ON sensor_records(session_id);
