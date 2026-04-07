const OpenAI = require("openai");

const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY);

let client = null;
if (hasOpenAIKey) {
  client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function buildFallbackReply(intent, userMessage, context) {
  const orderId = context.orderId || "ORD123";

  const templates = {
    complaint_intent:
      "I am really sorry your experience was not great. I understand how frustrating this feels. I have noted this issue for your order and can help with a refund or replacement right away.",
    refund_intent:
      "Thank you for confirming. I have initiated a refund request for your order. You will receive an update shortly, and the amount should reflect in your account within 3-5 business days.",
    delivery_query:
      "I checked your order update. It is currently in transit and should reach you soon. I can keep tracking it for you if you would like live updates.",
    food_recommendation:
      "Great question. I can absolutely suggest options based on your preference and situation.",
    food_topic_query:
      "Nice topic. Here is a quick and practical explanation to help you decide better.",
    fallback:
      "I want to make sure I help correctly. Could you share whether this is about order status, refund, or a food quality issue?",
  };

  const confidence = intent === "fallback" ? 0.42 : 0.87;

  return {
    text: templates[intent] || templates.fallback,
    confidence,
    metadata: {
      model: "template-fallback",
      orderId,
      userMessage,
    },
  };
}

async function generateReply(intent, userMessage, context) {
  if (!client) {
    return buildFallbackReply(intent, userMessage, context);
  }

  try {
    const prompt = [
      "You are an empathetic customer support agent for a food delivery app.",
      "Reply in 1-3 short sentences.",
      "Be polite, human, and action-oriented.",
      `Intent: ${intent}`,
      `User message: ${userMessage}`,
      `Context: ${JSON.stringify(context)}`,
    ].join("\n");

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content:
            "You are a helpful and empathetic food delivery support assistant.",
        },
        { role: "user", content: prompt },
      ],
    });

    return {
      text:
        completion.choices?.[0]?.message?.content?.trim() ||
        buildFallbackReply(intent, userMessage, context).text,
      confidence: intent === "fallback" ? 0.5 : 0.9,
      metadata: {
        model: completion.model || "openai",
      },
    };
  } catch (error) {
    return {
      ...buildFallbackReply(intent, userMessage, context),
      metadata: {
        model: "template-fallback",
        note: `OpenAI failed: ${error.message}`,
      },
    };
  }
}

module.exports = {
  generateReply,
};
