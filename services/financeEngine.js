const { db } = require('../db/database');
const { CATEGORIES, getCategoryGroup, evaluateFinancialHealth } = require('./financeRules');

/**
 * Mengambil ringkasan data finansial agregat secara matematis dan dinamis
 */
function getFinancialSummary() {
  // Total Income
  const incomeRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM transactions
    WHERE type = 'INCOME'
  `).get();
  const totalIncome = Number(incomeRow.total) || 0;

  // Total Expense
  const expenseRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM transactions
    WHERE type = 'EXPENSE'
  `).get();
  const totalExpense = Number(expenseRow.total) || 0;

  // Saldo Akhir / Net Balance
  const netBalance = totalIncome - totalExpense;

  // Breakdown per kategori
  const categoryRows = db.prepare(`
    SELECT type, category, SUM(amount) AS total, COUNT(id) AS count
    FROM transactions
    GROUP BY type, category
    ORDER BY total DESC
  `).all();

  let needsExpense = 0;
  let wantsExpense = 0;
  const categoryBreakdown = [];
  const wantsBreakdown = [];
  const needsBreakdown = [];

  for (const row of categoryRows) {
    const total = Number(row.total);
    const group = getCategoryGroup(row.category, row.type);

    const item = {
      type: row.type,
      category: row.category,
      total,
      count: row.count,
      group,
      percentageOfGroup: 0
    };

    if (row.type === 'EXPENSE') {
      if (group === 'NEEDS') {
        needsExpense += total;
        needsBreakdown.push(item);
      } else if (group === 'WANTS') {
        wantsExpense += total;
        wantsBreakdown.push(item);
      }
    }
    categoryBreakdown.push(item);
  }

  // Hitung persentase terhadap total expense
  for (const item of categoryBreakdown) {
    if (item.type === 'EXPENSE' && totalExpense > 0) {
      item.percentageOfExpense = Number(((item.total / totalExpense) * 100).toFixed(1));
    } else if (item.type === 'INCOME' && totalIncome > 0) {
      item.percentageOfIncome = Number(((item.total / totalIncome) * 100).toFixed(1));
    }
  }

  // Evaluasi aturan kesehatan finansial (Target 20% & Warning Wants > 30%)
  const healthRules = evaluateFinancialHealth({
    totalIncome,
    totalExpense,
    netBalance,
    needsExpense,
    wantsExpense,
    wantsBreakdown
  });

  return {
    totalIncome,
    totalExpense,
    netBalance,
    needsExpense,
    wantsExpense,
    wantsBreakdown,
    needsBreakdown,
    categoryBreakdown,
    ...healthRules
  };
}

/**
 * Mengambil daftar transaksi dengan pagination dan filter
 */
function getTransactions({ limit = 100, type = null } = {}) {
  let sql = 'SELECT * FROM transactions';
  const params = [];

  if (type && ['INCOME', 'EXPENSE'].includes(type)) {
    sql += ' WHERE type = ?';
    params.push(type);
  }

  sql += ' ORDER BY date DESC, id DESC LIMIT ?';
  params.push(limit);

  const rows = db.prepare(sql).all(...params);

  return rows.map(r => ({
    ...r,
    group: getCategoryGroup(r.category, r.type)
  }));
}

/**
 * Menambahkan transaksi baru
 */
function addTransaction({ type, amount, category, description, date }) {
  if (!['INCOME', 'EXPENSE'].includes(type)) {
    throw new Error("Tipe transaksi harus 'INCOME' atau 'EXPENSE'");
  }
  const parsedAmount = Number(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    throw new Error('Nominal transaksi harus berupa angka lebih dari 0');
  }
  if (!category || typeof category !== 'string') {
    throw new Error('Kategori transaksi wajib diisi');
  }
  if (!date) {
    date = new Date().toISOString().split('T')[0];
  }

  // Validasi: Pengeluaran tidak boleh melebihi saldo bersih saat ini
  if (type === 'EXPENSE') {
    const summary = getFinancialSummary();
    if (parsedAmount > summary.netBalance) {
      const formattedExpense = 'Rp ' + parsedAmount.toLocaleString('id-ID');
      const formattedBalance = 'Rp ' + (summary.netBalance || 0).toLocaleString('id-ID');
      throw new Error(`Nominal pengeluaran (${formattedExpense}) melebihi saldo bersih Anda saat ini (${formattedBalance}). Transaksi tidak dapat disimpan.`);
    }
  }

  const insert = db.prepare(`
    INSERT INTO transactions (type, amount, category, description, date)
    VALUES (?, ?, ?, ?, ?)
  `);

  const result = insert.run(type, parsedAmount, category.trim(), description ? description.trim() : null, date);

  const newTx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(result.lastInsertRowid);
  return {
    ...newTx,
    group: getCategoryGroup(newTx.category, newTx.type)
  };
}

/**
 * Menghapus transaksi berdasarkan ID
 */
function deleteTransaction(id) {
  const check = db.prepare('SELECT id FROM transactions WHERE id = ?').get(id);
  if (!check) {
    return false;
  }
  db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
  return true;
}

module.exports = {
  getFinancialSummary,
  getTransactions,
  addTransaction,
  deleteTransaction
};
