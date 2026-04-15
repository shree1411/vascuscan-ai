/**
 * RiskAssessment.tsx — Risk level card with blockage probability and AI confidence bars.
 */
import type { Patient } from "../../types";

interface Props {
  patient: Patient;
}

interface BarProps {
  label: string;
  value: number;
  valueText: string;
  barColor: string;
  textColor: string;
}

function MetricBar({ label, value, valueText, barColor, textColor }: BarProps) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs" style={{ color: "#64748b" }}>
          {label}
        </span>
        <span className="text-xs font-bold" style={{ color: textColor }}>
          {valueText}
        </span>
      </div>
      <div
        className="w-full h-1.5 rounded-full overflow-hidden"
        style={{ background: "#2a1a00" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${value}%`, background: barColor }}
        />
      </div>
    </div>
  );
}

function getRiskLabel(level: string): string {
  return `${level.toUpperCase()} RISK`;
}

export function RiskAssessment({ patient }: Props) {
  const { riskLevel, blockageProbability, aiConfidence } =
    patient.riskAssessment;

  return (
    <div
      className="rounded-lg p-3 border"
      style={{ background: "#1a0a00", borderColor: "rgba(146,64,14,0.5)" }}
      data-ocid="risk-assessment-card"
    >
      <p
        className="text-sm font-bold uppercase mb-3"
        style={{ color: "#fb923c" }}
      >
        {getRiskLabel(riskLevel)}
      </p>
      <div className="flex flex-col gap-3">
        <MetricBar
          label="Blockage Probability"
          value={blockageProbability}
          valueText={`${blockageProbability}%`}
          barColor="#f97316"
          textColor="#fb923c"
        />
        <MetricBar
          label="AI Confidence"
          value={aiConfidence}
          valueText={`${aiConfidence}%`}
          barColor="#00d4ff"
          textColor="#00d4ff"
        />
      </div>
    </div>
  );
}
