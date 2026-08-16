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
  var MODEL = "gemini-2.5-flash";
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

  // Gemini's responseSchema is a restricted subset of OpenAPI 3.0's Schema
  // object: "type" values are the capitalized Type enum (STRING, OBJECT,
  // ARRAY, ...), and "propertyOrdering" (Gemini-specific) hints the key
  // order in the generated JSON. additionalProperties is not part of this
  // subset, so it's omitted.
  var ITINERARY_SCHEMA = {
    type: "OBJECT",
    properties: {
      days: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            dayNumber: { type: "INTEGER" },
            blocks: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  time: { type: "STRING", enum: ["morning", "afternoon", "evening"] },
                  title: { type: "STRING" },
                  desc: { type: "STRING" },
                  cost: { type: "STRING", enum: ["free", "low", "mid", "high"] },
                },
                required: ["time", "title", "desc", "cost"],
                propertyOrdering: ["time", "title", "desc", "cost"],
              },
            },
          },
          required: ["dayNumber", "blocks"],
          propertyOrdering: ["dayNumber", "blocks"],
        },
      },
    },
    required: ["days"],
  };

  var PACKING_SCHEMA = {
    type: "OBJECT",
    properties: {
      items: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            category: { type: "STRING" },
            text: { type: "STRING" },
          },
          required: ["category", "text"],
          propertyOrdering: ["category", "text"],
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
      "Output must match the provided JSON schema exactly.";
    var user =
      tripContext(trip) +
      "\n\nGenerate a " + dayCount + "-day itinerary starting " + trip.startDate + ".";

    return structuredCall({
      contents: [{ role: "user", parts: [{ text: user }] }],
      systemInstruction: { parts: [{ text: system }] },
      generationConfig: {
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
        responseSchema: ITINERARY_SCHEMA,
      },
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
      contents: [{ role: "user", parts: [{ text: user }] }],
      systemInstruction: { parts: [{ text: system }] },
      generationConfig: {
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
        responseSchema: PACKING_SCHEMA,
      },
    }).then(function (parsed) {
      return (parsed.items || []).map(function (item) {
        return { category: item.category, text: item.text };
      });
    });
  }

  return {
    MODEL: MODEL,
    getApiKey: getApiKey,
    setApiKey: setApiKey,
    isConfigured: isConfigured,
    testConnection: testConnection,
    generateItinerary: generateItinerary,
    generatePacking: generatePacking,
  };
})();
