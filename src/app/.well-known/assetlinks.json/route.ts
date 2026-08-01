import { NextResponse } from "next/server";

const androidPackageName = "com.staronlabs.chartradar";

function readFingerprints() {
  return (process.env.ANDROID_APP_LINK_SHA256_FINGERPRINTS || "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter((value) => /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(value));
}

export async function GET() {
  const fingerprints = readFingerprints();
  const body = fingerprints.length
    ? [
        {
          relation: ["delegate_permission/common.handle_all_urls"],
          target: {
            namespace: "android_app",
            package_name: androidPackageName,
            sha256_cert_fingerprints: fingerprints
          }
        }
      ]
    : [];

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=300"
    }
  });
}
