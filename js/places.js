/* ============================================================
   places.js — hotel & restaurant recommendations.
   The app is fully offline, so it can't know live listings or
   real current prices. Instead it gives you *archetypes* matched
   to your budget tier/interests, each with one-tap search links
   to live sources (Maps, Booking.com, TripAdvisor) for when you
   have a connection and want the real current options.
   ============================================================ */

window.TP_PLACES = (function (DATA) {
  "use strict";

  function encode(q) { return encodeURIComponent(q); }

  function searchLinks(destination, kind, extra) {
    var base = destination + (extra ? " " + extra : "");
    if (kind === "hotel") {
      return [
        { label: "Google Maps", url: "https://www.google.com/maps/search/?api=1&query=" + encode("hotels in " + base) },
        { label: "Booking.com", url: "https://www.booking.com/searchresults.html?ss=" + encode(destination) },
        { label: "TripAdvisor", url: "https://www.tripadvisor.com/Search?q=" + encode("hotels " + base) }
      ];
    }
    return [
      { label: "Google Maps", url: "https://www.google.com/maps/search/?api=1&query=" + encode("restaurants in " + base) },
      { label: "TripAdvisor", url: "https://www.tripadvisor.com/Search?q=" + encode("restaurants " + base) },
      { label: "Yelp", url: "https://www.yelp.com/search?find_desc=" + encode("Restaurants") + "&find_loc=" + encode(destination) }
    ];
  }

  function recommend(trip) {
    var destination = trip.destination || "your destination";
    var tier = trip.budgetTier || "mid";
    var hotelArch = DATA.HOTEL_ARCHETYPES[tier] || DATA.HOTEL_ARCHETYPES.mid;
    var restArch = DATA.RESTAURANT_ARCHETYPES[tier] || DATA.RESTAURANT_ARCHETYPES.mid;

    var hotels = hotelArch.map(function (h) {
      return {
        title: h.title,
        features: h.features,
        links: searchLinks(destination, "hotel")
      };
    });

    var restaurants = restArch.map(function (r) {
      return {
        title: r.title,
        features: r.features,
        links: searchLinks(destination, "restaurant")
      };
    });

    return { destination: destination, hotels: hotels, restaurants: restaurants };
  }

  return { recommend: recommend };
})(window.TP_DATA);
