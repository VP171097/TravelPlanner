/* ============================================================
   budget.js — budget estimator.
   Built from per-day cost-tier baselines scaled by a region
   cost-of-living multiplier. These are ballpark planning figures,
   not live prices — always sanity-check against current quotes.
   ============================================================ */

window.TP_BUDGET = (function (DATA, ITIN) {
  "use strict";

  function getRegion(regionId) {
    var found = DATA.REGION_MULTIPLIERS.filter(function (r) { return r.id === regionId; })[0];
    return found || DATA.REGION_MULTIPLIERS[0];
  }

  function getCurrency(code) {
    var found = DATA.CURRENCIES.filter(function (c) { return c.code === code; })[0];
    return found || DATA.CURRENCIES[0]; // USD
  }

  function estimate(trip) {
    var days = ITIN.computeDayCount(trip.startDate, trip.endDate);
    var nights = Math.max(days - 1, 1);
    var travelers = Math.max(parseInt(trip.travelers, 10) || 1, 1);
    var rooms = Math.max(parseInt(trip.rooms, 10) || Math.ceil(travelers / 2), 1);
    var tiers = DATA.COST_TIERS[trip.budgetTier] || DATA.COST_TIERS.mid;
    var region = getRegion(trip.regionId);
    var currency = getCurrency(trip.currency);
    // Cost tiers are USD baselines: scale by the region's relative
    // cost-of-living, then convert to the trip's display currency.
    var mult = region.mult * currency.rate;
    // Flight estimate is a direct user-entered figure (already in the
    // trip's currency), so it isn't scaled like the cost-tier baselines.
    var flightPerPerson = parseFloat(trip.flightEstimate) || 0;

    var perDay = {
      lodging: tiers.lodging * mult,
      food: tiers.food * mult,
      transport: tiers.transport * mult,
      activities: tiers.activities * mult,
      misc: tiers.misc * mult
    };

    var rows = [
      { key: "lodging", label: "🏨 Lodging", perUnit: perDay.lodging, units: nights * rooms, unitLabel: nights + " night(s) × " + rooms + " room(s)" },
      { key: "food", label: "🍽️ Food & drink", perUnit: perDay.food, units: days * travelers, unitLabel: days + " day(s) × " + travelers + " traveler(s)" },
      { key: "transport", label: "🚌 Local transport", perUnit: perDay.transport, units: days * travelers, unitLabel: days + " day(s) × " + travelers + " traveler(s)" },
      { key: "activities", label: "🎟️ Activities & tours", perUnit: perDay.activities, units: days * travelers, unitLabel: days + " day(s) × " + travelers + " traveler(s)" },
      { key: "misc", label: "🧳 Misc / buffer", perUnit: perDay.misc, units: days * travelers, unitLabel: days + " day(s) × " + travelers + " traveler(s)" }
    ];

    rows.forEach(function (r) { r.total = round2(r.perUnit * r.units); });

    var flightsTotal = round2(flightPerPerson * travelers);
    var subtotal = rows.reduce(function (s, r) { return s + r.total; }, 0);
    var grandTotal = round2(subtotal + flightsTotal);

    return {
      days: days,
      nights: nights,
      travelers: travelers,
      rooms: rooms,
      region: region,
      currency: currency,
      rows: rows,
      flightsTotal: flightsTotal,
      subtotal: round2(subtotal),
      grandTotal: grandTotal,
      perTraveler: round2(grandTotal / travelers),
      perDay: round2(grandTotal / days)
    };
  }

  function round2(n) { return Math.round(n * 100) / 100; }

  return { estimate: estimate, getRegion: getRegion, getCurrency: getCurrency };
})(window.TP_DATA, window.TP_ITINERARY);
