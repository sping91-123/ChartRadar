const dayMs = 24 * 60 * 60 * 1000;
const snapshotViewNames = new Set(["home_snapshot_viewed", "perpetual_snapshot_viewed"]);
const userActivityNames = new Set([
  "home_snapshot_viewed",
  "home_perpetual_opened",
  "perpetual_snapshot_viewed",
  "monitor_created",
  "scenario_opened",
  "journal_saved"
]);

export function kstStudyWindow(startDateKst) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startDateKst ?? "");
  if (!match) throw new Error("startDateKst must use YYYY-MM-DD.");
  const startMs = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) - 9 * 60 * 60 * 1000;
  const start = new Date(startMs);
  if (Number.isNaN(start.getTime())) throw new Error("startDateKst is invalid.");
  return {
    start,
    week2Start: new Date(startMs + 7 * dayMs),
    end: new Date(startMs + 14 * dayMs)
  };
}

function inRange(value, start, end) {
  const time = Date.parse(value ?? "");
  return Number.isFinite(time) && time >= start.getTime() && time < end.getTime();
}

function kstDate(value) {
  const time = Date.parse(value ?? "");
  return Number.isFinite(time) ? new Date(time + 9 * 60 * 60 * 1000).toISOString().slice(0, 10) : null;
}

function userSets(userIds) {
  return new Map(userIds.map((userId) => [userId, new Set()]));
}

function incrementIf(set, condition, userId) {
  if (condition) set.add(userId);
}

export function buildPerpetualBetaReport({
  startDateKst,
  now = new Date(),
  cohortRows = [],
  events = [],
  snapshots = [],
  monitors = [],
  journals = [],
  deploymentSha = ""
}) {
  const window = kstStudyWindow(startDateKst);
  const cohortIds = cohortRows.map((row) => row.user_id).filter(Boolean);
  const uniqueIds = Array.from(new Set(cohortIds));
  const cohort = new Set(uniqueIds);
  const duplicateSubscriptions = cohortIds.length - uniqueIds.length;
  const entitlementCoversStudy = cohortRows.length > 0 && cohortRows.every((row) => Date.parse(row.current_period_end ?? "") >= window.end.getTime());
  const snapshotsById = new Map(snapshots.map((row) => [row.id, row]));
  const readyViewDays = userSets(uniqueIds);
  const week2ActivityDays = userSets(uniqueIds);
  const monitorUsers = new Set();
  const reviewUsers = new Set();
  const journeyUsers = new Set();
  const homeJourneys = new Map();
  const purchaseStarted = new Map();
  const purchaseLatencies = [];

  for (const event of events) {
    if (!cohort.has(event.user_id) || !inRange(event.occurred_at, window.start, window.end)) continue;
    const eventTime = Date.parse(event.occurred_at);
    const date = kstDate(event.occurred_at);
    if (eventTime >= window.week2Start.getTime() && userActivityNames.has(event.event_name) && date) {
      week2ActivityDays.get(event.user_id)?.add(date);
    }
    if (event.event_name === "home_perpetual_opened" && event.attribution_id) {
      homeJourneys.set(`${event.user_id}:${event.attribution_id}`, event);
    }
    if (event.event_name === "perpetual_snapshot_viewed" && event.attribution_id) {
      const home = homeJourneys.get(`${event.user_id}:${event.attribution_id}`);
      if (home && home.snapshot_id === event.snapshot_id && Date.parse(home.occurred_at) <= eventTime) journeyUsers.add(event.user_id);
    }
    if (event.event_name === "purchase_started") purchaseStarted.set(event.event_id, eventTime);
    if (event.event_name === "entitlement_activated" && event.attribution_id) {
      const startedAt = purchaseStarted.get(event.attribution_id);
      if (startedAt !== undefined && eventTime >= startedAt) purchaseLatencies.push((eventTime - startedAt) / 1000);
    }
    if (inRange(event.occurred_at, window.start, window.week2Start)) {
      const snapshot = snapshotsById.get(event.snapshot_id);
      const readyView = snapshotViewNames.has(event.event_name)
        && event.properties?.mode !== "shadow"
        && snapshot?.quality === "ready"
        && snapshot.asset === event.asset;
      if (readyView && date) readyViewDays.get(event.user_id)?.add(date);
      if (event.event_name === "scenario_opened") reviewUsers.add(event.user_id);
    }
  }

  for (const monitor of monitors) {
    if (!cohort.has(monitor.user_id)) continue;
    if (inRange(monitor.created_at, window.start, window.week2Start)) monitorUsers.add(monitor.user_id);
    if (inRange(monitor.created_at, window.week2Start, window.end)) {
      const date = kstDate(monitor.created_at);
      if (date) week2ActivityDays.get(monitor.user_id)?.add(date);
    }
  }
  for (const journal of journals) {
    if (!cohort.has(journal.user_id)) continue;
    if (inRange(journal.created_at, window.start, window.week2Start)) reviewUsers.add(journal.user_id);
    if (inRange(journal.created_at, window.week2Start, window.end)) {
      const date = kstDate(journal.created_at);
      if (date) week2ActivityDays.get(journal.user_id)?.add(date);
    }
  }

  const viewTwoDaysUsers = new Set(uniqueIds.filter((id) => (readyViewDays.get(id)?.size ?? 0) >= 2));
  const activatedUsers = new Set(uniqueIds.filter((id) => viewTwoDaysUsers.has(id) && monitorUsers.has(id) && reviewUsers.has(id)));
  const retainedUsers = new Set(uniqueIds.filter((id) => (week2ActivityDays.get(id)?.size ?? 0) >= 3));
  const elapsedDays = Math.max(0, Math.min(14, Math.floor((now.getTime() - window.start.getTime()) / dayMs)));
  const complete = now.getTime() >= window.end.getTime();
  const withinTwoMinutes = purchaseLatencies.filter((seconds) => seconds <= 120).length;

  return {
    study: {
      startKst: startDateKst,
      startAt: window.start.toISOString(),
      week2StartAt: window.week2Start.toISOString(),
      endAt: window.end.toISOString(),
      asOf: now.toISOString(),
      elapsedDays,
      complete,
      deploymentSha: /^[0-9a-f]{40}$/i.test(deploymentSha) ? deploymentSha : null
    },
    gates: {
      cohortExactly12: uniqueIds.length === 12,
      duplicateSubscriptionsZero: duplicateSubscriptions === 0,
      entitlementCoversStudy,
      finalAvailable: complete
    },
    funnel: {
      cohort: uniqueIds.length,
      readySnapshotTwoDays: viewTwoDaysUsers.size,
      monitorCreated: monitorUsers.size,
      alertOpenedOrJournalSaved: reviewUsers.size,
      activated: activatedUsers.size,
      week2ThreeDays: retainedUsers.size,
      homeToPerpetualSameJourney: journeyUsers.size
    },
    targets: {
      activated: { actual: activatedUsers.size, required: 8, passed: activatedUsers.size >= 8 },
      week2ThreeDays: { actual: retainedUsers.size, required: 6, passed: retainedUsers.size >= 6 }
    },
    purchaseEntitlementSlo: {
      samples: purchaseLatencies.length,
      withinTwoMinutes,
      rate: purchaseLatencies.length ? withinTwoMinutes / purchaseLatencies.length : null,
      status: purchaseLatencies.length === 0 ? "not_applicable" : purchaseLatencies.length < 100 ? "provisional" : "measured"
    }
  };
}
