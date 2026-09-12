import type { Config } from '@netlify/functions';
import { seedDatabase } from '../../db/seed.js';
import * as financeEngine from '../../services/financeEngine.js';

export default async (req: Request) => {
  try {
    await seedDatabase(true);
    const summary = await financeEngine.getFinancialSummary();
    return Response.json({
      success: true,
      message: 'Data berhasil di-reset dengan seed dummy awal',
      data: summary
    });
  } catch (error: any) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
};

export const config: Config = {
  path: '/api/finance/reset-seed',
  method: 'POST',
};
