/* ============================================================
   storage.js — all persistence lives in localStorage on-device.
   Nothing here ever leaves the phone/browser.
   ============================================================ */

window.TP_STORE = (function () {
  "use strict";

  var KEY_TRIPS = "tp_trips_v1";
  var KEY_ACTIVE = "tp_active_trip_v1";

  function uid() {
    return "t_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function readAll() {
    try {
      var raw = localStorage.getItem(KEY_TRIPS);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.warn("TravelPlanner: failed to read trips, resetting.", e);
      return {};
    }
  }

  function writeAll(trips) {
    try {
      localStorage.setItem(KEY_TRIPS, JSON.stringify(trips));
      return true;
    } catch (e) {
      console.error("TravelPlanner: failed to save (storage full or unavailable).", e);
      return false;
    }
  }

  function listTrips() {
    var trips = readAll();
    return Object.keys(trips)
      .map(function (id) { return trips[id]; })
      .sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
  }

  function getTrip(id) {
    var trips = readAll();
    return trips[id] || null;
  }

  function saveTrip(trip) {
    var trips = readAll();
    if (!trip.id) trip.id = uid();
    trip.updatedAt = Date.now();
    trips[trip.id] = trip;
    writeAll(trips);
    return trip;
  }

  function deleteTrip(id) {
    var trips = readAll();
    delete trips[id];
    writeAll(trips);
    if (getActiveTripId() === id) setActiveTripId(null);
  }

  function getActiveTripId() {
    return localStorage.getItem(KEY_ACTIVE) || null;
  }

  function setActiveTripId(id) {
    if (id) localStorage.setItem(KEY_ACTIVE, id);
    else localStorage.removeItem(KEY_ACTIVE);
  }

  return {
    listTrips: listTrips,
    getTrip: getTrip,
    saveTrip: saveTrip,
    deleteTrip: deleteTrip,
    getActiveTripId: getActiveTripId,
    setActiveTripId: setActiveTripId
  };
})();
