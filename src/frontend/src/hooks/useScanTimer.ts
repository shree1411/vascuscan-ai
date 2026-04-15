import { useStore } from "../store/useStore";

export function useScanTimer() {
  const scanSeconds = useStore((s) => s.scanSeconds);

  const formatDuration = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return {
    scanDuration: scanSeconds,
    formattedDuration: formatDuration(scanSeconds),
  };
}
