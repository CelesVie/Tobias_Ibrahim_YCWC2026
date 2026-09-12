const { GoogleGenAI, Type } = require('@google/genai');
const financeEngine = require('./financeEngine');

const SYSTEM_PROMPT = `Anda adalah "FinAdvisor AI", seorang Penasihat Keuangan Pribadi (Agentic Financial Advisor) yang ramah, profesional, objektif, ringkas, dan sangat presisi dalam angka.

ATURAN UTAMA & PROTOKOL AGENTIC:
1. DILARANG KERAS memprediksi, mengarang, atau menghitung angka matematika saldo/pengeluaran secara mandiri.
2. Setiap kali pengguna menanyakan status keuangan, anggaran, evaluasi, tabungan, perbandingan kategori, atau saran finansial, Anda WAJIB memanggil function 'get_financial_summary' untuk mengambil data kalkulasi riil dari backend.
3. Gunakan data angka riil yang didapatkan dari pemanggilan fungsi untuk menyusun jawaban. Jangan pernah mengubah nominal angka riil tersebut.
4. PERIKSA ATURAN PENGELUARAN IMPULSIF (Wants Warning):
   - Jika rasio pengeluaran kategori Wants (Tidak Penting/Sekunder) > 30% dari total pengeluaran, Anda WAJIB menampilkan blok Peringatan (⚠️ WARNING) yang tegas, jelas, dan konstruktif. Berikan saran pemangkasan spesifik pada pos Wants terbesar.
5. PERIKSA ATURAN TARGET TABUNGAN (Savings Target):
   - Target tabungan ideal adalah minimal 20% dari total pemasukan.
   - Jika Saldo Saat Ini < Target Tabungan, sebutkan status DEFISIT beserta nominal kekurangannya, dan berikan rekomendasi aksi pemotongan anggaran dari kategori Wants.
   - Jika Saldo Saat Ini >= Target Tabungan, berikan apresiasi positif atas kedisiplinan finansialnya.
6. FORMAT PENYAJIAN:
   - Gunakan Markdown yang rapi dengan heading, bullet point, format Rupiah (misal: Rp 2.500.000), serta tabel ringkas jika membandingkan pos pengeluaran.
   - Bersikaplah suportif, solutif, dan hindari penjelasan bertele-tele.`;

const getFinancialSummaryDeclaration = {
  name: 'get_financial_summary',
  description: 'Mengambil ringkasan kalkulasi riil keuangan pengguna dari database backend. Menghasilkan total pemasukan, total pengeluaran, saldo akhir, breakdown per kategori (Needs vs Wants), rasio pengeluaran sekunder, dan status target tabungan 20%. WAJIB dipanggil untuk pertanyaan keuangan.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      includeCategoryBreakdown: {
        type: Type.BOOLEAN,
        description: 'Sertakan rincian per kategori pengeluaran dan pemasukan (default: true)'
      }
    }
  }
};

/**
 * Format angka rupiah untuk tampilan
 */
function formatRupiah(num) {
  return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
}

/**
 * Fallback AI Advisor cerdas jika GEMINI_API_KEY belum disetel
 * Mensimulasikan agentic LLM function calling secara presisi
 */
function generateFallbackAdvisorResponse(message, summary) {
  const {
    totalIncome,
    totalExpense,
    netBalance,
    needsExpense,
    wantsExpense,
    wantsRatio,
    needsRatio,
    idealSavingsTarget,
    isSavingsDeficit,
    savingsDeficit,
    isWantsWarning,
    topWantsCategory,
    wantsBreakdown
  } = summary;

  let warningBlock = '';
  if (isWantsWarning) {
    warningBlock = `
> ⚠️ **PERINGATAN DETEKSI PENGELUARAN IMPULSIF!**
> Rasio pengeluaran sekunder (*Wants*) Anda mencapai **${wantsRatio}%** dari total pengeluaran, melampaui batas wajar ideal (**maksimal 30%**).
> Pos pengeluaran sekunder terbesar Anda: **${topWantsCategory ? topWantsCategory.category + ' (' + formatRupiah(topWantsCategory.total) + ')' : '-'}**.
`;
  }

  let savingsBlock = '';
  if (isSavingsDeficit) {
    savingsBlock = `
- **Status Tabungan**: 🔴 **Defisit Tabungan**
- **Target Tabungan Ideal (20%)**: ${formatRupiah(idealSavingsTarget)}
- **Saldo Bersih Saat Ini**: ${formatRupiah(netBalance)}
- **Kekurangan / Defisit**: **${formatRupiah(savingsDeficit)}**
- **Rekomendasi Pemotongan**: Untuk mencapai target 20%, potong anggaran dari kategori **${topWantsCategory ? topWantsCategory.category : 'Wants'}** sebesar minimal **${formatRupiah(savingsDeficit)}**.
`;
  } else {
    savingsBlock = `
- **Status Tabungan**: 🟢 **Sehat & Aman**
- **Target Tabungan Ideal (20%)**: ${formatRupiah(idealSavingsTarget)}
- **Saldo Bersih Saat Ini**: ${formatRupiah(netBalance)} (Melampaui target ideal sebesar ${formatRupiah(netBalance - idealSavingsTarget)})
- **Apresiasi**: Pengelolaan keuangan Anda sangat disiplin! Anda telah menyisihkan lebih dari 20% pemasukan bersih.
`;
  }

  let topWantsList = '';
  if (wantsBreakdown && wantsBreakdown.length > 0) {
    topWantsList = wantsBreakdown.slice(0, 3).map(w => `  - ${w.category}: **${formatRupiah(w.total)}** (${w.percentageOfExpense}% dari pengeluaran)`).join('\n');
  }

  return `### 📊 Ringkasan Analisis Finansial Pribadi

Berdasarkan data kalkulasi riil dari backend (*Financial Engine*):

| Parameter | Nominal | Persentase / Status |
| :--- | :--- | :--- |
| **Total Pemasukan** | **${formatRupiah(totalIncome)}** | 100% |
| **Total Pengeluaran** | **${formatRupiah(totalExpense)}** | ${totalIncome > 0 ? ((totalExpense / totalIncome) * 100).toFixed(1) : 0}% dari pemasukan |
| • Kebutuhan Pokok (*Needs*) | ${formatRupiah(needsExpense)} | ${needsRatio}% dari pengeluaran |
| • Keinginan/Sekunder (*Wants*) | ${formatRupiah(wantsExpense)} | **${wantsRatio}%** dari pengeluaran |
| **Saldo Bersih Saat Ini** | **${formatRupiah(netBalance)}** | - |

${warningBlock}
### 💡 Evaluasi & Rekomendasi Alokasi Tabungan (20% Target)
${savingsBlock}

${wantsBreakdown && wantsBreakdown.length > 0 ? `### 🎯 Rincian Pos Pengeluaran Sekunder (Wants):\n${topWantsList}\n` : ''}
*Catatan: FinAdvisor AI menggunakan Function Calling backend untuk memastikan seluruh angka 100% akurat sesuai data pencatatan Anda.*`;
}

/**
 * Handle chat interaktif dengan agentic function calling
 */
async function processChatMessage({ message, history = [] }) {
  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

  // Jika tidak ada API key atau API key masih default dummy, gunakan agentic simulation
  if (!apiKey || apiKey.trim() === '' || apiKey === 'your_gemini_api_key_here') {
    const summary = financeEngine.getFinancialSummary();
    const reply = generateFallbackAdvisorResponse(message, summary);
    return {
      reply,
      toolCalled: true,
      toolName: 'get_financial_summary',
      summaryData: summary,
      source: 'local_agentic_engine'
    };
  }

  let summaryData = null;

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Format riwayat chat untuk Gemini API
    const contents = [];

    for (const h of history) {
      if (h.role && h.content) {
        contents.push({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.content }]
        });
      }
    }

    // Tambahkan pesan user saat ini
    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    // Panggil model dengan tools function calling
    const response = await ai.models.generateContent({
      model: modelName,
      contents,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        tools: [{ functionDeclarations: [getFinancialSummaryDeclaration] }]
      }
    });

    // Cek apakah model meminta function call
    let toolCalled = false;

    if (response.functionCalls && response.functionCalls.length > 0) {
      const call = response.functionCalls[0];
      if (call.name === 'get_financial_summary') {
        toolCalled = true;
        summaryData = financeEngine.getFinancialSummary();

        // Putaran kedua: kembalikan hasil data fungsi ke model
        // PENTING: pakai content asli dari response (bukan rekonstruksi manual),
        // supaya thoughtSignature yang nempel di part functionCall ikut terbawa.
        // Model generasi 3.x (thinking model) akan reject request kalau
        // signature ini hilang/dibuang.
        const modelTurn = response.candidates?.[0]?.content;
        contents.push(
          modelTurn || { role: 'model', parts: [{ functionCall: call }] }
        );

        contents.push({
          role: 'user',
          parts: [{
            functionResponse: {
              name: 'get_financial_summary',
              response: summaryData
            }
          }]
        });

        const followUpResponse = await ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction: SYSTEM_PROMPT,
            tools: [{ functionDeclarations: [getFinancialSummaryDeclaration] }]
          }
        });

        return {
          reply: followUpResponse.text || 'Maaf, tidak dapat menghasilkan respons.',
          toolCalled: true,
          toolName: 'get_financial_summary',
          summaryData,
          source: 'gemini_api'
        };
      }
    }

    return {
      reply: response.text || 'Terima kasih atas pertanyaan Anda.',
      toolCalled,
      summaryData,
      source: 'gemini_api'
    };

  } catch (error) {
    console.error('[AI Advisor Error]:', error);
    // Fallback ke agentic calculation internal jika terjadi error koneksi ke Google API
    const summary = financeEngine.getFinancialSummary();
    const reply = generateFallbackAdvisorResponse(message, summary);
    return {
      reply: `*(Catatan: Menggunakan mode penasihat internal karena koneksi API: ${error.message})*\n\n` + reply,
      toolCalled: true,
      toolName: 'get_financial_summary',
      summaryData: summary,
      source: 'fallback_error_recovery'
    };
  }
}

module.exports = {
  processChatMessage,
  generateFallbackAdvisorResponse,
  SYSTEM_PROMPT
};