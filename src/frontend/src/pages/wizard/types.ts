export interface FormData {
  // Step 1 - Demographics
  fullName: string;
  dob: string;
  gender: string;
  bloodType: string;
  contactNumber: string;
  email: string;
  // Step 2 - Vitals
  height: string;
  weight: string;
  systolic: string;
  diastolic: string;
  heartRateBaseline: string;
  // Step 3 - Medical
  diabetes: string;
  diabetesDuration: string;
  hypertension: string;
  hypertensionDuration: string;
  cholesterol: string;
  ldl: string;
  hdl: string;
  // Step 4 - Lifestyle
  smoking: string;
  smokingYears: string;
  alcohol: string;
  activityLevel: string;
  activityMinutes: string;
  stressLevel: string;
  sleepHours: string;
  // Step 5 - Family
  familyHeartDisease: boolean;
  familyDiabetes: boolean;
  familyHypertension: boolean;
  heartRelations: string[];
  diabetesRelations: string[];
  hypertensionRelations: string[];
  // Step 6 - Events
  previousEvents: string[];
  eventDates: Record<string, string>;
  eventNotes: Record<string, string>;
  medications: string;
  allergies: string;
  // Step 7 - Consent
  confirmAccuracy: boolean;
  consentMonitoring: boolean;
}

export const initialFormData: FormData = {
  fullName: "",
  dob: "",
  gender: "",
  bloodType: "",
  contactNumber: "",
  email: "",
  height: "",
  weight: "",
  systolic: "120",
  diastolic: "80",
  heartRateBaseline: "72",
  diabetes: "No",
  diabetesDuration: "",
  hypertension: "No",
  hypertensionDuration: "",
  cholesterol: "180",
  ldl: "110",
  hdl: "50",
  smoking: "Never",
  smokingYears: "",
  alcohol: "None",
  activityLevel: "Moderate",
  activityMinutes: "150",
  stressLevel: "Low",
  sleepHours: "7",
  familyHeartDisease: false,
  familyDiabetes: false,
  familyHypertension: false,
  heartRelations: [],
  diabetesRelations: [],
  hypertensionRelations: [],
  previousEvents: [],
  eventDates: {},
  eventNotes: {},
  medications: "",
  allergies: "",
  confirmAccuracy: false,
  consentMonitoring: false,
};
