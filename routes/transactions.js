const express = require('express');
const router = express.Router();
const financeEngine = require('../services/financeEngine');

// GET /api/transactions - Ambil riwayat transaksi
router.get('/', (req, res) => {
  try {
    const { limit, type } = req.query;
    const transactions = financeEngine.getTransactions({
      limit: limit ? parseInt(limit, 10) : 100,
      type: type || null
    });
    res.json({
      success: true,
      count: transactions.length,
      data: transactions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// POST /api/transactions - Tambah transaksi manual
router.post('/', (req, res) => {
  try {
    const { type, amount, category, description, date } = req.body;
    if (!type || !amount || !category) {
      return res.status(400).json({
        success: false,
        message: 'Field type, amount, dan category wajib diisi'
      });
    }

    const newTx = financeEngine.addTransaction({
      type,
      amount,
      category,
      description,
      date
    });

    res.status(201).json({
      success: true,
      message: 'Transaksi berhasil disimpan',
      data: newTx
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// DELETE /api/transactions/:id - Hapus transaksi
router.delete('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const deleted = financeEngine.deleteTransaction(id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Transaksi tidak ditemukan'
      });
    }
    res.json({
      success: true,
      message: 'Transaksi berhasil dihapus'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
