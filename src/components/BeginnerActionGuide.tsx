// 초보 사용자가 레이더 판독 뒤 바로 확인할 행동 순서를 보여주는 안내 컴포넌트.
import { CheckCircle2, ShieldAlert } from "lucide-react";

export type BeginnerGuideTone = "success" | "danger" | "warning" | "neutral" | "info";

export interface BeginnerGuideStep {
  label: string;
  title: string;
  body: string;
  tone?: BeginnerGuideTone;
}

interface BeginnerActionGuideProps {
  eyebrow?: string;
  title: string;
  summary: string;
  steps: BeginnerGuideStep[];
  checklist?: string[];
  help: string;
}

function stepToneClass(tone: BeginnerGuideTone = "neutral") {
  if (tone === "success") return "border-signal-success/25 bg-signal-success/10 text-signal-success";
  if (tone === "danger") return "border-signal-danger/25 bg-signal-danger/10 text-signal-danger";
  if (tone === "warning") return "border-signal-warning/25 bg-signal-warning/10 text-signal-warning";
  if (tone === "info") return "border-cyan-300/25 bg-cyan-300/10 text-cyan-100";
  return "border-transparent bg-ui-elevated text-slate-200";
}

export function BeginnerActionGuide({
  eyebrow = "처음 보는 사람용",
  title,
  summary,
  steps,
  checklist = [],
  help
}: BeginnerActionGuideProps) {
  return (
    <section className="rounded-ui-lg bg-ui-panel p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-cyan-200">{eyebrow}</p>
            <span className="group relative inline-flex" tabIndex={0} aria-label="판단 기준">
              <span className="rounded-ui-sm border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-bold text-cyan-100">판단 기준</span>
              <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-[min(19rem,calc(100vw-2rem))] -translate-x-1/2 rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-[11px] font-bold leading-5 text-slate-300 shadow-xl group-hover:block group-focus:block">
                {help}
              </span>
            </span>
          </div>
          <h3 className="mt-2 text-lg font-black text-white">{title}</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400 [word-break:keep-all]">{summary}</p>
        </div>
        {checklist.length > 0 ? (
          <div className="w-full shrink-0 md:w-72">
            <div className="flex items-center gap-2 text-xs font-black text-slate-200">
              <ShieldAlert size={15} className="text-signal-warning" aria-hidden />
              실행 전 3개만 확인
            </div>
            <ul className="mt-2 space-y-1.5">
              {checklist.map((item) => (
                <li key={item} className="flex gap-2 text-[11px] font-bold leading-5 text-slate-400 [word-break:keep-all]">
                  <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-cyan-200" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-3">
        {steps.map((step) => (
          <article key={step.label} className={`min-h-[128px] rounded-ui-sm border p-3 ${stepToneClass(step.tone)}`}>
            <p className="text-[11px] font-black opacity-80">{step.label}</p>
            <h4 className="mt-2 text-sm font-black text-white">{step.title}</h4>
            <p className="mt-2 text-xs font-bold leading-5 text-slate-300 [word-break:keep-all]">{step.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
