import { useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useAppStore } from "../store/appStore";
import type {
  BloodType,
  FeatureFlag,
  MedicalHistoryBadge,
  Patient,
  RiskAssessment,
  ScanSession,
  VitalSigns,
} from "../types";
import { useStore } from "../store/useStore";
import Step1Demographics from "./wizard/Step1Demographics";
import Step2Vitals from "./wizard/Step2Vitals";
import Step3Medical from "./wizard/Step3Medical";
import Step4Lifestyle from "./wizard/Step4Lifestyle";
import Step5Family from "./wizard/Step5Family";
import Step6Events from "./wizard/Step6Events";
import Step7Review from "./wizard/Step7Review";
import StepIndicator, { STEPS } from "./wizard/StepIndicator";
import { initialFormData } from "./wizard/types";
import type { FormData } from "./wizard/types";

export default function NewPatient() {
  const navigate = useNavigate();
  const addPatient = useStore((s) => s.addPatient);
  const addScanSession = useStore((s) => s.addScanSession);
  const setCurrentPatientId = useStore((s) => s.setCurrentPatientId);
  const addNotification = useStore((s) => s.addNotification);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>(
    {},
  );

  const onChange = useCallback(
    <K extends keyof FormData>(field: K, value: FormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    },
    [],
  );

  const validate = (): boolean => {
    const errs: Partial<Record<keyof FormData, string>> = {};
    if (step === 1) {
      if (!formData.fullName.trim()) errs.fullName = "Required";
      else if (/[^a-zA-Z\s.]/.test(formData.fullName))
        errs.fullName = "No special characters or numbers";
      if (!formData.dob) errs.dob = "Required";
      else {
        const age = Math.floor(
          (Date.now() - new Date(formData.dob).getTime()) /
            (365.25 * 24 * 3600 * 1000),
        );
        if (age < 18) errs.dob = "Patient must be 18 or older";
      }
      if (!formData.gender) errs.gender = "Required";
      if (!formData.bloodType) errs.bloodType = "Required";
      const digits = formData.contactNumber.replace(/\D/g, "");
      if (digits.length < 10 || digits.length > 15)
        errs.contactNumber = "Phone must be 10–15 digits";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
        errs.email = "Invalid email format";
    }
    if (step === 2) {
      if (!formData.height || Number.parseFloat(formData.height) < 100)
        errs.height = "Minimum 100 cm";
      if (!formData.weight || Number.parseFloat(formData.weight) < 30)
        errs.weight = "Minimum 30 kg";
    }
    if (step === 3) {
      // Remove strict cholesterol block
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const cholVal = Number.parseFloat(formData.cholesterol);
  const cholBlocked = false;

  const handleNext = () => {
    if (validate() && !cholBlocked) setStep((s) => Math.min(s + 1, 7));
  };
  const handleBack = () => setStep((s) => Math.max(s - 1, 1));

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const id = `VS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 8999)}`;
    const badges: MedicalHistoryBadge[] = [];
    if (formData.diabetes !== "No")
      badges.push({
        label: `Diabetes: ${formData.diabetes}`,
        detail: formData.diabetesDuration
          ? `${formData.diabetesDuration}yr`
          : undefined,
        color: "#f59e0b",
      });
    if (formData.hypertension !== "No")
      badges.push({
        label: `Hypertension: ${formData.hypertension}`,
        color: "#22c55e",
      });
    if (formData.smoking !== "Never")
      badges.push({
        label: `Smoking: ${formData.smoking}`,
        color: formData.smoking === "Current" ? "#ef4444" : "#64748b",
      });
    if (formData.familyHeartDisease)
      badges.push({ label: "Family History: Positive", color: "#ef4444" });
    if (formData.previousEvents.length > 0)
      badges.push({
        label: formData.previousEvents[0].split("/")[0],
        color: "#f97316",
      });

    const age = Math.floor(
      (Date.now() - new Date(formData.dob).getTime()) /
        (365.25 * 24 * 3600 * 1000),
    );

    const vitals: VitalSigns = {
      heartRate: Number.parseInt(formData.heartRateBaseline) || 72,
      spo2: 98,
      systolic: Number.parseInt(formData.systolic) || 120,
      diastolic: Number.parseInt(formData.diastolic) || 80,
      ptt: 220,
      perfusionIndex: 2.5,
    };

    // ── Call Model 1 (form-only) for instant AI prediction ────────────────
    let ra: RiskAssessment = {
      riskScore: 30,
      riskLevel: "Low",
      blockageProbability: 20,
      aiConfidence: 85,
      modelUsed: "none",
    };

    try {
      const payload = {
        age,
        gender: formData.gender,
        diabetes_status: formData.diabetes,
        hypertension_status: formData.hypertension,
        cholesterol_level: Number.parseFloat(formData.cholesterol) || 180,
        ldl: Number.parseFloat(formData.ldl) || 110,
        hdl: Number.parseFloat(formData.hdl) || 50,
        smoking_status: formData.smoking,
        family_history: formData.familyHeartDisease ? 1 : 0,
        activity_level: formData.activityLevel || "Moderate",
        stress_level: formData.stressLevel || "Low",
      };
      const res = await fetch("http://127.0.0.1:5000/api/predict-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const json = await res.json();
        const lvl = (json.risk_level as string) ?? "Low";
        const riskLevel =
          lvl === "High" ? "High" : lvl === "Moderate" ? "Moderate" : "Low";
        const score = json.risk_score ?? 0.3;
        ra = {
          riskScore: Math.round(score * 100),
          riskLevel,
          blockageProbability: Math.round(score * 80),
          aiConfidence: Math.round(json.probabilities?.[lvl] ?? 75),
          modelUsed: "model1_form",
          probabilities: json.probabilities ?? {},
        };
        addNotification("Clinical AI assessment complete.", "success");
      }
    } catch (_e) {
      addNotification("Model 1 offline. Using clinical baseline.", "warning");
    }

    const featureFlags: FeatureFlag[] = [];

    const patient: Patient = {
      id,
      fullName: formData.fullName,
      initials: formData.fullName
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
      avatarColor: "#1a4a7a",
      age,
      gender: formData.gender as Patient["gender"],
      bloodType: formData.bloodType as BloodType,
      height: Number.parseFloat(formData.height),
      weight: Number.parseFloat(formData.weight),
      dob: formData.dob,
      contactNumber: formData.contactNumber,
      email: formData.email,
      createdAt: new Date().toISOString(),
      medicalBadges: badges,
      vitals,
      riskAssessment: ra,
      scanSessions: [],
      featureFlags,
      ppgParams: {
        heartRate: vitals.heartRate,
        pulseAmplitude: 0.72,
        ptt: 220,
        riseTime: 165,
      },
      ecgParams: {
        qrsDuration: 92,
        rrInterval: Math.round(60000 / vitals.heartRate),
        stSegment: 0.08,
        hrvIndex: 42,
      },
      aiFeatures: [],
      diabetes: formData.diabetes,
      hypertension: formData.hypertension,
      cholesterol: Number.parseFloat(formData.cholesterol),
      smoking: formData.smoking,
      familyHistoryPositive: formData.familyHeartDisease,
      medications: formData.medications,
      allergies: formData.allergies,
    };

    addPatient(patient);

    const registrationSession: ScanSession = {
      id: `session-${Date.now()}`,
      patientId: id,
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      duration: 0,
      vitals,
      ppgParams: patient.ppgParams,
      ecgParams: patient.ecgParams,
      riskAssessment: ra,
    };
    addScanSession(id, registrationSession);

    setCurrentPatientId(id);
    setIsSubmitting(false);
    navigate({ to: "/" });
  };

  const stepProps = { formData, onChange, errors };

  return (
    <div className="min-h-screen bg-[#0a0e1a] p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            type="button"
            onClick={() => navigate({ to: "/" })}
            className="text-[#00d4ff] text-sm hover:text-white transition-smooth"
            data-ocid="np-back-btn"
          >
            ← Back
          </button>
          <div>
            <h1 className="text-white font-bold text-lg tracking-wide">
              NEW PATIENT REGISTRATION
            </h1>
            <p className="text-[#64748b] text-xs">
              Step {step} of {STEPS.length} — {STEPS[step - 1]}
            </p>
          </div>
        </div>

        <StepIndicator current={step} />

        {/* Form card */}
        <div className="bg-[#0d1426] border border-[#1a2744] rounded-lg p-6">
          <h2 className="text-[#00d4ff] font-semibold text-sm uppercase tracking-wide mb-5">
            Step {step}: {STEPS[step - 1]}
          </h2>

          {step === 1 && <Step1Demographics {...stepProps} />}
          {step === 2 && <Step2Vitals {...stepProps} />}
          {step === 3 && <Step3Medical {...stepProps} />}
          {step === 4 && <Step4Lifestyle {...stepProps} />}
          {step === 5 && <Step5Family {...stepProps} />}
          {step === 6 && <Step6Events {...stepProps} />}
          {step === 7 && <Step7Review {...stepProps} onSubmit={handleSubmit} />}
        </div>

        {/* Navigation */}
        {step < 7 && (
          <div className="flex justify-between mt-6">
            <button
              type="button"
              onClick={handleBack}
              disabled={step === 1}
              className="bg-[#1a2744] text-white px-4 py-2 rounded text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-smooth"
              data-ocid="np-prev-btn"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={cholBlocked}
              className="bg-[#00d4ff] text-black font-semibold px-6 py-2 rounded text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-smooth"
              data-ocid="np-next-btn"
            >
              Next →
            </button>
          </div>
        )}
        {step === 7 && (
          <div className="flex justify-start mt-6">
            <button
              type="button"
              onClick={handleBack}
              className="bg-[#1a2744] text-white px-4 py-2 rounded text-sm transition-smooth"
              data-ocid="np-prev-final-btn"
            >
              ← Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
