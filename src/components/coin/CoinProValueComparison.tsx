export function CoinProValueComparison() {
  return (
    <section aria-labelledby="coin-pro-difference" className="border-y border-ui-line py-3">
      <h2 id="coin-pro-difference" className="text-base font-bold text-ui-text">Coin Pro에서 늘어나는 확인 범위</h2>
      <table className="mt-3 w-full table-fixed text-left text-xs leading-5 text-ui-muted">
        <caption className="sr-only">Basic과 Coin Pro 이용 범위</caption>
        <thead><tr className="border-b border-ui-line"><th className="w-[34%] pb-2 font-medium" scope="col">확인할 것</th><th className="pb-2 font-semibold" scope="col">Basic · 무료</th><th className="pb-2 font-bold text-ui-brand" scope="col">Coin Pro</th></tr></thead>
        <tbody>
          <tr className="border-b border-ui-line/50"><th scope="row" className="py-2 pr-2 font-medium">상태·위험·다음 조건</th><td className="py-2">확인 가능</td><td className="py-2">확인 가능</td></tr>
          <tr className="border-b border-ui-line/50"><th scope="row" className="py-2 pr-2 font-medium">당시 판단·다음 기준 기록</th><td className="py-2">저장·다시 확인</td><td className="py-2">저장·다시 확인</td></tr>
          <tr className="border-b border-ui-line/50"><th scope="row" className="py-2 pr-2 font-medium">조건 감시</th><td className="py-2">1개</td><td className="py-2 font-bold text-ui-text">최대 20개</td></tr>
          <tr><th scope="row" className="py-2 pr-2 font-medium">1시간·4시간 근거</th><td className="py-2">방향 요약</td><td className="py-2 text-ui-text">신호 가격·시각<br />고급 구간·AI 해설</td></tr>
        </tbody>
      </table>
    </section>
  );
}
