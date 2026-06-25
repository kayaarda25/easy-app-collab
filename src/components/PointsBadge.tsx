import { Coins } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyPointsBalance } from "@/lib/points.functions";

export function PointsBadge({ compact = false }: { compact?: boolean }) {
  const fetchFn = useServerFn(getMyPointsBalance);
  const q = useQuery({ queryKey: ["points-balance"], queryFn: () => fetchFn() });
  const value = q.data?.available ?? 0;
  const plan = q.data?.effectivePlan ?? "basic";
  return (
    <Link
      to="/points"
      className={`inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-amber-700 dark:text-amber-300 ${compact ? "text-xs" : "text-sm"} font-semibold hover:bg-amber-500/25 transition`}
      title={plan === "basic" ? "Upgrade to earn flatch.points" : "Your flatch.points balance"}
    >
      <Coins className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
      <span>{value}</span>
      <span className="opacity-70 font-normal">pts</span>
    </Link>
  );
}