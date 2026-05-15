// 개발 서버가 실제 화면 스타일 파일을 정상 제공하는지 확인합니다.
const baseUrl = (process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const pageUrl = `${baseUrl}/majors`;

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

function pass(message) {
  console.log(`PASS ${message}`);
}

async function main() {
  const pageResponse = await fetch(pageUrl, { cache: "no-store" });
  if (!pageResponse.ok) fail(`차트 화면 응답 실패 - HTTP ${pageResponse.status}`);

  const html = await pageResponse.text();
  const cssLinks = [...html.matchAll(/href="([^"]+\.css[^"]*)"/g)].map((match) => match[1]);
  if (cssLinks.length === 0) fail("차트 화면에서 CSS 링크를 찾지 못했습니다.");

  for (const href of cssLinks) {
    const cssUrl = href.startsWith("http") ? href : `${baseUrl}${href}`;
    const cssResponse = await fetch(cssUrl, { cache: "no-store" });
    if (!cssResponse.ok) fail(`CSS 파일 응답 실패 - ${href} HTTP ${cssResponse.status}`);

    const css = await cssResponse.text();
    if (css.length < 10_000) fail(`CSS 파일 크기가 비정상적으로 작습니다 - ${href}`);
  }

  pass(`차트 화면 CSS ${cssLinks.length}개 확인`);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
