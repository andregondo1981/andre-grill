const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const Stripe = require('stripe');

const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mockkey');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

app.use(cors());
app.use(express.json());

// Initialize Database Table
async function initDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        customer_name VARCHAR(100),
        phone VARCHAR(30),
        items TEXT,
        total_amount NUMERIC(10,2),
        payment_status VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Database table 'orders' initialized successfully.");
  } catch (err) {
    console.error("Database initialization error:", err.message);
  }
}
initDb();

// Order & Payment Intent Endpoint
app.post('/api/create-order-payment', async (req, res) => {
  const { customer_name, phone, items, amount } = req.body;
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      metadata: { customer_name, phone }
    });

    const query = `
      INSERT INTO orders (customer_name, phone, items, total_amount, payment_status)
      VALUES ($1, $2, $3, $4, $5) RETURNING *;
    `;
    const values = [customer_name, phone, JSON.stringify(items), amount, 'pending'];
    const dbResult = await pool.query(query, values);

    res.json({
      clientSecret: paymentIntent.client_secret,
      orderId: dbResult.rows[0].id
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Health check endpoint for ALB
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));