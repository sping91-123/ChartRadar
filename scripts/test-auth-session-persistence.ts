import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://auth-persistence.test";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";
process.env.NEXT_PUBLIC_ALLOW_LOCAL_REFRESH_TOKEN = "true";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const localStorage = new MemoryStorage();
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: { localStorage }
});

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

async function main() {
  const {
    clearSupabaseSession,
    getActiveSupabaseSession,
    getSupabaseSession,
    refreshSupabaseSession,
    saveSupabaseSession,
    shouldRefreshSupabaseSession
  } = await import("../src/lib/supabase.js");

  const originalFetch = globalThis.fetch;
  const now = Math.floor(Date.now() / 1000);

  const session = {
    accessToken: "access-before-refresh",
    refreshToken: "refresh-before-refresh",
    expiresAt: now + 30,
    tokenType: "bearer"
  };

  assert.equal(shouldRefreshSupabaseSession(session, now), true, "sessions within 60 seconds of expiry must refresh");
  assert.equal(
    shouldRefreshSupabaseSession({ ...session, expiresAt: now + 61 }, now),
    false,
    "sessions outside the refresh leeway must remain active"
  );

  try {
    clearSupabaseSession();
    saveSupabaseSession(session);
    let refreshFetchCount = 0;
    globalThis.fetch = (async () => {
      refreshFetchCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return Response.json({
        access_token: "access-after-refresh",
        refresh_token: "refresh-after-refresh",
        expires_in: 3600,
        token_type: "bearer"
      });
    }) as typeof fetch;

    const concurrentResults = await Promise.all(
      Array.from({ length: 10 }, () => refreshSupabaseSession(session))
    );
    assert.equal(refreshFetchCount, 1, "concurrent refreshes must share one network request");
    assert.ok(concurrentResults.every((result) => result?.refreshToken === "refresh-after-refresh"));
    assert.equal(getSupabaseSession()?.refreshToken, "refresh-after-refresh");

    const transientSession = {
      accessToken: "access-transient",
      refreshToken: "refresh-transient",
      expiresAt: now + 30,
      tokenType: "bearer"
    };
    saveSupabaseSession(transientSession);
    globalThis.fetch = (async () => new Response("temporarily unavailable", { status: 503 })) as typeof fetch;

    await assert.rejects(
      refreshSupabaseSession(transientSession),
      /잠시 지연/
    );
    assert.equal(
      getSupabaseSession()?.refreshToken,
      "refresh-transient",
      "temporary refresh failures must not delete the stored session"
    );
    assert.equal(
      (await getActiveSupabaseSession())?.accessToken,
      "access-transient",
      "a still-valid access token must remain usable while refresh is temporarily unavailable"
    );

    const invalidSession = {
      accessToken: "access-invalid",
      refreshToken: "refresh-invalid",
      expiresAt: now - 1,
      tokenType: "bearer"
    };
    saveSupabaseSession(invalidSession);
    globalThis.fetch = (async () => Response.json(
      { error: "invalid_grant" },
      { status: 400 }
    )) as typeof fetch;

    assert.equal(await refreshSupabaseSession(invalidSession), null);
    assert.equal(getSupabaseSession(), null, "a verified invalid refresh token must clear the session");

    const staleRequestSession = {
      accessToken: "access-stale-request",
      refreshToken: "refresh-stale-request",
      expiresAt: now - 1,
      tokenType: "bearer"
    };
    saveSupabaseSession(staleRequestSession);
    const staleRequest = deferred<Response>();
    globalThis.fetch = (() => staleRequest.promise) as typeof fetch;

    const staleRefresh = refreshSupabaseSession(staleRequestSession);
    clearSupabaseSession();
    staleRequest.resolve(Response.json({
      access_token: "must-not-be-restored",
      refresh_token: "must-not-be-restored",
      expires_in: 3600,
      token_type: "bearer"
    }));

    assert.equal(await staleRefresh, null);
    assert.equal(getSupabaseSession(), null, "an in-flight refresh must not restore a signed-out session");

    const crossTabOldSession = {
      accessToken: "access-old-tab",
      refreshToken: "refresh-old-tab",
      expiresAt: now - 1,
      tokenType: "bearer"
    };
    const crossTabNewSession = {
      accessToken: "access-new-tab",
      refreshToken: "refresh-new-tab",
      expiresAt: now + 3600,
      tokenType: "bearer"
    };
    saveSupabaseSession(crossTabOldSession);
    const crossTabRequest = deferred<Response>();
    globalThis.fetch = (() => crossTabRequest.promise) as typeof fetch;

    const crossTabRefresh = refreshSupabaseSession(crossTabOldSession);
    saveSupabaseSession(crossTabNewSession);
    crossTabRequest.resolve(Response.json({ error: "invalid_grant" }, { status: 400 }));

    assert.equal((await crossTabRefresh)?.refreshToken, "refresh-new-tab");
    assert.equal(
      getSupabaseSession()?.refreshToken,
      "refresh-new-tab",
      "an old tab must not delete a newer rotated session"
    );
  } finally {
    globalThis.fetch = originalFetch;
    clearSupabaseSession();
  }

  console.log("Authentication session persistence matrix passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
