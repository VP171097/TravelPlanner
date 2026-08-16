/* ============================================================
   ai.js — optional real-AI itinerary/packing generation via a
   user-deployed Cloudflare Worker relay (see /cf-worker).

   This module never talks to Anthropic directly — the browser can't
   (see cf-worker/README.md for why). It POSTs a Messages-API-shaped
   request to the configured Worker URL, which injects the API key
   server-side and relays it. If no Worker URL is configured, or a
   call fails, callers should fall back to the offline generators in
   itinerary.js / packing.js — this module never breaks the app.
   ============================================================ */

window.TP_AI = (function () {
  "use strict";

  var KEY_WORKER_URL = "tp_ai_worker_url";
  var MODEL = "claude-haiku-4-5"; // also enforced server-side by the Worker

  function getWorkerUrl() {
    return (localStorage.getItem(KEY_WORKER_URL) || "").trim();
  }
  function setWorkerUrl(url) {
    url = (url || "").trim();
    if (url) localStorage.setItem(KEY_WORKER_URL, url);
    else localStorage.removeItem(KEY_WORKER_URL);
  }
  function isConfigured() {
    return !!getWorkerUrl();
  }

  // Raw call: POSTs to the Worker, returns the Anthropic Messages API
  // response object (whatever the assistant said, unparsed).
  function rawCall(payload) {
    var url = getWorkerUrl();
    if (!url) return Promise.reject(new Error("AI is not configured — add your Worker URL in AI settings."));

    return fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    })
      .catch(function () {
        throw new Error("Couldn't reach the AI proxy — check the Worker URL and your connection.");
      })
      .then(function (res) {
        return res.text().then(function (text) {
          var data;
          try { data = JSON.parse(text); } catch (e) { data = null; }
          if (!res.ok) {
            var msg = (data && (data.error && (data.error.message || data.error))) || ("HTTP " + res.status);
            throw new Error("AI request failed: " + msg);
          }
          if (!data) throw new Error("AI returned an unreadable response.");
          return data;
        });
      });
  }

  function textBlock(message) {
    return (message.content || []).filter(function (b) { return b.type === "text"; })[0];
  }

  // Structured call: expects the assistant's text content to itself be
  // JSON (enforced via output_config.format on the request) and parses it.
  function structuredCall(payload) {
    return rawCall(payload).then(function (message) {
      var block = textBlock(message);
      if (!block) throw new Error("AI response had no content.");
      try {
        return JSON.parse(block.text);
      } catch (e) {
        throw new Error("AI returned invalid JSON.");
      }
    });
  }

  function testConnection() {
    return rawCall({
      max_tokens: 16,
      messages: [{ role: "user", content: "Reply with only the single word OK." }],
    }).then(function (message) {
      var block = textBlock(message);
      if (!block || !/ok/i.test(block.text)) throw new Error("Unexpected response from AI proxy.");
      return true;
    });
  }

  function tripContext(trip) {
    var interestLabels = (trip.interests || []).join(", ") || "a broad general mix";
    return [
      "Destination: " + trip.destination,
      "Dates: " + trip.startDate + " to " + trip.endDate,
      "Travelers: " + (trip.travelers || 1),
      "Budget level: " + (trip.budgetTier || "mid"),
      "Pace: " + (trip.pace || "balanced"),
      "Interests: " + interestLabels,
      "Climate expectation: " + (trip.climate || "mixed"),
      "Trip type: " + (trip.tripType || "city"),
    ].join("\n");
  }

  var ITINERARY_SCHEMA = {
    type: "object",
    properties: {
      days: {
        type: "array",
        items: {
          type: "object",
          properties: {
            dayNumber: { type: "integer" },
            blocks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  time: { type: "string", enum: ["morning", "afternoon", "evening"] },
                  title: { type: "string" },
                  desc: { type: "string" },
                  cost: { type: "string", enum: ["free", "low", "mid", "high"] },
                },
                required: ["time", "title", "desc", "cost"],
                additionalProperties: false,
              },
            },
          },
          required: ["dayNumber", "blocks"],
          additionalProperties: false,
        },
      },
    },
    required: ["days"],
    additionalProperties: false,
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
          additionalProperties: false,
        },
      },
    },
    required: ["items"],
    additionalProperties: false,
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
      "Output must match the provided JSON schema exactly.";
    var user =
      tripContext(trip) +
      "\n\nGenerate a " + dayCount + "-day itinerary starting " + trip.startDate + ".";

    return structuredCall({
      max_tokens: 4096,
      system: system,
      messages: [{ role: "user", content: user }],
      output_config: { format: { type: "json_schema", schema: ITINERARY_SCHEMA } },
    }).then(function (parsed) {
      var start = new Date(trip.startDate + "T00:00:00");
      return (parsed.days || []).map(function (day, i) {
        var date = new Date(start.getTime() + i * 86400000);
        return {
          dayNumber: day.dayNumber || i + 1,
          date: date.toISOString().slice(0, 10),
          blocks: day.blocks || [],
        };
      });
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

    return structuredCall({
      max_tokens: 2048,
      system: system,
      messages: [{ role: "user", content: user }],
      output_config: { format: { type: "json_schema", schema: PACKING_SCHEMA } },
    }).then(function (parsed) {
      return (parsed.items || []).map(function (item) {
        return { category: item.category, text: item.text };
      });
    });
  }

  return {
    MODEL: MODEL,
    getWorkerUrl: getWorkerUrl,
    setWorkerUrl: setWorkerUrl,
    isConfigured: isConfigured,
    testConnection: testConnection,
    generateItinerary: generateItinerary,
    generatePacking: generatePacking,
  };
})();
