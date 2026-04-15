/**
 * types/medical.ts — Simplified medical type interfaces for VASCUSCAN AI.
 * These are lightweight aliases/interfaces used by new components.
 * Full types are in types/index.ts
 */

export interface MedicalHistoryBadge {
  label: string;
  detail: string;
  color: string;
}

export interface FeatureFlag {
  label: string;
  detected: boolean;
  color: string;
}

export interface Patient {
  id: string;
  name: string;
  initials: string;
  age: number;
  gender: string;
  bloodType: string;
  medicalHistory: MedicalHistoryBadge[];
  riskScore: number;
  riskLevel: string;
  blockageProbability: number;
  aiConfidence: number;
  featureFlags: FeatureFlag[];
  scanSessions?: ScanSession[];
}

export interface ScanSession {
  id: string;
  date: string;
  duration: string;
  riskLevel: string;
  heartRate: number;
  spo2: number;
  systolic: number;
  diastolic: number;
}

export interface VitalsState {
  heartRate: number;
  spo2: number;
  systolic: number;
  diastolic: number;
  ptt: number;
  perfusionIndex: number;
}
