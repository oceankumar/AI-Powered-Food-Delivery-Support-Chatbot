const { generateReply } = require("./gptService");
const { getOrder, updateIssue, createRefund } = require("./mockDB");
const {
  getFoodRecommendations,
  getPersonalizedRecommendations,
  getNearbyRestaurants,
  getFoodTopicAnswer,
  isFastingQuery,
} = require("./externalFoodService");

const sessions = {};

function detectIntent(message = "") {
  const normalized = message.toLowerCase();

  let intent = "fallback";
  if (/\brefund\b/.test(normalized)) {
    intent = "refund_intent";
  } else if (/\b(not good|bad|cold|wrong item|stale|late)\b/.test(normalized)) {
    intent = "complaint_intent";
  } else if (/\b(where|status|track|arrive|delivery)\b/.test(normalized)) {
    intent = "delivery_query";
  } else if (
    /\b(recommend|suggest|what should i eat|hungry|fast|fasting|vrat|upvas)\b/.test(
      normalized
    )
  ) {
    intent = "food_recommendation";
  } else if (/\b(near me|nearby|around me|in .+|restaurants? near)\b/.test(normalized)) {
    intent = "food_recommendation";
  } else if (
    /\b(calories|protein|nutrition|healthy|what is|explain|tell me about|cuisine|diet)\b/.test(
      normalized
    )
  ) {
    intent = "food_topic_query";
  }

  let sentiment = "neutral";
  if (/\b(bad|cold|terrible|worst|angry|upset|not good)\b/.test(normalized)) {
    sentiment = "negative";
  } else if (/\b(good|great|thanks|awesome)\b/.test(normalized)) {
    sentiment = "positive";
  }

  const confidenceByIntent = {
    complaint_intent: 0.92,
    refund_intent: 0.93,
    delivery_query: 0.9,
    food_recommendation: 0.88,
    food_topic_query: 0.82,
    fallback: 0.45,
  };

  return {
    intent,
    sentiment,
    confidence: confidenceByIntent[intent],
  };
}

function getSession(sessionId) {
  if (!sessions[sessionId]) {
    sessions[sessionId] = {
      orderId: "ORD123",
      lastIntent: null,
      history: [],
      escalated: false,
      preferenceProfile: {
        dietary: null,
        spiceLevel: null,
        budgetMax: null,
        calorieGoal: null,
        fasting: false,
        location: "sonipat",
        mealTime: null,
        allergies: [],
      },
    };
  }
  return sessions[sessionId];
}

function extractPreferenceSignals(message = "") {
  const text = message.toLowerCase();
  const updates = {};

  if (/\bveg|vegetarian\b/.test(text)) updates.dietary = "veg";
  if (/\bvegan\b/.test(text)) updates.dietary = "vegan";
  if (/\bnon[- ]?veg|chicken|mutton|fish|egg\b/.test(text)) {
    updates.dietary = "non-veg";
  }

  if (/\bmild|less spicy|not spicy\b/.test(text)) updates.spiceLevel = "mild";
  if (/\bmedium spicy|medium\b/.test(text)) updates.spiceLevel = "medium";
  if (/\bspicy|very spicy\b/.test(text)) updates.spiceLevel = "spicy";

  const budgetMatch = text.match(/(?:under|below|budget)\s*₹?\s*(\d{2,5})/i);
  if (budgetMatch?.[1]) updates.budgetMax = Number(budgetMatch[1]);

  if (/\blow calorie|weight loss|light\b/.test(text)) {
    updates.calorieGoal = "low";
  }
  if (/\bhigh protein|protein rich|gym\b/.test(text)) {
    updates.calorieGoal = "high-protein";
  }
  if (/\bbreakfast\b/.test(text)) updates.mealTime = "breakfast";
  if (/\blunch\b/.test(text)) updates.mealTime = "lunch";
  if (/\bdinner\b/.test(text)) updates.mealTime = "dinner";

  const locationMatch = text.match(/\b(?:in|at|near)\s+([a-z\s]{3,30})/i);
  if (locationMatch?.[1]) {
    updates.location = locationMatch[1]
      .replace(/\b(recommend|food|nearby|restaurants?|please)\b/g, "")
      .trim();
  }

  const allergySignals = [];
  if (/\bnut|peanut|almond|cashew\b/.test(text)) allergySignals.push("nuts");
  if (/\bdairy|lactose|milk\b/.test(text)) allergySignals.push("dairy");
  if (/\bgluten|wheat\b/.test(text)) allergySignals.push("gluten");
  if (/\bsoy\b/.test(text)) allergySignals.push("soy");
  if (/\begg allergy\b/.test(text)) allergySignals.push("egg");
  if (allergySignals.length > 0) updates.allergies = allergySignals;
  if (/\bno allergies\b/.test(text)) updates.allergies = [];

  if (isFastingQuery(text)) updates.fasting = true;
  if (/\bnot fasting\b/.test(text)) updates.fasting = false;

  return updates;
}

function looksLikePreferenceInput(message = "") {
  return /\b(veg|vegetarian|vegan|non[- ]?veg|mild|medium|spicy|under|below|budget|high protein|low calorie|fasting|fast|upvas|vrat|breakfast|lunch|dinner|near me|nearby|allergy|dairy|gluten|nuts|soy)\b/i.test(
    message
  );
}

function getMissingPreferenceFields(profile) {
  const missing = [];
  if (!profile.dietary) missing.push("diet");
  if (!profile.spiceLevel) missing.push("spice");
  if (!profile.budgetMax) missing.push("budget");
  return missing;
}

async function handleMessage({ sessionId, message }) {
  const session = getSession(sessionId);
  const preferenceUpdates = extractPreferenceSignals(message);
  const detected = detectIntent(message);
  let { intent, sentiment, confidence } = detected;
  if (
    session.lastIntent === "food_recommendation" &&
    looksLikePreferenceInput(message)
  ) {
    intent = "food_recommendation";
    confidence = Math.max(confidence, 0.9);
  }
  session.preferenceProfile = {
    ...session.preferenceProfile,
    ...preferenceUpdates,
  };

  session.lastIntent = intent;
  session.history.push({
    role: "user",
    content: message,
    createdAt: new Date().toISOString(),
  });

  const order = getOrder(session.orderId);
  let action = "none";
  let actionResult = null;

  if (intent === "complaint_intent") {
    action = "log_complaint";
    actionResult = updateIssue(session.orderId, message);
  }

  if (intent === "refund_intent") {
    action = "trigger_refund";
    actionResult = createRefund(session.orderId, message);
  }

  if (intent === "delivery_query") {
    action = "fetch_order_status";
    actionResult = order
      ? {
          orderId: order.id,
          status: order.status,
          etaMinutes: order.etaMinutes,
          riderName: order.riderName,
        }
      : null;
  }

  if (intent === "food_recommendation") {
    action = "fetch_food_recommendations";
    const missing = getMissingPreferenceFields(session.preferenceProfile);
    const asksNearby = /\b(near me|nearby|around me|restaurants? near)\b/i.test(message);
    if (asksNearby && !session.preferenceProfile.location) {
      action = "ask_location_for_nearby";
      actionResult = { needsLocation: true };
    } else if (asksNearby || session.preferenceProfile.location) {
      action = "fetch_nearby_restaurants";
      actionResult = await getNearbyRestaurants(session.preferenceProfile.location);
    } else if (!session.preferenceProfile.fasting && missing.length > 0) {
      action = "ask_recommendation_preferences";
      actionResult = {
        missing,
      };
    } else if (Object.keys(preferenceUpdates).length > 0 || session.preferenceProfile.fasting) {
      action = "fetch_personalized_food_recommendations";
      actionResult = getPersonalizedRecommendations(session.preferenceProfile);
    } else {
      actionResult = await getFoodRecommendations(message);
    }
  }

  if (intent === "food_topic_query") {
    action = "fetch_food_topic_answer";
    actionResult = await getFoodTopicAnswer(message);
  }

  if (intent === "fallback" && sentiment === "negative") {
    session.escalated = true;
  }

  const generated = await generateReply(intent, message, {
    ...session,
    order,
    action,
    actionResult,
  });

  const escalationLine = session.escalated
    ? " I can also connect you to a human support agent immediately."
    : "";

  let finalText = generated.text;
  if (intent === "delivery_query" && actionResult) {
    finalText = `${generated.text} Current status: ${actionResult.status}. ETA: ${actionResult.etaMinutes} minutes.`;
  }
  if (intent === "refund_intent" && actionResult) {
    finalText = `${generated.text} Refund ID: ${actionResult.refundId}, Amount: INR ${actionResult.amount}.`;
  }
  if (intent === "complaint_intent") {
    finalText = `${generated.text} Could you confirm if you prefer a refund or replacement?`;
  }
  if (intent === "food_recommendation" && Array.isArray(actionResult)) {
    const recLines = actionResult
      .map(
        (item, index) =>
          `${index + 1}. ${item.name} (${item.category}, ${item.cuisine}${
            item.priceInr ? `, INR ${item.priceInr}` : ""
          })`
      )
      .join(" ");
    finalText = `${generated.text} Here are good picks: ${recLines}`;
  }
  if (intent === "food_recommendation" && action === "ask_recommendation_preferences") {
    finalText =
      "I can personalize this perfectly. Please share your diet (veg/non-veg/vegan), spice level (mild/medium/spicy), and budget (example: under 300).";
  }
  if (intent === "food_recommendation" && action === "ask_location_for_nearby") {
    finalText = "Sure, share your location/city and I will suggest nearby options.";
  }
  if (intent === "food_recommendation" && action === "fetch_nearby_restaurants") {
    const restaurants = Array.isArray(actionResult) ? actionResult : [];
    const recLines = restaurants
      .map(
        (item, index) =>
          `${index + 1}. ${item.name} (${item.area}, rating ${item.rating}, ${item.distanceKm} km, ETA ${item.etaMinutes} min)`
      )
      .join(" ");
    finalText = `Here are nearby restaurant suggestions${session.preferenceProfile.location ? ` in ${session.preferenceProfile.location}` : ""}: ${recLines}`;
  }
  if (intent === "food_topic_query" && actionResult) {
    finalText = `${generated.text} ${actionResult.answer} Source: ${actionResult.source}.`;
  }
  if (intent === "fallback") {
    finalText = `${finalText}${escalationLine}`;
  }

  const botMessage = {
    role: "bot",
    content: finalText,
    createdAt: new Date().toISOString(),
  };
  session.history.push(botMessage);

  return {
    reply: finalText,
    intent,
    sentiment,
    confidence,
    action,
    actionResult,
    context: {
      orderId: session.orderId,
      lastIntent: session.lastIntent,
      escalated: session.escalated,
      turns: session.history.length,
      preferenceProfile: session.preferenceProfile,
    },
  };
}

module.exports = {
  detectIntent,
  handleMessage,
  sessions,
};
