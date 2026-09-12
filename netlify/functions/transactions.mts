import type { Config } from '@netlify/functions';
import { ensureSeeded } from '../../db/seed.js';
import * as financeEngine from '../../services/financeEngine.js';

export default async (req: Request) => {
  const url = new URL(req.url);
  const idMatch = url.pathname.match(/\/api\/transactions\/(\d+)$/);

  try {
    if (req.method === 'GET') {
      await ensureSeeded();
      const limit = url.searchParams.get('limit');
      const type = url.searchParams.get('type');
      const data = await financeEngine.getTransactions({
        limit: limit ? parseInt(limit, 10) : 100,
        type: type || null
      });
      return Response.json({ success: true, count: data.length, data });
    }

    if (req.method === 'POST') {
      const { type, amount, category, description, date } = await req.json();
      if (!type || !amount || !category) {
        return Response.json({
          success: false,
          message: 'Field type, amount, dan category wajib diisi'
        }, { status: 400 });
      }

      const newTx = await financeEngine.addTransaction({ type, amount, category, description, date });

      return Response.json({
        success: true,
        message: 'Transaksi berhasil disimpan',
        data: newTx
      }, { status: 201 });
    }

    if (req.method === 'DELETE' && idMatch) {
      const id = parseInt(idMatch[1], 10);
      const deleted = await financeEngine.deleteTransaction(id);
      if (!deleted) {
        return Response.json({ success: false, message: 'Transaksi tidak ditemukan' }, { status: 404 });
      }
      return Response.json({ success: true, message: 'Transaksi berhasil dihapus' });
    }

    return new Response('Method not allowed', { status: 405 });
  } catch (error: any) {
    const status = req.method === 'POST' ? 400 : 500;
    return Response.json({ success: false, message: error.message }, { status });
  }
};

export const config: Config = {
  path: ['/api/transactions', '/api/transactions/:id'],
  method: ['GET', 'POST', 'DELETE'],
};
