/**
 * Dashboard.tsx — Main dashboard page assembling all panels.
 * Layout already provides global header/footer — this renders the dashboard body.
 */
import { AIFeatureAnalysis } from "../components/AIFeatureAnalysis";
import { LiveVitals } from "../components/LiveVitals";
import { SensorStatusBar } from "../components/SensorStatusBar";
import { PatientInfoPanel } from "../components/dashboard/PatientInfoPanel";
import { WaveformPanel } from "../components/dashboard/WaveformPanel";
import { MedicalAlerts } from "../components/dashboard/MedicalAlerts";
import { useStore } from "../store/useStore";
import { useRealTimeAlerts } from "../hooks/useRealTimeAlerts";

export default function Dashboard() {
  useRealTimeAlerts(); // Activate physiological alerts monitoring
  const waveformResolution = useStore((s) => s.waveformResolution);
  const setWaveformResolution = useStore((s) => s.setWaveformResolution);

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ background: "#0a0e1a" }}
    >
      <SensorStatusBar />
      <MedicalAlerts />

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — patient info */}
        <aside
          className="flex flex-col overflow-y-auto shrink-0 border-r"
          style={{ width: 260, borderColor: "#1a2744" }}
          data-ocid="patient-sidebar"
        >
          <PatientInfoPanel />
        </aside>

        {/* Center — waveforms + AI analysis */}
        <main
          className="flex-1 flex flex-col gap-3 p-3 overflow-y-auto min-w-0"
          data-ocid="main-content"
        >
          <WaveformPanel
            type="ppg"
            resolution={waveformResolution}
            onResolutionChange={setWaveformResolution}
          />
          <WaveformPanel
            type="ecg"
            resolution={waveformResolution}
            onResolutionChange={setWaveformResolution}
          />
          <AIFeatureAnalysis />
        </main>

        {/* Right sidebar — live vitals + AI model status */}
        <LiveVitals />
      </div>
    </div>
  );
}
