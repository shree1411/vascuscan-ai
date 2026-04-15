import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_PATIENT_ID, mockPatients } from "../data/mockPatients";
import type {
  ModelStatus,
  Patient,
  ScanSession,
  SensorStatus,
  VitalSigns,
  WaveformResolution,
} from "../types";

interface AppStore {
  currentPatientId: string;
  patients: Patient[];
  scanActive: boolean;
  scanDuration: number;
  vitals: VitalSigns;
  sensorStatus: SensorStatus;
  waveformResolution: WaveformResolution;
  modelStatus: ModelStatus;

  setCurrentPatient: (id: string) => void;
  addPatient: (p: Patient) => void;
  updatePatient: (id: string, updates: Partial<Patient>) => void;
  addScanSession: (patientId: string, session: ScanSession) => void;
  startScan: () => void;
  stopScan: () => void;
  tickScan: () => void;
  setSensorStatus: (s: Partial<SensorStatus>) => void;
  setModelStatus: (s: Partial<ModelStatus>) => void;
  updateVitals: (updates: Partial<VitalSigns>) => void;
  setWaveformResolution: (r: WaveformResolution) => void;
}

const defaultVitals: VitalSigns = {
  heartRate: 78,
  spo2: 96,
  systolic: 138,
  diastolic: 88,
  ptt: 245,
  perfusionIndex: 3.2,
};

const defaultSensorStatus: SensorStatus = {
  ppg: "CONNECTED",
  ecg: "CONNECTED",
  fingerDetected: "SIGNAL GOOD",
};

const defaultModelStatus: ModelStatus = {
  cnn: "ACTIVE",
  lstm: "ACTIVE",
  sensor: "ONLINE",
  database: "CONNECTED",
};

const CLAMPS: Partial<Record<keyof VitalSigns, [number, number]>> = {
  heartRate: [30, 220],
  spo2: [70, 100],
  systolic: [80, 220],
  diastolic: [50, 140],
  ptt: [80, 1200],
  perfusionIndex: [0.1, 30],
};

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      currentPatientId: DEFAULT_PATIENT_ID,
      patients: mockPatients,
      scanActive: false,
      scanDuration: 0,
      vitals: defaultVitals,
      sensorStatus: defaultSensorStatus,
      waveformResolution: "5s",
      modelStatus: defaultModelStatus,

      setCurrentPatient: (id) => {
        const p = get().patients.find((pt) => pt.id === id);
        set({
          currentPatientId: id,
          vitals: p ? { ...p.vitals } : defaultVitals,
        });
      },

      addPatient: (p) => set((s) => ({ patients: [...s.patients, p] })),

      updatePatient: (id, updates) =>
        set((s) => ({
          patients: s.patients.map((p) =>
            p.id === id ? { ...p, ...updates } : p,
          ),
        })),

      addScanSession: (patientId, session) =>
        set((s) => ({
          patients: s.patients.map((p) =>
            p.id === patientId
              ? { ...p, scanSessions: [...(p.scanSessions ?? []), session] }
              : p,
          ),
        })),

      startScan: () => set({ scanActive: true, scanDuration: 0 }),
      stopScan: () => set({ scanActive: false }),
      tickScan: () => set((s) => ({ scanDuration: s.scanDuration + 1 })),

      adjustVital: (key, delta) =>
        set((s) => {
          const cur = s.vitals[key] as number;
          const [lo, hi] = CLAMPS[key] ?? [0, Number.POSITIVE_INFINITY];
          const next = Number.parseFloat(
            Math.min(Math.max(cur + delta, lo), hi).toFixed(1),
          );
          return { vitals: { ...s.vitals, [key]: next } };
        }),

      setSensorStatus: (status) =>
        set((s) => ({ sensorStatus: { ...s.sensorStatus, ...status } })),

      setModelStatus: (status) =>
        set((s) => ({ modelStatus: { ...s.modelStatus, ...status } })),

      updateVitals: (updates) =>
        set((s) => ({ vitals: { ...s.vitals, ...updates } })),

      setWaveformResolution: (r) => set({ waveformResolution: r }),
    }),
    {
      name: "vascuscan-v2",
      partialize: (s) => ({
        currentPatientId: s.currentPatientId,
        patients: s.patients,
        waveformResolution: s.waveformResolution,
      }),
    },
  ),
);

export const selectCurrentPatient = (s: AppStore): Patient | undefined =>
  s.patients.find((p) => p.id === s.currentPatientId);
