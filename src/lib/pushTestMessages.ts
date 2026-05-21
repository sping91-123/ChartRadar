// 푸시와 브라우저 알림 테스트에 사용할 사용자용 예시 문구를 관리합니다.
export type PushTestKind = "default" | "crypto" | "global" | "macro";

export interface PushTestMessage {
  kind: PushTestKind;
  label: string;
  title: string;
  body: string;
  target: string;
  market: "crypto" | "stocks";
}

export const pushTestMessages: PushTestMessage[] = [
  {
    kind: "default",
    label: "기본 테스트 알림",
    title: "차트레이더 테스트 알림",
    body: "앱 푸시 알림이 정상적으로 연결되었습니다.",
    target: "/alerts?market=crypto",
    market: "crypto"
  },
  {
    kind: "crypto",
    label: "코인 레이더 알림 예시",
    title: "코인 레이더 조건 감지",
    body: "BTC 흐름에 변화가 감지되었습니다. 레이더를 확인해 주세요.",
    target: "/alerts?market=crypto",
    market: "crypto"
  },
  {
    kind: "global",
    label: "글로벌 레이더 알림 예시",
    title: "글로벌 시장 흐름 변화",
    body: "지수와 변동성 흐름에 변화가 감지되었습니다.",
    target: "/alerts?market=global",
    market: "stocks"
  },
  {
    kind: "macro",
    label: "매크로 일정 알림 예시",
    title: "중요 일정 임박",
    body: "시장 영향 가능성이 큰 일정이 예정되어 있습니다.",
    target: "/news?market=global",
    market: "stocks"
  }
];

export function getPushTestMessage(kind: unknown): PushTestMessage {
  return pushTestMessages.find((message) => message.kind === kind) ?? pushTestMessages[0]!;
}
