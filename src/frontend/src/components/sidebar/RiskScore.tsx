/**
 * RiskScore.tsx — Visual risk factor score with progress bar.
 */
import type { Patient } from "../../types";

interface Props {
  patient: Patient;
}

export function RiskScore({ patient }: Props) {
  const score = patient.riskAssessment.riskScore;
  const pct = Math.min(100, score);

  return (
    <div data-ocid="risk-score-section">
      <p
        className="text-xs font-semibold uppercase tracking-wider mb-2"
        style={{ color: "#64748b" }}
      >
        Risk Factor Score
      </p>

      {/* Score display */}
      <div className="flex items-baseline gap-1 mb-2">
        <span className="text-4xl font-bold" style={{ color: "#fb923c" }}>
          {score}
        </span>
        <span className="text-sm" style={{ color: "#64748b" }}>
          /100
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="w-full h-3 rounded-full overflow-hidden"
        style={{ background: "#1a2744" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, #f97316, #ef4444)",
          }}
        />
      </div>

      {/* Labels */}
      <div className="flex justify-between mt-1">
        <span className="text-[10px]" style={{ color: "#64748b" }}>
          Low
        </span>
        <span className="text-[10px]" style={{ color: "#64748b" }}>
          High
        </span>
      </div>
    </div>
  );
}
