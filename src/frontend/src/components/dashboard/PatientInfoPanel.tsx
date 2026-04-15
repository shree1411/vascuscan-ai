/**
 * PatientInfoPanel.tsx — Left sidebar showing patient demographics, medical history,
 * risk scores, and feature flags.
 */
import { useStore, selectCurrentPatient } from "../../store/useStore";
import type { RiskLevel } from "../../types";

function getAge(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())
  )
    age--;
  return age;
}

function getBMI(height: number, weight: number): string {
  return (weight / ((height / 100) * (height / 100))).toFixed(1);
}

function riskColor(level: RiskLevel) {
  if (level === "High") return "#ef4444";
  if (level === "Moderate") return "#f97316";
  return "#22c55e";
}

function riskBg(level: RiskLevel) {
  if (level === "High") return "rgba(239,68,68,0.12)";
  if (level === "Moderate") return "rgba(249,115,22,0.12)";
  return "rgba(34,197,94,0.12)";
}

export function PatientInfoPanel() {
  const currentPatient = useStore(selectCurrentPatient);

  if (!currentPatient) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full p-6 text-center"
        style={{ color: "#475569" }}
      >
        <span className="text-sm">No patient selected</span>
      </div>
    );
  }

  const {
    fullName,
    dob,
    gender,
    bloodType,
    height,
    weight,
    medicalBadges,
    riskAssessment,
    featureFlags,
  } = currentPatient;

  const age = getAge(dob);
  const bmi = getBMI(height, weight);
  const risk = riskAssessment;

  return (
    <div className="p-3 flex flex-col gap-3">
      {/* Profile header */}
      <div
        className="rounded-lg p-3 border"
        style={{ background: "#141824", borderColor: "#1e2a3a" }}
      >
        <div
          className="text-xs font-semibold mb-3 tracking-widest uppercase"
          style={{ color: "#00d4ff" }}
        >
          Patient Info
        </div>
        <div className="flex items-center gap-3 mb-3">
          <div
            className="flex items-center justify-center rounded-full font-bold text-base shrink-0"
            style={{
              width: 48,
              height: 48,
              background: "linear-gradient(135deg, #1e3a5f 0%, #0d2340 100%)",
              border: "2px solid #00d4ff33",
              color: "#00d4ff",
            }}
          >
            {currentPatient.initials}
          </div>
          <div>
            <div className="font-semibold text-sm" style={{ color: "#e2e8f0" }}>
              {fullName}
            </div>
            <div
              className="text-xs font-mono mt-0.5"
              style={{ color: "#64748b" }}
            >
              ID: {currentPatient.id}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          <Stat label="Age" value={`${age}`} />
          <Stat
            label="Gender"
            value={gender === "Male" ? "M" : gender === "Female" ? "F" : "O"}
          />
          <Stat label="Height" value={`${height}cm`} />
          <Stat label="Weight" value={`${weight}kg`} />
          <Stat label="BMI" value={bmi} />
          <Stat label="Blood Type" value={bloodType} />
        </div>
      </div>

      {/* Medical History badges */}
      <div
        className="rounded-lg p-3 border"
        style={{ background: "#141824", borderColor: "#1e2a3a" }}
      >
        <div
          className="text-xs font-semibold mb-2.5 tracking-widest uppercase"
          style={{ color: "#94a3b8" }}
        >
          Medical History
        </div>
        <div className="flex flex-col gap-1.5">
          {medicalBadges.map((badge) => (
            <div
              key={badge.label}
              className="flex items-center justify-between px-2.5 py-1.5 rounded text-xs"
              style={{
                background: `${badge.color}1a`,
                border: `1px solid ${badge.color}33`,
              }}
            >
              <span style={{ color: badge.color }}>{badge.label}</span>
              {badge.detail && (
                <span className="text-xs" style={{ color: badge.color }}>
                  {badge.detail}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Risk Factor Score */}
      <div
        className="rounded-lg p-3 border"
        style={{ background: "#141824", borderColor: "#1e2a3a" }}
      >
        <div
          className="text-xs font-semibold mb-2 tracking-widest uppercase"
          style={{ color: "#94a3b8" }}
        >
          Risk Factor Score
        </div>
        <div className="flex items-end gap-2 mb-1.5">
          <span
            className="text-3xl font-bold font-mono"
            style={{ color: riskColor(risk.riskLevel) }}
          >
            {risk.riskScore}
          </span>
          <span className="text-xs mb-1" style={{ color: "#475569" }}>
            /100
          </span>
        </div>
        <div
          className="w-full rounded-full overflow-hidden mb-3"
          style={{ height: 6, background: "#1e2a3a" }}
        >
          <div
            className="h-full rounded-full transition-smooth"
            style={{
              width: `${risk.riskScore}%`,
              background: `linear-gradient(90deg, #f97316, ${riskColor(risk.riskLevel)})`,
            }}
          />
        </div>

        {/* Risk level box */}
        <div
          className="rounded p-2.5 mb-2.5 text-center"
          style={{
            background: riskBg(risk.riskLevel),
            border: `1px solid ${riskColor(risk.riskLevel)}33`,
          }}
        >
          <div
            className="text-xs font-bold tracking-widest uppercase"
            style={{ color: riskColor(risk.riskLevel) }}
          >
            {risk.riskLevel === "Moderate"
              ? "MODERATE RISK"
              : risk.riskLevel === "High"
                ? "HIGH RISK"
                : "LOW RISK"}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <BarMetric
            label="Blockage Probability"
            value={risk.blockageProbability}
            color="#f97316"
            suffix="%"
          />
          <BarMetric
            label="AI Confidence"
            value={risk.aiConfidence}
            color="#00d4ff"
            suffix="%"
          />
        </div>

        {/* AI Model badge */}
        <div
          className="mt-2.5 rounded px-2.5 py-2"
          style={{
            background:
              risk.modelUsed === "model2_sensor"
                ? "rgba(34,197,94,0.08)"
                : risk.modelUsed === "model1_form"
                  ? "rgba(234,179,8,0.08)"
                  : "rgba(100,116,139,0.08)",
            border: `1px solid ${
              risk.modelUsed === "model2_sensor"
                ? "rgba(34,197,94,0.25)"
                : risk.modelUsed === "model1_form"
                  ? "rgba(234,179,8,0.25)"
                  : "rgba(100,116,139,0.2)"
            }`,
          }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background:
                  risk.modelUsed === "model2_sensor"
                    ? "#22c55e"
                    : risk.modelUsed === "model1_form"
                      ? "#eab308"
                      : "#64748b",
                boxShadow:
                  risk.modelUsed !== "none"
                    ? `0 0 5px ${risk.modelUsed === "model2_sensor" ? "#22c55e" : "#eab308"}`
                    : "none",
              }}
            />
            <span
              className="text-xs font-semibold"
              style={{
                color:
                  risk.modelUsed === "model2_sensor"
                    ? "#22c55e"
                    : risk.modelUsed === "model1_form"
                      ? "#eab308"
                      : "#64748b",
              }}
            >
              {risk.modelUsed === "model2_sensor"
                ? "IoT + AI (Model 2)"
                : risk.modelUsed === "model1_form"
                  ? "Form-Only AI (Model 1)"
                  : "No Prediction Yet"}
            </span>
          </div>
          <div className="text-xs" style={{ color: "#475569" }}>
            {risk.modelUsed === "model2_sensor"
              ? "ECG + PPG + Clinical data"
              : risk.modelUsed === "model1_form"
                ? "Clinical form data only"
                : "Register patient to predict"}
          </div>

          {/* Probability breakdown */}
          {risk.probabilities &&
            Object.keys(risk.probabilities).length > 0 && (
              <div className="mt-2 flex flex-col gap-1">
                {(["Low", "Moderate", "High"] as const).map((lvl) => {
                  const pct = risk.probabilities?.[lvl] ?? 0;
                  const c =
                    lvl === "High"
                      ? "#ef4444"
                      : lvl === "Moderate"
                        ? "#f97316"
                        : "#22c55e";
                  return (
                    <div key={lvl}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span style={{ color: "#475569" }}>{lvl}</span>
                        <span style={{ color: c }} className="font-mono">
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                      <div
                        className="w-full rounded-full"
                        style={{ height: 3, background: "#1e2a3a" }}
                      >
                        <div
                          className="h-full rounded-full transition-smooth"
                          style={{ width: `${pct}%`, background: c }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      </div>

      {/* Feature Flags */}
      <div
        className="rounded-lg p-3 border"
        style={{ background: "#141824", borderColor: "#1e2a3a" }}
      >
        <div
          className="text-xs font-semibold mb-2.5 tracking-widest uppercase"
          style={{ color: "#94a3b8" }}
        >
          Feature Flags
        </div>
        <div className="flex flex-col gap-2">
          {featureFlags.map((flag) => {
            const dotColor = flag.detected
              ? flag.statusLabel === "Critical"
                ? "#ef4444"
                : flag.statusLabel === "Warning"
                  ? "#eab308"
                  : "#22c55e"
              : "#334155";
            return (
              <div key={flag.id} className="flex items-center gap-2 text-xs">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{
                    background: dotColor,
                    boxShadow: flag.detected ? `0 0 6px ${dotColor}` : "none",
                  }}
                />
                <span style={{ color: flag.detected ? "#cbd5e1" : "#475569" }}>
                  {flag.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs" style={{ color: "#475569" }}>
        {label}
      </div>
      <div className="text-sm font-semibold" style={{ color: "#e2e8f0" }}>
        {value}
      </div>
    </div>
  );
}

function BarMetric({
  label,
  value,
  color,
  suffix,
}: {
  label: string;
  value: number;
  color: string;
  suffix: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span style={{ color: "#64748b" }}>{label}</span>
        <span style={{ color }} className="font-mono">
          {value}
          {suffix}
        </span>
      </div>
      <div
        className="w-full rounded-full"
        style={{ height: 4, background: "#1e2a3a" }}
      >
        <div
          className="h-full rounded-full transition-smooth"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
    </div>
  );
}
