/* ============================================================
   data.js — curated, fully-offline content used by the generators.
   No network calls. Everything here ships with the app so the
   planner works with zero connectivity once installed.
   ============================================================ */

window.TP_DATA = (function () {
  "use strict";

  // ---------- Interest tags ----------
  var INTERESTS = [
    { id: "sightseeing", label: "🏛️ Sightseeing" },
    { id: "culture", label: "🎭 Culture & History" },
    { id: "food", label: "🍜 Food & Drink" },
    { id: "nature", label: "🌿 Nature & Outdoors" },
    { id: "adventure", label: "🧗 Adventure" },
    { id: "relaxation", label: "🧘 Relaxation" },
    { id: "nightlife", label: "🌃 Nightlife" },
    { id: "shopping", label: "🛍️ Shopping" },
    { id: "art", label: "🎨 Art & Design" },
    { id: "family", label: "👨‍👩‍👧 Family-friendly" }
  ];

  // ---------- Activity template bank ----------
  // time: morning | afternoon | evening | any
  // cost: free | low | mid | high  (relative, scaled by budget tier later)
  var ACTIVITIES = [
    { tags: ["sightseeing", "culture"], time: "morning", cost: "low", title: "Old town / historic center walk", desc: "Wander the historic core, taking in landmark architecture and public squares." },
    { tags: ["sightseeing", "culture", "art"], time: "morning", cost: "mid", title: "Top-rated local museum", desc: "Visit the destination's flagship museum or gallery — check current hours before you go." },
    { tags: ["culture", "sightseeing"], time: "morning", cost: "low", title: "Landmark cathedral / temple / monument", desc: "See the most iconic religious or historic monument in town." },
    { tags: ["food"], time: "morning", cost: "low", title: "Local market breakfast crawl", desc: "Sample breakfast staples and fresh produce at the central market." },
    { tags: ["nature", "relaxation"], time: "morning", cost: "free", title: "Sunrise at a scenic viewpoint", desc: "Catch the best light of the day at a hill, tower, or waterfront lookout." },
    { tags: ["adventure", "nature"], time: "morning", cost: "mid", title: "Day-hike to a nearby nature reserve", desc: "Half-day trail with views — pack water and check trail conditions." },
    { tags: ["family", "nature"], time: "morning", cost: "mid", title: "Zoo, aquarium, or botanical garden", desc: "An easy-paced, family-friendly morning outing." },
    { tags: ["art"], time: "morning", cost: "low", title: "Street-art / architecture photo walk", desc: "Self-guided walk through the most photogenic neighborhood." },
    { tags: ["shopping"], time: "morning", cost: "mid", title: "Artisan & craft market browse", desc: "Browse local makers for souvenirs before the crowds arrive." },
    { tags: ["culture", "family"], time: "morning", cost: "low", title: "Guided walking tour of the main district", desc: "A 2–3 hour orientation tour — great for your first full day." },

    { tags: ["shopping"], time: "afternoon", cost: "mid", title: "Main shopping district", desc: "Explore the primary retail street or mall for local brands and souvenirs." },
    { tags: ["culture", "sightseeing"], time: "afternoon", cost: "low", title: "Museum-hopping afternoon", desc: "Pick 1–2 smaller museums or galleries matching your interests." },
    { tags: ["nature", "relaxation"], time: "afternoon", cost: "free", title: "Park or waterfront relaxation", desc: "Slow down with a picnic, a book, or people-watching in a green space." },
    { tags: ["adventure"], time: "afternoon", cost: "mid", title: "Bike tour around the city", desc: "Cover more ground on two wheels — many cities offer rental/bike-share." },
    { tags: ["adventure", "nature"], time: "afternoon", cost: "high", title: "Watersports session (snorkel/kayak/surf)", desc: "Book a local outfitter for an afternoon on the water." },
    { tags: ["relaxation"], time: "afternoon", cost: "mid", title: "Spa or wellness treatment", desc: "A massage, onsen, hammam, or thermal bath session." },
    { tags: ["food"], time: "afternoon", cost: "mid", title: "Cooking class featuring local cuisine", desc: "Hands-on class — a great rainy-day backup option too." },
    { tags: ["culture", "family"], time: "afternoon", cost: "low", title: "Day trip to a nearby small town", desc: "A short train/bus ride out for a change of pace." },
    { tags: ["nature"], time: "afternoon", cost: "low", title: "Botanical garden or nature park", desc: "A calmer outdoor afternoon with good photo spots." },
    { tags: ["art", "shopping"], time: "afternoon", cost: "low", title: "Design district / gallery browsing", desc: "Independent galleries, concept stores, and design studios." },

    { tags: ["food", "nightlife"], time: "evening", cost: "mid", title: "Night market food crawl", desc: "Graze your way through stalls — order small portions of several dishes." },
    { tags: ["nightlife"], time: "evening", cost: "mid", title: "Rooftop bar with a view", desc: "Sunset drinks somewhere with a skyline or waterfront view." },
    { tags: ["culture", "nightlife"], time: "evening", cost: "mid", title: "Live music or cultural performance", desc: "Check listings for a show matching local traditions or the local scene." },
    { tags: ["relaxation"], time: "evening", cost: "free", title: "Sunset walk along the waterfront", desc: "An easy, unhurried way to close out the day." },
    { tags: ["food"], time: "evening", cost: "high", title: "Notable local restaurant dinner", desc: "Book ahead for a well-reviewed spot serving regional specialties." },
    { tags: ["adventure", "relaxation"], time: "evening", cost: "low", title: "Sunset boat cruise", desc: "Harbor, river, or lake cruise timed for golden hour." },
    { tags: ["nightlife"], time: "evening", cost: "low", title: "Local brewery or wine-bar tasting", desc: "Sample regional beer, wine, or spirits at a casual venue." },
    { tags: ["family"], time: "evening", cost: "low", title: "Family game night / arcade / bowling", desc: "A relaxed, low-key evening option for mixed-age groups." },

    { tags: ["culture", "sightseeing", "family"], time: "any", cost: "low", title: "Local festival or seasonal market (if on)", desc: "Check what's on during your dates — festivals vary by season." },
    { tags: ["relaxation"], time: "any", cost: "free", title: "Free / unplanned time", desc: "Deliberately unscheduled — wander, rest, or revisit a favorite spot." },
    { tags: ["adventure"], time: "any", cost: "mid", title: "Escape room or local game experience", desc: "A fun indoor option, good for a rainy slot." },
    { tags: ["shopping", "food"], time: "any", cost: "low", title: "Souvenir & specialty food shopping", desc: "Pick up gifts, spices, or specialty foods to bring home." }
  ];

  // ---------- Hotel & restaurant archetypes ----------
  // These are generic *profiles*, not real named venues — the app can't
  // know live listings offline. Use the "Find real options" links in the
  // Places tab to pull up actual current places for your destination.
  var HOTEL_ARCHETYPES = {
    budget: [
      { title: "Well-reviewed hostel (private room)", features: ["Free Wi-Fi", "Shared or private bath", "Sociable common area"] },
      { title: "Simple guesthouse / B&B", features: ["Central-ish location", "Basic breakfast often included", "Family-run"] },
      { title: "Budget chain hotel", features: ["Predictable amenities", "Often near transit", "Free cancellation options common"] }
    ],
    mid: [
      { title: "3–4★ boutique hotel", features: ["Central location", "Good reviews for service", "On-site breakfast"] },
      { title: "Well-located apartment rental", features: ["Kitchen for some self-catering", "More space than a hotel room", "Good for longer stays"] },
      { title: "Business-class chain hotel", features: ["Reliable amenities", "Gym/pool common", "Good transit access"] }
    ],
    luxury: [
      { title: "5★ hotel or resort", features: ["Full-service amenities", "Concierge & spa", "Prime location or view"] },
      { title: "Design-led luxury boutique", features: ["Distinctive architecture", "High-end dining on-site", "Curated local experiences"] },
      { title: "Serviced luxury residence", features: ["Suite-style space", "Premium finishes", "Privacy + hotel services"] }
    ]
  };

  var RESTAURANT_ARCHETYPES = {
    budget: [
      { title: "Street-food stalls / hawker center", features: ["Cheapest authentic option", "Fast, casual", "Cash often preferred"] },
      { title: "Local canteen / no-frills eatery", features: ["Where locals actually eat", "Simple menu", "Great value"] },
      { title: "Bakery / café for light meals", features: ["Good for breakfast or a quick bite", "Usually walk-in"] }
    ],
    mid: [
      { title: "Mid-range bistro serving regional dishes", features: ["Sit-down, moderate prices", "Good for dinner", "Reservations sometimes useful"] },
      { title: "Popular local chain / well-reviewed casual spot", features: ["Consistent quality", "Often has an English/photo menu"] },
      { title: "Themed restaurant (vegetarian, seafood, etc.)", features: ["Match it to your dietary interests", "Usually needs no reservation"] }
    ],
    luxury: [
      { title: "Fine-dining / chef's-table restaurant", features: ["Reservation required", "Tasting menus common", "Dress code likely"] },
      { title: "Award-recognized regional-cuisine restaurant", features: ["Signature dishes", "Book several days ahead"] },
      { title: "Rooftop or destination restaurant with a view", features: ["Premium pricing for setting + food", "Great for a special night"] }
    ]
  };

  // ---------- Budget cost tiers (USD per day, per traveler, "global average") ----------
  var COST_TIERS = {
    budget: { lodging: 25, food: 15, transport: 8, activities: 10, misc: 5 },
    mid: { lodging: 80, food: 35, transport: 15, activities: 25, misc: 10 },
    luxury: { lodging: 250, food: 80, transport: 40, activities: 60, misc: 25 }
  };
  // Lodging is typically per room, not per traveler — handled in budget.js.

  var REGION_MULTIPLIERS = [
    { id: "global", label: "Global average (default)", mult: 1.0 },
    { id: "sea", label: "Southeast Asia", mult: 0.5 },
    { id: "sasia", label: "South Asia", mult: 0.4 },
    { id: "eeurope", label: "Eastern Europe", mult: 0.6 },
    { id: "latam", label: "Latin America", mult: 0.6 },
    { id: "africa", label: "Africa", mult: 0.55 },
    { id: "weurope", label: "Western Europe", mult: 1.15 },
    { id: "uk", label: "UK & Ireland", mult: 1.2 },
    { id: "usca", label: "USA & Canada", mult: 1.3 },
    { id: "jpkr", label: "Japan & South Korea", mult: 1.1 },
    { id: "anz", label: "Australia & New Zealand", mult: 1.3 },
    { id: "mideast", label: "Middle East", mult: 1.0 }
  ];

  // ---------- Packing lists ----------
  var PACKING_BASE = {
    "Documents & Money": ["Passport / ID", "Visa or entry documents (if needed)", "Travel insurance details", "Boarding passes / bookings (saved offline too)", "Local currency + one backup card", "Copies of important documents (photo + printed)"],
    "Electronics": ["Phone + charger", "Power bank", "Universal plug adapter", "Headphones", "Camera (optional)"],
    "Health & Toiletries": ["Toothbrush & toothpaste", "Any prescription medication", "Basic first-aid kit", "Hand sanitizer", "Sunscreen"],
    "Clothing (base)": ["Comfortable walking shoes", "Underwear & socks", "Sleepwear", "Light jacket"],
    "Misc": ["Reusable water bottle", "Daypack / small bag", "Travel pillow", "Earplugs / eye mask"]
  };

  var PACKING_CLIMATE = {
    hot: { "Clothing (climate)": ["Breathable t-shirts / tops", "Shorts / light dresses", "Sunglasses", "Sun hat", "Sandals"] },
    mild: { "Clothing (climate)": ["Layerable tops", "A mid-weight jacket", "Light scarf", "Comfortable trousers"] },
    cold: { "Clothing (climate)": ["Thermal base layers", "Warm insulated coat", "Gloves & beanie", "Wool socks", "Waterproof boots"] },
    mixed: { "Clothing (climate)": ["Layerable tops for variable weather", "A packable rain jacket", "One warm layer", "Versatile shoes"] }
  };

  var PACKING_TRIP_TYPE = {
    beach: { "Trip extras": ["Swimwear", "Beach towel", "After-sun lotion", "Waterproof phone pouch", "Flip-flops"] },
    city: { "Trip extras": ["Crossbody / anti-theft bag", "Portable phone charger for a full day out", "Compact umbrella"] },
    hiking: { "Trip extras": ["Hiking boots", "Moisture-wicking socks", "Backpack with rain cover", "Trail snacks", "Blister plasters", "Offline trail map"] },
    winter_sports: { "Trip extras": ["Ski/snow jacket & pants", "Goggles", "Thermal gloves", "Neck gaiter", "Hand warmers"] },
    business: { "Trip extras": ["Business attire", "Laptop + charger", "Business cards", "Portable garment bag"] },
    roadtrip: { "Trip extras": ["Offline maps downloaded", "Car charger / adapter", "Snacks for the road", "Entertainment for downtime"] }
  };

  var TRIP_TYPES = [
    { id: "city", label: "City break" },
    { id: "beach", label: "Beach / island" },
    { id: "hiking", label: "Hiking / outdoors" },
    { id: "winter_sports", label: "Winter / ski" },
    { id: "business", label: "Business" },
    { id: "roadtrip", label: "Road trip" }
  ];

  var CLIMATES = [
    { id: "hot", label: "☀️ Hot" },
    { id: "mild", label: "🌤️ Mild" },
    { id: "cold", label: "❄️ Cold" },
    { id: "mixed", label: "🌦️ Mixed / unsure" }
  ];

  return {
    INTERESTS: INTERESTS,
    ACTIVITIES: ACTIVITIES,
    HOTEL_ARCHETYPES: HOTEL_ARCHETYPES,
    RESTAURANT_ARCHETYPES: RESTAURANT_ARCHETYPES,
    COST_TIERS: COST_TIERS,
    REGION_MULTIPLIERS: REGION_MULTIPLIERS,
    PACKING_BASE: PACKING_BASE,
    PACKING_CLIMATE: PACKING_CLIMATE,
    PACKING_TRIP_TYPE: PACKING_TRIP_TYPE,
    TRIP_TYPES: TRIP_TYPES,
    CLIMATES: CLIMATES
  };
})();
