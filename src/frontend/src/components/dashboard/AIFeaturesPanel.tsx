/**
 * AIFeaturesPanel.tsx — AI feature analysis grid with confidence bars.
 */
import { selectCurrentPatient, useAppStore } from "../../store/appStore";

const STATUS_STYLES: Record<string, { color: string; bg: string }> = {
  Normal: { color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  Warning: { color: "#eab308", bg: "rgba(234,179,8,0.12)" },
  "Elevated Risk": { color: "#f97316", bg: "rgba(249,115,22,0.12)" },
  Critical: { color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  Present: { color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  Absent: { color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
};

export function AIFeaturesPanel() {
  const currentPatient = useAppStore(selectCurrentPatient);
  const features = currentPatient?.aiFeatures ?? [];

  return (
    <div
      className="rounded-lg border overflow-hidden shrink-0"
      style={{ background: "#0d1120", borderColor: "#1e2a3a" }}
    >
      <div className="px-3 py-2 border-b" style={{ borderColor: "#1e2a3a" }}>
        <span
          className="text-xs font-bold tracking-widest uppercase"
          style={{ color: "#94a3b8" }}
        >
          AI Feature Metrics
        </span>
      </div>
      <div className="grid grid-cols-4 gap-3 p-3">
        {features.map((feat) => {
          const styles = STATUS_STYLES[feat.badge] ?? {
            color: "#64748b",
            bg: "rgba(100,116,139,0.12)",
          };
          return (
            <div
              key={feat.id}
              className="rounded-lg p-3 border flex flex-col gap-1.5"
              style={{ background: "#141824", borderColor: "#2a3a4a" }}
              data-ocid={`ai-feature-${feat.id}`}
            >
              <div className="flex items-start justify-between gap-1">
                <span
                  className="text-xs font-semibold leading-tight"
                  style={{ color: "#94a3b8" }}
                >
                  {feat.name}
                </span>
                <span
                  className="text-xs font-bold px-1.5 py-0.5 rounded shrink-0"
                  style={{
                    background: styles.bg,
                    color: styles.color,
                    border: `1px solid ${styles.color}22`,
                  }}
                >
                  {feat.badge}
                </span>
              </div>
              <div
                className="text-lg font-bold font-mono"
                style={{ color: "#e2e8f0" }}
              >
                {feat.value}
                {feat.unit && (
                  <span
                    className="text-xs font-normal ml-0.5"
                    style={{ color: "#475569" }}
                  >
                    {feat.unit}
                  </span>
                )}
              </div>
              {feat.range && (
                <div className="text-xs" style={{ color: "#334155" }}>
                  {feat.range}
                </div>
              )}
              <div>
                <div className="text-xs mb-1" style={{ color: "#475569" }}>
                  Confidence
                </div>
                <div
                  className="w-full rounded-full"
                  style={{ height: 3, background: "#1e2a3a" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${feat.confidence}%`,
                      background: "#00d4ff",
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
