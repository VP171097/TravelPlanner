/* ============================================================
   itinerary.js — the "smart" day-by-day itinerary generator.
   Rule-based (not a live AI call) so it works fully offline:
   scores the activity bank against the trip's interests, then
   fills each day's slots without repeating an activity until
   the pool is exhausted.
   ============================================================ */

window.TP_ITINERARY = (function (DATA) {
  "use strict";

  function computeDayCount(startDate, endDate) {
    var start = new Date(startDate + "T00:00:00");
    var end = new Date(endDate + "T00:00:00");
    var diff = Math.round((end - start) / 86400000) + 1;
    if (isNaN(diff) || diff < 1) diff = 1;
    return Math.min(diff, 30); // sanity cap
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function score(activity, interests) {
    var overlap = activity.tags.filter(function (t) { return interests.indexOf(t) !== -1; }).length;
    return overlap + Math.random() * 0.5; // small jitter so ties don't feel robotic
  }

  function poolFor(timeSlot, interests) {
    var pool = DATA.ACTIVITIES.filter(function (a) { return a.time === timeSlot || a.time === "any"; });
    return shuffle(pool).sort(function (a, b) { return score(b, interests) - score(a, interests); });
  }

  function slotsForPace(pace) {
    if (pace === "relaxed") return ["morning", "evening"];
    if (pace === "packed") return ["morning", "afternoon", "evening", "afternoon"];
    return ["morning", "afternoon", "evening"]; // balanced (default)
  }

  function generate(trip) {
    var dayCount = computeDayCount(trip.startDate, trip.endDate);
    var interests = (trip.interests && trip.interests.length) ? trip.interests : ["sightseeing", "food", "culture"];
    var slotOrder = slotsForPace(trip.pace);

    // Build one scored pool per distinct time slot we need, plus cursors.
    var pools = {};
    var cursors = {};
    slotOrder.forEach(function (slot) {
      if (!pools[slot]) { pools[slot] = poolFor(slot, interests); cursors[slot] = 0; }
    });

    function nextFromSlot(slot, usedTitles) {
      var pool = pools[slot];
      var tries = 0;
      while (tries < pool.length) {
        if (cursors[slot] >= pool.length) {
          pools[slot] = poolFor(slot, interests); // reshuffle/rescan for variety on long trips
          pool = pools[slot];
          cursors[slot] = 0;
        }
        var candidate = pool[cursors[slot]];
        cursors[slot]++;
        tries++;
        if (usedTitles.indexOf(candidate.title) === -1) return candidate;
      }
      return pool[0]; // fallback: allow a repeat rather than an empty slot
    }

    var days = [];
    var start = new Date(trip.startDate + "T00:00:00");
    for (var d = 0; d < dayCount; d++) {
      var date = new Date(start.getTime() + d * 86400000);
      var usedTitles = [];
      var blocks = slotOrder.map(function (slot) {
        var activity = nextFromSlot(slot, usedTitles);
        usedTitles.push(activity.title);
        return { time: slot, title: activity.title, desc: activity.desc, cost: activity.cost, tags: activity.tags };
      });
      days.push({
        dayNumber: d + 1,
        date: date.toISOString().slice(0, 10),
        blocks: blocks
      });
    }
    return days;
  }

  return { generate: generate, computeDayCount: computeDayCount };
})(window.TP_DATA);
