import { desc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { transactions } from "../db/schema.js";
import { getCategoryGroup, evaluateFinancialHealth } from "./financeRules.js";

interface CategoryItem {
  type: string;
  category: string;
  total: number;
  count: number;
  group: string;
  percentageOfGroup: number;
  percentageOfExpense?: number;
  percentageOfIncome?: number;
}

/**
 * Mengambil ringkasan data finansial agregat secara matematis dan dinamis
 */
export async function getFinancialSummary() {
  const allTransactions = await db.select().from(transactions);

  let totalIncome = 0;
  let totalExpense = 0;
  const groupTotals = new Map<string, { type: string; category: string; total: number; count: number }>();

  for (const tx of allTransactions) {
    const amount = Number(tx.amount);
    if (tx.type === 'INCOME') {
      totalIncome += amount;
    } else {
      totalExpense += amount;
    }

    const key = `${tx.type}::${tx.category}`;
    const existing = groupTotals.get(key);
    if (existing) {
      existing.total += amount;
      existing.count += 1;
    } else {
      groupTotals.set(key, { type: tx.type, category: tx.category, total: amount, count: 1 });
    }
  }

  const netBalance = totalIncome - totalExpense;

  let needsExpense = 0;
  let wantsExpense = 0;
  const categoryBreakdown: CategoryItem[] = [];
  const wantsBreakdown: CategoryItem[] = [];
  const needsBreakdown: CategoryItem[] = [];

  const sortedGroups = [...groupTotals.values()].sort((a, b) => b.total - a.total);

  for (const row of sortedGroups) {
    const group = getCategoryGroup(row.category, row.type);

    const item: CategoryItem = {
      type: row.type,
      category: row.category,
      total: row.total,
      count: row.count,
      group,
      percentageOfGroup: 0
    };

    if (row.type === 'EXPENSE') {
      if (group === 'NEEDS') {
        needsExpense += row.total;
        needsBreakdown.push(item);
      } else if (group === 'WANTS') {
        wantsExpense += row.total;
        wantsBreakdown.push(item);
      }
    }
    categoryBreakdown.push(item);
  }

  // Hitung persentase terhadap total expense/income
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
export async function getTransactions({ limit = 100, type = null as string | null } = {}) {
  const query = db.select().from(transactions);

  const rows = type && ['INCOME', 'EXPENSE'].includes(type)
    ? await query.where(eq(transactions.type, type)).orderBy(desc(transactions.date), desc(transactions.id)).limit(limit)
    : await query.orderBy(desc(transactions.date), desc(transactions.id)).limit(limit);

  return rows.map(r => ({
    ...r,
    group: getCategoryGroup(r.category, r.type)
  }));
}

interface NewTransactionInput {
  type: string;
  amount: number | string;
  category: string;
  description?: string | null;
  date?: string;
}

/**
 * Menambahkan transaksi baru
 */
export async function addTransaction({ type, amount, category, description, date }: NewTransactionInput) {
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
    const summary = await getFinancialSummary();
    if (parsedAmount > summary.netBalance) {
      const formattedExpense = 'Rp ' + parsedAmount.toLocaleString('id-ID');
      const formattedBalance = 'Rp ' + (summary.netBalance || 0).toLocaleString('id-ID');
      throw new Error(`Nominal pengeluaran (${formattedExpense}) melebihi saldo bersih Anda saat ini (${formattedBalance}). Transaksi tidak dapat disimpan.`);
    }
  }

  const [newTx] = await db.insert(transactions).values({
    type,
    amount: parsedAmount,
    category: category.trim(),
    description: description ? description.trim() : null,
    date
  }).returning();

  return {
    ...newTx,
    group: getCategoryGroup(newTx.category, newTx.type)
  };
}

/**
 * Menghapus transaksi berdasarkan ID
 */
export async function deleteTransaction(id: number) {
  const [deleted] = await db.delete(transactions).where(eq(transactions.id, id)).returning();
  return !!deleted;
}
