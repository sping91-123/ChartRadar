const day = 86_400_000;
const ratio = (numerator, denominator) => ({ numerator, denominator, rate: denominator ? numerator / denominator : null });

// Input is a read-only export of product_events. Output contains counts only, never user/session IDs.
export function buildConversionHealth({ events, startAt, endAt }) {
  const start = Date.parse(startAt), end = Date.parse(endAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error("A valid explicit startAt/endAt window is required.");
  const uniqueEvents = new Map();
  for (const event of events) {
    const time = Date.parse(event.occurred_at);
    if (event.traffic_class !== "user" || !Number.isFinite(time) || time < start || time >= end) continue;
    if (!event.event_id) throw new Error("Every included event needs an event_id for deduplication.");
    uniqueEvents.set(event.event_id, { ...event, time });
  }
  const rows = [...uniqueEvents.values()].sort((a, b) => a.time - b.time);
  const gates = new Map(), passed = new Set(), firstHome = new Map(), homeMonitor = new Set();
  const trials = new Map(), firstMonitor = new Map(), converted = new Map();
  const failureCodes = {}, gatePlatforms = {};
  for (const event of rows) {
    const session = event.funnel_session_hash, user = event.user_id;
    if (event.event_name === "pro_gate_viewed" && session) {
      if (!gates.has(session)) {
        gates.set(session, event.time);
        const platform = ["android", "ios", "web"].includes(event.properties?.platform) ? event.properties.platform : "missing";
        gatePlatforms[platform] = (gatePlatforms[platform] ?? 0) + 1;
      }
    }
    if (event.event_name === "paywall_viewed" && session && gates.has(session) && event.time >= gates.get(session)) passed.add(session);
    if (!user) continue;
    if (event.event_name === "home_snapshot_viewed" && !firstHome.has(user)) firstHome.set(user, event.time);
    if (event.event_name === "monitor_created" && firstHome.has(user) && event.time >= firstHome.get(user)) homeMonitor.add(user);
    if (event.event_name === "verified_trial_started" && !trials.has(user)) trials.set(user, event.time);
    if (event.event_name === "monitor_created" && trials.has(user) && !firstMonitor.has(user) && event.time >= trials.get(user)) firstMonitor.set(user, event.time);
    if (event.event_name === "trial_converted" && trials.has(user) && event.time >= trials.get(user) && !converted.has(user)) converted.set(user, event.time);
    if (event.event_name === "purchase_failed") {
      // Only normalized machine categories are rendered; never echo arbitrary export properties.
      const category = ["cancelled", "network", "store", "pending", "already_owned", "configuration", "not_allowed", "in_progress", "unknown"].includes(event.properties?.category) ? event.properties.category : "unclassified";
      failureCodes[category] = (failureCodes[category] ?? 0) + 1;
    }
  }
  const mature24h = [...trials].filter(([, at]) => at + day <= end).map(([user]) => user);
  const matureD15 = [...trials].filter(([, at]) => at + 15 * day <= end).map(([user]) => user);
  const observed24h = mature24h.filter((user) => firstMonitor.has(user) && firstMonitor.get(user) < trials.get(user) + day);
  return {
    window: { startAt: new Date(start).toISOString(), endAtExclusive: new Date(end).toISOString() },
    includedEvents: rows.length,
    gateToPaywallSessions: ratio(passed.size, gates.size),
    firstGatePlatformSessions: gatePlatforms,
    loggedInHomeToMonitorUsers: ratio(homeMonitor.size, firstHome.size),
    verifiedTrialUsers: trials.size,
    firstMonitorWithin24h: ratio(observed24h.length, mature24h.length),
    matureD15PaidConversion: ratio(matureD15.filter((user) => converted.has(user) && converted.get(user) <= trials.get(user) + 15 * day).length, matureD15.length),
    immatureTrialUsers: trials.size - matureD15.length,
    purchaseFailureCategories: failureCodes,
    decision: "OBSERVATIONAL_ONLY",
    limitations: [
      "Sessions are not people. Gate trial eligibility is unavailable before the store offer check.",
      "Only verified_trial_started and trial_converted server events count as trial/payment evidence.",
      "24h and D15 ratios include only users with complete observation windows; null is not zero.",
      "Events marked internal or missing traffic_class are excluded; unidentified QA may remain.",
      "journal_saved does not measure all manual journals stored on the device.",
      "Cohort enrollment, D7 retention and sample sufficiency require the separately registered study; this report does not declare revenue normalized."
    ]
  };
}
