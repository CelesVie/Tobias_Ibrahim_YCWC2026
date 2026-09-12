const express = require('express');
const router = express.Router();
const { processChatMessage } = require('../services/aiAdvisor');

// POST /api/chat - Endpoint Agentic AI Chatbot dengan Function Calling
router.post('/', async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Pesan chat wajib diisi'
      });
    }

    const result = await processChatMessage({
      message: message.trim(),
      history: Array.isArray(history) ? history : []
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    // Log detail lengkap buat developer (di server, gak dikirim ke client)
    console.error('[Route /api/chat Error]:', error);

    res.status(500).json({
      success: false,
      // Pesan ke user: generic, gak bocorin detail internal (nama variable,
      // stack trace, dsb). Detail sebenarnya cuma ada di server log di atas.
      message: 'Maaf, FinAdvisor AI sedang mengalami gangguan. Silakan coba lagi dalam beberapa saat.'
    });
  }
});

module.exports = router;