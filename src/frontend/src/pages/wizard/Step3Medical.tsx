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

export default function Step3Medical({ formData, onChange, errors }: Props) {
  const cholVal = Number.parseFloat(formData.cholesterol);
  const cholLow = formData.cholesterol && !Number.isNaN(cholVal) && cholVal < 150;

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <FieldLabel text="Diabetes Status" required />
        <select
          className={ic}
          value={formData.diabetes}
          onChange={(e) => onChange("diabetes", e.target.value)}
          data-ocid="np-diabetes"
        >
          {["No", "Type 1", "Type 2", "Prediabetes"].map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </div>

      {formData.diabetes !== "No" && (
        <div>
          <FieldLabel text="Duration (years)" />
          <input
            type="number"
            className={ic}
            value={formData.diabetesDuration}
            onChange={(e) => onChange("diabetesDuration", e.target.value)}
            min="0"
            data-ocid="np-diabetes-dur"
          />
        </div>
      )}

      <div>
        <FieldLabel text="Hypertension Status" required />
        <select
          className={ic}
          value={formData.hypertension}
          onChange={(e) => onChange("hypertension", e.target.value)}
          data-ocid="np-hypertension"
        >
          {["No", "Treated", "Untreated"].map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </div>

      {formData.hypertension !== "No" && (
        <div>
          <FieldLabel text="Duration (years)" />
          <input
            type="number"
            className={ic}
            value={formData.hypertensionDuration}
            onChange={(e) => onChange("hypertensionDuration", e.target.value)}
            min="0"
            data-ocid="np-hypertension-dur"
          />
        </div>
      )}

      <div className="col-span-2">
        <FieldLabel text="Cholesterol Level (mg/dL) (Optional)" />
        <input
          type="number"
          className={ic}
          value={formData.cholesterol}
          onChange={(e) => onChange("cholesterol", e.target.value)}
          min="150"
          max="300"
          data-ocid="np-cholesterol"
        />
        {cholLow && (
          <p className="text-red-400 text-xs mt-1 font-medium">
            ⚠ Cholesterol level must be minimum 150 mg/dL
          </p>
        )}
        <FieldError msg={!cholLow ? errors.cholesterol : undefined} />
      </div>

      <div>
        <FieldLabel text="LDL (mg/dL)" />
        <input
          type="number"
          className={ic}
          value={formData.ldl}
          onChange={(e) => onChange("ldl", e.target.value)}
          min="70"
          max="200"
          data-ocid="np-ldl"
        />
      </div>

      <div>
        <FieldLabel text="HDL (mg/dL)" />
        <input
          type="number"
          className={ic}
          value={formData.hdl}
          onChange={(e) => onChange("hdl", e.target.value)}
          min="30"
          max="80"
          data-ocid="np-hdl"
        />
      </div>
    </div>
  );
}
