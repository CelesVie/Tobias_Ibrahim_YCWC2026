import type { Config } from '@netlify/functions';
import { ensureSeeded } from '../../db/seed.js';
import * as financeEngine from '../../services/financeEngine.js';

export default async (req: Request) => {
  try {
    await ensureSeeded();
    const summary = await financeEngine.getFinancialSummary();
    return Response.json({ success: true, data: summary });
  } catch (error: any) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
};

export const config: Config = {
  path: '/api/finance/summary',
  method: 'GET',
};
