import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  healthy: "bg-[#01A982]/10 border-[#01A982] text-[#01A982]",
  untested: "bg-[#CCCCCC]/10 border-[#CCCCCC] text-[#CCCCCC]",
  rate_limited: "bg-[#FFB100]/10 border-[#FFB100] text-[#FFB100]",
  error: "bg-[#FF4B4B]/10 border-[#FF4B4B] text-[#FF4B4B]",
  failed: "bg-[#FF4B4B]/10 border-[#FF4B4B] text-[#FF4B4B]",
};

export function StatusChip({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  const style = statusStyles[status] ?? statusStyles.untested;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.05em]",
        style
      )}
    >
      {label ?? status.replaceAll("_", " ")}
    </span>
  );
}
