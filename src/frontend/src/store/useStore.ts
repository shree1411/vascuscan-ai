/**
 * useStore.ts — Re-exports appStore with the simplified interface expected by new components.
 * New components should import from here; existing components continue using appStore.ts.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_PATIENT_ID, mockPatients } from "../data/mockPatients";
import type {
  Dataset,
  ModelStatus,
  Patient,
  ScanSession,
  SensorStatus,
  VitalSigns,
} from "../types";
import { toast } from "sonner";

export interface SignalFeatures {
  pulseAmplitude: number;
  riseTime: number;
  dicroticNotch: string;
  skewness: string;
  hrvIndex: number;
  perfusion: number;
  qrsDuration: number;
  stSegment: number;
  rrInterval: number;
  estSystolicBp: number;
  estDiastolicBp: number;
  ptt: number;
  heartRate: number;
  confidenceScore: number;
  vascularStiffness: number;
}

export interface Notification {
  id: string;
  message: string;
  type: "info" | "success" | "warning";
  timestamp: string;
}

interface StoreState {
  currentPatientId: string;
  patients: Patient[];
  vitals: VitalSigns;
  scanActive: boolean;
  scanSeconds: number;
  sensorStatus: SensorStatus;
  waveformResolution: "5s" | "10s";
  modelStatus: ModelStatus & { accuracy: number };
  datasets: Dataset[];
  notifications: Notification[];
  signalFeatures: SignalFeatures;
  preferredPredictionModel: "auto" | "model1" | "model2";

  // actions
  addPatient: (patient: Patient) => void;
  updatePatient: (id: string, updates: Partial<Patient>) => void;
  updateVitals: (updates: Partial<VitalSigns>) => void;
  updateSignalFeatures: (updates: Partial<SignalFeatures>) => void;
  toggleScan: () => void;
  incrementScanSeconds: () => void;
  setWaveformResolution: (res: "5s" | "10s") => void;
  setCurrentPatientId: (id: string) => void;
  adjustVital: (key: keyof VitalSigns, delta: number) => void;
  addScanSession: (patientId: string, session: ScanSession) => void;
  addDataset: (dataset: Dataset) => void;
  removeDataset: (id: string) => void;
  setSensorStatus: (status: Partial<SensorStatus>) => void;
  deletePatient: (id: string) => void;
  deleteScanSession: (patientId: string, sessionId: string) => void;
  addNotification: (msg: string, type?: Notification["type"]) => void;
  clearNotifications: () => void;
  setPreferredPredictionModel: (val: "auto" | "model1" | "model2") => void;
}

const defaultVitals: VitalSigns = {
  heartRate: 78,
  spo2: 96,
  systolic: 138,
  diastolic: 88,
  ptt: 245,
  perfusionIndex: 3.2,
};

const CLAMPS: Partial<Record<keyof VitalSigns, [number, number]>> = {
  heartRate: [30, 220],
  spo2: [70, 100],
  systolic: [80, 220],
  diastolic: [50, 140],
  ptt: [80, 1200],
  perfusionIndex: [0.1, 30],
};

const defaultSignalFeatures: SignalFeatures = {
  pulseAmplitude: 0.85,
  riseTime: 165,
  dicroticNotch: "PRESENT",
  skewness: "NORMAL",
  hrvIndex: 42,
  perfusion: 3.2,
  qrsDuration: 90,
  stSegment: 0.05,
  rrInterval: 800,
  estSystolicBp: 120,
  estDiastolicBp: 80,
  ptt: 250,
  heartRate: 75,
  confidenceScore: 100,
  vascularStiffness: 3.5,
};

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      currentPatientId: DEFAULT_PATIENT_ID,
      patients: mockPatients,
      vitals: { ...defaultVitals },
      scanActive: true,
      scanSeconds: 0,
      datasets: [],
      sensorStatus: {
        ppg: "OFFLINE",
        ecg: "OFFLINE",
        ppgQuality: "OFFLINE",
        ecgQuality: "OFFLINE",
        ecgConfidence: 0,
        ppgConfidence: 0,
        fingerDetected: "NO SIGNAL",
      },
      waveformResolution: "5s",
      modelStatus: {
        cnn: "ACTIVE",
        lstm: "ACTIVE",
        sensor: "SIMULATING",
        database: "CONNECTED",
        accuracy: 94.2,
      },
      notifications: [],
      signalFeatures: { ...defaultSignalFeatures },
      preferredPredictionModel: "auto",

      addPatient: (patient) =>
        set((s) => ({ patients: [...s.patients, patient] })),

      updatePatient: (id, updates) =>
        set((s) => ({
          patients: s.patients.map((p) =>
            p.id === id ? { ...p, ...updates } : p,
          ),
        })),

      updateVitals: (updates) =>
        set((s) => ({ vitals: { ...s.vitals, ...updates } })),

      updateSignalFeatures: (updates) =>
        set((s) => ({ signalFeatures: { ...s.signalFeatures, ...updates } })),

      toggleScan: () =>
        set((s) => ({
          scanActive: !s.scanActive,
          scanSeconds: s.scanActive ? s.scanSeconds : 0,
        })),

      incrementScanSeconds: () =>
        set((s) => ({ scanSeconds: s.scanSeconds + 1 })),

      setWaveformResolution: (res) => set({ waveformResolution: res }),

      setCurrentPatientId: (id) => {
        const patient = get().patients.find((p) => p.id === id);
        set({
          currentPatientId: id,
          vitals: patient ? { ...patient.vitals } : defaultVitals,
        });
      },

      adjustVital: (key, delta) =>
        set((s) => {
          const cur = s.vitals[key] as number;
          const [lo, hi] = CLAMPS[key] ?? [0, Number.POSITIVE_INFINITY];
          const next = Number.parseFloat(
            Math.min(Math.max(cur + delta, lo), hi).toFixed(1),
          );
          return { vitals: { ...s.vitals, [key]: next } };
        }),

      addScanSession: (patientId, session) =>
        set((s) => ({
          patients: s.patients.map((p) =>
            p.id === patientId
              ? { ...p, scanSessions: [...(p.scanSessions ?? []), session] }
              : p,
          ),
        })),

      addDataset: (dataset) =>
        set((s) => ({ datasets: [...s.datasets, dataset] })),

      removeDataset: (id) =>
        set((s) => ({ datasets: s.datasets.filter((d) => d.id !== id) })),

      setSensorStatus: (status) =>
        set((s) => ({ sensorStatus: { ...s.sensorStatus, ...status } })),

      deletePatient: (id) =>
        set((s) => ({
          patients: s.patients.filter((p) => p.id !== id),
          currentPatientId: s.currentPatientId === id && s.patients.length > 0 ? s.patients[0].id : s.currentPatientId,
        })),

      deleteScanSession: (patientId, sessionId) =>
        set((s) => ({
          patients: s.patients.map((p) =>
            p.id === patientId
              ? { ...p, scanSessions: p.scanSessions?.filter((ss) => ss.id !== sessionId) }
              : p
          ),
        })),

      addNotification: (message, type = "info") => {
        const id = Math.random().toString(36).substring(7);
        const timestamp = new Date().toLocaleTimeString();
        set((s) => ({
          notifications: [{ id, message, type, timestamp }, ...s.notifications].slice(0, 50),
        }));
        // Also trigger a real UI toast
        if (type === "success") toast.success(message);
        else if (type === "warning") toast.warning(message);
        else toast(message);
      },

      clearNotifications: () => set({ notifications: [] }),
      
      setPreferredPredictionModel: (val) => set({ preferredPredictionModel: val }),
    }),
    {
      name: "vascuscan-store-v1",
      partialize: (s) => ({
        currentPatientId: s.currentPatientId,
        patients: s.patients,
        waveformResolution: s.waveformResolution,
        datasets: s.datasets,
      }),
    },
  ),
);

export const selectCurrentPatient = (s: StoreState): Patient | undefined =>
  s.patients.find((p) => p.id === s.currentPatientId);
