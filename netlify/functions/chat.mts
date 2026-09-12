import type { Config } from '@netlify/functions';
import { processChatMessage } from '../../services/aiAdvisor.js';

export default async (req: Request) => {
  try {
    const { message, history } = await req.json();

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return Response.json({ success: false, message: 'Pesan chat wajib diisi' }, { status: 400 });
    }

    const result = await processChatMessage({
      message: message.trim(),
      history: Array.isArray(history) ? history : []
    });

    return Response.json({ success: true, data: result });
  } catch (error) {
    // Log detail lengkap buat developer (di server, gak dikirim ke client)
    console.error('[Function /api/chat Error]:', error);

    return Response.json({
      success: false,
      // Pesan ke user: generic, gak bocorin detail internal (nama variable,
      // stack trace, dsb). Detail sebenarnya cuma ada di server log di atas.
      message: 'Maaf, FinAdvisor AI sedang mengalami gangguan. Silakan coba lagi dalam beberapa saat.'
    }, { status: 500 });
  }
};

export const config: Config = {
  path: '/api/chat',
  method: 'POST',
};
