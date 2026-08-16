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

  // Broad multi-country averages (kept for anyone who'd rather not pick a
  // specific country) plus a country-level list so a destination like
  // India can be selected directly, with a currency suggestion attached.
  // "mult" is a rough relative cost-of-living multiplier vs. the global
  // average (1.0) — ballpark planning figures, not a live index.
  var REGION_MULTIPLIERS = [
    { id: "global", label: "Global average (default)", mult: 1.0, group: "General" },

    { id: "sea", label: "Southeast Asia (broad average)", mult: 0.5, group: "Region average (broad)" },
    { id: "sasia", label: "South Asia (broad average)", mult: 0.4, group: "Region average (broad)" },
    { id: "eeurope", label: "Eastern Europe (broad average)", mult: 0.6, group: "Region average (broad)" },
    { id: "latam", label: "Latin America (broad average)", mult: 0.6, group: "Region average (broad)" },
    { id: "africa", label: "Africa (broad average)", mult: 0.55, group: "Region average (broad)" },
    { id: "weurope", label: "Western Europe (broad average)", mult: 1.15, group: "Region average (broad)" },
    { id: "uk", label: "UK & Ireland (broad average)", mult: 1.2, group: "Region average (broad)" },
    { id: "usca", label: "USA & Canada (broad average)", mult: 1.3, group: "Region average (broad)" },
    { id: "jpkr", label: "Japan & South Korea (broad average)", mult: 1.1, group: "Region average (broad)" },
    { id: "anz", label: "Australia & New Zealand (broad average)", mult: 1.3, group: "Region average (broad)" },
    { id: "mideast", label: "Middle East (broad average)", mult: 1.0, group: "Region average (broad)" },

    { id: "c_in", label: "India", mult: 0.35, currency: "INR", group: "Asia" },
    { id: "c_cn", label: "China", mult: 0.55, currency: "CNY", group: "Asia" },
    { id: "c_jp", label: "Japan", mult: 1.1, currency: "JPY", group: "Asia" },
    { id: "c_kr", label: "South Korea", mult: 1.0, currency: "KRW", group: "Asia" },
    { id: "c_th", label: "Thailand", mult: 0.5, currency: "THB", group: "Asia" },
    { id: "c_vn", label: "Vietnam", mult: 0.4, currency: "VND", group: "Asia" },
    { id: "c_id", label: "Indonesia", mult: 0.4, currency: "IDR", group: "Asia" },
    { id: "c_ph", label: "Philippines", mult: 0.45, currency: "PHP", group: "Asia" },
    { id: "c_my", label: "Malaysia", mult: 0.5, currency: "MYR", group: "Asia" },
    { id: "c_sg", label: "Singapore", mult: 1.25, currency: "SGD", group: "Asia" },
    { id: "c_np", label: "Nepal", mult: 0.3, currency: "NPR", group: "Asia" },
    { id: "c_ae", label: "UAE (Dubai / Abu Dhabi)", mult: 1.15, currency: "AED", group: "Asia" },
    { id: "c_tr", label: "Turkey", mult: 0.5, currency: "TRY", group: "Asia" },

    { id: "c_gb", label: "United Kingdom", mult: 1.2, currency: "GBP", group: "Europe" },
    { id: "c_fr", label: "France", mult: 1.15, currency: "EUR", group: "Europe" },
    { id: "c_de", label: "Germany", mult: 1.05, currency: "EUR", group: "Europe" },
    { id: "c_it", label: "Italy", mult: 1.05, currency: "EUR", group: "Europe" },
    { id: "c_es", label: "Spain", mult: 0.9, currency: "EUR", group: "Europe" },
    { id: "c_pt", label: "Portugal", mult: 0.8, currency: "EUR", group: "Europe" },
    { id: "c_gr", label: "Greece", mult: 0.85, currency: "EUR", group: "Europe" },
    { id: "c_nl", label: "Netherlands", mult: 1.1, currency: "EUR", group: "Europe" },
    { id: "c_ch", label: "Switzerland", mult: 1.6, currency: "CHF", group: "Europe" },

    { id: "c_us", label: "United States", mult: 1.3, currency: "USD", group: "Americas" },
    { id: "c_ca", label: "Canada", mult: 1.2, currency: "CAD", group: "Americas" },
    { id: "c_mx", label: "Mexico", mult: 0.5, currency: "MXN", group: "Americas" },
    { id: "c_br", label: "Brazil", mult: 0.55, currency: "BRL", group: "Americas" },
    { id: "c_pe", label: "Peru", mult: 0.5, currency: "PEN", group: "Americas" },

    { id: "c_za", label: "South Africa", mult: 0.5, currency: "ZAR", group: "Africa" },
    { id: "c_eg", label: "Egypt", mult: 0.4, currency: "EGP", group: "Africa" },
    { id: "c_ma", label: "Morocco", mult: 0.55, currency: "MAD", group: "Africa" },
    { id: "c_ke", label: "Kenya", mult: 0.5, currency: "KES", group: "Africa" },

    { id: "c_au", label: "Australia", mult: 1.3, currency: "AUD", group: "Oceania" },
    { id: "c_nz", label: "New Zealand", mult: 1.25, currency: "NZD", group: "Oceania" }
  ];

  // Approximate, static exchange rates (units per 1 USD) — for rough trip
  // budgeting only, not live rates. "rate" scales the USD-baseline cost
  // tiers above into the selected display currency.
  var CURRENCIES = [
    { code: "USD", label: "US Dollar", symbol: "$", rate: 1 },
    { code: "INR", label: "Indian Rupee", symbol: "₹", rate: 83 },
    { code: "EUR", label: "Euro", symbol: "€", rate: 0.92 },
    { code: "GBP", label: "British Pound", symbol: "£", rate: 0.79 },
    { code: "JPY", label: "Japanese Yen", symbol: "¥", rate: 149 },
    { code: "AUD", label: "Australian Dollar", symbol: "A$", rate: 1.52 },
    { code: "CAD", label: "Canadian Dollar", symbol: "C$", rate: 1.36 },
    { code: "NZD", label: "New Zealand Dollar", symbol: "NZ$", rate: 1.65 },
    { code: "SGD", label: "Singapore Dollar", symbol: "S$", rate: 1.34 },
    { code: "AED", label: "UAE Dirham", symbol: "AED", rate: 3.67 },
    { code: "THB", label: "Thai Baht", symbol: "฿", rate: 34 },
    { code: "CNY", label: "Chinese Yuan", symbol: "¥", rate: 7.2 },
    { code: "KRW", label: "South Korean Won", symbol: "₩", rate: 1330 },
    { code: "IDR", label: "Indonesian Rupiah", symbol: "Rp", rate: 15800 },
    { code: "PHP", label: "Philippine Peso", symbol: "₱", rate: 58 },
    { code: "MYR", label: "Malaysian Ringgit", symbol: "RM", rate: 4.7 },
    { code: "VND", label: "Vietnamese Dong", symbol: "₫", rate: 25000 },
    { code: "NPR", label: "Nepalese Rupee", symbol: "Rs", rate: 133 },
    { code: "TRY", label: "Turkish Lira", symbol: "₺", rate: 34 },
    { code: "CHF", label: "Swiss Franc", symbol: "Fr", rate: 0.88 },
    { code: "MXN", label: "Mexican Peso", symbol: "$", rate: 17 },
    { code: "BRL", label: "Brazilian Real", symbol: "R$", rate: 5.4 },
    { code: "PEN", label: "Peruvian Sol", symbol: "S/", rate: 3.75 },
    { code: "ZAR", label: "South African Rand", symbol: "R", rate: 18.5 },
    { code: "EGP", label: "Egyptian Pound", symbol: "E£", rate: 48 },
    { code: "MAD", label: "Moroccan Dirham", symbol: "DH", rate: 10 },
    { code: "KES", label: "Kenyan Shilling", symbol: "KSh", rate: 129 }
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
    CURRENCIES: CURRENCIES,
    PACKING_BASE: PACKING_BASE,
    PACKING_CLIMATE: PACKING_CLIMATE,
    PACKING_TRIP_TYPE: PACKING_TRIP_TYPE,
    TRIP_TYPES: TRIP_TYPES,
    CLIMATES: CLIMATES
  };
})();
