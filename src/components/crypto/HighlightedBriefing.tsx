function BriefingKeyword({ children, tone }: { children: string; tone: "long" | "short" | "warn" | "neutral" }) {
  const className =
    tone === "long"
      ? "text-signal-success"
      : tone === "short"
        ? "text-signal-danger"
        : tone === "warn"
          ? "text-signal-warning"
          : "text-accent-blue";
  return <span className={className}>{children}</span>;
}

function cleanBriefingText(text: string) {
  return text
    .replace(/[\u3040-\u30ff]+/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitBriefingParagraphs(text: string) {
  const cleaned = cleanBriefingText(text);
  const explicitParagraphs = cleaned
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (explicitParagraphs.length >= 2) return explicitParagraphs;

  const sentences = cleaned
    .split(/(?<=[.!?。！？])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (sentences.length <= 2) return cleaned ? [cleaned] : [];

  const midpoint = Math.ceil(sentences.length / 2);
  return [sentences.slice(0, midpoint).join(" "), sentences.slice(midpoint).join(" ")].filter(Boolean);
}

export function HighlightedBriefing({ text }: { text: string }) {
  const pattern =
    /(롱|숏|매수|매도|상승|하락|지지|저항|돌파|이탈|유리|불리|우세|중립|횡보|관망|주의|위험|리스크|조정|과열|침체|손절|익절|OB|FVG|POC|PD|MSB|BOS|CHoCH|Sweep|CISD|강점|약점|대기|관찰)/g;
  const paragraphs = splitBriefingParagraphs(text);
  return (
    <div className="space-y-3">
      {paragraphs.map((paragraph, paragraphIndex) => (
        <p key={paragraphIndex} className="rounded-md border border-white/10 bg-black/15 px-3 py-3 text-sm leading-7 text-slate-200 [word-break:keep-all]">
          {paragraph.split(pattern).map((part, index) => {
            if (!part) return null;
            if (["롱", "매수", "상승", "지지", "돌파", "유리", "우세", "강점"].includes(part)) {
              return <BriefingKeyword key={`${paragraphIndex}-${part}-${index}`} tone="long">{part}</BriefingKeyword>;
            }
            if (["숏", "매도", "하락", "저항", "이탈", "불리"].includes(part)) {
              return <BriefingKeyword key={`${paragraphIndex}-${part}-${index}`} tone="short">{part}</BriefingKeyword>;
            }
            if (["주의", "위험", "리스크", "조정", "과열", "침체", "약점", "손절"].includes(part)) {
              return <BriefingKeyword key={`${paragraphIndex}-${part}-${index}`} tone="warn">{part}</BriefingKeyword>;
            }
            if (
              ["중립", "횡보", "관망", "OB", "FVG", "POC", "PD", "MSB", "BOS", "CHoCH", "Sweep", "CISD", "대기", "관찰", "익절"].includes(part)
            ) {
              return <BriefingKeyword key={`${paragraphIndex}-${part}-${index}`} tone="neutral">{part}</BriefingKeyword>;
            }
            return <span key={`${paragraphIndex}-${part}-${index}`}>{part}</span>;
          })}
        </p>
      ))}
    </div>
  );
}
