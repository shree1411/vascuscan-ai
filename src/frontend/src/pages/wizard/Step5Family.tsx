import type { FormData } from "./types";

const RELATIONS = ["Father", "Mother", "Sibling", "Grandparent"];

interface Props {
  formData: FormData;
  onChange: (field: keyof FormData, value: FormData[keyof FormData]) => void;
  errors: Partial<Record<keyof FormData, string>>;
}

type FamilyBoolKey =
  | "familyHeartDisease"
  | "familyDiabetes"
  | "familyHypertension";
type RelationKey =
  | "heartRelations"
  | "diabetesRelations"
  | "hypertensionRelations";

const SECTIONS: {
  label: string;
  boolKey: FamilyBoolKey;
  relKey: RelationKey;
}[] = [
  {
    label: "Family History of Heart Disease",
    boolKey: "familyHeartDisease",
    relKey: "heartRelations",
  },
  {
    label: "Family History of Diabetes",
    boolKey: "familyDiabetes",
    relKey: "diabetesRelations",
  },
  {
    label: "Family History of Hypertension",
    boolKey: "familyHypertension",
    relKey: "hypertensionRelations",
  },
];

export default function Step5Family({ formData, onChange }: Props) {
  const toggle = (relKey: RelationKey, rel: string) => {
    const cur = formData[relKey] as string[];
    onChange(
      relKey,
      cur.includes(rel) ? cur.filter((r) => r !== rel) : [...cur, rel],
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {SECTIONS.map(({ label, boolKey, relKey }) => (
        <div
          key={boolKey}
          className="bg-[#0a0e1a] border border-[#1a2744] rounded p-4"
        >
          <div className="flex gap-4 mb-3">
            <p className="text-white text-sm font-medium flex-1">{label}</p>
            <div className="flex gap-4">
              {["Yes", "No"].map((opt) => (
                <label
                  key={opt}
                  className="flex items-center gap-1.5 cursor-pointer"
                >
                  <input
                    type="radio"
                    name={boolKey}
                    value={opt}
                    checked={(formData[boolKey] as boolean) === (opt === "Yes")}
                    onChange={() => onChange(boolKey, opt === "Yes")}
                    style={{ accentColor: "#00d4ff" }}
                    data-ocid={`np-${boolKey}-${opt.toLowerCase()}`}
                  />
                  <span className="text-sm text-[#64748b]">{opt}</span>
                </label>
              ))}
            </div>
          </div>
          {(formData[boolKey] as boolean) && (
            <div>
              <p className="text-[#64748b] text-xs mb-2">
                Specify relation(s):
              </p>
              <div className="flex flex-wrap gap-3">
                {RELATIONS.map((rel) => (
                  <label
                    key={rel}
                    className="flex items-center gap-1.5 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={(formData[relKey] as string[]).includes(rel)}
                      onChange={() => toggle(relKey, rel)}
                      style={{ accentColor: "#00d4ff" }}
                    />
                    <span className="text-sm text-white">{rel}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
