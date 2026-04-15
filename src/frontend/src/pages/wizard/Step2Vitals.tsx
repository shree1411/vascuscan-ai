import type { FormData } from "./types";

const ic =
  "w-full bg-[#0a0e1a] border border-[#1a2744] rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00d4ff]";

function FieldLabel({ text, required }: { text: string; required?: boolean }) {
  return (
    <p className="text-[#64748b] text-sm mb-1">
      {text}
      {required && <span className="text-red-400"> *</span>}
    </p>
  );
}

function FieldError({ msg }: { msg?: string }) {
  return msg ? <p className="text-red-400 text-xs mt-1">{msg}</p> : null;
}

interface Props {
  formData: FormData;
  onChange: (field: keyof FormData, value: FormData[keyof FormData]) => void;
  errors: Partial<Record<keyof FormData, string>>;
}

export default function Step2Vitals({ formData, onChange, errors }: Props) {
  const h = Number.parseFloat(formData.height) || 0;
  const w = Number.parseFloat(formData.weight) || 0;
  const bmi = h > 0 && w > 0 ? (w / (h / 100) ** 2).toFixed(2) : "—";

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <FieldLabel text="Height (cm)" required />
        <input
          type="number"
          className={ic}
          value={formData.height}
          onChange={(e) => onChange("height", e.target.value)}
          min="100"
          placeholder="170"
          data-ocid="np-height"
        />
        <FieldError msg={errors.height} />
      </div>

      <div>
        <FieldLabel text="Weight (kg)" required />
        <input
          type="number"
          className={ic}
          value={formData.weight}
          onChange={(e) => onChange("weight", e.target.value)}
          min="30"
          placeholder="70"
          data-ocid="np-weight"
        />
        <FieldError msg={errors.weight} />
      </div>

      <div className="col-span-2">
        <FieldLabel text="BMI (auto-calculated)" />
        <div className="w-full bg-[#0a0e1a] border border-[#1a2744] rounded px-3 py-2 text-sm text-[#64748b]">
          BMI: <span className="text-[#00d4ff] font-semibold">{bmi}</span>
        </div>
      </div>

      <div>
        <FieldLabel text="Systolic BP (mmHg) (Optional)" />
        <input
          type="number"
          className={ic}
          value={formData.systolic}
          onChange={(e) => onChange("systolic", e.target.value)}
          min="90"
          max="180"
          data-ocid="np-systolic"
        />
        <FieldError msg={errors.systolic} />
      </div>

      <div>
        <FieldLabel text="Diastolic BP (mmHg) (Optional)" />
        <input
          type="number"
          className={ic}
          value={formData.diastolic}
          onChange={(e) => onChange("diastolic", e.target.value)}
          min="60"
          max="120"
          data-ocid="np-diastolic"
        />
        <FieldError msg={errors.diastolic} />
      </div>

      <div className="col-span-2">
        <FieldLabel text="Resting Heart Rate (BPM) (Optional)" />
        <input
          type="number"
          className={ic}
          value={formData.heartRateBaseline}
          onChange={(e) => onChange("heartRateBaseline", e.target.value)}
          min="40"
          max="100"
          data-ocid="np-hr-baseline"
        />
        <FieldError msg={errors.heartRateBaseline} />
      </div>
    </div>
  );
}
