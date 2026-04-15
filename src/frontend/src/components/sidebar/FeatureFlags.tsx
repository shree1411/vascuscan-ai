/**
 * FeatureFlags.tsx — Detected/not-detected feature flags for the current patient.
 */
import type { FeatureFlag, Patient } from "../../types";

interface Props {
  patient: Patient;
}

function dotColor(flag: FeatureFlag): string {
  if (!flag.detected) return "#64748b";
  if (flag.statusLabel === "Critical") return "#ef4444";
  if (flag.statusLabel === "Warning") return "#facc15";
  return "#22c55e";
}

export function FeatureFlags({ patient }: Props) {
  return (
    <div data-ocid="feature-flags-section">
      <p
        className="text-xs font-semibold uppercase tracking-wider mb-2"
        style={{ color: "#64748b" }}
      >
        Detected Features
      </p>
      <div className="flex flex-col">
        {patient.featureFlags.map((flag) => {
          const detected = flag.detected;
          return (
            <div
              key={flag.id}
              className="flex items-center gap-2 py-1"
              data-ocid={`feature-flag-${flag.id}`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: dotColor(flag) }}
              />
              <span
                className="text-xs"
                style={{ color: detected ? "#e2e8f0" : "#64748b" }}
              >
                {flag.name}
              </span>
              {detected && (
                <span
                  className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded"
                  style={{
                    background:
                      flag.statusLabel === "Critical"
                        ? "rgba(239,68,68,0.15)"
                        : "rgba(250,204,21,0.15)",
                    color:
                      flag.statusLabel === "Critical" ? "#ef4444" : "#facc15",
                  }}
                >
                  {flag.statusLabel}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
