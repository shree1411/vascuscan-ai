const STEPS = [
  "Demographics",
  "Vital Measurements",
  "Medical History",
  "Lifestyle & Risk",
  "Family History",
  "Medical Events",
  "Review & Consent",
];

export { STEPS };

export default function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-6">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-smooth"
              style={{
                background:
                  i + 1 === current
                    ? "#00d4ff"
                    : i + 1 < current
                      ? "#22c55e"
                      : "#1a2744",
                color:
                  i + 1 === current
                    ? "#000"
                    : i + 1 < current
                      ? "#fff"
                      : "#64748b",
              }}
              data-ocid={`step-indicator-${i + 1}`}
            >
              {i + 1 < current ? "✓" : i + 1}
            </div>
            <span
              className="text-[9px] mt-1 hidden sm:block max-w-[60px] text-center leading-tight"
              style={{ color: i + 1 === current ? "#00d4ff" : "#64748b" }}
            >
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className="h-px w-8 mx-1 mb-4 transition-smooth"
              style={{ background: i + 1 < current ? "#22c55e" : "#1a2744" }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
