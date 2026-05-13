export type BloodType = "O+" | "O-" | "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-";
export type Gender = "Male" | "Female" | "Other";
export type RiskLevel = "Low" | "Moderate" | "High";
export type WaveformResolution = "5s" | "10s" | "30s";

export interface VitalSigns {
  heartRate: number;
  spo2: number;
  systolic: number;
  diastolic: number;
  ptt: number;
  perfusionIndex: number;
}

export interface PPGParameters {
  heartRate: number;
  pulseAmplitude: number;
  ptt: number;
  riseTime: number;
}

export interface ECGParameters {
  qrsDuration: number;
  rrInterval: number;
  stSegment: number;
  hrvIndex: number;
}

export interface FeatureFlag {
  id: string;
  name: string;
  detected: boolean;
  statusLabel:
    | "Normal"
    | "Warning"
    | "Critical"
    | "Elevated Risk"
    | "Present"
    | "Absent";
}

export interface AIFeatureMetric {
  id: string;
  name: string;
  value: string | number;
  unit?: string;
  badge:
    | "Normal"
    | "Warning"
    | "Critical"
    | "Elevated Risk"
    | "Present"
    | "Absent";
  confidence: number;
  range?: string;
}

export type PredictionMode = "model1_form" | "model2_sensor" | "none";

export interface RiskAssessment {
  riskScore: number;
  riskLevel: RiskLevel;
  blockageProbability: number;
  aiConfidence: number;
  modelUsed?: PredictionMode;
  probabilities?: { Low?: number; Moderate?: number; High?: number };
}

export interface ScanSession {
  id: string;
  patientId: string;
  startTime: string;
  endTime?: string;
  duration: number;
  ppgParams: PPGParameters;
  ecgParams: ECGParameters;
  vitals: VitalSigns;
  riskAssessment: RiskAssessment;
}

export interface MedicalHistoryBadge {
  label: string;
  detail?: string;
  color: string;
}

export interface Patient {
  id: string;
  fullName: string;
  dob: string;
  age: number;
  gender: Gender;
  bloodType: BloodType;
  contactNumber: string;
  email: string;
  height: number;
  weight: number;
  initials: string;
  avatarColor: string;
  medicalBadges: MedicalHistoryBadge[];
  vitals: VitalSigns;
  ppgParams: PPGParameters;
  ecgParams: ECGParameters;
  riskAssessment: RiskAssessment;
  featureFlags: FeatureFlag[];
  aiFeatures: AIFeatureMetric[];
  scanSessions: ScanSession[];
  createdAt: string;
  // raw medical data for registration / history
  diabetes: string;
  hypertension: string;
  cholesterol: number;
  smoking: string;
  familyHistoryPositive: boolean;
  medications?: string;
  allergies?: string;
}

export interface SensorStatus {
  ppg: "CONNECTED" | "DISCONNECTED" | "OFFLINE" | "SIMULATING";
  ecg: "CONNECTED" | "DISCONNECTED" | "OFFLINE" | "SIMULATING";
  ppgQuality?: "GOOD" | "MODERATE" | "POOR" | "OFFLINE";
  ecgQuality?: "GOOD" | "MODERATE" | "POOR" | "OFFLINE";
  ecgConfidence?: number;
  ppgConfidence?: number;
  fingerDetected: "SIGNAL GOOD" | "SIGNAL POOR" | "NO SIGNAL";
}

export interface ModelStatus {
  cnn: "ACTIVE" | "INACTIVE" | "ERROR" | "OFFLINE";
  lstm: "ACTIVE" | "INACTIVE" | "ERROR" | "OFFLINE";
  sensor: "ONLINE" | "OFFLINE" | "SIMULATING";
  database: "CONNECTED" | "DISCONNECTED";
}

export interface DatasetColumn {
  age: number;
  gender: string;
  diabetes_status: number;
  hypertension_status: number;
  cholesterol_level: number;
  ldl: number;
  hdl: number;
  smoking_status: number;
  ecg_hrv: number;
  ecg_qrs_duration: number;
  ppg_peak_amplitude: number;
  perfusion_index: number;
  ptt: number;
  risk_label: string;
}

export interface Dataset {
  id: string;
  name: string;
  uploadedAt: string;
  rowCount: number;
  columns: string[];
  rows: DatasetColumn[];
}
