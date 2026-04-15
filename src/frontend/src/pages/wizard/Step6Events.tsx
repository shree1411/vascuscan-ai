import type { FormData } from "./types";

const ic =
  "w-full bg-[#0a0e1a] border border-[#1a2744] rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00d4ff]";

const EVENTS = [
  "Myocardial Infarction (Heart Attack)",
  "Stroke",
  "Angioplasty/Stent Placement",
  "Coronary Bypass Surgery",
  "Arrhythmia",
];

interface Props {
  formData: FormData;
  onChange: (field: keyof FormData, value: FormData[keyof FormData]) => void;
  errors: Partial<Record<keyof FormData, string>>;
}

export default function Step6Events({ formData, onChange }: Props) {
  const toggleEvent = (ev: string) => {
    const cur = formData.previousEvents;
    onChange(
      "previousEvents",
      cur.includes(ev) ? cur.filter((e) => e !== ev) : [...cur, ev],
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-[#64748b] text-sm mb-3">
          Previous Cardiovascular Events
        </p>
        <div className="flex flex-col gap-2">
          {EVENTS.map((ev) => (
            <div key={ev}>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.previousEvents.includes(ev)}
                  onChange={() => toggleEvent(ev)}
                  style={{ accentColor: "#00d4ff" }}
                  data-ocid={`np-event-${ev.slice(0, 8).replace(/\s/g, "-")}`}
                />
                <span className="text-white text-sm">{ev}</span>
              </label>
              {formData.previousEvents.includes(ev) && (
                <div className="mt-2 ml-6 grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    className={ic}
                    placeholder="Date of event"
                    value={formData.eventDates?.[ev] ?? ""}
                    onChange={(e) =>
                      onChange("eventDates", {
                        ...formData.eventDates,
                        [ev]: e.target.value,
                      })
                    }
                  />
                  <input
                    className={ic}
                    placeholder="Brief notes…"
                    value={formData.eventNotes?.[ev] ?? ""}
                    onChange={(e) =>
                      onChange("eventNotes", {
                        ...formData.eventNotes,
                        [ev]: e.target.value,
                      })
                    }
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[#64748b] text-sm mb-1">Current Medications</p>
        <textarea
          className={`${ic} resize-none`}
          rows={3}
          value={formData.medications}
          onChange={(e) => onChange("medications", e.target.value)}
          placeholder="List current medications…"
          data-ocid="np-medications"
        />
      </div>

      <div>
        <p className="text-[#64748b] text-sm mb-1">Allergies</p>
        <textarea
          className={`${ic} resize-none`}
          rows={2}
          value={formData.allergies}
          onChange={(e) => onChange("allergies", e.target.value)}
          placeholder="List allergies…"
          data-ocid="np-allergies"
        />
      </div>
    </div>
  );
}
