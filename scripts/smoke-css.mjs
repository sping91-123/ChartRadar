// 媛쒕컻 ?쒕쾭媛 ?ㅼ젣 ?붾㈃ ?ㅽ????뚯씪???뺤긽 ?쒓났?섎뒗吏 ?뺤씤?⑸땲??
const baseUrl = (process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const pageUrl = `${baseUrl}/crypto/home`;

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

function pass(message) {
  console.log(`PASS ${message}`);
}

async function main() {
  const pageResponse = await fetch(pageUrl, { cache: "no-store" });
  if (!pageResponse.ok) fail(`李⑦듃 ?붾㈃ ?묐떟 ?ㅽ뙣 - HTTP ${pageResponse.status}`);

  const html = await pageResponse.text();
  const cssLinks = [...html.matchAll(/href="([^"]+\.css[^"]*)"/g)].map((match) => match[1]);
  if (cssLinks.length === 0) fail("李⑦듃 ?붾㈃?먯꽌 CSS 留곹겕瑜?李얠? 紐삵뻽?듬땲??");

  for (const href of cssLinks) {
    const cssUrl = href.startsWith("http") ? href : `${baseUrl}${href}`;
    const cssResponse = await fetch(cssUrl, { cache: "no-store" });
    if (!cssResponse.ok) fail(`CSS ?뚯씪 ?묐떟 ?ㅽ뙣 - ${href} HTTP ${cssResponse.status}`);

    const css = await cssResponse.text();
    if (css.length < 10_000) fail(`CSS ?뚯씪 ?ш린媛 鍮꾩젙?곸쟻?쇰줈 ?묒뒿?덈떎 - ${href}`);
  }

  pass(`李⑦듃 ?붾㈃ CSS ${cssLinks.length}媛??뺤씤`);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});

