import type { ReactNode } from "react";
import { CircleHelp } from "lucide-react";

export function CompactHelp({ children, label = "상세" }: { children?: ReactNode; label?: string }) {
  if (!children) return null;

  return (
    <details className="group min-w-0">
      <summary
        aria-label={`${label} 보기`}
        className="inline-grid h-6 w-6 cursor-pointer list-none place-items-center border border-ui-line text-ui-muted transition hover:text-ui-text marker:hidden [&::-webkit-details-marker]:hidden"
      >
        <CircleHelp size={14} aria-hidden />
      </summary>
      <div className="mt-2 border-y border-ui-line py-2 text-xs leading-5 text-ui-muted [word-break:keep-all]">{children}</div>
    </details>
  );
}
