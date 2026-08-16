/* ============================================================
   ai.js — optional real-AI itinerary/packing generation via the
   Gemini API, called directly from the browser.

   Unlike Anthropic's API, Google's Generative Language API sends
   CORS headers that allow browser calls from any origin, so no
   server-side relay is needed here — the app POSTs straight to
   generativelanguage.googleapis.com with the user's own API key.
   That key is stored locally (localStorage) and never leaves the
   browser except in requests to Google. Users are told to restrict
   their key by HTTP referrer in Google AI Studio so a copied key
   can't be used from anywhere else.

   If no API key is configured, or a call fails, callers should fall
   back to the offline generators in itinerary.js / packing.js — this
   module never breaks the app.
   ============================================================ */

window.TP_AI = (function () {
  "use strict";

  var KEY_API_KEY = "tp_ai_api_key";
  var MODEL = "gemini-3.7-flash"; // gemini-2.5-flash was retired for new API keys; 3.7 is its current successor
  var API_URL = "https://generativelanguage.googleapis.com/v1beta/models/" + MODEL + ":generateContent";

  function getApiKey() {
    return (localStorage.getItem(KEY_API_KEY) || "").trim();
  }
  function setApiKey(key) {
    key = (key || "").trim();
    if (key) localStorage.setItem(KEY_API_KEY, key);
    else localStorage.removeItem(KEY_API_KEY);
  }
  function isConfigured() {
    return !!getApiKey();
  }

  // Raw call: POSTs to the Gemini API, returns the parsed response body.
  function rawCall(body) {
    var key = getApiKey();
    if (!key) return Promise.reject(new Error("AI is not configured — add your Gemini API key in AI settings."));

    return fetch(API_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
    })
      .catch(function () {
        throw new Error("Couldn't reach the Gemini API — check your connection.");
      })
      .then(function (res) {
        return res.text().then(function (text) {
          var data;
          try { data = JSON.parse(text); } catch (e) { data = null; }
          if (!res.ok) {
            var msg = (data && data.error && data.error.message) || ("HTTP " + res.status);
            throw new Error("AI request failed: " + msg);
          }
          if (!data) throw new Error("AI returned an unreadable response.");
          return data;
        });
      });
  }

  function responseText(data) {
    var candidate = (data.candidates || [])[0];
    if (!candidate) {
      var blockReason = data.promptFeedback && data.promptFeedback.blockReason;
      throw new Error(blockReason ? "AI blocked the request (" + blockReason + ")." : "AI returned no response.");
    }
    if (candidate.finishReason && candidate.finishReason !== "STOP" && candidate.finishReason !== "MAX_TOKENS") {
      throw new Error("AI stopped early (" + candidate.finishReason + ").");
    }
    var part = candidate.content && (candidate.content.parts || [])[0];
    if (!part || !part.text) throw new Error("AI response had no content.");
    return part.text;
  }

  // Structured call: expects the model's text to itself be JSON
  // (enforced via generationConfig.responseSchema) and parses it.
  function structuredCall(body) {
    return rawCall(body).then(function (data) {
      var text = responseText(data).trim();
      // Defensive: strip a ```json ... ``` fence if the model added one anyway.
      text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
      try {
        return JSON.parse(text);
      } catch (e) {
        throw new Error("AI returned invalid JSON.");
      }
    });
  }

  // Calls with responseSchema for the best-conformance result; if that
  // specific request fails (e.g. a schema-format quirk), retries once with
  // just responseMimeType + a plain-text shape description instead of
  // giving up straight to the rule-based fallback.
  function generateStructured(system, user, schema, shapeHint, maxOutputTokens) {
    return structuredCall({
      contents: [{ role: "user", parts: [{ text: user }] }],
      systemInstruction: { parts: [{ text: system }] },
      generationConfig: {
        maxOutputTokens: maxOutputTokens,
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    }).catch(function () {
      return structuredCall({
        contents: [{ role: "user", parts: [{ text: user }] }],
        systemInstruction: { parts: [{ text: system + "\n\n" + shapeHint }] },
        generationConfig: {
          maxOutputTokens: maxOutputTokens,
          responseMimeType: "application/json",
        },
      });
    });
  }

  function testConnection() {
    return rawCall({
      contents: [{ role: "user", parts: [{ text: "Reply with only the single word OK." }] }],
      generationConfig: { maxOutputTokens: 16 },
    }).then(function (data) {
      var text = responseText(data);
      if (!/ok/i.test(text)) throw new Error("Unexpected response from Gemini.");
      return true;
    });
  }

  function tripContext(trip) {
    var interestLabels = (trip.interests || []).join(", ") || "a broad general mix";
    var lines = [
      "Destination: " + trip.destination,
      "Dates: " + trip.startDate + " to " + trip.endDate,
      "Travelers: " + (trip.travelers || 1),
      "Budget level: " + (trip.budgetTier || "mid"),
      "Pace: " + (trip.pace || "balanced"),
      "Interests: " + interestLabels,
      "Climate expectation: " + (trip.climate || "mixed"),
      "Trip type: " + (trip.tripType || "city"),
    ];
    if (trip.arrivalTime) lines.push("Arrival time on day 1: " + trip.arrivalTime + " (24h)");
    if (trip.nearbyDestinations && trip.nearbyDestinations.length) {
      lines.push("Nearby destinations to weave in as day trips (one per extra day, in order): " + trip.nearbyDestinations.join(", "));
    }
    return lines.join("\n");
  }

  // Gemini's responseSchema is a restricted subset of standard JSON Schema
  // (lowercase "type" values: object/array/string/integer/...).
  var ITINERARY_SCHEMA = {
    type: "object",
    properties: {
      days: {
        type: "array",
        items: {
          type: "object",
          properties: {
            dayNumber: { type: "integer" },
            dayTripTo: { type: "string" }, // name of the nearby destination this day covers, or "" if none
            blocks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  time: { type: "string", enum: ["morning", "afternoon", "evening"] },
                  startTime: { type: "string" }, // "HH:MM", 24h — the actual clock time this block starts
                  title: { type: "string" },
                  desc: { type: "string" },
                  cost: { type: "string", enum: ["free", "low", "mid", "high"] },
                },
                required: ["time", "startTime", "title", "desc", "cost"],
              },
            },
          },
          required: ["dayNumber", "blocks"],
        },
      },
    },
    required: ["days"],
  };

  var HOTEL_SCHEMA = {
    type: "object",
    properties: {
      hotels: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            distanceKm: { type: "number" }, // approx. straight-line distance from the given landmark
            priceLow: { type: "number" }, // in the traveler's stated currency, per night
            priceHigh: { type: "number" },
            desc: { type: "string" }, // one line: area/vibe/why it fits
          },
          required: ["name", "distanceKm", "priceLow", "priceHigh", "desc"],
        },
      },
    },
    required: ["hotels"],
  };

  var PACKING_SCHEMA = {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            category: { type: "string" },
            text: { type: "string" },
          },
          required: ["category", "text"],
        },
      },
    },
    required: ["items"],
  };

  function generateItinerary(trip, dayCount) {
    var system =
      "You are a knowledgeable local trip planner. Use your own knowledge of the specific " +
      "destination named by the user — real neighborhoods, landmarks, dishes, and seasonal " +
      "context for the actual travel dates — rather than generic placeholder activities. " +
      "Keep descriptions concrete and specific (name real places/areas), one or two sentences each. " +
      "Respect the traveler's pace: relaxed = 2 blocks/day (morning, evening), " +
      "balanced = 3 blocks/day (morning, afternoon, evening), packed = 4 blocks/day " +
      "(morning, afternoon, evening, plus a second afternoon/evening block). " +
      "Give every block a realistic 24h startTime (\"HH:MM\") — space blocks out sensibly " +
      "through the day (roughly 2-4 hours apart). If an arrival time is given for day 1, do NOT " +
      "schedule anything before ~60-90 minutes after arrival (allow time to reach and check into " +
      "lodging) — a lighter day 1 with just 1-2 blocks (or an arrival/check-in block) is correct " +
      "for a late arrival. If nearby destinations are listed, dedicate one full day per destination " +
      "(in the order given, starting day 2) to a day trip there — set that day's dayTripTo to the " +
      "destination's name and make all of that day's blocks genuinely about that place, using your " +
      "own real knowledge of it. Set dayTripTo to \"\" on days that aren't a nearby-destination day trip. " +
      "Output must match the provided JSON schema exactly.";
    var user =
      tripContext(trip) +
      "\n\nGenerate a " + dayCount + "-day itinerary starting " + trip.startDate + ".";

    var shapeHint =
      'Respond with ONLY raw JSON (no markdown fences) matching exactly: ' +
      '{"days":[{"dayNumber":<int>,"dayTripTo":"<string, empty if none>","blocks":[{"time":"morning|afternoon|evening",' +
      '"startTime":"<HH:MM 24h>","title":"<string>","desc":"<string>","cost":"free|low|mid|high"}]}]}';

    return generateStructured(system, user, ITINERARY_SCHEMA, shapeHint, 8192).then(function (parsed) {
      return reshapeItineraryDays(trip, parsed.days);
    });
  }

  function reshapeItineraryDays(trip, days) {
    var start = new Date(trip.startDate + "T00:00:00");
    return (days || []).map(function (day, i) {
      var date = new Date(start.getTime() + i * 86400000);
      return {
        dayNumber: day.dayNumber || i + 1,
        date: date.toISOString().slice(0, 10),
        dayTripTo: day.dayTripTo || null,
        blocks: day.blocks || [],
      };
    });
  }

  // Free-form edit of an *existing* itinerary — "make day 2 more relaxed",
  // "swap the museum for something outdoors", etc. Sends the current
  // itinerary back to the model as context so it only changes what the
  // instruction asks for. No offline equivalent (the rule-based generator
  // can't interpret free-form instructions) — this is AI-only, and on
  // failure the caller should leave the existing itinerary untouched
  // rather than silently discarding the traveler's edits.
  function editItinerary(trip, currentItinerary, instruction) {
    var system =
      "You are updating an existing day-by-day trip itinerary per the traveler's instruction. " +
      "You'll be given the current itinerary as JSON and an instruction describing what to change. " +
      "Apply ONLY what the instruction asks for — keep every other day/block exactly as given unless " +
      "the change naturally requires adjusting it (e.g. re-spacing that day's startTimes). Keep the " +
      "same number of days as the current itinerary unless the instruction explicitly asks to add or " +
      "remove a day. Keep realistic 24h startTimes, spaced sensibly. Preserve dayTripTo on days not " +
      "affected by the instruction. Output must match the provided JSON schema exactly.";
    var user =
      tripContext(trip) +
      "\n\nCurrent itinerary:\n" + JSON.stringify({ days: currentItinerary }) +
      "\n\nInstruction: " + instruction;
    var shapeHint =
      'Respond with ONLY raw JSON (no markdown fences) matching exactly: ' +
      '{"days":[{"dayNumber":<int>,"dayTripTo":"<string, empty if none>","blocks":[{"time":"morning|afternoon|evening",' +
      '"startTime":"<HH:MM 24h>","title":"<string>","desc":"<string>","cost":"free|low|mid|high"}]}]}';

    return generateStructured(system, user, ITINERARY_SCHEMA, shapeHint, 8192).then(function (parsed) {
      return reshapeItineraryDays(trip, parsed.days);
    });
  }

  function generatePacking(trip, dayCount) {
    var system =
      "You are a meticulous, practical packing assistant. Tailor the list to the specific " +
      "destination's real climate for the given dates, the trip type, and trip length. " +
      "Cover documents, electronics, health/toiletries, clothing (with realistic quantities " +
      "for a " + dayCount + "-day trip), and any trip-type-specific gear. Avoid generic filler; " +
      "every item should be genuinely relevant to this trip. " +
      "Output must match the provided JSON schema exactly.";
    var user = tripContext(trip) + "\n\nTrip length: " + dayCount + " day(s).";
    var shapeHint =
      'Respond with ONLY raw JSON (no markdown fences) matching exactly: ' +
      '{"items":[{"category":"<string>","text":"<string>"}]}';

    return generateStructured(system, user, PACKING_SCHEMA, shapeHint, 4096).then(function (parsed) {
      return (parsed.items || []).map(function (item) {
        return { category: item.category, text: item.text };
      });
    });
  }

  // Real, specifically-named hotel suggestions near a landmark, within a
  // price band, sorted ascending by distance from that landmark. This is
  // the one AI feature with no offline equivalent — the built-in generator
  // has no geographic or pricing knowledge of actual named properties, so
  // this requires AI mode. Results are the model's own knowledge, not a
  // live lookup — always double-check current price/availability before
  // booking, which is why every result links out to a real search.
  function findHotels(trip, landmark, priceLow, priceHigh, currencyCode) {
    var system =
      "You are a knowledgeable local travel assistant with real knowledge of actual, currently " +
      "operating hotels/guesthouses in the given destination. Suggest genuinely real, specifically " +
      "named properties near the given landmark — never invent a hotel name. Estimate each one's " +
      "approximate straight-line distance in km from the landmark, and a realistic per-night price " +
      "range in the given currency. Only include hotels whose price range overlaps the traveler's " +
      "stated budget. Sort the list ascending by distanceKm. Output must match the provided JSON " +
      "schema exactly.";
    var user = [
      "Destination: " + trip.destination,
      "Landmark / area to search near: " + landmark,
      "Budget per night: " + priceLow + "–" + priceHigh + " " + currencyCode,
      "Suggest 5-8 real hotels, closest first.",
    ].join("\n");
    var shapeHint =
      'Respond with ONLY raw JSON (no markdown fences) matching exactly: ' +
      '{"hotels":[{"name":"<string>","distanceKm":<number>,"priceLow":<number>,"priceHigh":<number>,"desc":"<string>"}]}';

    return generateStructured(system, user, HOTEL_SCHEMA, shapeHint, 4096).then(function (parsed) {
      var hotels = (parsed.hotels || []).slice();
      hotels.sort(function (a, b) { return (a.distanceKm || 0) - (b.distanceKm || 0); }); // safety net — don't fully trust model ordering
      return hotels;
    });
  }

  return {
    MODEL: MODEL,
    getApiKey: getApiKey,
    setApiKey: setApiKey,
    isConfigured: isConfigured,
    testConnection: testConnection,
    generateItinerary: generateItinerary,
    editItinerary: editItinerary,
    generatePacking: generatePacking,
    findHotels: findHotels,
  };
})();
