// Pemetaan Kategori & Aturan Financial Intelligence Engine

export const CATEGORIES = {
  NEEDS: [
    'Makanan Utama',
    'Tagihan/Utilitas',
    'Sewa/Kebutuhan Rumah',
    'Transportasi Kerja',
    'Kesehatan',
    'Pendidikan'
  ],
  WANTS: [
    'Jajan/Coffee Shop',
    'Entertainment/Gaming',
    'Belanja Hobi',
    'Langganan/Subscription Stream',
    'Gaya Hidup'
  ],
  INCOME: [
    'Gaji',
    'Freelance',
    'Investasi',
    'Bonus',
    'Lain-lain'
  ]
};

/**
 * Mengidentifikasi grup kategori: 'NEEDS', 'WANTS', atau 'INCOME'
 */
export function getCategoryGroup(category: string, type: string = 'EXPENSE') {
  if (type === 'INCOME') return 'INCOME';
  if (CATEGORIES.NEEDS.includes(category)) return 'NEEDS';
  if (CATEGORIES.WANTS.includes(category)) return 'WANTS';
  return 'OTHER';
}

interface WantsItem {
  category: string;
  total: number;
  [key: string]: unknown;
}

interface HealthInput {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  needsExpense: number;
  wantsExpense: number;
  wantsBreakdown?: WantsItem[];
}

/**
 * Evaluasi aturan finansial (Savings Target 20% & Wants Warning > 30%)
 */
export function evaluateFinancialHealth({ totalIncome, totalExpense, netBalance, needsExpense, wantsExpense, wantsBreakdown = [] }: HealthInput) {
  // Target tabungan ideal: 20% dari total pemasukan
  const idealSavingsTarget = Math.round(totalIncome * 0.20);

  // Defisit tabungan jika saldo saat ini di bawah target ideal
  const isSavingsDeficit = netBalance < idealSavingsTarget;
  const savingsDeficit = isSavingsDeficit ? (idealSavingsTarget - netBalance) : 0;

  // Rasio Wants terhadap total pengeluaran
  const wantsRatio = totalExpense > 0 ? Number(((wantsExpense / totalExpense) * 100).toFixed(1)) : 0;
  const needsRatio = totalExpense > 0 ? Number(((needsExpense / totalExpense) * 100).toFixed(1)) : 0;

  // Peringatan pengeluaran impulsif jika Wants > 30% dari total pengeluaran
  const isWantsWarning = wantsRatio > 30;

  // Identifikasi kategori Wants terbesar yang berpotensi dipotong
  const sortedWants = [...wantsBreakdown].sort((a, b) => b.total - a.total);
  const topWantsCategory = sortedWants.length > 0 ? sortedWants[0] : null;

  let warningMessage = null;
  if (isWantsWarning) {
    warningMessage = `PERINGATAN IMPULSIF: Rasio pengeluaran sekunder (Wants) Anda mencapai ${wantsRatio}% dari total pengeluaran (Batas wajar ideal adalah maksimal 30%).`;
  }

  let savingsRecommendation;
  if (isSavingsDeficit) {
    savingsRecommendation = {
      status: 'DEFICIT',
      idealSavingsTarget,
      currentBalance: netBalance,
      deficitAmount: savingsDeficit,
      advice: `Saldo Anda saat ini (Rp ${netBalance.toLocaleString('id-ID')}) belum mencapai target tabungan ideal 20% (Rp ${idealSavingsTarget.toLocaleString('id-ID')}). Anda kekurangan Rp ${savingsDeficit.toLocaleString('id-ID')}. Disarankan memangkas pengeluaran di pos ${topWantsCategory ? `"${topWantsCategory.category}" (sebesar Rp ${topWantsCategory.total.toLocaleString('id-ID')})` : 'kategori Wants'}.`
    };
  } else {
    savingsRecommendation = {
      status: 'HEALTHY',
      idealSavingsTarget,
      currentBalance: netBalance,
      deficitAmount: 0,
      advice: `Kondisi tabungan Anda sangat sehat! Saldo saat ini (Rp ${netBalance.toLocaleString('id-ID')}) telah melampaui target tabungan minimum 20% (Rp ${idealSavingsTarget.toLocaleString('id-ID')}). Pertahankan rasio ini!`
    };
  }

  return {
    idealSavingsTarget,
    isSavingsDeficit,
    savingsDeficit,
    wantsRatio,
    needsRatio,
    isWantsWarning,
    warningMessage,
    topWantsCategory,
    savingsRecommendation
  };
}
