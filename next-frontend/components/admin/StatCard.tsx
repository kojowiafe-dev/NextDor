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

  // Adapt font sizing dynamically if value is a long currency string
  const isLargeNumber = value.length > 11;
  const isMediumNumber = value.length > 8;

  return (
    <div className="flex flex-col justify-between rounded-xl bg-white p-4 sm:p-5 shadow-sm ring-1 ring-zinc-100 hover:shadow-md transition-shadow min-w-0">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs sm:text-sm font-medium leading-snug text-zinc-600" title={title}>
          {title}
        </p>
        <div
          className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg ${iconBg}`}
        >
          <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} />
        </div>
      </div>

      <div className="mt-3 min-w-0">
        <p
          className={`font-bold tracking-tight text-zinc-900 ${
            isLargeNumber
              ? "text-sm sm:text-base"
              : isMediumNumber
                ? "text-base sm:text-lg"
                : "text-lg sm:text-xl"
          }`}
          title={value}
        >
          {value}
        </p>
        {trend && (
          <p
            className={`mt-1 text-xs font-medium ${trendColor}`}
            title={`${trendPrefix} ${trend}`}
          >
            {trendPrefix} {trend}
          </p>
        )}
      </div>
    </div>
  );
}
