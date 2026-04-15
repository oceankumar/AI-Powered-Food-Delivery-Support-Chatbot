const express = require("express");
const { handleMessage } = require("../services/dialogManager");
const { getOrder, createRefund } = require("../services/mockDB");

const router = express.Router();

router.post("/webhook", async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message || !sessionId) {
      return res.status(400).json({
        error: "message and sessionId are required",
      });
    }

    const result = await handleMessage({ message, sessionId });
    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      error: "Internal server error",
      detail: error.message,
    });
  }
});

router.get("/order/:id", (req, res) => {
  const order = getOrder(req.params.id);

  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Order not found",
    });
  }

  return res.json({
    success: true,
    order: {
      id: order.id,
      restaurant: order.restaurant,
      status: order.status,
      etaMinutes: order.etaMinutes,
      items: order.items,
      totalAmount: order.totalAmount,
      riderName: order.riderName,
      riderPhone: order.riderPhone,
    },
  });
});
// made this
router.post("/refund", (req, res) => {
  const { orderId, reason = "Customer requested refund" } = req.body;

  if (!orderId) {
    return res.status(400).json({
      success: false,
      message: "orderId is required",
    });
  }

  const refund = createRefund(orderId, reason);
  if (!refund) {
    return res.status(404).json({
      success: false,
      message: "Order not found",
    });
  }

  return res.status(201).json({
    success: true,
    message: "Refund initiated",
    refund,
  });
});

module.exports = router;
