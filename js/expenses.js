/* ============================================================
   expenses.js — actual spend tracking, kept separate from the
   budget *estimate* (budget.js) so you can compare planned vs
   real spend. Everything here is just arithmetic over
   trip.expenses[]; persistence lives in storage.js as usual.
   ============================================================ */

window.TP_EXPENSES = (function (DATA) {
  "use strict";

  var CATEGORIES = [
    { id: "lodging", label: "🏨 Lodging" },
    { id: "food", label: "🍽️ Food & drink" },
    { id: "transport", label: "🚌 Local transport" },
    { id: "activities", label: "🎟️ Activities & tours" },
    { id: "flights", label: "✈️ Flights" },
    { id: "misc", label: "🧳 Misc" },
    { id: "other", label: "➕ Other" }
  ];

  function categoryLabel(id) {
    var found = CATEGORIES.filter(function (c) { return c.id === id; })[0];
    return found ? found.label : id;
  }

  function round2(n) { return Math.round(n * 100) / 100; }

  // budgetEstimate: the object returned by TP_BUDGET.estimate(trip) — used
  // to show spent-vs-planned per category. Optional; pass null to skip.
  function summarize(trip, budgetEstimate) {
    var expenses = (trip.expenses || []).slice().sort(function (a, b) {
      return (b.date || "").localeCompare(a.date || "") || (b.createdAt || 0) - (a.createdAt || 0);
    });

    var estByCategory = {};
    if (budgetEstimate) {
      budgetEstimate.rows.forEach(function (r) { estByCategory[r.key] = r.total; });
      estByCategory.flights = budgetEstimate.flightsTotal;
    }

    var byCategory = {};
    CATEGORIES.forEach(function (c) { byCategory[c.id] = 0; });
    var totalSpent = 0;
    expenses.forEach(function (e) {
      var amt = parseFloat(e.amount) || 0;
      byCategory[e.category] = (byCategory[e.category] || 0) + amt;
      totalSpent += amt;
    });
    totalSpent = round2(totalSpent);

    var categoryRows = CATEGORIES.map(function (c) {
      var spent = round2(byCategory[c.id] || 0);
      var planned = estByCategory.hasOwnProperty(c.id) ? round2(estByCategory[c.id]) : null;
      return {
        id: c.id,
        label: c.label,
        spent: spent,
        planned: planned,
        pct: planned && planned > 0 ? Math.min(Math.round((spent / planned) * 100), 999) : null,
        over: planned !== null && spent > planned
      };
    }).filter(function (r) { return r.spent > 0 || r.planned !== null; });

    var plannedTotal = budgetEstimate ? round2(budgetEstimate.grandTotal) : null;

    return {
      expenses: expenses,
      totalSpent: totalSpent,
      plannedTotal: plannedTotal,
      remaining: plannedTotal !== null ? round2(plannedTotal - totalSpent) : null,
      pct: plannedTotal ? Math.min(Math.round((totalSpent / plannedTotal) * 100), 999) : null,
      categoryRows: categoryRows
    };
  }

  return { CATEGORIES: CATEGORIES, categoryLabel: categoryLabel, summarize: summarize };
})(window.TP_DATA);
