type RadarScanLoaderProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
};

const sizeClasses: Record<NonNullable<RadarScanLoaderProps["size"]>, string> = {
  sm: "h-12 w-12 rounded-2xl",
  md: "h-16 w-16 rounded-[1.25rem]",
  lg: "h-36 w-36 rounded-[1.8rem]"
};

export function RadarScanLoader({ size = "md", className = "", label }: RadarScanLoaderProps) {
  return (
    <div
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`radar-scan-loader ${sizeClasses[size]} ${className}`}
    >
      <span className="radar-scan-loader__beam" aria-hidden />
      <span className="radar-scan-loader__pulse" aria-hidden />
      <span className="radar-scan-loader__dot" aria-hidden />
    </div>
  );
}
