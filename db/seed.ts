import { sql } from "drizzle-orm";
import { db } from "./index.js";
import { transactions } from "./schema.js";

export const seedTransactions = [
  {
    type: 'INCOME',
    amount: 10000000,
    category: 'Gaji',
    description: 'Gaji Pokok Bulanan Perusahaan',
    date: '2026-09-01'
  },
  {
    type: 'INCOME',
    amount: 2500000,
    category: 'Freelance',
    description: 'Pembayaran Project Website Landing Page',
    date: '2026-09-03'
  },
  {
    type: 'EXPENSE',
    amount: 2500000,
    category: 'Sewa/Kebutuhan Rumah',
    description: 'Biaya Sewa Apartemen / Kos Bulanan',
    date: '2026-09-01'
  },
  {
    type: 'EXPENSE',
    amount: 1500000,
    category: 'Makanan Utama',
    description: 'Belanja Mingguan Supermarket & Bahan Dapur',
    date: '2026-09-02'
  },
  {
    type: 'EXPENSE',
    amount: 600000,
    category: 'Tagihan/Utilitas',
    description: 'Tagihan Listrik PLN, Air PDAM & Wi-Fi',
    date: '2026-09-02'
  },
  {
    type: 'EXPENSE',
    amount: 450000,
    category: 'Transportasi Kerja',
    description: 'Bensin Motor, Tol, dan Tiket KRL Komuter',
    date: '2026-09-03'
  },
  {
    type: 'EXPENSE',
    amount: 850000,
    category: 'Jajan/Coffee Shop',
    description: 'Kopi Specialty & Nongkrong Kafe Akhir Pekan',
    date: '2026-09-04'
  },
  {
    type: 'EXPENSE',
    amount: 1200000,
    category: 'Entertainment/Gaming',
    description: 'Pembelian Game Steam Summer Sale & Battle Pass',
    date: '2026-09-04'
  },
  {
    type: 'EXPENSE',
    amount: 300000,
    category: 'Langganan/Subscription Stream',
    description: 'Langganan Bulanan Netflix, Spotify & YouTube Premium',
    date: '2026-09-05'
  }
];

export async function seedDatabase(force = false) {
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(transactions);

  if (count > 0 && !force) {
    return;
  }

  if (force) {
    await db.delete(transactions);
  }

  await db.insert(transactions).values(seedTransactions);
}

export async function ensureSeeded() {
  if (process.env.SKIP_SEED === 'true') {
    return;
  }
  await seedDatabase(false);
}
