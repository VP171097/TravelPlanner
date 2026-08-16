/* ============================================================
   itinerary.js — the "smart" day-by-day itinerary generator.
   Rule-based (not a live AI call) so it works fully offline:
   scores the activity bank against the trip's interests, then
   fills each day's slots without repeating an activity until
   the pool is exhausted.

   Blocks carry a clock "startTime" (HH:MM) in addition to the
   morning/afternoon/evening bucket used for scoring — day 1 is
   scheduled around the trip's arrival time (if given), later days
   use a normal full-day schedule. Times are just a starting
   suggestion; the UI lets the traveler edit any block's time.
   ============================================================ */

window.TP_ITINERARY = (function (DATA) {
  "use strict";

  var SLOT_DEFAULT_TIMES = { morning: "09:00", afternoon: "14:00", evening: "18:30" };
  var BLOCK_SPACING_MIN = 180; // ~3h between blocks by default

  function computeDayCount(startDate, endDate) {
    var start = new Date(startDate + "T00:00:00");
    var end = new Date(endDate + "T00:00:00");
    var diff = Math.round((end - start) / 86400000) + 1;
    if (isNaN(diff) || diff < 1) diff = 1;
    return Math.min(diff, 30); // sanity cap
  }

  // Extracts "YYYY-MM-DD" from a Date using its LOCAL calendar date, not
  // toISOString()'s UTC conversion — for timezones ahead of UTC (e.g. IST,
  // UTC+5:30), a local midnight Date's UTC representation is still the
  // *previous* calendar day, so .toISOString().slice(0,10) silently rolls
  // every date back by one.
  function localDateStr(d) {
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
  }

  function clampMinutes(mins) { return Math.max(0, Math.min(23 * 60 + 59, mins)); }
  function toMinutes(hhmm) {
    var p = (hhmm || "09:00").split(":").map(Number);
    return (p[0] || 0) * 60 + (p[1] || 0);
  }
  function fromMinutes(mins) {
    mins = clampMinutes(mins);
    var h = Math.floor(mins / 60), m = mins % 60;
    return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
  }
  function addMinutes(hhmm, delta) { return fromMinutes(toMinutes(hhmm) + delta); }

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
    var nearby = (trip.nearbyDestinations || []).filter(Boolean);
    var arrivalTime = trip.arrivalTime || null;

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

      // Day 1 is scheduled around arrival: drop any slot that would fall
      // before you've realistically checked in, and start the day's first
      // block ~75min after touchdown instead of the normal default.
      var daySlots = slotOrder;
      var firstBlockTime = SLOT_DEFAULT_TIMES[slotOrder[0]] || "09:00";
      if (d === 0 && arrivalTime) {
        var effectiveStart = addMinutes(arrivalTime, 75);
        daySlots = slotOrder.filter(function (slot) { return SLOT_DEFAULT_TIMES[slot] >= effectiveStart; });
        firstBlockTime = daySlots.length ? effectiveStart : null;
      }

      var blocks;
      if (d === 0 && arrivalTime && !daySlots.length) {
        // Arrived too late in the day for any planned activity.
        blocks = [{ time: "evening", startTime: addMinutes(arrivalTime, 45), title: "Arrival & check-in", desc: "Settle into your accommodation and rest up after traveling — a full day starts tomorrow.", cost: "free", tags: [] }];
      } else {
        var cursor = firstBlockTime;
        blocks = daySlots.map(function (slot) {
          var activity = nextFromSlot(slot, usedTitles);
          usedTitles.push(activity.title);
          var block = { time: slot, startTime: cursor, title: activity.title, desc: activity.desc, cost: activity.cost, tags: activity.tags };
          cursor = addMinutes(cursor, BLOCK_SPACING_MIN);
          return block;
        });
      }

      // Days 2+ get dedicated day trips to any nearby destinations, in order.
      var dayTripTo = null;
      if (d > 0 && nearby.length) {
        var nearbyIdx = d - 1;
        if (nearbyIdx < nearby.length) {
          dayTripTo = nearby[nearbyIdx];
          blocks = blocks.map(function (b, i) {
            return i === 0 ? Object.assign({}, b, { title: "Day trip to " + dayTripTo + ": " + b.title, desc: b.desc + " (Day trip to " + dayTripTo + " — swap in local specifics if you know them.)" }) : b;
          });
        }
      }

      days.push({
        dayNumber: d + 1,
        date: localDateStr(date),
        dayTripTo: dayTripTo,
        blocks: blocks
      });
    }
    return days;
  }

  return { generate: generate, computeDayCount: computeDayCount, addMinutes: addMinutes, SLOT_DEFAULT_TIMES: SLOT_DEFAULT_TIMES };
})(window.TP_DATA);
