/**
 * PremiumMC Backend - Produkcyjny serwer rang Minecraft
 * Automatyczne nadawanie rang po webhooku Shopify
 */

require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const { Rcon } = require('mcrcon');
const rateLimit = require('express-rate-limit');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const helmet = require('helmet');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.raw({ type: 'application/json' }));

// Rate limiting
const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many webhook requests'
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50
});

// Flexible rate limiter dla kluczowych endpointów
const rateLimiter = new RateLimiterMemory({
  points: 10,
  duration: 60
});

// Database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Shopify Webhook verification
function verifyShopifyWebhook(body, signature) {
  const SHOPIFY_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET;
  const calculated = crypto
    .createHmac('sha256', SHOPIFY_SECRET)
    .update(body, 'utf8')
    .digest('base64');
  
  return `sha256=${calculated}` === signature;
}

// Webhook handler - GŁÓWNY ENDPOINT
app.post('/webhook/orders/paid', webhookLimiter, async (req, res) => {
  try {
    const signature = req.get('X-Shopify-Hmac-Sha256');
    const rawBody = req.body;
    
    // Weryfikacja HMAC
    if (!verifyShopifyWebhook(rawBody, signature)) {
      console.error('❌ Invalid HMAC signature');
      return res.status(401).send('Unauthorized');
    }

    const order = req.body;
    
    // Idempotencja - sprawdź czy już przetworzone
    const [existing] = await pool.execute(
      'SELECT id FROM purchases WHERE order_id = ?',
      [order.id]
    );
    
    if (existing.length > 0) {
      console.log(`✅ Order ${order.id} already processed`);
      return res.status(200).json({ status: 'already_processed' });
    }

    // Przetwarzaj line items
    for (const item of order.line_items) {
      const nickProperty = item.properties.find(p => p.name === 'Nick Minecraft');
      
      if (!nickProperty?.value) {
        console.warn(`⚠️ No nick for item ${item.id} in order ${order.id}`);
        continue;
      }

      const nick = nickProperty.value.trim();
      const rankGroup = item.product.metafields?.rank?.luckperms_group;
      
      if (!rankGroup) {
        console.warn(`⚠️ No LuckPerms group for product ${item.product_id}`);
        continue;
      }

      // Zapisz do bazy (pending)
      await pool.execute(
        `INSERT INTO purchases (order_id, nick, rank, status, created_at) 
         VALUES (?, ?, ?, 'pending', NOW())`,
        [order.id, nick, rankGroup]
      );

      // Nadaj rangę (async)
      this.processRankAssignment(order.id, nick, rankGroup)
        .catch(err => console.error(`❌ Rank assignment failed for ${nick}:`, err));
    }

    console.log(`✅ Webhook processed: Order #${order.id}`);
    res.status(200).json({ status: 'success' });

  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Funkcja nadawania rangi
async function processRankAssignment(orderId, nick, rankGroup) {
  const maxRetries = 3;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Waliduj nick
      if (!/^[a-zA-Z0-9_]{3,16}$/.test(nick)) {
        throw new Error('Invalid Minecraft nick');
      }

      // RCON połączenie
      const rcon = new Rcon(process.env.MC_RCON_HOST, process.env.MC_RCON_PORT, {
        password: process.env.MC_RCON_PASSWORD,
        timeout: 5000
      });

      await rcon.connect();
      
      // LuckPerms komenda
      const command = `lp user ${nick} parent add ${rankGroup}`;
      await rcon.send(command);
      
      await rcon.end();

      // Update status
      await pool.execute(
        'UPDATE purchases SET status = "completed", updated_at = NOW() WHERE order_id = ? AND nick = ? AND rank = ?',
        [orderId, nick, rankGroup]
      );

      console.log(`✅ Rank "${rankGroup}" assigned to ${nick} (attempt ${attempt})`);
      return;

    } catch (error) {
      console.error(`❌ Attempt ${attempt} failed for ${nick}:`, error.message);
      
      if (attempt === maxRetries) {
        // Final failed status
        await pool.execute(
          'UPDATE purchases SET status = "failed", error_message = ?, updated_at = NOW() WHERE order_id = ? AND nick = ? AND rank = ?',
          [error.message, orderId, nick, rankGroup]
        );
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
}

// Admin panel
app.use('/admin', adminLimiter, express.static('admin'));

app.get('/api/purchases', async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (auth !== `Basic ${Buffer.from(`${process.env.ADMIN_USER}:${process.env.ADMIN_PASS}`).toString('base64')}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const [rows] = await pool.execute(
      'SELECT * FROM purchases ORDER BY created_at DESC LIMIT 100'
    );
    
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 PremiumMC Backend running on port ${PORT}`);
});
