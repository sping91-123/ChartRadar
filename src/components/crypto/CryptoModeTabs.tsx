// 코인 레이더 분석 모드 탭 UI를 담당하는 controlled component입니다.
import type { RadarProfile } from "@/components/crypto/types";

interface CryptoModeOption {
  key: RadarProfile;
  label: string;
  description: string;
}

interface CryptoModeTabsProps {
  options: CryptoModeOption[];
  activeMode: RadarProfile;
  onChange: (mode: RadarProfile) => void;
}

export function CryptoModeTabs({ options, activeMode, onChange }: CryptoModeTabsProps) {
  return (
    <div className="mt-1.5 grid grid-cols-3 gap-1">
      {options.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          className={`min-h-8 rounded-ui-sm px-2 text-[11px] font-semibold transition sm:min-h-9 sm:text-xs ${activeMode === item.key ? "bg-ui-active text-ui-text" : "text-ui-muted hover:bg-ui-inset/60 hover:text-ui-text"}`}
          title={item.description}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
