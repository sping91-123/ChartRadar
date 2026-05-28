import Link from "next/link";
import type { ButtonHTMLAttributes, ElementType, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type Tone = "panel" | "elevated" | "inset" | "critical";
type SurfaceVariant = "card" | "flat" | "report" | "list";
type SurfaceRadius = "none" | "sm" | "md";
type Padding = "none" | "sm" | "md" | "lg";
type StatusTone = "long" | "short" | "watch" | "risk" | "locked" | "info";
type ButtonTone = "primary" | "secondary" | "ghost" | "danger";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const surfaceVariantClass: Record<SurfaceVariant, Record<Tone, string>> = {
  card: {
    panel: "border border-ui-line bg-ui-panel text-ui-text shadow-ui-panel",
    elevated: "border border-ui-line bg-ui-elevated text-ui-text shadow-ui-elevated",
    inset: "border border-ui-line bg-ui-inset text-ui-text",
    critical: "border border-amber-400/28 bg-amber-400/10 text-ui-risk"
  },
  flat: {
    panel: "bg-transparent text-ui-text",
    elevated: "bg-transparent text-ui-text",
    inset: "bg-transparent text-ui-muted",
    critical: "bg-transparent text-ui-risk"
  },
  report: {
    panel: "border-y border-ui-line bg-transparent text-ui-text",
    elevated: "border-y border-ui-lineStrong bg-transparent text-ui-text",
    inset: "border-y border-ui-line bg-transparent text-ui-muted",
    critical: "border-y border-amber-400/28 bg-transparent text-ui-risk"
  },
  list: {
    panel: "divide-y divide-ui-line bg-transparent text-ui-text",
    elevated: "divide-y divide-ui-lineStrong bg-transparent text-ui-text",
    inset: "divide-y divide-ui-line bg-transparent text-ui-muted",
    critical: "divide-y divide-amber-400/24 bg-transparent text-ui-risk"
  }
};

const paddingClass: Record<Padding, string> = {
  none: "",
  sm: "p-2",
  md: "p-4",
  lg: "p-5"
};

const radiusClass: Record<SurfaceRadius, string> = {
  none: "",
  sm: "rounded-ui-sm",
  md: "rounded-ui"
};

function defaultRadiusForVariant(variant: SurfaceVariant) {
  return variant === "card" ? "md" : "none";
}

interface AppSurfaceProps {
  as?: ElementType;
  tone?: Tone;
  variant?: SurfaceVariant;
  padding?: Padding;
  radius?: SurfaceRadius;
  className?: string;
  children: ReactNode;
}

export function AppSurface({
  as: Component = "section",
  tone = "panel",
  variant = "card",
  padding = "md",
  radius = defaultRadiusForVariant(variant),
  className,
  children
}: AppSurfaceProps) {
  return <Component className={cx(radiusClass[radius], surfaceVariantClass[variant][tone], paddingClass[padding], className)}>{children}</Component>;
}

export function PanelCard({
  tone = "panel",
  variant = "card",
  padding = "md",
  className,
  children
}: {
  tone?: Tone;
  variant?: SurfaceVariant;
  padding?: Padding;
  className?: string;
  children: ReactNode;
}) {
  return (
    <AppSurface tone={tone} variant={variant} padding={padding} className={cx("min-w-0", className)}>
      {children}
    </AppSurface>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  className
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="text-ui-label font-semibold uppercase tracking-[0.12em] text-ui-subtle">{eyebrow}</p> : null}
        <h2 className="text-ui-heading font-semibold tracking-tight text-ui-text">{title}</h2>
        {description ? <p className="mt-1 max-w-3xl text-ui-body text-ui-muted [word-break:keep-all]">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

const statusClass: Record<StatusTone, string> = {
  long: "border-emerald-400/24 bg-emerald-400/10 text-ui-long",
  short: "border-rose-400/24 bg-rose-400/10 text-ui-short",
  watch: "border-slate-400/20 bg-slate-400/10 text-ui-watch",
  risk: "border-amber-400/28 bg-amber-400/10 text-ui-risk",
  locked: "border-slate-400/18 bg-slate-400/10 text-ui-locked",
  info: "border-ui-line bg-ui-inset text-ui-muted"
};

export function StatusPill({ tone = "info", icon: Icon, children, className }: { tone?: StatusTone; icon?: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex min-h-7 items-center gap-1.5 rounded-ui-sm border px-2.5 text-ui-label font-semibold", statusClass[tone], className)}>
      {Icon ? <Icon size={13} aria-hidden /> : null}
      {children}
    </span>
  );
}

export function DataRow({
  label,
  value,
  detail,
  className
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex min-w-0 items-start justify-between gap-3 border-t border-ui-line py-2.5 first:border-t-0", className)}>
      <div className="min-w-0">
        <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">{label}</p>
        {detail ? <p className="mt-0.5 text-xs leading-5 text-ui-muted [word-break:keep-all]">{detail}</p> : null}
      </div>
      <div className="min-w-0 shrink-0 text-right text-sm font-semibold text-ui-text">{value}</div>
    </div>
  );
}

export const MetricRow = DataRow;

const buttonClass: Record<ButtonTone, string> = {
  primary: "border-ui-brand bg-ui-brand text-slate-950 hover:brightness-110",
  secondary: "border-ui-line bg-ui-panel text-ui-text hover:border-ui-lineStrong hover:bg-ui-elevated",
  ghost: "border-transparent bg-transparent text-ui-muted hover:bg-ui-inset hover:text-ui-text",
  danger: "border-rose-400/24 bg-rose-400/10 text-ui-short hover:border-rose-400/40"
};

interface ActionButtonBase {
  tone?: ButtonTone;
  className?: string;
  children: ReactNode;
  href?: string;
}

type ActionButtonProps = ActionButtonBase & ButtonHTMLAttributes<HTMLButtonElement>;

export function ActionButton({ tone = "secondary", className, children, href, type = "button", ...props }: ActionButtonProps) {
  const classes = cx(
    "inline-flex min-h-9 items-center justify-center gap-2 rounded-ui border px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
    buttonClass[tone],
    className
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} className={classes} {...props}>
      {children}
    </button>
  );
}
