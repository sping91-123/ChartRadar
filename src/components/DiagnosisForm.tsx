"use client";
// 진입 전 리스크 진단에 필요한 값을 입력받는 폼.
import { AlertTriangle, ChevronRight } from "lucide-react";
import type { DiagnosisFormValues } from "@/types";

const coinOptions = ["BTC", "ETH", "SOL", "XRP", "DOGE", "직접입력"] as const;
const directionOptions = ["롱", "숏"] as const;
const trendOptions = ["상승", "하락", "횡보", "모르겠음"] as const;
const locationOptions = ["지지 근처", "저항 근처", "중간값", "고점 추격", "저점 추격", "모르겠음"] as const;
const stopLossOptions = ["있음", "없음"] as const;
const riskOptions = ["0.5", "1", "2", "3", "직접입력"] as const;

interface DiagnosisFormProps {
  values: DiagnosisFormValues;
  onChange: <K extends keyof DiagnosisFormValues>(key: K, value: DiagnosisFormValues[K]) => void;
  onSubmit: () => void;
}

function SectionTitle({ step, title, description }: { step: string; title: string; description: string }) {
  return (
    <div className="space-y-1">
      <div className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-bold text-slate-400">
        <span className="text-accent-blue">{step}</span>
        <span>{title}</span>
      </div>
      <p className="text-xs leading-5 text-slate-500">{description}</p>
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-slate-200">{label}</span>
      {children}
    </label>
  );
}

function PillGroup<T extends string>({
  value,
  options,
  onChange
}: {
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {options.map((option) => {
        const isActive = value === option;

        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`min-h-11 rounded-md border px-3 py-2 text-sm font-semibold transition ${
              isActive
                ? "border-accent-blue bg-accent-blue text-slate-950"
                : "border-surface-line bg-surface-cardSoft text-slate-300 hover:border-accent-blue/60"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  disabled = false
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      inputMode="decimal"
      className="min-h-12 w-full rounded-md border border-surface-line bg-surface-cardSoft px-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-accent-blue disabled:cursor-not-allowed disabled:opacity-45"
    />
  );
}

export function DiagnosisForm({ values, onChange, onSubmit }: DiagnosisFormProps) {
  const essentialsReady = [
    values.entryPrice.trim(),
    values.totalSeed.trim(),
    values.leverage.trim(),
    values.stopLossStatus === "없음" ? "skipped" : values.stopLossPrice.trim()
  ].filter(Boolean).length;

  return (
    <section className="border-y border-surface-line py-4 sm:py-5">
      <div className="mb-5 flex items-start gap-3 border-y border-accent-blue/20 py-3">
        <AlertTriangle className="mt-0.5 shrink-0 text-accent-blue" size={18} aria-hidden />
        <p className="text-sm leading-6 text-slate-300">
          이 진단은 매매를 더 많이 하게 만드는 도구가 아니라, 지금 자리가 위험한지 먼저 걸러내는 체크표입니다.
        </p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2">
        <div className="border-y border-white/10 py-2">
          <p className="text-[11px] font-semibold text-slate-500">입력 진행도</p>
          <p className="mt-1 text-base font-black text-white">{essentialsReady}/4</p>
        </div>
        <div className="border-y border-white/10 py-2">
          <p className="text-[11px] font-semibold text-slate-500">현재 방향</p>
          <p className="mt-1 text-base font-black text-white">{values.direction}</p>
        </div>
      </div>

      <div className="space-y-6">
        <SectionTitle step="1" title="기본 상황" description="종목과 방향만 먼저 정합니다." />

        <FieldGroup label="종목">
          <PillGroup value={values.coin} options={coinOptions} onChange={(value) => onChange("coin", value)} />
          {values.coin === "직접입력" ? (
            <TextInput value={values.customCoin} onChange={(value) => onChange("customCoin", value)} placeholder="예. AVAX" />
          ) : null}
        </FieldGroup>

        <FieldGroup label="방향">
          <PillGroup value={values.direction} options={directionOptions} onChange={(value) => onChange("direction", value)} />
        </FieldGroup>

        <SectionTitle step="2" title="자리 확인" description="상위 추세와 현재 위치가 추격인지 아닌지 판단합니다." />

        <FieldGroup label="상위 시간대 추세">
          <PillGroup value={values.higherTrend} options={trendOptions} onChange={(value) => onChange("higherTrend", value)} />
        </FieldGroup>

        <FieldGroup label="현재 위치">
          <PillGroup value={values.currentLocation} options={locationOptions} onChange={(value) => onChange("currentLocation", value)} />
        </FieldGroup>

        <SectionTitle step="3" title="리스크 숫자" description="손절, 시드, 레버리지까지 넣으면 적정 포지션 크기도 계산합니다." />

        <FieldGroup label="손절가 설정 여부">
          <PillGroup value={values.stopLossStatus} options={stopLossOptions} onChange={(value) => onChange("stopLossStatus", value)} />
          {values.stopLossStatus === "없음" ? (
            <p className="rounded-md border border-signal-warning/25 bg-signal-warning/10 px-3 py-2 text-xs leading-5 text-signal-warning">
              손절가가 없으면 진단은 기본적으로 위험하게 평가합니다.
            </p>
          ) : null}
        </FieldGroup>

        <div className="grid gap-4 sm:grid-cols-2">
          <FieldGroup label="진입가">
            <TextInput value={values.entryPrice} onChange={(value) => onChange("entryPrice", value)} placeholder="예. 68000" />
          </FieldGroup>
          <FieldGroup label="손절가">
            <TextInput
              value={values.stopLossPrice}
              onChange={(value) => onChange("stopLossPrice", value)}
              placeholder="예. 66500"
              disabled={values.stopLossStatus === "없음"}
            />
          </FieldGroup>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FieldGroup label="총 시드">
            <TextInput value={values.totalSeed} onChange={(value) => onChange("totalSeed", value)} placeholder="예. 1000000" />
          </FieldGroup>
          <FieldGroup label="레버리지">
            <TextInput value={values.leverage} onChange={(value) => onChange("leverage", value)} placeholder="예. 3" />
          </FieldGroup>
        </div>

        <FieldGroup label="허용 손실률">
          <PillGroup value={values.riskPercentPreset} options={riskOptions} onChange={(value) => onChange("riskPercentPreset", value)} />
          {values.riskPercentPreset === "직접입력" ? (
            <TextInput value={values.customRiskPercent} onChange={(value) => onChange("customRiskPercent", value)} placeholder="예. 1.5" />
          ) : null}
        </FieldGroup>

        <button
          type="button"
          onClick={onSubmit}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-accent-blue px-5 text-base font-extrabold text-slate-950 transition hover:bg-sky-300 focus:outline-none focus:ring-2 focus:ring-accent-blue focus:ring-offset-2 focus:ring-offset-surface-base"
        >
          진입 전 리스크 점검하기
          <ChevronRight size={20} aria-hidden />
        </button>
      </div>
    </section>
  );
}
