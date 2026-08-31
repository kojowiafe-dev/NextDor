import type { LucideIcon } from "lucide-react";

type TrendDirection = "up" | "down" | "neutral";

type StatCardProps = {
  title: string;
  value: string;
  trend?: string;
  trendDirection?: TrendDirection;
  icon: LucideIcon;
  iconBg?: string;
  iconColor?: string;
};

export function StatCard({
  title,
  value,
  trend,
  trendDirection = "neutral",
  icon: Icon,
  iconBg = "bg-[#fff3e0]",
  iconColor = "text-[#ff9900]",
}: StatCardProps) {
  const trendColor =
    trendDirection === "up"
      ? "text-green-600"
      : trendDirection === "down"
        ? "text-red-500"
        : "text-zinc-500";

  const trendPrefix = trendDirection === "up" ? "↑" : trendDirection === "down" ? "↓" : "";

  return (
    <div className="flex items-center gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${iconBg}`}
      >
        <Icon className={`h-6 w-6 ${iconColor}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug text-zinc-500">{title}</p>
        <p className="mt-1 text-lg font-bold leading-tight text-zinc-900">
          {value}
        </p>
        {trend && (
          <p className={`mt-0.5 text-xs font-medium ${trendColor}`}>
            {trendPrefix} {trend}
          </p>
        )}
      </div>
    </div>
  );
}
