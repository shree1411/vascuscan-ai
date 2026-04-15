import type { FormData } from "./types";

interface Props {
  formData: FormData;
  onChange: (field: keyof FormData, value: FormData[keyof FormData]) => void;
  errors: Partial<Record<keyof FormData, string>>;
  onSubmit: () => void;
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-[#1a2744]">
      <span className="text-[#64748b] text-xs">{label}</span>
      <span className="text-white text-xs font-medium">{value || "—"}</span>
    </div>
  );
}

export default function Step7Review({ formData, onChange, onSubmit }: Props) {
  const canSubmit = formData.confirmAccuracy && formData.consentMonitoring;
  const h = Number.parseFloat(formData.height) || 0;
  const w = Number.parseFloat(formData.weight) || 0;
  const bmi = h > 0 && w > 0 ? (w / (h / 100) ** 2).toFixed(2) : "—";
  const age = formData.dob
    ? Math.floor(
        (Date.now() - new Date(formData.dob).getTime()) /
          (365.25 * 24 * 3600 * 1000),
      )
    : 0;

  const rows: [string, string][] = [
    ["Name", formData.fullName],
    ["Date of Birth", formData.dob],
    ["Age", age > 0 ? `${age} years` : "—"],
    ["Gender", formData.gender],
    ["Blood Type", formData.bloodType],
    ["Contact", formData.contactNumber],
    ["Email", formData.email],
    [
      "Height / Weight",
      `${formData.height || "—"} cm / ${formData.weight || "—"} kg`,
    ],
    ["BMI", bmi],
    ["Blood Pressure", `${formData.systolic}/${formData.diastolic} mmHg`],
    ["Resting HR", `${formData.heartRateBaseline} BPM`],
    ["Diabetes", formData.diabetes],
    ["Hypertension", formData.hypertension],
    ["Cholesterol", `${formData.cholesterol} mg/dL`],
    ["LDL / HDL", `${formData.ldl} / ${formData.hdl} mg/dL`],
    ["Smoking", formData.smoking],
    ["Activity Level", formData.activityLevel],
    ["Stress Level", formData.stressLevel],
    ["Sleep Hours", formData.sleepHours],
    ["Family: Heart", formData.familyHeartDisease ? "Positive" : "Negative"],
    ["Family: Diabetes", formData.familyDiabetes ? "Positive" : "Negative"],
    [
      "Family: Hypertension",
      formData.familyHypertension ? "Positive" : "Negative",
    ],
    [
      "Prev. Events",
      formData.previousEvents.length > 0
        ? formData.previousEvents.join(", ")
        : "None",
    ],
    ["Medications", formData.medications || "None"],
    ["Allergies", formData.allergies || "None"],
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="max-h-64 overflow-y-auto border border-[#1a2744] rounded bg-[#0a0e1a] p-3">
        <p className="text-[#00d4ff] text-xs font-semibold mb-2 uppercase tracking-wide">
          Patient Summary
        </p>
        {rows.map(([label, value]) => (
          <ReviewRow key={label} label={label} value={value} />
        ))}
      </div>

      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={formData.confirmAccuracy}
          onChange={(e) => onChange("confirmAccuracy", e.target.checked)}
          style={{ accentColor: "#00d4ff" }}
          className="mt-0.5"
          data-ocid="np-confirm-accuracy"
        />
        <span className="text-white text-sm">
          I confirm all information is accurate
        </span>
      </label>

      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={formData.consentMonitoring}
          onChange={(e) => onChange("consentMonitoring", e.target.checked)}
          style={{ accentColor: "#00d4ff" }}
          className="mt-0.5"
          data-ocid="np-consent-monitoring"
        />
        <span className="text-white text-sm">
          I consent to real-time monitoring and data collection
        </span>
      </label>

      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit}
        className="w-full py-2.5 rounded font-semibold text-sm transition-smooth"
        style={{
          background: canSubmit ? "#00d4ff" : "#1a2744",
          color: canSubmit ? "#000" : "#64748b",
          cursor: canSubmit ? "pointer" : "not-allowed",
        }}
        data-ocid="np-submit-btn"
      >
        Register Patient
      </button>
    </div>
  );
}
