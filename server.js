require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Inisialisasi DB dan Seed Data
const { db } = require('./db/database');
const { seedDatabase } = require('./db/seed');

if (process.env.SKIP_SEED !== 'true') {
  seedDatabase(false);
} else {
  console.log('[Seed] Dilewati (SKIP_SEED=true di .env)');
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes API
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/finance', require('./routes/finance'));
app.use('/api/chat', require('./routes/chat'));

// Layani berkas statis (main.html, styles.css, script.js)
app.use(express.static(__dirname));

// Route root mengembalikan main.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'main.html'));
});

// Jalankan server
app.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🚀 Smart Personal Finance Server is running!`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`📁 Static Files: ${__dirname}`);
  console.log(`🤖 AI Model: ${process.env.GEMINI_MODEL || 'gemini-3.6-flash'}`);
  console.log(`🔑 Gemini API Key: ${process.env.GEMINI_API_KEY ? 'Terpasang ✅' : 'Mode Simulasi Internal (Tambahkan key di .env) ℹ️'}`);
  console.log('====================================================');
});