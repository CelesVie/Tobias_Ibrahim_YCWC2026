const express = require('express');
const router = express.Router();
const financeEngine = require('../services/financeEngine');
const { seedDatabase } = require('../db/seed');

// GET /api/finance/summary - Hitung agregat saldo, pemasukan, pengeluaran, Needs vs Wants, rasio 20%
router.get('/summary', (req, res) => {
  try {
    const summary = financeEngine.getFinancialSummary();
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// POST /api/finance/reset-seed - Reset dan muat ulang seed data dummy
router.post('/reset-seed', (req, res) => {
  try {
    seedDatabase(true);
    const summary = financeEngine.getFinancialSummary();
    res.json({
      success: true,
      message: 'Data berhasil di-reset dengan seed dummy awal',
      data: summary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
