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

interface Props {
  formData: FormData;
  onChange: (field: keyof FormData, value: FormData[keyof FormData]) => void;
  errors: Partial<Record<keyof FormData, string>>;
}

export default function Step4Lifestyle({ formData, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <FieldLabel text="Smoking Status" required />
        <select
          className={ic}
          value={formData.smoking}
          onChange={(e) => onChange("smoking", e.target.value)}
          data-ocid="np-smoking"
        >
          {["Never", "Former", "Current"].map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </div>

      {formData.smoking !== "Never" && (
        <div>
          <FieldLabel text="Years Smoked" />
          <input
            type="number"
            className={ic}
            value={formData.smokingYears}
            onChange={(e) => onChange("smokingYears", e.target.value)}
            min="0"
            data-ocid="np-smoking-years"
          />
        </div>
      )}

      <div>
        <FieldLabel text="Alcohol Consumption" />
        <select
          className={ic}
          value={formData.alcohol}
          onChange={(e) => onChange("alcohol", e.target.value)}
          data-ocid="np-alcohol"
        >
          {["None", "Occasional", "Regular", "Heavy"].map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </div>

      <div>
        <FieldLabel text="Physical Activity" />
        <select
          className={ic}
          value={formData.activityLevel}
          onChange={(e) => onChange("activityLevel", e.target.value)}
          data-ocid="np-activity"
        >
          {["Sedentary", "Light", "Moderate", "Vigorous"].map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </div>

      <div>
        <FieldLabel text="Minutes/week" />
        <input
          type="number"
          className={ic}
          value={formData.activityMinutes}
          onChange={(e) => onChange("activityMinutes", e.target.value)}
          min="0"
          data-ocid="np-activity-mins"
        />
      </div>

      <div>
        <FieldLabel text="Stress Level" />
        <select
          className={ic}
          value={formData.stressLevel}
          onChange={(e) => onChange("stressLevel", e.target.value)}
          data-ocid="np-stress"
        >
          {["Low", "Moderate", "High"].map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </div>

      <div>
        <FieldLabel text="Sleep Hours/night" />
        <input
          type="number"
          className={ic}
          value={formData.sleepHours}
          onChange={(e) => onChange("sleepHours", e.target.value)}
          min="4"
          max="12"
          step="0.5"
          data-ocid="np-sleep"
        />
      </div>
    </div>
  );
}
