# AI-Powered Food Delivery Support Chatbot

A production-style MVP chatbot for food delivery support (Zomato/Swiggy-like) with:

- NLP-style intent detection
- Dialogue/state management with session context
- LLM response generation with OpenAI + template fallback
- External food knowledge integration (Wikipedia + TheMealDB)
- Mock backend APIs (orders + refunds)
- React + Tailwind chat UI

## Project Structure

```bash
project-root/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   └── ChatBox.jsx
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   └── vite.config.js
├── server/
│   ├── routes/
│   │   └── webhook.js
│   ├── services/
│   │   ├── dialogManager.js
│   │   ├── gptService.js
│   │   └── mockDB.js
│   ├── app.js
│   └── package.json
└── README.md
```

## Features

### NLP Intent Detection (Simulated)

Rules in `server/services/dialogManager.js`:

- `refund` -> `refund_intent`
- `not good`, `bad`, `cold`, `wrong item`, `stale`, `late` -> `complaint_intent`
- `where`, `status`, `track`, `arrive`, `delivery` -> `delivery_query`
- `recommend`, `suggest`, `fast`, `fasting`, `vrat`, `what should i eat` -> `food_recommendation`
- `calories`, `protein`, `nutrition`, `healthy`, `explain`, `tell me about` -> `food_topic_query`
- otherwise -> `fallback`

Also returns:
- `sentiment`: `positive | neutral | negative`
- `confidence`: simple score by intent

### Dialogue Management

- Maintains in-memory `sessions` by `sessionId`
- Tracks:
  - last intent
  - conversation turns
  - order context (`ORD123` default)
  - escalation flag
- Triggers action by intent:
  - complaint -> log complaint
  - refund -> create refund
  - delivery query -> fetch order status
  - food recommendation -> fetch recommendations (live/fallback)
  - food topic query -> fetch external topic summary
  - fallback + negative sentiment -> suggest human agent

### GPT Response Generation

`server/services/gptService.js`:

- If `OPENAI_API_KEY` exists -> uses OpenAI chat completion
- Else -> uses empathetic template replies

### Backend APIs

- `POST /webhook` -> main chatbot endpoint
- `GET /order/:id` -> order details/status
- `POST /refund` -> initiate refund
- `GET /health` -> health check

### Frontend Chat Interface

- Message bubbles (user/bot)
- Typing indicator animation
- Timestamps
- Auto-scroll
- Displays intent + confidence metadata for bot messages
- API integration with `http://localhost:5000/webhook`

## Setup Instructions

## 1) Backend

```bash
cd server
npm install
npm run dev
```

Server runs at `http://localhost:5000`

Optional:

```bash
export OPENAI_API_KEY=your_key_here
```

If port `5000` is already in use:

```bash
PORT=5001 npm run dev
```

## 2) Frontend

Open another terminal:

```bash
cd client
npm install
npm run dev
```

Client runs at `http://localhost:5173`

If backend runs on `5001`, set client API base URL:

```bash
echo "VITE_API_BASE_URL=http://localhost:5001" > client/.env
```

## API Contract

### POST `/webhook`

Request:

```json
{
  "message": "food was cold",
  "sessionId": "user123"
}
```

Response example:

```json
{
  "reply": "I am really sorry your experience was not great... Could you confirm if you prefer a refund or replacement?",
  "intent": "complaint_intent",
  "sentiment": "negative",
  "confidence": 0.92,
  "action": "log_complaint",
  "actionResult": {
    "id": "ORD123"
  },
  "context": {
    "orderId": "ORD123",
    "lastIntent": "complaint_intent",
    "escalated": false,
    "turns": 2
  }
}
```

### GET `/order/ORD123`

```json
{
  "success": true,
  "order": {
    "id": "ORD123",
    "restaurant": "Spice Junction",
    "status": "Out for delivery",
    "etaMinutes": 18
  }
}
```

### POST `/refund`

Request:

```json
{
  "orderId": "ORD123",
  "reason": "Food arrived cold"
}
```

Response:

```json
{
  "success": true,
  "message": "Refund initiated",
  "refund": {
    "refundId": "RFD-1712500000000",
    "orderId": "ORD123",
    "amount": 279,
    "status": "initiated"
  }
}
```

## Test Cases

Send these messages from UI:

1. `food was cold` -> complaint + apology + follow-up
2. `where is my order` -> delivery status + ETA
3. `I want refund` -> refund action + refund ID confirmation
4. `wrong item delivered` -> complaint handling + remedy prompt
5. `i am on a fast recommend me anything` -> fasting-friendly food recommendations
6. `tell me about mediterranean diet` -> food-topic answer with external source

## Notes

- This is a complete runnable prototype.
- Session context is in-memory (replace with Redis/DB for production scale).
- Intent detection is rules-based (can be swapped with Dialogflow ES/NLU service).
- Personalized recommendation memory now supports: diet, spice level, budget, calorie goal, and fasting mode.
- Added advanced recommendation context: meal time (breakfast/lunch/dinner), nearby location lookup, and allergy filters (nuts/dairy/gluten/soy).
