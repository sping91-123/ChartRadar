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
    <div className="mt-2 grid grid-cols-3 gap-1">
      {options.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          className={`min-h-9 border-b-2 px-2 text-xs font-black transition ${
            activeMode === item.key
              ? "border-white bg-transparent text-white"
              : "border-transparent bg-transparent text-slate-400 hover:text-slate-200"
          }`}
          title={item.description}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
