"use client";

import { useState } from "react";
import { Copy, Sparkles } from "lucide-react";

const questions = [
  "지금 자리가 왜 위험한지 한 줄로 정리해줘.",
  "이 매매에서 제일 먼저 고쳐야 할 한 가지를 알려줘.",
  "지금 자리가 추격인지 아닌지 체크해줘.",
  "상위 추세와 반대로 들어가는 매매인지 확인해줘.",
  "지금은 진입보다 관찰이 더 필요한 자리인지 알려줘."
];

interface QuestionTemplatesProps {
  selectedQuestion: string;
  onSelect: (question: string) => void;
}

export function QuestionTemplates({ selectedQuestion, onSelect }: QuestionTemplatesProps) {
  const [copied, setCopied] = useState(false);

  async function copySelectedQuestion() {
    if (!selectedQuestion) return;
    await navigator.clipboard.writeText(selectedQuestion);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section className="rounded-lg border border-surface-line bg-surface-card p-5">
      <div className="flex items-center gap-3">
        <Sparkles className="text-accent-blue" size={20} aria-hidden />
        <h2 className="text-lg font-bold text-white">질문 템플릿</h2>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-400">
        진단 결과를 보고 바로 다시 물어볼 만한 질문만 짧게 남겼습니다.
      </p>
      <div className="mt-4 grid gap-2">
        {questions.map((question, index) => (
          <button
            key={question}
            type="button"
            onClick={() => onSelect(question)}
            className="flex min-h-12 items-start gap-3 rounded-md border border-surface-line bg-surface-cardSoft px-3 py-3 text-left text-sm leading-6 text-slate-300 transition hover:border-accent-blue/60 hover:text-white"
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-black/25 text-xs font-bold text-accent-blue">
              {index + 1}
            </span>
            <span>{question}</span>
          </button>
        ))}
      </div>

      {selectedQuestion ? (
        <div className="mt-4 rounded-md border border-accent-blue/25 bg-accent-blue/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold text-accent-blue">
              <Copy size={16} aria-hidden />
              선택한 질문
            </div>
            <button
              type="button"
              onClick={copySelectedQuestion}
              className="inline-flex min-h-9 items-center rounded-md border border-accent-blue/20 bg-black/20 px-3 text-xs font-bold text-slate-200"
            >
              {copied ? "복사됨" : "질문 복사"}
            </button>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-200">{selectedQuestion}</p>
        </div>
      ) : null}
    </section>
  );
}
