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

  // Goibibo's hotel-search pages live at a stable city-slug URL. We don't
  // guess at a specific property's page (its real URL isn't derivable from
  // the name), so for a *specific* named hotel we route through a Google
  // search instead — always a valid link, and it reliably surfaces the
  // real Goibibo listing if one exists, rather than risking a broken guess.
  function goibiboCitySlug(destination) {
    var city = (destination || "").split(",")[0].trim().toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-");
    return city || "india";
  }
  function goibiboCityLink(destination) {
    return "https://www.goibibo.com/hotels/find-hotels-in-" + encode(goibiboCitySlug(destination)) + "/";
  }
  function goibiboHotelLink(hotelName, destination) {
    return "https://www.google.com/search?q=" + encode(hotelName + " " + destination + " Goibibo");
  }

  function searchLinks(destination, kind, extra) {
    var base = destination + (extra ? " " + extra : "");
    if (kind === "hotel") {
      return [
        { label: "Google Maps", url: "https://www.google.com/maps/search/?api=1&query=" + encode("hotels in " + base) },
        { label: "Booking.com", url: "https://www.booking.com/searchresults.html?ss=" + encode(destination) },
        { label: "Goibibo", url: goibiboCityLink(destination) },
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

  return { recommend: recommend, goibiboCityLink: goibiboCityLink, goibiboHotelLink: goibiboHotelLink };
})(window.TP_DATA);
