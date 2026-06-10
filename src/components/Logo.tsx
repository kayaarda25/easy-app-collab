import logoAsset from "@/assets/flatch-logo.png.asset.json";
import { cn } from "@/lib/utils";

type LogoProps = {
  size?: number;
  withWordmark?: boolean;
  className?: string;
  wordmarkClassName?: string;
};

export function Logo({ size = 32, withWordmark = false, className, wordmarkClassName }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <img
        src={logoAsset.url}
        alt="flatch."
        width={size}
        height={size}
        className="block object-contain"
        style={{ width: size, height: size }}
      />
      {withWordmark && (
        <span className={cn("font-bold tracking-tight", wordmarkClassName)}>flatch.</span>
      )}
    </span>
  );
}