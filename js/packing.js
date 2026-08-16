/* ============================================================
   packing.js — generates a checklist from climate + trip type +
   trip length, then merges in any custom items / checked state
   the user already saved for this trip.
   ============================================================ */

window.TP_PACKING = (function (DATA, ITIN) {
  "use strict";

  function clothingQty(days) {
    // Cap quantities on the assumption of laundry / re-wearing after ~7 days.
    var cap = Math.min(days, 7);
    return {
      tshirts: Math.max(cap, 2),
      bottoms: Math.max(Math.ceil(cap / 2), 1),
      socksUnderwear: Math.max(cap, 2)
    };
  }

  function generate(trip) {
    var days = ITIN.computeDayCount(trip.startDate, trip.endDate);
    var qty = clothingQty(days);
    var categories = {};

    function addCategory(name, items) {
      if (!categories[name]) categories[name] = [];
      items.forEach(function (item) {
        if (categories[name].indexOf(item) === -1) categories[name].push(item);
      });
    }

    Object.keys(DATA.PACKING_BASE).forEach(function (cat) { addCategory(cat, DATA.PACKING_BASE[cat]); });

    addCategory("Clothing (base)", [
      qty.tshirts + " tops/t-shirts",
      qty.bottoms + " bottoms (trousers/shorts/skirts)",
      qty.socksUnderwear + " sets of socks & underwear"
    ]);

    var climate = DATA.PACKING_CLIMATE[trip.climate] || DATA.PACKING_CLIMATE.mixed;
    Object.keys(climate).forEach(function (cat) { addCategory(cat, climate[cat]); });

    var tripType = DATA.PACKING_TRIP_TYPE[trip.tripType];
    if (tripType) {
      Object.keys(tripType).forEach(function (cat) { addCategory(cat, tripType[cat]); });
    }

    if (parseInt(trip.travelers, 10) > 1) {
      addCategory("Misc", ["Shared items checklist (chargers, meds) split between bags"]);
    }

    // Flatten to a stable ordered list of {id, category, text}
    var order = ["Documents & Money", "Electronics", "Health & Toiletries", "Clothing (base)", "Clothing (climate)", "Trip extras", "Misc"];
    var list = [];
    order.forEach(function (cat) {
      if (!categories[cat]) return;
      categories[cat].forEach(function (text) {
        list.push({ id: slug(cat + "-" + text), category: cat, text: text });
      });
    });
    // Any category not in our known order (future-proofing)
    Object.keys(categories).forEach(function (cat) {
      if (order.indexOf(cat) !== -1) return;
      categories[cat].forEach(function (text) {
        list.push({ id: slug(cat + "-" + text), category: cat, text: text });
      });
    });

    return list;
  }

  function slug(s) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  // Merge a freshly generated list with previously saved checked/custom state.
  function merge(freshList, savedList) {
    var savedById = {};
    (savedList || []).forEach(function (i) { savedById[i.id] = i; });
    var merged = freshList.map(function (item) {
      var saved = savedById[item.id];
      return { id: item.id, category: item.category, text: item.text, checked: saved ? !!saved.checked : false, custom: false };
    });
    // Preserve any custom (user-added) items that aren't part of the generator output.
    (savedList || []).forEach(function (item) {
      if (item.custom && merged.every(function (m) { return m.id !== item.id; })) {
        merged.push(item);
      }
    });
    return merged;
  }

  return { generate: generate, merge: merge, slug: slug };
})(window.TP_DATA, window.TP_ITINERARY);
