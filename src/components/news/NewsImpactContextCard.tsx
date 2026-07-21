import { Clock3, Newspaper, ShieldAlert } from "lucide-react";
import { StatusPill } from "@/components/ui/DesignPrimitives";
import type { NewsDecisionContext } from "@/lib/newsImpact";
import { formatNewsImpactTime, newsImpactClassificationLabel, newsImpactTone } from "@/lib/newsImpactPresentation";

export function NewsImpactContextCard({ context, compact = false }: { context: NewsDecisionContext; compact?: boolean }) {
  return (
    <section className="border-l-2 border-ui-brand bg-ui-panel px-3 py-3 sm:px-4" aria-labelledby={`news-context-${context.reactionId}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.12em] text-ui-brand">
          <Newspaper size={12} aria-hidden /> 공식 발표·공시 이후 관측
        </p>
        <StatusPill tone={newsImpactTone(context.classification)} icon={ShieldAlert}>
          {newsImpactClassificationLabel(context.classification)}
        </StatusPill>
      </div>
      <h2 id={`news-context-${context.reactionId}`} className="mt-2 text-sm font-black leading-6 text-ui-text [word-break:keep-all]">
        {context.headline}
      </h2>
      {!compact ? <p className="mt-1 text-xs leading-5 text-ui-muted [word-break:keep-all]">{context.factSummary}</p> : null}
      <p className="mt-2 text-sm font-semibold leading-6 text-ui-text [word-break:keep-all]">{context.reactionSummary}</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-ui-muted">
        <span className="inline-flex items-center gap-1"><Clock3 size={12} aria-hidden /> {context.nextCheckAt ? `다음 확인 ${formatNewsImpactTime(context.nextCheckAt)}` : `평가 ${formatNewsImpactTime(context.evaluatedAt)}`}</span>
        <a className="text-ui-brand underline underline-offset-2" href={`/crypto/news?asset=${context.target}&event=${context.eventId}&source=perpetual`}>공식 발표·공시 보기</a>
      </div>
    </section>
  );
}
