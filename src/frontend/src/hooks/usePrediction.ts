/**
 * usePrediction.ts
 *
 * Central hook that syncs the dataset (patient clinical data) with the backend
 * prediction models.
 *
 * On mount:
 *   - Calls GET /api/health to confirm models are loaded
 *   - For every patient that has modelUsed === "none" or undefined,
 *     sends their form data to POST /api/predict-form  (Model 1)
 *   - Saves the real prediction result back into the store
 *
 * On patient change:
 *   - If the new patient has no real prediction yet, fetches one immediately
 *
 * Returns: { loading, lastPrediction, error, refetchCurrentPatient }
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { selectCurrentPatient, useAppStore } from "../store/appStore";
import type { RiskAssessment } from "../types";

const API = "http://127.0.0.1:5000";

export interface PredictionResult {
  risk_level: string;
  risk_score: number;
  risk_percentage: number;
  probabilities: { High: number; Low: number; Moderate: number };
  model_used: string;
  model_label: string;
  features_used: string[];
}

function buildPayload(patient: ReturnType<typeof selectCurrentPatient>) {
  if (!patient) return null;
  return {
    age: patient.age,
    gender: patient.gender,
    diabetes_status: patient.diabetes ?? "No",
    hypertension_status: patient.hypertension ?? "No",
    cholesterol_level: patient.cholesterol ?? 180,
    ldl: 110,
    hdl: 50,
    smoking_status: patient.smoking ?? "Never",
    family_history: patient.familyHistoryPositive ? 1 : 0,
    activity_level: "Moderate",
    stress_level: "Low",
  };
}

async function fetchPrediction(payload: object): Promise<PredictionResult> {
  const res = await fetch(`${API}/api/predict-form`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function toRiskAssessment(r: PredictionResult): RiskAssessment {
  const lvl = r.risk_level as "Low" | "Moderate" | "High";
  const riskLevel = lvl === "High" ? "High" : lvl === "Moderate" ? "Moderate" : "Low";
  const score = Math.round(r.risk_score * 100);
  return {
    riskScore: score,
    riskLevel,
    blockageProbability: Math.round(r.risk_score * 80),
    aiConfidence: Math.round(r.probabilities?.[lvl] ?? r.risk_percentage ?? 75),
    modelUsed: r.model_used as "model1_form" | "model2_sensor" | "none",
    probabilities: r.probabilities,
  };
}

export function usePrediction() {
  const patients = useAppStore((s) => s.patients);
  const updatePatient = useAppStore((s) => s.updatePatient);
  const currentPatient = useAppStore(selectCurrentPatient);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPrediction, setLastPrediction] = useState<PredictionResult | null>(null);
  const fetchedIds = useRef<Set<string>>(new Set());

  // Helper: fetch and save prediction for a patient
  const fetchAndSave = useCallback(
    async (patient: (typeof patients)[0]) => {
      if (fetchedIds.current.has(patient.id)) return;
      fetchedIds.current.add(patient.id);

      const payload = buildPayload(patient);
      if (!payload) return;

      try {
        const result = await fetchPrediction(payload);
        const ra = toRiskAssessment(result);
        updatePatient(patient.id, { riskAssessment: ra });
        if (patient.id === currentPatient?.id) {
          setLastPrediction(result);
        }
      } catch (e) {
        fetchedIds.current.delete(patient.id); // allow retry
        setError("Backend offline — using cached data");
      }
    },
    [updatePatient, currentPatient?.id],
  );

  const refetchCurrentPatient = useCallback(async () => {
    if (!currentPatient) return;
    fetchedIds.current.delete(currentPatient.id); // force re-fetch
    setLoading(true);
    setError(null);
    updatePatient(currentPatient.id, {
        riskAssessment: {
          riskScore: 0,
          riskLevel: "Unknown" as any,
          blockageProbability: 0,
          aiConfidence: 0,
          modelUsed: "none" as const,
        }
    });
    const payload = buildPayload(currentPatient);
    if (!payload) { setLoading(false); return; }
    try {
      const result = await fetchPrediction(payload);
      const ra = toRiskAssessment(result);
      updatePatient(currentPatient.id, { riskAssessment: ra });
      setLastPrediction(result);
    } catch (e) {
      setError("Backend offline — predictions unavailable");
    } finally {
      setLoading(false);
    }
  }, [currentPatient, updatePatient]);

  // On mount: batch fetch all patients that have no real prediction yet
  useEffect(() => {
    const unpredicted = patients.filter(
      (p) => !p.riskAssessment?.modelUsed || p.riskAssessment.modelUsed === "none",
    );
    // Stagger requests to avoid hammering the backend
    unpredicted.forEach((p, i) => {
      setTimeout(() => fetchAndSave(p), i * 300);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When current patient changes, fetch if needed
  useEffect(() => {
    if (!currentPatient) return;
    const needsFetch =
      !currentPatient.riskAssessment?.modelUsed ||
      currentPatient.riskAssessment.modelUsed === "none";
    if (needsFetch) {
      fetchAndSave(currentPatient);
    } else {
      // Still update lastPrediction for display
      setLastPrediction(null);
    }
  }, [currentPatient?.id, fetchAndSave]);

  return { loading, lastPrediction, error, refetchCurrentPatient };
}
