/**
 * PatientCard.tsx — Patient avatar, name, ID, and basic demographics.
 */
import type { Patient } from "../../types";

interface Props {
  patient: Patient;
}

export function PatientCard({ patient }: Props) {
  return (
    <div className="flex flex-col items-center gap-2 pt-2 pb-3">
      {/* Avatar */}
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl shrink-0"
        style={{
          background: "linear-gradient(135deg, #00d4ff, #1d4ed8)",
        }}
        data-ocid="patient-avatar"
      >
        {patient.initials}
      </div>

      {/* Name + ID */}
      <div className="text-center">
        <p className="text-white font-bold text-base leading-tight">
          {patient.fullName}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>
          {patient.id}
        </p>
      </div>

      {/* Demographics row */}
      <div className="flex gap-1.5 flex-wrap justify-center mt-1">
        {[
          `Age: ${patient.age}`,
          `Gender: ${patient.gender}`,
          `Blood: ${patient.bloodType}`,
        ].map((info) => (
          <span
            key={info}
            className="px-2 py-1 rounded text-xs text-white border"
            style={{ background: "#0d1426", borderColor: "#1a2744" }}
          >
            {info}
          </span>
        ))}
      </div>
    </div>
  );
}
