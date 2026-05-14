// 출시 전 주요 스모크 테스트를 순서대로 실행하는 통합 점검 스크립트입니다.
import { spawnSync } from "node:child_process";

const checks = [
  ["smoke:copy", "node", ["scripts/smoke-copy.mjs"]],
  ["smoke:launch", "node", ["scripts/launch-review.mjs"]],
  ["smoke:ops", "node", ["scripts/smoke-ops.mjs"]],
  ["smoke:mobile", "node", ["scripts/smoke-mobile.mjs"]],
  ["smoke:billing", "node", ["scripts/smoke-billing.mjs"]],
  [
    "dev:clean",
    process.platform === "win32" ? "powershell" : "pwsh",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts/restart-dev.ps1"]
  ],
  ["smoke:api", "node", ["scripts/smoke-api.mjs"]],
  ["smoke:routes", "node", ["scripts/smoke-routes.mjs"]]
];

const serverBaseUrl = (process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDevServer() {
  const deadline = Date.now() + 45_000;
  let lastError = "";

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${serverBaseUrl}/api/health`, { cache: "no-store" });
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(1_000);
  }

  throw new Error(`개발 서버가 준비되지 않았습니다. 마지막 상태는 ${lastError || "응답 없음"}입니다.`);
}

for (const [check, command, args] of checks) {
  console.log(`\n=== ${check} ===`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false
  });

  if (result.status !== 0) {
    if (result.error) console.error(result.error);
    console.error(`\n${check} 점검이 실패했습니다. 위 로그를 먼저 확인해 주세요.`);
    process.exit(result.status ?? 1);
  }

  if (check === "dev:clean") {
    console.log(`개발 서버 준비 상태를 확인합니다. 기준 URL은 ${serverBaseUrl}입니다.`);
    await waitForDevServer();
    console.log("개발 서버가 준비되었습니다.");
    console.log("\n=== smoke:css ===");
    const cssResult = spawnSync("node", ["scripts/smoke-css.mjs"], {
      stdio: "inherit",
      shell: false
    });
    if (cssResult.status !== 0) {
      if (cssResult.error) console.error(cssResult.error);
      console.error("\nsmoke:css 점검에 실패했습니다. 스타일 파일 응답을 확인해 주세요.");
      process.exit(cssResult.status ?? 1);
    }
  }
}

console.log("\n전체 출시 스모크 점검이 통과했습니다.");
