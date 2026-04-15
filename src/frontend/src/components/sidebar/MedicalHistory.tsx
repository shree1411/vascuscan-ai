/**
 * MedicalHistory.tsx — Medical history badges for a patient.
 */
import type { Patient } from "../../types";

interface Props {
  patient: Patient;
}

// Map badge color hex to Tailwind-compatible inline styles
function getBadgeStyle(color: string): React.CSSProperties {
  const map: Record<string, { bg: string; text: string; border: string }> = {
    "#f59e0b": {
      bg: "rgba(245,158,11,0.15)",
      text: "#f59e0b",
      border: "rgba(245,158,11,0.35)",
    },
    "#22c55e": {
      bg: "rgba(34,197,94,0.15)",
      text: "#22c55e",
      border: "rgba(34,197,94,0.35)",
    },
    "#64748b": {
      bg: "rgba(100,116,139,0.15)",
      text: "#94a3b8",
      border: "rgba(100,116,139,0.3)",
    },
    "#ef4444": {
      bg: "rgba(239,68,68,0.15)",
      text: "#ef4444",
      border: "rgba(239,68,68,0.35)",
    },
    "#f97316": {
      bg: "rgba(249,115,22,0.15)",
      text: "#f97316",
      border: "rgba(249,115,22,0.35)",
    },
  };
  const t = map[color] ?? {
    bg: "rgba(100,116,139,0.15)",
    text: "#94a3b8",
    border: "rgba(100,116,139,0.3)",
  };
  return { background: t.bg, color: t.text, borderColor: t.border };
}

export function MedicalHistory({ patient }: Props) {
  return (
    <div data-ocid="medical-history-section">
      <p
        className="text-xs font-semibold uppercase tracking-wider mb-2"
        style={{ color: "#64748b" }}
      >
        Medical History
      </p>
      <div className="flex flex-col gap-1.5">
        {patient.medicalBadges.map((badge) => (
          <span
            key={badge.label}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border w-fit"
            style={getBadgeStyle(badge.color)}
          >
            {badge.label}
            {badge.detail && (
              <span className="opacity-70">({badge.detail})</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
