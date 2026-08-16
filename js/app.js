/* ============================================================
   app.js — UI wiring: navigation, forms, rendering, persistence.
   Everything below runs entirely client-side.
   ============================================================ */

(function (DATA, STORE, ITIN, BUDGET, EXPENSES, PLACES, PACKING) {
  "use strict";

  var state = { activeTripId: STORE.getActiveTripId(), editingTripId: null };

  // ---------- small DOM helpers ----------
  function $(sel) { return document.querySelector(sel); }
  function $all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      if (k === "class") e.className = attrs[k];
      else if (k === "html") e.innerHTML = attrs[k];
      else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }
  function fmtMoney(n) { return "$" + Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
  function fmtDate(iso) {
    try {
      var d = new Date(iso + "T00:00:00");
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch (e) { return iso; }
  }
  function fmtDateShort(iso) {
    var d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }
  function toast(msg) {
    var t = $("#toast");
    t.textContent = msg;
    t.classList.remove("hidden");
    clearTimeout(toast._h);
    toast._h = setTimeout(function () { t.classList.add("hidden"); }, 2200);
  }

  // ---------- navigation ----------
  function switchView(viewId) {
    $all(".view").forEach(function (v) { v.classList.toggle("active", v.id === viewId); });
    $all(".nav-btn").forEach(function (b) { b.classList.toggle("active", b.dataset.view === viewId); });
    if (viewId !== "view-trips" && !state.activeTripId) {
      renderNoTripPrompt(viewId);
    }
    window.scrollTo(0, 0);
  }

  function renderNoTripPrompt(viewId) {
    var map = { "view-itinerary": "#itinerary-content", "view-budget": "#budget-content", "view-expenses": "#expenses-content", "view-places": "#places-content", "view-packing": "#packing-content" };
    var target = $(map[viewId]);
    if (!target) return;
    target.innerHTML = "";
    target.appendChild(el("div", { class: "empty-state" }, [
      el("p", {}, ["Select or create a trip first."]),
      el("button", { class: "btn btn-primary", onclick: openNewTripForm }, ["＋ New trip"])
    ]));
  }

  $all(".nav-btn").forEach(function (btn) {
    btn.addEventListener("click", function () { switchView(btn.dataset.view); });
  });

  // ---------- populate static form options ----------
  function populateFormStatics() {
    var regionSel = $("#f-region");
    DATA.REGION_MULTIPLIERS.forEach(function (r) {
      regionSel.appendChild(el("option", { value: r.id }, [r.label]));
    });
    var climateSel = $("#f-climate");
    DATA.CLIMATES.forEach(function (c) {
      climateSel.appendChild(el("option", { value: c.id }, [c.label]));
    });
    var tripTypeSel = $("#f-trip-type");
    DATA.TRIP_TYPES.forEach(function (t) {
      tripTypeSel.appendChild(el("option", { value: t.id }, [t.label]));
    });
    var chipGroup = $("#f-interests");
    DATA.INTERESTS.forEach(function (i) {
      var chip = el("button", { type: "button", class: "chip", "data-id": i.id, onclick: function () { chip.classList.toggle("selected"); } }, [i.label]);
      chipGroup.appendChild(chip);
    });
  }

  function getSelectedInterests() {
    return $all("#f-interests .chip.selected").map(function (c) { return c.dataset.id; });
  }
  function setSelectedInterests(ids) {
    ids = ids || [];
    $all("#f-interests .chip").forEach(function (c) { c.classList.toggle("selected", ids.indexOf(c.dataset.id) !== -1); });
  }

  // ---------- trip form (create/edit) ----------
  function openNewTripForm() {
    state.editingTripId = null;
    $("#trip-form").reset();
    $("#f-id").value = "";
    setSelectedInterests([]);
    $("#f-region").value = "global";
    $("#f-climate").value = "mixed";
    $("#f-trip-type").value = "city";
    $("#trip-form-title").textContent = "New trip";
    $("#btn-delete-trip").classList.add("hidden");
    var today = new Date().toISOString().slice(0, 10);
    $("#f-start").value = today;
    $("#f-end").value = today;
    $("#trip-form-overlay").classList.remove("hidden");
  }

  function openEditTripForm(trip) {
    state.editingTripId = trip.id;
    $("#f-id").value = trip.id;
    $("#f-destination").value = trip.destination || "";
    $("#f-start").value = trip.startDate || "";
    $("#f-end").value = trip.endDate || "";
    $("#f-travelers").value = trip.travelers || 1;
    $("#f-budget-tier").value = trip.budgetTier || "mid";
    $("#f-pace").value = trip.pace || "balanced";
    $("#f-region").value = trip.regionId || "global";
    $("#f-climate").value = trip.climate || "mixed";
    $("#f-trip-type").value = trip.tripType || "city";
    $("#f-flight").value = trip.flightEstimate || "";
    $("#f-rooms").value = trip.rooms || "";
    setSelectedInterests(trip.interests);
    $("#trip-form-title").textContent = "Edit trip";
    $("#btn-delete-trip").classList.remove("hidden");
    $("#trip-form-overlay").classList.remove("hidden");
  }

  function closeTripForm() { $("#trip-form-overlay").classList.add("hidden"); }

  $("#btn-new-trip").addEventListener("click", openNewTripForm);
  $("#btn-new-trip-2").addEventListener("click", openNewTripForm);
  $("#btn-close-form").addEventListener("click", closeTripForm);

  $("#trip-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var start = $("#f-start").value;
    var end = $("#f-end").value;
    if (end < start) { toast("End date is before start date"); return; }

    var existing = state.editingTripId ? STORE.getTrip(state.editingTripId) : null;
    var trip = existing || {};
    trip.destination = $("#f-destination").value.trim() || "Untitled trip";
    trip.startDate = start;
    trip.endDate = end;
    trip.travelers = parseInt($("#f-travelers").value, 10) || 1;
    trip.budgetTier = $("#f-budget-tier").value;
    trip.pace = $("#f-pace").value;
    trip.regionId = $("#f-region").value;
    trip.climate = $("#f-climate").value;
    trip.tripType = $("#f-trip-type").value;
    trip.interests = getSelectedInterests();
    trip.flightEstimate = $("#f-flight").value ? parseFloat($("#f-flight").value) : 0;
    trip.rooms = $("#f-rooms").value ? parseInt($("#f-rooms").value, 10) : null;

    // (Re)generate content that depends on these inputs.
    trip.itinerary = ITIN.generate(trip);
    var freshPacking = PACKING.generate(trip);
    trip.packing = PACKING.merge(freshPacking, trip.packing);

    var saved = STORE.saveTrip(trip);
    state.activeTripId = saved.id;
    STORE.setActiveTripId(saved.id);
    closeTripForm();
    toast("Trip saved");
    renderAll();
    switchView("view-itinerary");
  });

  $("#btn-delete-trip").addEventListener("click", function () {
    if (!state.editingTripId) return;
    if (!confirm("Delete this trip? This can't be undone.")) return;
    STORE.deleteTrip(state.editingTripId);
    if (state.activeTripId === state.editingTripId) state.activeTripId = STORE.getActiveTripId();
    closeTripForm();
    toast("Trip deleted");
    renderAll();
    switchView("view-trips");
  });

  // ---------- trips list ----------
  function renderTripList() {
    var list = STORE.listTrips();
    var container = $("#trip-list");
    container.innerHTML = "";
    $("#trip-empty").classList.toggle("hidden", list.length > 0);
    list.forEach(function (trip) {
      var days = ITIN.computeDayCount(trip.startDate, trip.endDate);
      var card = el("div", { class: "card trip-card" + (trip.id === state.activeTripId ? " active-trip" : "") }, [
        el("div", {}, [
          el("h3", {}, [trip.destination]),
          el("p", {}, [fmtDate(trip.startDate) + " → " + fmtDate(trip.endDate) + " · " + days + " day(s)"]),
          el("p", {}, [trip.travelers + " traveler(s) · " + capitalize(trip.budgetTier || "mid") + " budget"]),
          el("div", { class: "trip-card-tags" }, (trip.interests || []).slice(0, 4).map(function (id) {
            var found = DATA.INTERESTS.filter(function (i) { return i.id === id; })[0];
            return el("span", { class: "tag-pill" }, [found ? found.label : id]);
          }))
        ]),
        el("button", { class: "trip-card-edit", "aria-label": "Edit trip", onclick: function (ev) { ev.stopPropagation(); openEditTripForm(trip); } }, ["✏️"])
      ]);
      card.addEventListener("click", function () {
        state.activeTripId = trip.id;
        STORE.setActiveTripId(trip.id);
        renderAll();
        switchView("view-itinerary");
      });
      container.appendChild(card);
    });
  }

  function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  // ---------- header ----------
  function renderHeader() {
    var sub = $("#active-trip-sub");
    var trip = state.activeTripId ? STORE.getTrip(state.activeTripId) : null;
    if (trip) {
      sub.textContent = trip.destination + " · " + fmtDate(trip.startDate) + " → " + fmtDate(trip.endDate);
    } else {
      sub.textContent = "No trip selected";
    }
  }

  // ---------- itinerary ----------
  function renderItinerary() {
    var container = $("#itinerary-content");
    container.innerHTML = "";
    var trip = state.activeTripId ? STORE.getTrip(state.activeTripId) : null;
    if (!trip) { renderNoTripPrompt("view-itinerary"); return; }
    if (!trip.itinerary || !trip.itinerary.length) trip.itinerary = ITIN.generate(trip);

    trip.itinerary.forEach(function (day) {
      var dayCard = el("div", { class: "card day-card" }, [
        el("h3", {}, ["Day " + day.dayNumber + " · " + fmtDateShort(day.date)])
      ]);
      day.blocks.forEach(function (block) {
        dayCard.appendChild(el("div", { class: "block-row" }, [
          el("div", { class: "block-time" }, [block.time]),
          el("div", { class: "block-body" }, [
            el("strong", {}, [block.title]),
            el("p", {}, [block.desc]),
            el("span", { class: "cost-badge" }, [block.cost])
          ])
        ]));
      });
      container.appendChild(dayCard);
    });
  }

  $("#btn-regen-itinerary").addEventListener("click", function () {
    var trip = state.activeTripId ? STORE.getTrip(state.activeTripId) : null;
    if (!trip) return;
    trip.itinerary = ITIN.generate(trip);
    STORE.saveTrip(trip);
    renderItinerary();
    toast("Itinerary regenerated");
  });

  $("#btn-share-itinerary").addEventListener("click", function () {
    var trip = state.activeTripId ? STORE.getTrip(state.activeTripId) : null;
    if (!trip || !trip.itinerary) return;
    var lines = [trip.destination + " — " + fmtDate(trip.startDate) + " to " + fmtDate(trip.endDate), ""];
    trip.itinerary.forEach(function (day) {
      lines.push("Day " + day.dayNumber + " (" + fmtDateShort(day.date) + ")");
      day.blocks.forEach(function (b) { lines.push("  " + capitalize(b.time) + ": " + b.title); });
      lines.push("");
    });
    var text = lines.join("\n");
    if (navigator.share) {
      navigator.share({ title: trip.destination + " itinerary", text: text }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () { toast("Copied to clipboard"); }).catch(function () { toast("Couldn't copy"); });
    } else {
      toast("Sharing not supported on this browser");
    }
  });

  // ---------- budget ----------
  function renderBudget() {
    var container = $("#budget-content");
    container.innerHTML = "";
    var trip = state.activeTripId ? STORE.getTrip(state.activeTripId) : null;
    if (!trip) { renderNoTripPrompt("view-budget"); return; }

    var est = BUDGET.estimate(trip);

    var controls = el("div", { class: "card budget-controls" });
    var tierSel = el("select", { id: "b-tier" }, ["budget", "mid", "luxury"].map(function (t) {
      return el("option", { value: t, selected: t === trip.budgetTier ? "selected" : null }, [capitalize(t)]);
    }));
    var regionSel = el("select", { id: "b-region" }, DATA.REGION_MULTIPLIERS.map(function (r) {
      return el("option", { value: r.id, selected: r.id === trip.regionId ? "selected" : null }, [r.label]);
    }));
    var travelersInput = el("input", { type: "number", id: "b-travelers", min: "1", value: trip.travelers || 1 });
    var roomsInput = el("input", { type: "number", id: "b-rooms", min: "1", value: est.rooms, placeholder: "auto" });
    var flightInput = el("input", { type: "number", id: "b-flight", min: "0", value: trip.flightEstimate || "", placeholder: "0" });

    controls.appendChild(el("div", { class: "field-row" }, [
      el("label", { class: "field" }, [el("span", {}, ["Budget level"]), tierSel]),
      el("label", { class: "field" }, [el("span", {}, ["Region"]), regionSel])
    ]));
    controls.appendChild(el("div", { class: "field-row" }, [
      el("label", { class: "field" }, [el("span", {}, ["Travelers"]), travelersInput]),
      el("label", { class: "field" }, [el("span", {}, ["Hotel rooms"]), roomsInput])
    ]));
    controls.appendChild(el("label", { class: "field" }, [el("span", {}, ["Flight est. per person ($)"]), flightInput]));
    container.appendChild(controls);

    function onControlsChange() {
      trip.budgetTier = tierSel.value;
      trip.regionId = regionSel.value;
      trip.travelers = parseInt(travelersInput.value, 10) || 1;
      trip.rooms = parseInt(roomsInput.value, 10) || null;
      trip.flightEstimate = parseFloat(flightInput.value) || 0;
      STORE.saveTrip(trip);
      renderBudget();
      renderHeader();
    }
    [tierSel, regionSel, travelersInput, roomsInput, flightInput].forEach(function (input) {
      input.addEventListener("change", onControlsChange);
    });

    var totalCard = el("div", { class: "card" });
    totalCard.appendChild(el("div", { class: "budget-total" }, [
      el("div", { class: "amount" }, [fmtMoney(est.grandTotal)]),
      el("div", { class: "label" }, ["Estimated total (" + est.region.label + ")"])
    ]));
    totalCard.appendChild(el("div", { class: "budget-sub" }, [
      el("span", {}, [fmtMoney(est.perTraveler) + " / traveler"]),
      el("span", {}, [fmtMoney(est.perDay) + " / day"])
    ]));
    est.rows.forEach(function (r) {
      totalCard.appendChild(el("div", { class: "budget-row" }, [
        el("div", {}, [
          el("div", { class: "row-label" }, [r.label]),
          el("div", { class: "row-sub" }, [r.unitLabel + " × " + fmtMoney(r.perUnit)])
        ]),
        el("div", { class: "row-amount" }, [fmtMoney(r.total)])
      ]));
    });
    if (est.flightsTotal > 0) {
      totalCard.appendChild(el("div", { class: "budget-row" }, [
        el("div", { class: "row-label" }, ["✈️ Flights (entered estimate)"]),
        el("div", { class: "row-amount" }, [fmtMoney(est.flightsTotal)])
      ]));
    }
    totalCard.appendChild(el("p", { class: "disclaimer" }, [
      "Ballpark planning estimate from typical per-day costs × a regional cost-of-living multiplier — not live pricing. Adjust the controls above, and check real quotes for lodging/flights before booking."
    ]));
    container.appendChild(totalCard);

    container.appendChild(el("button", { class: "btn btn-secondary btn-block", onclick: function () { switchView("view-expenses"); } }, ["💵 Track actual spend →"]));
  }

  // ---------- expenses ----------
  function renderExpenses() {
    var container = $("#expenses-content");
    container.innerHTML = "";
    var trip = state.activeTripId ? STORE.getTrip(state.activeTripId) : null;
    if (!trip) { renderNoTripPrompt("view-expenses"); return; }
    if (!trip.expenses) trip.expenses = [];

    var est = BUDGET.estimate(trip);
    var sum = EXPENSES.summarize(trip, est);

    // -- add-expense form --
    var formCard = el("div", { class: "card" });
    var amountInput = el("input", { type: "number", min: "0", step: "0.01", placeholder: "Amount ($)" });
    var catSelect = el("select", {}, EXPENSES.CATEGORIES.map(function (c) { return el("option", { value: c.id }, [c.label]); }));
    var noteInput = el("input", { type: "text", placeholder: "Note (optional)" });
    var dateInput = el("input", { type: "date", value: new Date().toISOString().slice(0, 10) });
    formCard.appendChild(el("div", { class: "expense-form-row" }, [amountInput, catSelect]));
    formCard.appendChild(el("div", { class: "expense-form-row", style: "margin-top:8px;" }, [dateInput, noteInput]));
    formCard.appendChild(el("button", { class: "btn btn-primary btn-block", style: "margin-top:10px;", onclick: function () {
      var amount = parseFloat(amountInput.value);
      if (!amount || amount <= 0) { toast("Enter an amount"); return; }
      trip.expenses.push({
        id: "e_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6),
        amount: amount,
        category: catSelect.value,
        note: noteInput.value.trim(),
        date: dateInput.value || new Date().toISOString().slice(0, 10),
        createdAt: Date.now()
      });
      STORE.saveTrip(trip);
      toast("Expense added");
      renderExpenses();
    } }, ["＋ Add expense"]));
    container.appendChild(formCard);

    // -- summary --
    var summaryCard = el("div", { class: "card" });
    var overBudget = sum.plannedTotal !== null && sum.totalSpent > sum.plannedTotal;
    summaryCard.appendChild(el("div", { class: "expense-summary" }, [
      el("div", { class: "amount" + (overBudget ? " over" : "") }, [fmtMoney(sum.totalSpent)]),
      el("div", { class: "label" }, ["Spent so far"]),
      sum.plannedTotal !== null ? el("div", { class: "vs-planned" }, [
        "of " + fmtMoney(sum.plannedTotal) + " estimated · " +
        (sum.remaining >= 0 ? fmtMoney(sum.remaining) + " remaining" : fmtMoney(Math.abs(sum.remaining)) + " over budget")
      ]) : null
    ]));
    if (sum.pct !== null) {
      summaryCard.appendChild(el("div", { class: "progress-track" }, [
        el("div", { class: "progress-fill" + (overBudget ? " over" : ""), style: "width:" + Math.min(sum.pct, 100) + "%;" })
      ]));
    }
    container.appendChild(summaryCard);

    // -- by category --
    if (sum.categoryRows.length) {
      var catCard = el("div", { class: "card" }, [el("h3", { style: "font-size:13px; text-transform:uppercase; letter-spacing:.03em; color:var(--text-muted); margin-bottom:4px;" }, ["By category"])]);
      sum.categoryRows.forEach(function (r) {
        var rowOver = r.planned !== null && r.spent > r.planned;
        var row = el("div", { class: "expense-cat-row" }, [
          el("div", { class: "cat-line" }, [
            el("span", {}, [r.label]),
            el("span", { class: "cat-amounts" }, [
              el("strong", {}, [fmtMoney(r.spent)]),
              r.planned !== null ? (" / " + fmtMoney(r.planned) + " planned") : " (no budget line)"
            ])
          ])
        ]);
        if (r.planned !== null) {
          row.appendChild(el("div", { class: "progress-track" }, [
            el("div", { class: "progress-fill" + (rowOver ? " over" : ""), style: "width:" + Math.min(r.pct, 100) + "%;" })
          ]));
        }
        catCard.appendChild(row);
      });
      container.appendChild(catCard);
    }

    // -- expense list --
    var listCard = el("div", { class: "card" }, [el("h3", { style: "font-size:13px; text-transform:uppercase; letter-spacing:.03em; color:var(--text-muted); margin-bottom:4px;" }, ["All expenses"])]);
    if (!sum.expenses.length) {
      listCard.appendChild(el("p", { class: "expenses-empty" }, ["No expenses logged yet — add your first one above."]));
    } else {
      sum.expenses.forEach(function (e) {
        listCard.appendChild(el("div", { class: "expense-list-item" }, [
          el("div", { class: "exp-main" }, [
            el("div", { class: "exp-cat" }, [EXPENSES.categoryLabel(e.category)]),
            el("div", { class: "exp-meta" }, [fmtDate(e.date) + (e.note ? " · " + e.note : "")])
          ]),
          el("div", { class: "exp-amount" }, [fmtMoney(e.amount)]),
          el("button", { class: "exp-del", "aria-label": "Delete expense", onclick: function () {
            trip.expenses = trip.expenses.filter(function (x) { return x.id !== e.id; });
            STORE.saveTrip(trip);
            renderExpenses();
          } }, ["✕"])
        ]));
      });
    }
    container.appendChild(listCard);
  }

  // ---------- places ----------
  function renderPlaces() {
    var container = $("#places-content");
    container.innerHTML = "";
    var trip = state.activeTripId ? STORE.getTrip(state.activeTripId) : null;
    if (!trip) { renderNoTripPrompt("view-places"); return; }

    var rec = PLACES.recommend(trip);
    container.appendChild(el("p", { class: "disclaimer" }, [
      "These are typical place profiles for your budget level, not live listings — tap a link to pull up real, current options near " + rec.destination + "."
    ]));

    container.appendChild(el("div", { class: "places-subhead" }, ["Hotel types to look for"]));
    rec.hotels.forEach(function (h) { container.appendChild(renderPlaceCard(h)); });

    container.appendChild(el("div", { class: "places-subhead" }, ["Restaurant types to look for"]));
    rec.restaurants.forEach(function (r) { container.appendChild(renderPlaceCard(r)); });
  }

  function renderPlaceCard(item) {
    var card = el("div", { class: "card place-card" }, [
      el("h3", {}, [item.title]),
      el("ul", {}, item.features.map(function (f) { return el("li", {}, [f]); })),
      el("div", { class: "place-links" }, item.links.map(function (l) {
        return el("a", { class: "link-chip", href: l.url, target: "_blank", rel: "noopener" }, [l.label + " ↗"]);
      }))
    ]);
    return card;
  }

  // ---------- packing ----------
  function renderPacking() {
    var container = $("#packing-content");
    container.innerHTML = "";
    var trip = state.activeTripId ? STORE.getTrip(state.activeTripId) : null;
    if (!trip) { renderNoTripPrompt("view-packing"); return; }
    if (!trip.packing || !trip.packing.length) {
      trip.packing = PACKING.generate(trip);
      STORE.saveTrip(trip);
    }

    var byCategory = {};
    var order = [];
    trip.packing.forEach(function (item) {
      if (!byCategory[item.category]) { byCategory[item.category] = []; order.push(item.category); }
      byCategory[item.category].push(item);
    });

    order.forEach(function (cat) {
      var catBlock = el("div", { class: "card packing-category" }, [el("h3", {}, [cat])]);
      byCategory[cat].forEach(function (item) {
        var row = el("div", { class: "packing-item" + (item.checked ? " checked" : "") });
        var cb = el("input", { type: "checkbox", id: "pk-" + item.id });
        cb.checked = !!item.checked;
        cb.addEventListener("change", function () {
          item.checked = cb.checked;
          row.classList.toggle("checked", cb.checked);
          STORE.saveTrip(trip);
        });
        row.appendChild(cb);
        row.appendChild(el("label", { for: "pk-" + item.id }, [item.text]));
        catBlock.appendChild(row);
      });
      container.appendChild(catBlock);
    });

    var addCard = el("div", { class: "card" });
    var addInput = el("input", { type: "text", placeholder: "Add your own item…" });
    var addRow = el("div", { class: "add-item-row" }, [
      addInput,
      el("button", { class: "btn btn-secondary btn-sm", onclick: function () {
        var text = addInput.value.trim();
        if (!text) return;
        trip.packing.push({ id: PACKING.slug("custom-" + text + "-" + Date.now()), category: "Custom", text: text, checked: false, custom: true });
        STORE.saveTrip(trip);
        addInput.value = "";
        renderPacking();
      } }, ["Add"])
    ]);
    addCard.appendChild(addRow);
    container.appendChild(addCard);
  }

  $("#btn-regen-packing").addEventListener("click", function () {
    var trip = state.activeTripId ? STORE.getTrip(state.activeTripId) : null;
    if (!trip) return;
    var fresh = PACKING.generate(trip);
    trip.packing = PACKING.merge(fresh, trip.packing);
    STORE.saveTrip(trip);
    renderPacking();
    toast("Packing list rebuilt");
  });

  // ---------- offline banner ----------
  function updateOfflineBanner() {
    $("#offline-banner").classList.toggle("hidden", navigator.onLine);
  }
  window.addEventListener("online", updateOfflineBanner);
  window.addEventListener("offline", updateOfflineBanner);

  // ---------- render everything ----------
  function renderAll() {
    renderHeader();
    renderTripList();
    renderItinerary();
    renderBudget();
    renderExpenses();
    renderPlaces();
    renderPacking();
  }

  // ---------- service worker (best-effort; needs http/https, not file://) ----------
  function registerServiceWorker() {
    if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register("service-worker.js").catch(function (err) {
        console.warn("TravelPlanner: service worker registration failed.", err);
      });
    }
  }

  // ---------- init ----------
  populateFormStatics();
  updateOfflineBanner();
  renderAll();
  registerServiceWorker();

})(window.TP_DATA, window.TP_STORE, window.TP_ITINERARY, window.TP_BUDGET, window.TP_EXPENSES, window.TP_PLACES, window.TP_PACKING);
