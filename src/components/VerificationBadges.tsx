import { BadgeCheck, Mail, Phone, IdCard, Home, ShieldCheck, Crown, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type BadgeKey = "email" | "phone" | "identity" | "property" | "trusted_host" | "premium";

type BadgeMeta = { label: string; icon: LucideIcon; tone: string };

const META: Record<BadgeKey, BadgeMeta> = {
  email:        { label: "Email",        icon: Mail,        tone: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  phone:        { label: "Phone",        icon: Phone,       tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  identity:     { label: "ID verified",  icon: IdCard,      tone: "bg-violet-500/10 text-violet-700 dark:text-violet-300" },
  property:     { label: "Home verified",icon: Home,        tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  trusted_host: { label: "Trusted host", icon: ShieldCheck, tone: "bg-primary/10 text-primary" },
  premium:      { label: "Premium",      icon: Crown,       tone: "bg-gradient-to-r from-primary/15 to-accent text-primary" },
};

export type VerificationSource = {
  email_verified_at?: string | null;
  phone_verified_at?: string | null;
  identity_verified_at?: string | null;
  trusted_host?: boolean | null;
  plan?: string | null;
  hasVerifiedProperty?: boolean;
};

export function computeBadges(s: VerificationSource): BadgeKey[] {
  const out: BadgeKey[] = [];
  if (s.email_verified_at) out.push("email");
  if (s.phone_verified_at) out.push("phone");
  if (s.identity_verified_at) out.push("identity");
  if (s.hasVerifiedProperty) out.push("property");
  if (s.trusted_host) out.push("trusted_host");
  if (s.plan && s.plan !== "basic") out.push("premium");
  return out;
}

export function VerificationBadges({
  source,
  size = "sm",
  showLabels = true,
  className,
}: {
  source: VerificationSource;
  size?: "xs" | "sm";
  showLabels?: boolean;
  className?: string;
}) {
  const badges = computeBadges(source);
  if (badges.length === 0) return null;
  const pad = size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs";
  const icon = size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5";
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {badges.map((b) => {
        const m = META[b];
        const Icon = m.icon;
        return (
          <span key={b} title={m.label} className={cn("inline-flex items-center gap-1 rounded-full font-semibold", pad, m.tone)}>
            <Icon className={icon} />
            {showLabels && <span>{m.label}</span>}
          </span>
        );
      })}
    </div>
  );
}

export function VerificationChecklist({ source }: { source: VerificationSource }) {
  const items: { key: BadgeKey; done: boolean; hint: string }[] = [
    { key: "email",        done: !!source.email_verified_at,    hint: "Confirm your email address" },
    { key: "phone",        done: !!source.phone_verified_at,    hint: "Add and verify your phone number" },
    { key: "identity",     done: !!source.identity_verified_at, hint: "Verify your government ID" },
    { key: "property",     done: !!source.hasVerifiedProperty,  hint: "Get a home verified" },
    { key: "trusted_host", done: !!source.trusted_host,         hint: "Awarded after successful swaps" },
    { key: "premium",      done: !!source.plan && source.plan !== "basic", hint: "Upgrade to a paid plan" },
  ];
  return (
    <ul className="divide-y divide-border">
      {items.map(({ key, done, hint }) => {
        const m = META[key];
        const Icon = m.icon;
        return (
          <li key={key} className="flex items-center gap-3 p-3">
            <span className={cn("flex h-8 w-8 items-center justify-center rounded-full", m.tone)}>
              <Icon className="h-4 w-4" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold">{m.label}</p>
              <p className="text-xs text-muted-foreground">{hint}</p>
            </div>
            {done ? (
              <BadgeCheck className="h-5 w-5 text-primary" />
            ) : (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Pending</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}