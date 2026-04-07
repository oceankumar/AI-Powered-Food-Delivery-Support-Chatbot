const DEFAULT_TIMEOUT_MS = 5000;

async function fetchWithTimeout(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

const FASTING_FRIENDLY_FALLBACK = [
  {
    name: "Sabudana Khichdi",
    category: "Vrat/Fasting",
    cuisine: "Indian",
    source: "Curated fallback",
  },
  {
    name: "Fruit Bowl with Yogurt",
    category: "Light Meal",
    cuisine: "Global",
    source: "Curated fallback",
  },
  {
    name: "Roasted Sweet Potato Chaat",
    category: "Vrat/Fasting",
    cuisine: "Indian",
    source: "Curated fallback",
  },
];

const PERSONALIZED_FOOD_CATALOG = [
  {
    name: "Paneer Tikka Bowl",
    category: "High Protein",
    cuisine: "Indian",
    dietary: "veg",
    spicyLevel: "medium",
    calories: 520,
    priceInr: 280,
    mealTimes: ["lunch", "dinner"],
    allergens: ["dairy"],
    source: "Curated fallback",
  },
  {
    name: "Grilled Chicken Wrap",
    category: "High Protein",
    cuisine: "Global",
    dietary: "non-veg",
    spicyLevel: "mild",
    calories: 480,
    priceInr: 260,
    mealTimes: ["lunch", "dinner"],
    allergens: ["gluten"],
    source: "Curated fallback",
  },
  {
    name: "Veg Burrito Bowl",
    category: "Balanced Meal",
    cuisine: "Mexican",
    dietary: "veg",
    spicyLevel: "medium",
    calories: 540,
    priceInr: 300,
    mealTimes: ["lunch", "dinner"],
    allergens: [],
    source: "Curated fallback",
  },
  {
    name: "Tofu Stir Fry Bowl",
    category: "Low Calorie",
    cuisine: "Asian",
    dietary: "vegan",
    spicyLevel: "mild",
    calories: 390,
    priceInr: 320,
    mealTimes: ["lunch", "dinner"],
    allergens: ["soy"],
    source: "Curated fallback",
  },
  {
    name: "Dal Khichdi Bowl",
    category: "Comfort Meal",
    cuisine: "Indian",
    dietary: "veg",
    spicyLevel: "mild",
    calories: 430,
    priceInr: 210,
    mealTimes: ["breakfast", "lunch", "dinner"],
    allergens: [],
    source: "Curated fallback",
  },
  {
    name: "Peri Peri Chicken Rice",
    category: "High Protein",
    cuisine: "Fusion",
    dietary: "non-veg",
    spicyLevel: "spicy",
    calories: 610,
    priceInr: 350,
    mealTimes: ["lunch", "dinner"],
    allergens: [],
    source: "Curated fallback",
  },
];

const RESTAURANT_FALLBACK = [
  { name: "Green Bowl Kitchen", city: "mumbai", area: "andheri", rating: 4.4 },
  { name: "Protein Plate Co.", city: "mumbai", area: "powai", rating: 4.3 },
  { name: "South Spice Meals", city: "bangalore", area: "indiranagar", rating: 4.5 },
  { name: "Fit Tiffin Hub", city: "delhi", area: "saket", rating: 4.2 },
];

function enrichRestaurantMeta(restaurant, index) {
  const distanceKm = Number((1.2 + index * 1.1).toFixed(1));
  const etaMinutes = Math.round(18 + distanceKm * 6);
  return {
    ...restaurant,
    distanceKm,
    etaMinutes,
  };
}

function isFastingQuery(message = "") {
  return /\b(fast|fasting|vrat|navratri|upvas)\b/i.test(message);
}

async function getMealDbRecommendations(query = "") {
  const url = "https://www.themealdb.com/api/json/v1/1/search.php?s=salad";
  const response = await fetchWithTimeout(url);
  if (!response.ok) return [];

  const data = await response.json();
  const meals = data.meals || [];
  return meals.slice(0, 3).map((meal) => ({
    name: meal.strMeal,
    category: meal.strCategory,
    cuisine: meal.strArea,
    source: "TheMealDB",
  }));
}

async function getFoodRecommendations(userMessage = "") {
  if (isFastingQuery(userMessage)) {
    return FASTING_FRIENDLY_FALLBACK;
  }

  try {
    const live = await getMealDbRecommendations(userMessage);
    if (live.length > 0) return live;
  } catch (_error) {
    // Swallow and fallback to resilient local recommendations.
  }

  return [
    {
      name: "Paneer Tikka Bowl",
      category: "High Protein",
      cuisine: "Indian",
      source: "Curated fallback",
    },
    {
      name: "Veg Burrito Bowl",
      category: "Balanced Meal",
      cuisine: "Mexican",
      source: "Curated fallback",
    },
    {
      name: "Grilled Chicken Wrap",
      category: "High Protein",
      cuisine: "Global",
      source: "Curated fallback",
    },
  ];
}

async function getNearbyRestaurants(location = "") {
  if (!location) {
    return RESTAURANT_FALLBACK.slice(0, 3).map((item, idx) =>
      enrichRestaurantMeta(item, idx)
    );
  }

  const query = encodeURIComponent(`${location} restaurants`);
  const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=3`;

  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) throw new Error("geocoding failed");
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("no places");
    }
    return data.slice(0, 3).map((item, idx) =>
      enrichRestaurantMeta(
        {
          name: item.display_name.split(",").slice(0, 2).join(","),
          city: location,
          area: item.display_name.split(",")[1]?.trim() || "nearby",
          rating: Number((4.2 + idx * 0.1).toFixed(1)),
          source: "OpenStreetMap",
        },
        idx
      )
    );
  } catch (_error) {
    const norm = location.toLowerCase();
    const cityMatches = RESTAURANT_FALLBACK.filter((r) => r.city.includes(norm));
    return (cityMatches.length > 0 ? cityMatches : RESTAURANT_FALLBACK)
      .slice(0, 3)
      .map((item, idx) => enrichRestaurantMeta(item, idx));
  }
}

function getPersonalizedRecommendations(preferences = {}) {
  const {
    dietary,
    spiceLevel,
    budgetMax,
    calorieGoal,
    fasting,
    mealTime,
    allergies = [],
  } = preferences;

  if (fasting) {
    return FASTING_FRIENDLY_FALLBACK.map((item) => ({
      ...item,
      reason: "Suitable for fasting choices",
    }));
  }

  let filtered = [...PERSONALIZED_FOOD_CATALOG];
  const base = [...PERSONALIZED_FOOD_CATALOG];

  if (dietary) {
    filtered = filtered.filter((item) => item.dietary === dietary);
  }

  if (spiceLevel) {
    filtered = filtered.filter((item) => item.spicyLevel === spiceLevel);
  }

  if (budgetMax) {
    filtered = filtered.filter((item) => item.priceInr <= budgetMax);
  }

  if (calorieGoal === "low") {
    filtered = filtered.filter((item) => item.calories <= 450);
  }
  if (calorieGoal === "high-protein") {
    filtered = filtered.filter((item) =>
      /high protein/i.test(item.category)
    );
  }

  if (mealTime) {
    filtered = filtered.filter((item) => item.mealTimes?.includes(mealTime));
  }

  if (Array.isArray(allergies) && allergies.length > 0) {
    filtered = filtered.filter(
      (item) =>
        !item.allergens ||
        !item.allergens.some((allergen) => allergies.includes(allergen))
    );
  }

  if (filtered.length === 0) {
    // Progressive relaxation while preserving strongest constraints first.
    filtered = [...base];
    if (dietary) filtered = filtered.filter((item) => item.dietary === dietary);
    if (budgetMax) filtered = filtered.filter((item) => item.priceInr <= budgetMax);
    if (filtered.length === 0 && dietary) {
      filtered = base.filter((item) => item.dietary === dietary);
    }
    if (filtered.length === 0) {
      filtered = base.slice(0, 3);
    }
  }

  return filtered.slice(0, 4).map((item) => ({
    ...item,
    reason: "Matched to your preferences",
  }));
}

async function getFoodTopicAnswer(userMessage = "") {
  const cleanedTopic = userMessage
    .replace(/\b(what is|tell me about|explain|about)\b/gi, "")
    .trim();
  const topic = cleanedTopic || "Food";

  const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
    topic
  )}`;

  try {
    const response = await fetchWithTimeout(wikiUrl);
    if (response.ok) {
      const data = await response.json();
      if (data.extract) {
        return {
          topic: data.title || topic,
          answer: data.extract.split(". ").slice(0, 2).join(". "),
          source: data.content_urls?.desktop?.page || "Wikipedia",
        };
      }
    }
  } catch (_error) {
    // Continue to fallback.
  }

  return {
    topic,
    answer:
      "I could not fetch a live article right now, but I can still help with food recommendations, nutrition basics, cuisine comparisons, and meal planning.",
    source: "Local fallback knowledge",
  };
}

module.exports = {
  getFoodRecommendations,
  getPersonalizedRecommendations,
  getNearbyRestaurants,
  getFoodTopicAnswer,
  isFastingQuery,
};
