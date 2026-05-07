/**
 * routes/payment.js  –  Razorpay payment integration
 * POST /api/payment/create-order  →  creates a Razorpay order (returns orderId)
 */

const router   = require('express').Router();
const Razorpay = require('razorpay');

const rzp = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// POST /api/payment/create-order
// Body: { amount: 499 }  ← amount in ₹ (NOT paise)
router.post('/create-order', async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || isNaN(amount) || amount <= 0)
      return res.status(400).json({ error: 'Valid amount is required.' });

    const order = await rzp.orders.create({
      amount:   Math.round(amount * 100), // ₹ → paise
      currency: 'INR',
      receipt:  'kb_' + Date.now(),
    });

    res.json({
      orderId:  order.id,
      amount:   order.amount,   // in paise
      currency: order.currency,
    });
  } catch (err) {
    console.error('Razorpay error:', err);
    res.status(500).json({ error: err.message || 'Payment gateway error.' });
  }
});

module.exports = router;
