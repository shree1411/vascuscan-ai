/**
 * PatientSidebar.tsx — Left sidebar composing all patient info sub-components.
 */
import { selectCurrentPatient, useStore } from "../store/useStore";
import { FeatureFlags } from "./sidebar/FeatureFlags";
import { MedicalHistory } from "./sidebar/MedicalHistory";
import { PatientCard } from "./sidebar/PatientCard";
import { RiskAssessment } from "./sidebar/RiskAssessment";
import { RiskScore } from "./sidebar/RiskScore";

export function PatientSidebar() {
  const patient = useStore(selectCurrentPatient);

  if (!patient) {
    return (
      <aside
        className="w-72 shrink-0 flex items-center justify-center border-r"
        style={{ background: "#0d1426", borderColor: "#1a2744" }}
      >
        <p className="text-xs" style={{ color: "#64748b" }}>
          No patient selected
        </p>
      </aside>
    );
  }

  return (
    <aside
      className="w-72 shrink-0 border-r overflow-y-auto flex flex-col gap-3 p-3"
      style={{ background: "#0d1426", borderColor: "#1a2744" }}
      data-ocid="patient-sidebar"
    >
      {/* Divider utility */}
      <PatientCard patient={patient} />

      <hr style={{ borderColor: "#1a2744" }} />

      <MedicalHistory patient={patient} />

      <hr style={{ borderColor: "#1a2744" }} />

      <RiskScore patient={patient} />

      <RiskAssessment patient={patient} />

      <hr style={{ borderColor: "#1a2744" }} />

      <FeatureFlags patient={patient} />
    </aside>
  );
}
