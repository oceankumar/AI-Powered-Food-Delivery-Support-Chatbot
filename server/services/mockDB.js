const mockDB = {
  orders: {
    ORD123: {
      id: "ORD123",
      customerName: "Aarav Mehta",
      restaurant: "Spice Junction",
      items: ["Paneer Tikka Wrap", "Masala Fries"],
      totalAmount: 349,
      status: "Out for delivery",
      etaMinutes: 18,
      riderName: "Rahul",
      riderPhone: "+91-9000000001",
      issueHistory: [],
      refundHistory: [],
    },
    ORD456: {
      id: "ORD456",
      customerName: "Isha Verma",
      restaurant: "Biryani House",
      items: ["Chicken Biryani", "Raita"],
      totalAmount: 499,
      status: "Delivered",
      etaMinutes: 0,
      riderName: "Neha",
      riderPhone: "+91-9000000002",
      issueHistory: [],
      refundHistory: [],
    },
    ORD789: {
      id: "ORD789",
      customerName: "Kabir Singh",
      restaurant: "Green Bowl",
      items: ["Quinoa Salad", "Cold Pressed Juice"],
      totalAmount: 420,
      status: "Preparing at restaurant",
      etaMinutes: 28,
      riderName: null,
      riderPhone: null,
      issueHistory: [],
      refundHistory: [],
    },
  },
};

function getOrder(orderId) {
  return mockDB.orders[orderId] || null;
}

function updateIssue(orderId, issue) {
  const order = getOrder(orderId);
  if (!order) return null;

  order.issueHistory.push({
    issue,
    createdAt: new Date().toISOString(),
  });

  return order;
}

function createRefund(orderId, reason) {
  const order = getOrder(orderId);
  if (!order) return null;

  const refundAmount = Math.round(order.totalAmount * 0.8);
  const refund = {
    refundId: `RFD-${Date.now()}`,
    orderId,
    reason,
    amount: refundAmount,
    currency: "INR",
    status: "initiated",
    expectedInDays: 5,
    createdAt: new Date().toISOString(),
  };

  order.refundHistory.push(refund);
  return refund;
}

module.exports = {
  mockDB,
  getOrder,
  updateIssue,
  createRefund,
};
