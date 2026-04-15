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

const BLOOD_TYPES = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];

interface Props {
  formData: FormData;
  onChange: (field: keyof FormData, value: FormData[keyof FormData]) => void;
  errors: Partial<Record<keyof FormData, string>>;
}

export default function Step1Demographics({
  formData,
  onChange,
  errors,
}: Props) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2">
        <FieldLabel text="Full Name" required />
        <input
          className={ic}
          value={formData.fullName}
          onChange={(e) => onChange("fullName", e.target.value)}
          placeholder="Robert Anderson"
          data-ocid="np-fullname"
        />
        <FieldError msg={errors.fullName} />
      </div>

      <div>
        <FieldLabel text="Date of Birth" required />
        <input
          type="date"
          className={ic}
          value={formData.dob}
          onChange={(e) => onChange("dob", e.target.value)}
          data-ocid="np-dob"
        />
        <FieldError msg={errors.dob} />
      </div>

      <div>
        <FieldLabel text="Gender" required />
        <select
          className={ic}
          value={formData.gender}
          onChange={(e) => onChange("gender", e.target.value)}
          data-ocid="np-gender"
        >
          <option value="">Select…</option>
          <option>Male</option>
          <option>Female</option>
          <option>Other</option>
        </select>
        <FieldError msg={errors.gender} />
      </div>

      <div>
        <FieldLabel text="Blood Type" required />
        <select
          className={ic}
          value={formData.bloodType}
          onChange={(e) => onChange("bloodType", e.target.value)}
          data-ocid="np-bloodtype"
        >
          <option value="">Select…</option>
          {BLOOD_TYPES.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
        <FieldError msg={errors.bloodType} />
      </div>

      <div>
        <FieldLabel text="Contact Number" required />
        <input
          type="tel"
          className={ic}
          value={formData.contactNumber}
          onChange={(e) => onChange("contactNumber", e.target.value)}
          placeholder="+1-555-0100"
          data-ocid="np-phone"
        />
        <FieldError msg={errors.contactNumber} />
      </div>

      <div className="col-span-2">
        <FieldLabel text="Email" required />
        <input
          type="email"
          className={ic}
          value={formData.email}
          onChange={(e) => onChange("email", e.target.value)}
          placeholder="patient@example.com"
          data-ocid="np-email"
        />
        <FieldError msg={errors.email} />
      </div>
    </div>
  );
}
