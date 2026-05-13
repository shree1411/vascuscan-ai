/**
 * AIFeatureAnalysis.tsx
 *
 * Shows real AI prediction results from the backend (Model 1 or Model 2),
 * plus live waveform signal features that animate in real time.
 *
 * Prediction data is sourced from the current patient's riskAssessment
 * (which is populated by usePrediction hook on mount / patient switch).
 */
import { useEffect, useState } from "react";
import { usePrediction } from "../hooks/usePrediction";
import { useStore, selectCurrentPatient } from "../store/useStore";
import type { SignalFeatures } from "../store/useStore";

interface WaveFeature {
  id: string;
  name: string;
  value: string;
  badge: string;
  badgeBg: string;
  badgeColor: string;
  barPct: number;
  barColor: string;
  rangeText: string;
}

function buildWaveFeatures(signalFeatures: SignalFeatures): WaveFeature[] {
  const { pulseAmplitude, riseTime, dicroticNotch, hrvIndex, skewness } = signalFeatures;
  
  const pulseNormal   = pulseAmplitude >= 0.5 && pulseAmplitude <= 1.0;
  const riseNormal    = riseTime >= 100 && riseTime <= 200;
  const dicroticOk    = dicroticNotch;
  const hrvNormal     = hrvIndex >= 30 && hrvIndex <= 60;
  const skewNormal    = skewness >= 0.2 && skewness <= 0.5;

  return [
    {
      id: "pulse-amp",
      name: "PULSE AMPLITUDE",
      value: pulseAmplitude.toFixed(2),
      badge: pulseNormal ? "NORMAL" : "HIGH",
      badgeBg: pulseNormal ? "rgba(34,197,94,0.15)" : "rgba(245,158,11,0.15)",
      badgeColor: pulseNormal ? "#4ade80" : "#fbbf24",
      barPct: Math.round(Math.max(0, Math.min(100, ((pulseAmplitude - 0.3) / 0.9) * 100))),
      barColor: pulseNormal ? "#4ade80" : "#f59e0b",
      rangeText: "Normal: 0.5–1.0",
    },
    {
      id: "rise-time",
      name: "RISE TIME",
      value: `${Math.round(riseTime)}ms`,
      badge: riseNormal ? "NORMAL" : "ELEVATED",
      badgeBg: riseNormal ? "rgba(34,197,94,0.15)" : "rgba(245,158,11,0.15)",
      badgeColor: riseNormal ? "#4ade80" : "#fbbf24",
      barPct: Math.round(Math.max(0, Math.min(100, ((riseTime - 80) / 160) * 100))),
      barColor: riseNormal ? "#4ade80" : "#f59e0b",
      rangeText: "Normal: 100–200ms",
    },
    {
      id: "dicrotic-notch",
      name: "DICROTIC NOTCH",
      value: dicroticNotch ? "1.00" : "0.00",
      badge: dicroticOk ? "PRESENT" : "ABSENT",
      badgeBg: dicroticOk ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
      badgeColor: dicroticOk ? "#4ade80" : "#f87171",
      barPct: dicroticNotch ? 100 : 0,
      barColor: dicroticOk ? "#4ade80" : "#ef4444",
      rangeText: "Normal: PRESENT",
    },
    {
      id: "hrv-index",
      name: "HRV INDEX",
      value: `${Math.round(hrvIndex)}ms`,
      badge: hrvNormal ? "NORMAL" : hrvIndex < 30 ? "LOW" : "HIGH",
      badgeBg: hrvNormal ? "rgba(34,197,94,0.15)" : "rgba(245,158,11,0.15)",
      badgeColor: hrvNormal ? "#4ade80" : "#fbbf24",
      barPct: Math.round(Math.max(0, Math.min(100, ((hrvIndex - 10) / 70) * 100))),
      barColor: hrvNormal ? "#4ade80" : "#f59e0b",
      rangeText: "Normal: 30–60ms",
    },
    {
      id: "waveform-skew",
      name: "WAVEFORM SKEWNESS",
      value: skewness.toFixed(2),
      badge: skewNormal ? "NORMAL" : "IRREGULAR",
      badgeBg: skewNormal ? "rgba(34,197,94,0.15)" : "rgba(245,158,11,0.15)",
      badgeColor: skewNormal ? "#4ade80" : "#fbbf24",
      barPct: Math.round(Math.max(0, Math.min(100, (skewness / 0.7) * 100))),
      barColor: skewNormal ? "#4ade80" : "#f59e0b",
      rangeText: "Normal: 0.2–0.5",
    },
  ];
}

// ── Sub-components ─────────────────────────────────────────────────────────

function WaveCard({ feat }: { feat: WaveFeature }) {
  return (
    <div
      className="border rounded p-2 flex flex-col gap-1"
      style={{ background: "#0a0e1a", borderColor: "#1a2744" }}
      data-ocid={`ai-feat-${feat.id}`}
    >
      <div className="flex justify-between items-start gap-1">
        <p className="text-xs uppercase leading-tight" style={{ color: "#64748b" }}>
          {feat.name}
        </p>
        <span
          className="rounded px-1.5 py-0.5 text-xs font-semibold shrink-0"
          style={{ background: feat.badgeBg, color: feat.badgeColor }}
        >
          {feat.badge}
        </span>
      </div>
      <p className="text-white font-bold text-lg leading-tight">{feat.value}</p>
      <div className="h-1 rounded overflow-hidden" style={{ background: "#1a2744" }}>
        <div
          className="h-full rounded transition-all duration-700"
          style={{ width: `${feat.barPct}%`, background: feat.barColor }}
        />
      </div>
      <p className="text-xs" style={{ color: "#64748b" }}>{feat.rangeText}</p>
    </div>
  );
}

function ProbBar({
  label,
  pct,
  color,
  active,
}: { label: string; pct: number; color: string; active: boolean }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-0.5">
        <span style={{ color: active ? "#e2e8f0" : "#64748b", fontWeight: active ? 700 : 400 }}>
          {label}
        </span>
        <span style={{ color }} className="font-mono">
          {pct.toFixed(1)}%
        </span>
      </div>
      <div className="w-full rounded-full" style={{ height: 5, background: "#1a2744" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: color,
            boxShadow: active ? `0 0 6px ${color}` : "none",
          }}
        />
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function AIFeatureAnalysis() {
  const currentPatient = useStore(selectCurrentPatient);
  const { loading, error, refetchCurrentPatient } = usePrediction();
  const signalFeatures = useStore((s) => s.signalFeatures);
  const preferredModel = useStore((s) => s.preferredPredictionModel);
  const setPreferredModel = useStore((s) => s.setPreferredPredictionModel);
  const [waveFeatures, setWaveFeatures] = useState<WaveFeature[]>(() =>
    buildWaveFeatures(signalFeatures)
  );

  // Sync component state when store features change
  useEffect(() => {
    setWaveFeatures(buildWaveFeatures(signalFeatures));
  }, [signalFeatures]);

  const ra = currentPatient?.riskAssessment;
  const probabilities = ra?.probabilities ?? {};
  const riskLevel = ra?.riskLevel ?? "Low";
  const modelUsed = ra?.modelUsed ?? "none";

  const riskColor =
    riskLevel === "High" ? "#ef4444" : riskLevel === "Moderate" ? "#f97316" : "#22c55e";
  const riskBg =
    riskLevel === "High"
      ? "rgba(239,68,68,0.12)"
      : riskLevel === "Moderate"
        ? "rgba(249,115,22,0.12)"
        : "rgba(34,197,94,0.12)";

  const modelLabel =
    modelUsed === "model2_sensor"
      ? "IoT + AI — Model 2 (ECG + PPG)"
      : modelUsed === "model1_form"
        ? "Form-Only AI — Model 1 (Clinical)"
        : "No Prediction";

  const modelDot =
    modelUsed === "model2_sensor" ? "#22c55e" : modelUsed === "model1_form" ? "#eab308" : "#475569";

  const hasProbs = Object.keys(probabilities).length > 0;

  return (
    <div
      className="rounded-lg border p-3 shrink-0"
      style={{ background: "#0d1426", borderColor: "#1a2744" }}
      data-ocid="ai-feature-analysis"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <p className="text-white text-sm font-semibold">AI FEATURE ANALYSIS</p>
          <select
            value={preferredModel}
            onChange={(e) => {
                setPreferredModel(e.target.value as any);
                // Immediately trigger a refetch using the new preference
                setTimeout(() => refetchCurrentPatient(), 50);
            }}
            className="text-xs bg-transparent border rounded px-2 py-0.5"
            style={{
              borderColor: "rgba(255,255,255,0.2)",
              color: "#94a3b8",
              outline: "none"
            }}
          >
            <option value="auto">Auto (Sensor + Form)</option>
            <option value="model1">Module 1 (Dataset Only)</option>
          </select>
        </div>
        <button
          type="button"
          onClick={() => {
            setWaveFeatures(buildWaveFeatures(signalFeatures));
            refetchCurrentPatient();
          }}
          disabled={loading}
          className="text-xs px-2 py-1 rounded border transition-colors"
          style={{
            background: "rgba(0,212,255,0.08)",
            borderColor: "rgba(0,212,255,0.25)",
            color: loading ? "#475569" : "#00d4ff",
            cursor: loading ? "not-allowed" : "pointer",
          }}
          data-ocid="ai-refetch-btn"
        >
          {loading ? "Analyzing…" : "↻ Refresh"}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div
          className="mb-3 rounded px-2.5 py-1.5 text-xs"
          style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}
        >
          ⚠ {error}
        </div>
      )}

      {/* ── AI Prediction Result ── */}
      <div
        className="rounded-lg p-3 mb-3 border"
        style={{ background: "#0a0e1a", borderColor: "#1a2744" }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{
              background: modelDot,
              boxShadow: modelUsed !== "none" ? `0 0 6px ${modelDot}` : "none",
            }}
          />
          <span className="text-xs font-semibold" style={{ color: modelDot }}>
            {modelLabel}
          </span>
        </div>

        {/* Risk result box */}
        <div
          className="rounded p-3 mb-3 flex items-center justify-between"
          style={{ background: riskBg, border: `1px solid ${riskColor}33` }}
        >
          <div>
            <div className="text-xs mb-0.5" style={{ color: "#64748b" }}>
              CARDIOVASCULAR RISK
            </div>
            <div className="text-2xl font-black" style={{ color: riskColor }}>
              {riskLevel.toUpperCase()}
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black font-mono" style={{ color: riskColor }}>
              {ra?.riskScore ?? "--"}
            </div>
            <div className="text-xs" style={{ color: "#64748b" }}>/ 100</div>
          </div>
        </div>

        {/* Probability breakdown */}
        {hasProbs ? (
          <div className="flex flex-col gap-1.5">
            {(["High", "Moderate", "Low"] as const).map((lvl) => {
              const c =
                lvl === "High" ? "#ef4444" : lvl === "Moderate" ? "#f97316" : "#22c55e";
              const pct = (probabilities as Record<string, number>)[lvl] ?? 0;
              return (
                <ProbBar
                  key={lvl}
                  label={lvl}
                  pct={pct}
                  color={c}
                  active={lvl === riskLevel}
                />
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-center py-2" style={{ color: "#475569" }}>
            {loading ? "Fetching prediction…" : "No prediction data — click Refresh"}
          </div>
        )}

        {/* Confidence + blockage probability */}
        {ra?.aiConfidence !== undefined && (
          <div className="mt-2.5 grid grid-cols-2 gap-2 pt-2.5" style={{ borderTop: "1px solid #1e2a3a" }}>
            <div>
              <div className="text-xs mb-0.5" style={{ color: "#64748b" }}>AI Confidence</div>
              <div className="text-base font-bold font-mono" style={{ color: "#00d4ff" }}>
                {ra.aiConfidence}%
              </div>
            </div>
            <div>
              <div className="text-xs mb-0.5" style={{ color: "#64748b" }}>Blockage Prob.</div>
              <div className="text-base font-bold font-mono" style={{ color: "#f97316" }}>
                {ra.blockageProbability}%
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Live Signal Features (animated) ── */}
      <p className="text-xs uppercase tracking-wider mb-2" style={{ color: "#475569" }}>
        Live Signal Features
      </p>
      <div className="grid grid-cols-2 gap-2">
        {waveFeatures.map((feat) => (
          <WaveCard key={feat.id} feat={feat} />
        ))}
      </div>
    </div>
  );
}
