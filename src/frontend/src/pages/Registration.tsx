import { useNavigate } from "@tanstack/react-router";
import { CircleAlert as AlertCircle, Check, ChevronLeft, ChevronRight, UserPlus } from "lucide-react";
import { useCallback, useState } from "react";
import { useStore } from "../store/useStore";
import type {
  BloodType,
  FeatureFlag,
  MedicalHistoryBadge,
  Patient,
  RiskAssessment,
  ScanSession,
  VitalSigns,
} from "../types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormData {
  // Page 1 — Demographics
  fullName: string;
  dob: string;
  gender: "Male" | "Female" | "Other" | "";
  bloodType: string;
  contactNumber: string;
  email: string;
  // Page 2 — Vitals
  height: string;
  weight: string;
  systolic: string;
  diastolic: string;
  heartRate: string;
  // Page 3 — Chronic conditions
  diabetes: string;
  diabetesDuration: string;
  hypertension: string;
  hypertensionDuration: string;
  cholesterol: string;
  ldl: string;
  hdl: string;
  // Page 4 — Lifestyle
  smoking: string;
  smokingYears: string;
  alcohol: string;
  activityLevel: string;
  activityMinutes: string;
  stressLevel: string;
  sleepHours: string;
  // Page 5 — Family history
  familyHeartDisease: boolean;
  familyDiabetes: boolean;
  familyHypertension: boolean;
  familyRelations: string[];
  // Page 6 — Events
  previousEvents: string[];
  eventNotes: string;
  medications: string;
  allergies: string;
  // Page 7 — Consent
  confirmAccuracy: boolean;
  consentMonitoring: boolean;
}

const initialForm: FormData = {
  fullName: "",
  dob: "",
  gender: "",
  bloodType: "",
  contactNumber: "",
  email: "",
  height: "",
  weight: "",
  systolic: "120",
  diastolic: "80",
  heartRate: "72",
  diabetes: "None",
  diabetesDuration: "",
  hypertension: "None",
  hypertensionDuration: "",
  cholesterol: "180",
  ldl: "110",
  hdl: "50",
  smoking: "Never",
  smokingYears: "",
  alcohol: "None",
  activityLevel: "Moderate",
  activityMinutes: "150",
  stressLevel: "Low",
  sleepHours: "7",
  familyHeartDisease: false,
  familyDiabetes: false,
  familyHypertension: false,
  familyRelations: [],
  previousEvents: [],
  eventNotes: "",
  medications: "",
  allergies: "",
  confirmAccuracy: false,
  consentMonitoring: false,
};

const PAGE_TITLES = [
  "Demographics",
  "Vital Measurements",
  "Medical History",
  "Lifestyle & Risk",
  "Family History",
  "Medical Events",
  "Review & Consent",
];

const BLOOD_TYPES = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];
const FAMILY_RELATIONS = ["Father", "Mother", "Sibling", "Grandparent"];
const EVENTS = [
  "Myocardial Infarction (Heart Attack)",
  "Stroke",
  "Angioplasty/Stent Placement",
  "Coronary Bypass Surgery",
  "Arrhythmia",
];

// ─── Field component ──────────────────────────────────────────────────────────

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p
        className="block text-xs font-semibold mb-1"
        style={{ color: "rgba(255,255,255,0.6)" }}
      >
        {label}
        {required && <span style={{ color: "#ef4444" }}> *</span>}
      </p>
      {children}
      {error && (
        <div
          className="flex items-center gap-1 mt-1 text-xs"
          style={{ color: "#ef4444" }}
        >
          <AlertCircle size={10} />
          {error}
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  background: "#0d1525",
  borderColor: "rgba(0,212,255,0.2)",
  color: "#e8eaf0",
};

const inputClass =
  "w-full px-3 py-2 rounded-md border text-sm outline-none focus:border-cyan-400 transition-colors";

// ─── Pages ────────────────────────────────────────────────────────────────────

function Page1({
  form,
  set,
  errors,
}: {
  form: FormData;
  set: (k: keyof FormData, v: FormData[keyof FormData]) => void;
  errors: Partial<Record<keyof FormData, string>>;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2">
        <Field label="Full Name" required error={errors.fullName}>
          <input
            className={inputClass}
            style={inputStyle}
            value={form.fullName}
            onChange={(e) => set("fullName", e.target.value)}
            placeholder="John Smith"
            data-ocid="reg-fullname"
          />
        </Field>
      </div>
      <Field label="Date of Birth" required error={errors.dob}>
        <input
          type="date"
          className={inputClass}
          style={inputStyle}
          value={form.dob}
          onChange={(e) => set("dob", e.target.value)}
          data-ocid="reg-dob"
        />
      </Field>
      <Field label="Gender" required error={errors.gender}>
        <select
          className={inputClass}
          style={inputStyle}
          value={form.gender}
          onChange={(e) => set("gender", e.target.value as FormData["gender"])}
          data-ocid="reg-gender"
        >
          <option value="">Select…</option>
          <option>Male</option>
          <option>Female</option>
          <option>Other</option>
        </select>
      </Field>
      <Field label="Blood Type" required error={errors.bloodType}>
        <select
          className={inputClass}
          style={inputStyle}
          value={form.bloodType}
          onChange={(e) => set("bloodType", e.target.value)}
          data-ocid="reg-bloodtype"
        >
          <option value="">Select…</option>
          {BLOOD_TYPES.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
      </Field>
      <Field label="Contact Number" required error={errors.contactNumber}>
        <input
          className={inputClass}
          style={inputStyle}
          value={form.contactNumber}
          onChange={(e) => set("contactNumber", e.target.value)}
          placeholder="+1-555-0000"
          data-ocid="reg-phone"
        />
      </Field>
      <div className="col-span-2">
        <Field label="Email" required error={errors.email}>
          <input
            type="email"
            className={inputClass}
            style={inputStyle}
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="patient@example.com"
            data-ocid="reg-email"
          />
        </Field>
      </div>
    </div>
  );
}

function Page2({
  form,
  set,
  errors,
}: {
  form: FormData;
  set: (k: keyof FormData, v: FormData[keyof FormData]) => void;
  errors: Partial<Record<keyof FormData, string>>;
}) {
  const height = Number.parseFloat(form.height) || 0;
  const weight = Number.parseFloat(form.weight) || 0;
  const bmi =
    height > 0 && weight > 0 ? (weight / (height / 100) ** 2).toFixed(1) : "—";
  return (
    <div className="grid grid-cols-2 gap-4">
      <Field label="Height (cm)" required error={errors.height}>
        <input
          type="number"
          className={inputClass}
          style={inputStyle}
          value={form.height}
          onChange={(e) => set("height", e.target.value)}
          min="100"
          placeholder="170"
          data-ocid="reg-height"
        />
      </Field>
      <Field label="Weight (kg)" required error={errors.weight}>
        <input
          type="number"
          className={inputClass}
          style={inputStyle}
          value={form.weight}
          onChange={(e) => set("weight", e.target.value)}
          min="30"
          placeholder="70"
          data-ocid="reg-weight"
        />
      </Field>
      <div
        className="col-span-2 rounded-md px-3 py-2 text-sm"
        style={{
          background: "rgba(0,212,255,0.06)",
          border: "1px solid rgba(0,212,255,0.15)",
        }}
      >
        BMI (auto):{" "}
        <span className="font-bold" style={{ color: "#00d4ff" }}>
          {bmi}
        </span>
      </div>
      <Field label="Systolic BP (mmHg)" required error={errors.systolic}>
        <input
          type="number"
          className={inputClass}
          style={inputStyle}
          value={form.systolic}
          onChange={(e) => set("systolic", e.target.value)}
          min="90"
          max="180"
          data-ocid="reg-systolic"
        />
      </Field>
      <Field label="Diastolic BP (mmHg)" required error={errors.diastolic}>
        <input
          type="number"
          className={inputClass}
          style={inputStyle}
          value={form.diastolic}
          onChange={(e) => set("diastolic", e.target.value)}
          min="60"
          max="120"
          data-ocid="reg-diastolic"
        />
      </Field>
      <div className="col-span-2">
        <Field
          label="Heart Rate Baseline (BPM)"
          required
          error={errors.heartRate}
        >
          <input
            type="number"
            className={inputClass}
            style={inputStyle}
            value={form.heartRate}
            onChange={(e) => set("heartRate", e.target.value)}
            min="40"
            max="100"
            data-ocid="reg-heartrate"
          />
        </Field>
      </div>
    </div>
  );
}

function Page3({
  form,
  set,
  errors,
}: {
  form: FormData;
  set: (k: keyof FormData, v: FormData[keyof FormData]) => void;
  errors: Partial<Record<keyof FormData, string>>;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Field label="Diabetes Status" required>
        <select
          className={inputClass}
          style={inputStyle}
          value={form.diabetes}
          onChange={(e) => set("diabetes", e.target.value)}
          data-ocid="reg-diabetes"
        >
          {["None", "Type 1", "Type 2", "Prediabetes"].map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </Field>
      {form.diabetes !== "None" && (
        <Field label="Diabetes Duration (years)">
          <input
            type="number"
            className={inputClass}
            style={inputStyle}
            value={form.diabetesDuration}
            onChange={(e) => set("diabetesDuration", e.target.value)}
            min="0"
            data-ocid="reg-diabetes-dur"
          />
        </Field>
      )}
      <Field label="Hypertension Status" required>
        <select
          className={inputClass}
          style={inputStyle}
          value={form.hypertension}
          onChange={(e) => set("hypertension", e.target.value)}
          data-ocid="reg-hypertension"
        >
          {["None", "Treated", "Untreated"].map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </Field>
      {form.hypertension !== "None" && (
        <Field label="Hypertension Duration (years)">
          <input
            type="number"
            className={inputClass}
            style={inputStyle}
            value={form.hypertensionDuration}
            onChange={(e) => set("hypertensionDuration", e.target.value)}
            min="0"
            data-ocid="reg-hypertension-dur"
          />
        </Field>
      )}
      <Field label="Cholesterol (mg/dL)" required error={errors.cholesterol}>
        <input
          type="number"
          className={inputClass}
          style={inputStyle}
          value={form.cholesterol}
          onChange={(e) => set("cholesterol", e.target.value)}
          min="150"
          max="300"
          data-ocid="reg-cholesterol"
        />
      </Field>
      <Field label="LDL (mg/dL)">
        <input
          type="number"
          className={inputClass}
          style={inputStyle}
          value={form.ldl}
          onChange={(e) => set("ldl", e.target.value)}
          min="70"
          max="200"
          data-ocid="reg-ldl"
        />
      </Field>
      <Field label="HDL (mg/dL)">
        <input
          type="number"
          className={inputClass}
          style={inputStyle}
          value={form.hdl}
          onChange={(e) => set("hdl", e.target.value)}
          min="30"
          max="80"
          data-ocid="reg-hdl"
        />
      </Field>
    </div>
  );
}

function Page4({
  form,
  set,
}: {
  form: FormData;
  set: (k: keyof FormData, v: FormData[keyof FormData]) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Field label="Smoking Status" required>
        <select
          className={inputClass}
          style={inputStyle}
          value={form.smoking}
          onChange={(e) => set("smoking", e.target.value)}
          data-ocid="reg-smoking"
        >
          {["Never", "Former", "Current"].map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </Field>
      {form.smoking !== "Never" && (
        <Field label="Years Smoked">
          <input
            type="number"
            className={inputClass}
            style={inputStyle}
            value={form.smokingYears}
            onChange={(e) => set("smokingYears", e.target.value)}
            min="0"
            data-ocid="reg-smoking-years"
          />
        </Field>
      )}
      <Field label="Alcohol Consumption">
        <select
          className={inputClass}
          style={inputStyle}
          value={form.alcohol}
          onChange={(e) => set("alcohol", e.target.value)}
          data-ocid="reg-alcohol"
        >
          {["None", "Occasional", "Regular", "Heavy"].map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </Field>
      <Field label="Physical Activity Level">
        <select
          className={inputClass}
          style={inputStyle}
          value={form.activityLevel}
          onChange={(e) => set("activityLevel", e.target.value)}
          data-ocid="reg-activity"
        >
          {["Sedentary", "Light", "Moderate", "Vigorous"].map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </Field>
      <Field label="Activity (minutes/week)">
        <input
          type="number"
          className={inputClass}
          style={inputStyle}
          value={form.activityMinutes}
          onChange={(e) => set("activityMinutes", e.target.value)}
          min="0"
          data-ocid="reg-activity-mins"
        />
      </Field>
      <Field label="Stress Level">
        <select
          className={inputClass}
          style={inputStyle}
          value={form.stressLevel}
          onChange={(e) => set("stressLevel", e.target.value)}
          data-ocid="reg-stress"
        >
          {["Low", "Moderate", "High"].map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </Field>
      <Field label="Sleep Hours (per night)">
        <input
          type="number"
          className={inputClass}
          style={inputStyle}
          value={form.sleepHours}
          onChange={(e) => set("sleepHours", e.target.value)}
          min="4"
          max="12"
          step="0.5"
          data-ocid="reg-sleep"
        />
      </Field>
    </div>
  );
}

function Page5({
  form,
  set,
}: {
  form: FormData;
  set: (k: keyof FormData, v: FormData[keyof FormData]) => void;
}) {
  const toggle = (rel: string) => {
    const cur = form.familyRelations;
    set(
      "familyRelations",
      cur.includes(rel) ? cur.filter((r) => r !== rel) : [...cur, rel],
    );
  };
  return (
    <div className="flex flex-col gap-4">
      {[
        {
          label: "Family History of Heart Disease",
          key: "familyHeartDisease" as const,
        },
        { label: "Family History of Diabetes", key: "familyDiabetes" as const },
        {
          label: "Family History of Hypertension",
          key: "familyHypertension" as const,
        },
      ].map(({ label, key }) => (
        <div key={key} className="flex flex-col gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form[key] as boolean}
              onChange={(e) => set(key, e.target.checked)}
              className="w-4 h-4 rounded"
              style={{ accentColor: "#00d4ff" }}
              data-ocid={`reg-${key}`}
            />
            <span className="text-sm" style={{ color: "#e8eaf0" }}>
              {label}
            </span>
          </label>
          {form[key] && (
            <div className="flex flex-wrap gap-2 ml-6">
              {FAMILY_RELATIONS.map((rel) => (
                <label
                  key={rel}
                  className="flex items-center gap-1.5 cursor-pointer text-xs"
                >
                  <input
                    type="checkbox"
                    checked={form.familyRelations.includes(rel)}
                    onChange={() => toggle(rel)}
                    style={{ accentColor: "#00d4ff" }}
                  />
                  <span style={{ color: "rgba(255,255,255,0.6)" }}>{rel}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Page6({
  form,
  set,
}: {
  form: FormData;
  set: (k: keyof FormData, v: FormData[keyof FormData]) => void;
}) {
  const toggleEvent = (ev: string) => {
    const cur = form.previousEvents;
    set(
      "previousEvents",
      cur.includes(ev) ? cur.filter((e) => e !== ev) : [...cur, ev],
    );
  };
  return (
    <div className="flex flex-col gap-4">
      <Field label="Previous Cardiovascular Events">
        <div className="flex flex-col gap-2 mt-1">
          {EVENTS.map((ev) => (
            <label
              key={ev}
              className="flex items-center gap-2 cursor-pointer text-sm"
            >
              <input
                type="checkbox"
                checked={form.previousEvents.includes(ev)}
                onChange={() => toggleEvent(ev)}
                style={{ accentColor: "#00d4ff" }}
                data-ocid={`reg-event-${ev.slice(0, 10).replace(/\s/g, "-")}`}
              />
              <span style={{ color: "rgba(255,255,255,0.7)" }}>{ev}</span>
            </label>
          ))}
        </div>
      </Field>
      {form.previousEvents.length > 0 && (
        <Field label="Event Notes">
          <textarea
            className={`${inputClass} resize-none`}
            style={inputStyle}
            rows={3}
            value={form.eventNotes}
            onChange={(e) => set("eventNotes", e.target.value)}
            placeholder="Date and brief notes…"
            data-ocid="reg-eventnotes"
          />
        </Field>
      )}
      <Field label="Current Medications">
        <textarea
          className={`${inputClass} resize-none`}
          style={inputStyle}
          rows={3}
          value={form.medications}
          onChange={(e) => set("medications", e.target.value)}
          placeholder="List medications…"
          data-ocid="reg-medications"
        />
      </Field>
      <Field label="Allergies">
        <textarea
          className={`${inputClass} resize-none`}
          style={inputStyle}
          rows={2}
          value={form.allergies}
          onChange={(e) => set("allergies", e.target.value)}
          placeholder="List allergies…"
          data-ocid="reg-allergies"
        />
      </Field>
    </div>
  );
}

function Page7({
  form,
  set,
  onSubmit,
}: {
  form: FormData;
  set: (k: keyof FormData, v: FormData[keyof FormData]) => void;
  onSubmit: () => void;
}) {
  const canSubmit = form.confirmAccuracy && form.consentMonitoring;
  const age = form.dob
    ? Math.floor(
        (Date.now() - new Date(form.dob).getTime()) /
          (365.25 * 24 * 3600 * 1000),
      )
    : 0;
  const bmi =
    form.height && form.weight
      ? (
          Number.parseFloat(form.weight) /
          (Number.parseFloat(form.height) / 100) ** 2
        ).toFixed(1)
      : "—";

  return (
    <div className="flex flex-col gap-4">
      <div
        className="rounded-md p-4 border"
        style={{ background: "#0a1020", borderColor: "rgba(0,212,255,0.12)" }}
      >
        <p className="text-xs font-semibold mb-3" style={{ color: "#00d4ff" }}>
          Summary
        </p>
        <div className="grid grid-cols-2 gap-1 text-xs">
          {[
            ["Name", form.fullName || "—"],
            ["Age", age > 0 ? `${age}` : "—"],
            ["Gender", form.gender || "—"],
            ["Blood Type", form.bloodType || "—"],
            [
              "Height/Weight",
              `${form.height || "—"}cm / ${form.weight || "—"}kg`,
            ],
            ["BMI", bmi],
            ["BP Baseline", `${form.systolic}/${form.diastolic} mmHg`],
            ["Heart Rate", `${form.heartRate} BPM`],
            ["Diabetes", form.diabetes],
            ["Hypertension", form.hypertension],
            ["Cholesterol", `${form.cholesterol} mg/dL`],
            ["Smoking", form.smoking],
          ].map(([k, v]) => (
            <div
              key={k}
              className="flex justify-between py-1 border-b"
              style={{ borderColor: "rgba(255,255,255,0.05)" }}
            >
              <span style={{ color: "rgba(255,255,255,0.4)" }}>{k}</span>
              <span style={{ color: "#e8eaf0" }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={form.confirmAccuracy}
          onChange={(e) => set("confirmAccuracy", e.target.checked)}
          className="mt-0.5"
          style={{ accentColor: "#00d4ff" }}
          data-ocid="reg-confirm-accuracy"
        />
        <span className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
          I confirm all information is accurate
        </span>
      </label>
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={form.consentMonitoring}
          onChange={(e) => set("consentMonitoring", e.target.checked)}
          className="mt-0.5"
          style={{ accentColor: "#00d4ff" }}
          data-ocid="reg-consent-monitoring"
        />
        <span className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
          I consent to real-time monitoring and data collection
        </span>
      </label>
      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit}
        className="w-full py-2.5 rounded-md font-semibold text-sm transition-smooth"
        style={{
          background: canSubmit
            ? "rgba(0,212,255,0.2)"
            : "rgba(255,255,255,0.05)",
          border: `1px solid ${canSubmit ? "rgba(0,212,255,0.4)" : "rgba(255,255,255,0.1)"}`,
          color: canSubmit ? "#00d4ff" : "rgba(255,255,255,0.3)",
          cursor: canSubmit ? "pointer" : "not-allowed",
        }}
        data-ocid="reg-submit-btn"
      >
        Register Patient
      </button>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Registration() {
  const [page, setPage] = useState(0);
  const [form, setFormState] = useState<FormData>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>(
    {},
  );
  const addPatient = useStore((s) => s.addPatient);
  const addScanSession = useStore((s) => s.addScanSession);
  const setCurrentPatientId = useStore((s) => s.setCurrentPatientId);
  const addNotification = useStore((s) => s.addNotification);
  const navigate = useNavigate();

  const set = useCallback(
    <K extends keyof FormData>(key: K, value: FormData[K]) => {
      setFormState((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    },
    [],
  );

  const validate = (): boolean => {
    const errs: Partial<Record<keyof FormData, string>> = {};
    if (page === 0) {
      if (!form.fullName.trim()) errs.fullName = "Required";
      if (/[^a-zA-Z\s.]/.test(form.fullName))
        errs.fullName = "No special characters";
      if (!form.dob) errs.dob = "Required";
      else {
        const age = Math.floor(
          (Date.now() - new Date(form.dob).getTime()) /
            (365.25 * 24 * 3600 * 1000),
        );
        if (age < 18) errs.dob = "Patient must be 18+";
      }
      if (!form.gender) errs.gender = "Required";
      if (!form.bloodType) errs.bloodType = "Required";
      if (!/^\+?[\d\s\-()]{10,15}$/.test(form.contactNumber))
        errs.contactNumber = "Invalid phone number";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
        errs.email = "Invalid email";
    }
    if (page === 1) {
      if (!form.height || Number.parseFloat(form.height) < 100)
        errs.height = "Minimum 100 cm";
      if (!form.weight || Number.parseFloat(form.weight) < 30)
        errs.weight = "Minimum 30 kg";
    }
    if (page === 2) {
      const chol = Number.parseFloat(form.cholesterol);
      if (Number.isNaN(chol) || chol < 150)
        errs.cholesterol = "Cholesterol must be minimum 150 mg/dL";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const next = () => {
    if (validate()) setPage((p) => Math.min(p + 1, 6));
  };
  const prev = () => setPage((p) => Math.max(p - 1, 0));

  const submit = async () => {
    const id = `VS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 8999)}`;
    const age = form.dob ? Math.floor((Date.now() - new Date(form.dob).getTime()) / (365.25 * 24 * 3600 * 1000)) : 0;

    const medicalBadges: MedicalHistoryBadge[] = [];
    if (form.diabetes !== "No" && form.diabetes) {
      medicalBadges.push({
        label: `Diabetes ${form.diabetes}`,
        detail: form.diabetesDuration
          ? `${form.diabetesDuration}yr`
          : undefined,
        color: "#f59e0b",
      });
    }
    if (form.hypertension !== "No" && form.hypertension) {
      medicalBadges.push({
        label: `Hypertension: ${form.hypertension}`,
        color: "#22c55e",
      });
    }
    if (form.smoking !== "Never" && form.smoking) {
      medicalBadges.push({
        label: `Smoking: ${form.smoking}`,
        detail: form.smokingYears ? `${form.smokingYears}yr` : undefined,
        color: form.smoking === "Current" ? "#ef4444" : "#64748b",
      });
    }
    if (form.familyHeartDisease) {
      medicalBadges.push({
        label: "Family History: Positive",
        color: "#ef4444",
      });
    }
    if (form.previousEvents.length > 0) {
      medicalBadges.push({
        label: form.previousEvents[0].split("/")[0],
        color: "#f97316",
      });
    }

    const featureFlags: FeatureFlag[] = [];

    const vitals: VitalSigns = {
      heartRate: Number.parseInt(form.heartRate),
      spo2: 98,
      systolic: Number.parseInt(form.systolic),
      diastolic: Number.parseInt(form.diastolic),
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
        gender: form.gender,
        diabetes_status: form.diabetes,
        hypertension_status: form.hypertension,
        cholesterol_level: Number.parseFloat(form.cholesterol) || 180,
        ldl: Number.parseFloat(form.ldl) || 110,
        hdl: Number.parseFloat(form.hdl) || 50,
        smoking_status: form.smoking,
        family_history: form.familyHeartDisease ? 1 : 0,
        activity_level: form.activityLevel || "Moderate",
        stress_level: form.stressLevel || "Low",
      };
      const res = await fetch("http://127.0.0.1:5000/api/predict-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const json = await res.json();
        const lvl = (json.risk_level as string) ?? "Low";
        const riskLevel = lvl === "High" ? "High" : lvl === "Moderate" ? "Moderate" : "Low";
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
    const patient: Patient = {
      id,
      fullName: form.fullName,
      initials: form.fullName
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
      avatarColor: "#1a4a7a",
      age: Math.floor(
        (Date.now() - new Date(form.dob).getTime()) /
          (365.25 * 24 * 3600 * 1000),
      ),
      gender: form.gender as Patient["gender"],
      bloodType: form.bloodType as BloodType,
      height: Number.parseFloat(form.height),
      weight: Number.parseFloat(form.weight),
      dob: form.dob,
      contactNumber: form.contactNumber,
      email: form.email,
      createdAt: new Date().toISOString(),
      medicalBadges,
      vitals,
      riskAssessment: ra,
      scanSessions: [],
      featureFlags,
      ppgParams: {
        heartRate: Number.parseInt(form.heartRate),
        pulseAmplitude: 0.72,
        ptt: 220,
        riseTime: 165,
      },
      ecgParams: {
        qrsDuration: 92,
        rrInterval: Math.round(60000 / Number.parseInt(form.heartRate || "78")),
        stSegment: 0.08,
        hrvIndex: 42,
      },
      aiFeatures: [],
      diabetes: form.diabetes,
      hypertension: form.hypertension,
      cholesterol: Number.parseFloat(form.cholesterol),
      smoking: form.smoking,
      familyHistoryPositive: form.familyHeartDisease,
      medications: form.medications,
      allergies: form.allergies,
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
    navigate({ to: "/" });
  };

  const pageComponents = [
    <Page1 key="p1" form={form} set={set} errors={errors} />,
    <Page2 key="p2" form={form} set={set} errors={errors} />,
    <Page3 key="p3" form={form} set={set} errors={errors} />,
    <Page4 key="p4" form={form} set={set} />,
    <Page5 key="p5" form={form} set={set} />,
    <Page6 key="p6" form={form} set={set} />,
    <Page7 key="p7" form={form} set={set} onSubmit={submit} />,
  ];

  return (
    <div
      className="h-full overflow-y-auto flex items-start justify-center p-8"
      style={{ background: "#0a0e1a" }}
    >
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: "rgba(0,212,255,0.15)",
              border: "1px solid rgba(0,212,255,0.3)",
            }}
          >
            <UserPlus size={16} style={{ color: "#00d4ff" }} />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: "#e8eaf0" }}>
              Patient Registration
            </h1>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
              Page {page + 1} of 7 — {PAGE_TITLES[page]}
            </p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex gap-1 mb-6">
          {PAGE_TITLES.map((title, i) => (
            <div
              key={title}
              className="flex-1 flex flex-col items-center gap-1"
            >
              <div
                className="w-full h-1 rounded-full"
                style={{
                  background: i <= page ? "#00d4ff" : "rgba(255,255,255,0.1)",
                }}
              />
              <span
                className="text-[9px] hidden sm:block"
                style={{
                  color: i === page ? "#00d4ff" : "rgba(255,255,255,0.3)",
                }}
              >
                {i + 1}
              </span>
            </div>
          ))}
        </div>

        {/* Form card */}
        <div
          className="rounded-xl border p-6 mb-4"
          style={{ background: "#0d1525", borderColor: "rgba(0,212,255,0.12)" }}
        >
          <h2
            className="text-sm font-semibold mb-4"
            style={{ color: "#00d4ff" }}
          >
            {PAGE_TITLES[page]}
          </h2>
          {pageComponents[page]}
        </div>

        {/* Nav buttons */}
        {page < 6 && (
          <div className="flex justify-between">
            <button
              type="button"
              onClick={prev}
              disabled={page === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-smooth"
              style={{
                background: "rgba(255,255,255,0.06)",
                color:
                  page === 0
                    ? "rgba(255,255,255,0.2)"
                    : "rgba(255,255,255,0.6)",
                cursor: page === 0 ? "not-allowed" : "pointer",
              }}
              data-ocid="reg-prev-btn"
            >
              <ChevronLeft size={14} />
              Previous
            </button>
            <button
              type="button"
              onClick={next}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-smooth"
              style={{
                background: "rgba(0,212,255,0.2)",
                border: "1px solid rgba(0,212,255,0.35)",
                color: "#00d4ff",
              }}
              data-ocid="reg-next-btn"
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        )}
        {page === 6 && page > 0 && (
          <div className="flex justify-start">
            <button
              type="button"
              onClick={prev}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium"
              style={{
                background: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.6)",
              }}
              data-ocid="reg-prev-final-btn"
            >
              <ChevronLeft size={14} />
              Previous
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
