/* ============================================================
   app.js — UI wiring: navigation, forms, rendering, persistence.
   Everything below runs entirely client-side.
   ============================================================ */

(function (DATA, STORE, ITIN, BUDGET, EXPENSES, PLACES, PACKING, AI) {
  "use strict";

  var state = { activeTripId: STORE.getActiveTripId(), editingTripId: null };

  // ---------- small DOM helpers ----------
  function $(sel) { return document.querySelector(sel); }
  function $all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      if (attrs[k] === null || attrs[k] === undefined) return; // e.g. `selected: cond ? "selected" : null` — omit, don't stringify to "null"
      if (k === "class") e.className = attrs[k];
      else if (k === "html") e.innerHTML = attrs[k];
      else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }
  function fmtMoney(n, symbol) {
    symbol = symbol || "$";
    return symbol + Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  // Builds a <select> of regions/countries grouped into <optgroup>s by
  // DATA.REGION_MULTIPLIERS' "group" field (e.g. "Asia", "Europe", ...).
  function buildRegionSelect(id, selectedId) {
    var sel = el("select", { id: id });
    var groups = {};
    var order = [];
    DATA.REGION_MULTIPLIERS.forEach(function (r) {
      var g = r.group || "Other";
      if (!groups[g]) { groups[g] = []; order.push(g); }
      groups[g].push(r);
    });
    order.forEach(function (g) {
      var optgroup = el("optgroup", { label: g });
      groups[g].forEach(function (r) {
        optgroup.appendChild(el("option", { value: r.id, selected: r.id === selectedId ? "selected" : null }, [r.label]));
      });
      sel.appendChild(optgroup);
    });
    return sel;
  }
  function buildCurrencySelect(id, selectedCode) {
    return el("select", { id: id }, DATA.CURRENCIES.map(function (c) {
      return el("option", { value: c.code, selected: c.code === selectedCode ? "selected" : null }, [c.code + " — " + c.label + " (" + c.symbol + ")"]);
    }));
  }
  // Local calendar date, not toISOString()'s UTC conversion — for
  // timezones ahead of UTC (e.g. IST, UTC+5:30) that silently rolls
  // "today" back a day for part of the day.
  function todayStr() {
    var d = new Date();
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
  }
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

  // ---------- AI generation (with automatic fallback to the offline generators) ----------
  function withAIFallback(aiFactory, ruleFactory, label) {
    if (AI.isConfigured()) {
      return aiFactory()
        .then(function (result) { return { result: result, source: "ai" }; })
        .catch(function (err) {
          console.warn(label + " failed, falling back to built-in generator:", err);
          toast((label || "AI") + " failed — used the built-in generator instead");
          return { result: ruleFactory(), source: "rule" };
        });
    }
    return Promise.resolve({ result: ruleFactory(), source: "rule" });
  }

  function generateItineraryForTrip(trip) {
    var dayCount = ITIN.computeDayCount(trip.startDate, trip.endDate);
    return withAIFallback(
      function () { return AI.generateItinerary(trip, dayCount); },
      function () { return ITIN.generate(trip); },
      "AI itinerary"
    );
  }

  function generatePackingForTrip(trip) {
    var dayCount = ITIN.computeDayCount(trip.startDate, trip.endDate);
    return withAIFallback(
      function () {
        return AI.generatePacking(trip, dayCount).then(function (items) {
          return items.map(function (item) {
            return { id: PACKING.slug(item.category + "-" + item.text), category: item.category, text: item.text };
          });
        });
      },
      function () { return PACKING.generate(trip); },
      "AI packing list"
    );
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
    var regionGroups = {};
    var regionOrder = [];
    DATA.REGION_MULTIPLIERS.forEach(function (r) {
      var g = r.group || "Other";
      if (!regionGroups[g]) { regionGroups[g] = []; regionOrder.push(g); }
      regionGroups[g].push(r);
    });
    regionOrder.forEach(function (g) {
      var optgroup = el("optgroup", { label: g });
      regionGroups[g].forEach(function (r) {
        optgroup.appendChild(el("option", { value: r.id }, [r.label]));
      });
      regionSel.appendChild(optgroup);
    });
    // Picking a country auto-suggests its currency (only while the
    // currency field is still untouched, so it doesn't clobber a
    // deliberate manual choice).
    regionSel.addEventListener("change", function () {
      var region = DATA.REGION_MULTIPLIERS.filter(function (r) { return r.id === regionSel.value; })[0];
      var currencySel = $("#f-currency");
      if (region && region.currency && currencySel && !currencySel.dataset.touched) {
        currencySel.value = region.currency;
      }
    });

    var currencySel = $("#f-currency");
    DATA.CURRENCIES.forEach(function (c) {
      currencySel.appendChild(el("option", { value: c.code }, [c.code + " — " + c.label + " (" + c.symbol + ")"]));
    });
    currencySel.addEventListener("change", function () { currencySel.dataset.touched = "1"; });

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

  // ---------- nearby-destinations chip input (freeform add/remove) ----------
  function getNearbyDestinations() {
    return $all("#f-nearby-chips .chip").map(function (c) { return c.dataset.name; });
  }
  function setNearbyDestinations(names) {
    var container = $("#f-nearby-chips");
    container.innerHTML = "";
    (names || []).forEach(function (name) { addNearbyChip(name); });
  }
  function addNearbyChip(name) {
    name = (name || "").trim();
    if (!name) return;
    if (getNearbyDestinations().indexOf(name) !== -1) return; // no dupes
    var chip = el("button", { type: "button", class: "chip", "data-name": name, title: "Tap to remove" }, [name + " ✕"]);
    chip.addEventListener("click", function () { chip.remove(); });
    $("#f-nearby-chips").appendChild(chip);
  }
  $("#btn-add-nearby").addEventListener("click", function () {
    var input = $("#f-nearby-input");
    addNearbyChip(input.value);
    input.value = "";
    input.focus();
  });
  $("#f-nearby-input").addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); $("#btn-add-nearby").click(); }
  });

  // ---------- trip form (create/edit) ----------
  function openNewTripForm() {
    state.editingTripId = null;
    $("#trip-form").reset();
    $("#f-id").value = "";
    setSelectedInterests([]);
    setNearbyDestinations([]);
    $("#f-arrival-time").value = "";
    $("#f-region").value = "global";
    $("#f-currency").value = "USD";
    delete $("#f-currency").dataset.touched;
    $("#f-climate").value = "mixed";
    $("#f-trip-type").value = "city";
    $("#trip-form-title").textContent = "New trip";
    $("#btn-delete-trip").classList.add("hidden");
    var today = todayStr();
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
    $("#f-currency").value = trip.currency || "USD";
    $("#f-currency").dataset.touched = "1"; // don't let a region change silently override an existing trip's currency
    $("#f-climate").value = trip.climate || "mixed";
    $("#f-trip-type").value = trip.tripType || "city";
    $("#f-flight").value = trip.flightEstimate || "";
    $("#f-rooms").value = trip.rooms || "";
    $("#f-arrival-time").value = trip.arrivalTime || "";
    $("#f-ai-instructions").value = trip.aiInstructions || "";
    setSelectedInterests(trip.interests);
    setNearbyDestinations(trip.nearbyDestinations);
    $("#trip-form-title").textContent = "Edit trip";
    $("#btn-delete-trip").classList.remove("hidden");
    $("#trip-form-overlay").classList.remove("hidden");
  }

  function closeTripForm() { $("#trip-form-overlay").classList.add("hidden"); }

  $("#btn-new-trip").addEventListener("click", openNewTripForm);
  $("#btn-new-trip-2").addEventListener("click", openNewTripForm);
  $("#btn-close-form").addEventListener("click", closeTripForm);

  $("#trip-form").addEventListener("submit", async function (e) {
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
    trip.currency = $("#f-currency").value || "USD";
    trip.climate = $("#f-climate").value;
    trip.tripType = $("#f-trip-type").value;
    trip.interests = getSelectedInterests();
    trip.flightEstimate = $("#f-flight").value ? parseFloat($("#f-flight").value) : 0;
    trip.rooms = $("#f-rooms").value ? parseInt($("#f-rooms").value, 10) : null;
    trip.arrivalTime = $("#f-arrival-time").value || null;
    trip.nearbyDestinations = getNearbyDestinations();
    trip.aiInstructions = $("#f-ai-instructions").value.trim();

    var submitBtn = $("#trip-form button[type=submit]");
    var usingAI = AI.isConfigured();
    submitBtn.disabled = true;
    submitBtn.textContent = usingAI ? "✨ Asking Gemini…" : "Saving…";

    // (Re)generate content that depends on these inputs — tries AI first
    // (if configured), falls back to the built-in generators automatically.
    var itinRes, packRes;
    try {
      itinRes = await generateItineraryForTrip(trip);
      trip.itinerary = itinRes.result;
      packRes = await generatePackingForTrip(trip);
      trip.packing = PACKING.merge(packRes.result, trip.packing);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Save trip";
    }

    var saved = STORE.saveTrip(trip);
    state.activeTripId = saved.id;
    STORE.setActiveTripId(saved.id);
    closeTripForm();
    toast(itinRes.source === "ai" ? "Trip saved — ✨ AI itinerary" : "Trip saved");
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
  function blockClockTime(block) {
    return block.startTime || ITIN.SLOT_DEFAULT_TIMES[block.time] || "09:00";
  }

  function renderItinerary() {
    var container = $("#itinerary-content");
    container.innerHTML = "";
    var trip = state.activeTripId ? STORE.getTrip(state.activeTripId) : null;
    if (!trip) { renderNoTripPrompt("view-itinerary"); return; }
    if (!trip.itinerary || !trip.itinerary.length) trip.itinerary = ITIN.generate(trip);

    if (trip.arrivalTime) {
      container.appendChild(el("p", { class: "disclaimer" }, [
        "Day 1 is scheduled around your " + trip.arrivalTime + " arrival. Every block's time is editable below — nudge anything to fit your actual plans."
      ]));
    }

    trip.itinerary.forEach(function (day) {
      var titleParts = ["Day " + day.dayNumber + " · " + fmtDateShort(day.date)];
      var dayCard = el("div", { class: "card day-card" }, [
        el("h3", {}, titleParts.concat(day.dayTripTo ? [el("span", { class: "tag-pill", style: "margin-left:8px;" }, ["📍 Day trip: " + day.dayTripTo])] : []))
      ]);
      day.blocks.forEach(function (block) {
        var timeInput = el("input", { type: "time", value: blockClockTime(block), class: "block-time-input" });
        timeInput.addEventListener("change", function () {
          block.startTime = timeInput.value;
          STORE.saveTrip(trip);
        });
        dayCard.appendChild(el("div", { class: "block-row" }, [
          el("div", { class: "block-time" }, [timeInput]),
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

  // ---------- AI edit itinerary (free-form instructions) ----------
  // No offline equivalent — the rule-based generator can't interpret
  // free-form instructions — so this is AI-only. On failure the existing
  // itinerary is left untouched rather than silently discarded.
  function openAiEditOverlay() {
    var trip = state.activeTripId ? STORE.getTrip(state.activeTripId) : null;
    if (!trip) { toast("Select or create a trip first"); return; }
    if (!AI.isConfigured()) {
      toast("AI edit needs AI mode — configure your Gemini key first");
      openAiSettings();
      return;
    }
    $("#f-ai-edit-instruction").value = "";
    $("#ai-edit-status").textContent = "";
    $("#ai-edit-overlay").classList.remove("hidden");
    $("#f-ai-edit-instruction").focus();
  }
  function closeAiEditOverlay() { $("#ai-edit-overlay").classList.add("hidden"); }

  $("#btn-ai-edit-itinerary").addEventListener("click", openAiEditOverlay);
  $("#btn-close-ai-edit").addEventListener("click", closeAiEditOverlay);
  $("#btn-ai-edit-cancel").addEventListener("click", closeAiEditOverlay);

  $("#btn-ai-edit-apply").addEventListener("click", async function () {
    var trip = state.activeTripId ? STORE.getTrip(state.activeTripId) : null;
    if (!trip) return;
    var instruction = $("#f-ai-edit-instruction").value.trim();
    if (!instruction) { toast("Enter an instruction first"); return; }

    var btn = $("#btn-ai-edit-apply");
    var originalLabel = btn.textContent;
    var status = $("#ai-edit-status");
    btn.disabled = true;
    btn.textContent = "✨ Updating…";
    status.textContent = "";
    try {
      var updated = await AI.editItinerary(trip, trip.itinerary || [], instruction);
      trip.itinerary = updated;
      STORE.saveTrip(trip);
      renderItinerary();
      closeAiEditOverlay();
      toast("✨ Itinerary updated");
    } catch (err) {
      console.warn("AI itinerary edit failed:", err);
      status.textContent = "❌ " + err.message + " — your itinerary wasn't changed.";
    } finally {
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  });

  $("#btn-regen-itinerary").addEventListener("click", async function () {
    var trip = state.activeTripId ? STORE.getTrip(state.activeTripId) : null;
    if (!trip) return;
    var btn = $("#btn-regen-itinerary");
    var originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = AI.isConfigured() ? "✨ Asking Gemini…" : "Regenerating…";
    try {
      var res = await generateItineraryForTrip(trip);
      trip.itinerary = res.result;
      STORE.saveTrip(trip);
      renderItinerary();
      toast(res.source === "ai" ? "✨ AI itinerary regenerated" : "Itinerary regenerated");
    } finally {
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
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
    var regionSel = buildRegionSelect("b-region", trip.regionId || "global");
    var currencySel = buildCurrencySelect("b-currency", est.currency.code);
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
    controls.appendChild(el("div", { class: "field-row" }, [
      el("label", { class: "field" }, [el("span", {}, ["Currency"]), currencySel]),
      el("label", { class: "field" }, [el("span", {}, ["Flight est. per person (" + est.currency.symbol + ")"]), flightInput])
    ]));
    container.appendChild(controls);

    // Picking a country here auto-suggests its currency too, same as the trip form.
    regionSel.addEventListener("change", function () {
      var region = DATA.REGION_MULTIPLIERS.filter(function (r) { return r.id === regionSel.value; })[0];
      if (region && region.currency) currencySel.value = region.currency;
    });

    function onControlsChange() {
      trip.budgetTier = tierSel.value;
      trip.regionId = regionSel.value;
      trip.currency = currencySel.value;
      trip.travelers = parseInt(travelersInput.value, 10) || 1;
      trip.rooms = parseInt(roomsInput.value, 10) || null;
      trip.flightEstimate = parseFloat(flightInput.value) || 0;
      STORE.saveTrip(trip);
      renderBudget();
      renderHeader();
    }
    [tierSel, regionSel, currencySel, travelersInput, roomsInput, flightInput].forEach(function (input) {
      input.addEventListener("change", onControlsChange);
    });

    var sym = est.currency.symbol;
    var totalCard = el("div", { class: "card" });
    totalCard.appendChild(el("div", { class: "budget-total" }, [
      el("div", { class: "amount" }, [fmtMoney(est.grandTotal, sym)]),
      el("div", { class: "label" }, ["Estimated total (" + est.region.label + ")"])
    ]));
    totalCard.appendChild(el("div", { class: "budget-sub" }, [
      el("span", {}, [fmtMoney(est.perTraveler, sym) + " / traveler"]),
      el("span", {}, [fmtMoney(est.perDay, sym) + " / day"])
    ]));
    est.rows.forEach(function (r) {
      totalCard.appendChild(el("div", { class: "budget-row" }, [
        el("div", {}, [
          el("div", { class: "row-label" }, [r.label]),
          el("div", { class: "row-sub" }, [r.unitLabel + " × " + fmtMoney(r.perUnit, sym)])
        ]),
        el("div", { class: "row-amount" }, [fmtMoney(r.total, sym)])
      ]));
    });
    if (est.flightsTotal > 0) {
      totalCard.appendChild(el("div", { class: "budget-row" }, [
        el("div", { class: "row-label" }, ["✈️ Flights (entered estimate)"]),
        el("div", { class: "row-amount" }, [fmtMoney(est.flightsTotal, sym)])
      ]));
    }
    totalCard.appendChild(el("p", { class: "disclaimer" }, [
      "Ballpark planning estimate from typical per-day costs × a regional cost-of-living multiplier, converted at an approximate static exchange rate — not live pricing or live rates. Adjust the controls above, and check real quotes for lodging/flights before booking."
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
    var sym = est.currency.symbol;

    // -- add-expense form --
    var formCard = el("div", { class: "card" });
    var amountInput = el("input", { type: "number", min: "0", step: "0.01", placeholder: "Amount (" + sym + ")" });
    var catSelect = el("select", {}, EXPENSES.CATEGORIES.map(function (c) { return el("option", { value: c.id }, [c.label]); }));
    var noteInput = el("input", { type: "text", placeholder: "Note (optional)" });
    var dateInput = el("input", { type: "date", value: todayStr() });
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
        date: dateInput.value || todayStr(),
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
      el("div", { class: "amount" + (overBudget ? " over" : "") }, [fmtMoney(sum.totalSpent, sym)]),
      el("div", { class: "label" }, ["Spent so far"]),
      sum.plannedTotal !== null ? el("div", { class: "vs-planned" }, [
        "of " + fmtMoney(sum.plannedTotal, sym) + " estimated · " +
        (sum.remaining >= 0 ? fmtMoney(sum.remaining, sym) + " remaining" : fmtMoney(Math.abs(sum.remaining), sym) + " over budget")
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
              el("strong", {}, [fmtMoney(r.spent, sym)]),
              r.planned !== null ? (" / " + fmtMoney(r.planned, sym) + " planned") : " (no budget line)"
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
          el("div", { class: "exp-amount" }, [fmtMoney(e.amount, sym)]),
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

    container.appendChild(renderHotelFinder(trip));

    var rec = PLACES.recommend(trip);
    container.appendChild(el("p", { class: "disclaimer" }, [
      "These are typical place profiles for your budget level, not live listings — tap a link to pull up real, current options near " + rec.destination + "."
    ]));

    container.appendChild(el("div", { class: "places-subhead" }, ["Hotel types to look for"]));
    rec.hotels.forEach(function (h) { container.appendChild(renderPlaceCard(h)); });

    container.appendChild(el("div", { class: "places-subhead" }, ["Restaurant types to look for"]));
    rec.restaurants.forEach(function (r) { container.appendChild(renderPlaceCard(r)); });
  }

  // AI-only: real, specifically-named hotels near a landmark, sorted
  // ascending by distance, within a price band — the offline generator
  // has no way to know actual named properties or their real distances,
  // so this needs AI mode configured.
  function renderHotelFinder(trip) {
    var card = el("div", { class: "card" });
    card.appendChild(el("div", { class: "places-subhead", style: "margin-top:0;" }, ["🔎 Find specific hotels"]));

    if (!AI.isConfigured()) {
      card.appendChild(el("p", { class: "disclaimer" }, [
        "Real, named hotel suggestions — sorted by distance from a landmark, filtered by your price range — need AI mode. The built-in generator below only knows generic hotel " +
        "types, not actual properties."
      ]));
      card.appendChild(el("button", { class: "btn btn-secondary btn-sm", onclick: openAiSettings }, ["🤖 Set up AI"]));
      return card;
    }

    var est = BUDGET.estimate(trip);
    var sym = est.currency.symbol;
    var tierLodging = (DATA.COST_TIERS[trip.budgetTier] || DATA.COST_TIERS.mid).lodging;
    var defaultCenter = tierLodging * est.region.mult * est.currency.rate;

    var hs = trip.hotelSearch;
    var landmarkInput = el("input", { type: "text", placeholder: "Landmark or area, e.g. Taj Mahal", value: (hs && hs.landmark) || "" });
    var minInput = el("input", { type: "number", min: "0", placeholder: "Min " + sym + "/night", value: (hs && hs.minPrice) || "" });
    var maxInput = el("input", { type: "number", min: "0", placeholder: "Max " + sym + "/night", value: (hs && hs.maxPrice) || "" });
    var findBtn = el("button", { class: "btn btn-primary btn-block", style: "margin-top:10px;" }, ["Find hotels"]);

    card.appendChild(el("div", { class: "field-row" }, [landmarkInput]));
    card.appendChild(el("div", { class: "field-row", style: "margin-top:8px;" }, [minInput, maxInput]));
    card.appendChild(findBtn);

    var resultsWrap = el("div", { style: "margin-top:12px;" });
    card.appendChild(resultsWrap);

    function renderResults() {
      resultsWrap.innerHTML = "";
      var current = trip.hotelSearch;
      if (!current || !current.results || !current.results.length) return;
      resultsWrap.appendChild(el("p", { class: "disclaimer" }, [
        "AI-suggested from the model's own knowledge, not a live lookup — confirm price/availability before booking. Sorted by distance from \"" + current.landmark + "\"."
      ]));
      current.results.forEach(function (h) {
        resultsWrap.appendChild(el("div", { class: "card place-card" }, [
          el("h3", {}, [h.name]),
          el("p", { class: "row-sub" }, ["~" + h.distanceKm + " km from " + current.landmark]),
          el("p", {}, [h.desc]),
          el("p", {}, [fmtMoney(h.priceLow, sym) + "–" + fmtMoney(h.priceHigh, sym) + " / night"]),
          el("div", { class: "place-links" }, [
            el("a", { class: "link-chip", href: PLACES.goibiboHotelLink(h.name, trip.destination), target: "_blank", rel: "noopener" }, ["Goibibo ↗"]),
            el("a", { class: "link-chip", href: "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(h.name + " " + trip.destination), target: "_blank", rel: "noopener" }, ["Maps ↗"])
          ])
        ]));
      });
    }
    renderResults();

    findBtn.addEventListener("click", async function () {
      var landmark = landmarkInput.value.trim();
      if (!landmark) { toast("Enter a landmark or area first"); return; }
      var minPrice = minInput.value ? parseFloat(minInput.value) : Math.round(defaultCenter * 0.6);
      var maxPrice = maxInput.value ? parseFloat(maxInput.value) : Math.round(defaultCenter * 1.6);
      if (maxPrice < minPrice) { toast("Max price should be more than min"); return; }

      findBtn.disabled = true;
      var originalLabel = findBtn.textContent;
      findBtn.textContent = "✨ Asking Gemini…";
      try {
        var hotels = await AI.findHotels(trip, landmark, minPrice, maxPrice, est.currency.code);
        trip.hotelSearch = { landmark: landmark, minPrice: minPrice, maxPrice: maxPrice, results: hotels, generatedAt: Date.now() };
        STORE.saveTrip(trip);
        renderResults();
        toast(hotels.length ? "Found " + hotels.length + " hotels" : "No matches — try a wider price range");
      } catch (err) {
        console.warn("Hotel search failed:", err);
        toast("Hotel search failed: " + err.message);
      } finally {
        findBtn.disabled = false;
        findBtn.textContent = originalLabel;
      }
    });

    return card;
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

  $("#btn-regen-packing").addEventListener("click", async function () {
    var trip = state.activeTripId ? STORE.getTrip(state.activeTripId) : null;
    if (!trip) return;
    var btn = $("#btn-regen-packing");
    var originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = AI.isConfigured() ? "✨ Asking Gemini…" : "Rebuilding…";
    try {
      var res = await generatePackingForTrip(trip);
      trip.packing = PACKING.merge(res.result, trip.packing);
      STORE.saveTrip(trip);
      renderPacking();
      toast(res.source === "ai" ? "✨ AI packing list rebuilt" : "Packing list rebuilt");
    } finally {
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  });

  // ---------- AI settings ----------
  function renderAiStatus() {
    var status = $("#ai-status");
    status.textContent = AI.isConfigured()
      ? "✅ Configured — AI regenerate buttons will call Gemini."
      : "Not set — the app uses its built-in generator (no network needed).";
  }

  function openAiSettings() {
    $("#f-ai-api-key").value = AI.getApiKey();
    renderAiStatus();
    $("#ai-settings-overlay").classList.remove("hidden");
  }
  function closeAiSettings() { $("#ai-settings-overlay").classList.add("hidden"); }

  $("#btn-ai-settings").addEventListener("click", openAiSettings);
  $("#btn-close-ai-settings").addEventListener("click", closeAiSettings);

  $("#btn-ai-save").addEventListener("click", function () {
    AI.setApiKey($("#f-ai-api-key").value);
    renderAiStatus();
    toast(AI.isConfigured() ? "AI settings saved" : "AI settings cleared");
    closeAiSettings();
  });

  $("#btn-ai-clear").addEventListener("click", function () {
    AI.setApiKey("");
    $("#f-ai-api-key").value = "";
    renderAiStatus();
    toast("AI settings cleared — back to the built-in generator");
  });

  $("#btn-ai-test").addEventListener("click", async function () {
    var key = $("#f-ai-api-key").value.trim();
    if (!key) { toast("Enter an API key first"); return; }
    AI.setApiKey(key);
    var btn = $("#btn-ai-test");
    var original = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Testing…";
    var status = $("#ai-status");
    try {
      await AI.testConnection();
      status.textContent = "✅ Connected — the Gemini API key is working.";
    } catch (err) {
      status.textContent = "❌ " + err.message;
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
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

})(window.TP_DATA, window.TP_STORE, window.TP_ITINERARY, window.TP_BUDGET, window.TP_EXPENSES, window.TP_PLACES, window.TP_PACKING, window.TP_AI);
