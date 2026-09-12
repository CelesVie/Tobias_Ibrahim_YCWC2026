/**
 * Smart Personal Finance - Frontend Controller
 * Integrates Manual Finance Engine with Agentic LLM Advisor (Function Calling)
 */

// Kategori Terstruktur
const CATEGORY_GROUPS = {
  EXPENSE: {
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
    ]
  },
  INCOME: [
    'Gaji',
    'Freelance',
    'Investasi',
    'Bonus',
    'Lain-lain'
  ]
};

// State Aplikasi
let currentFilter = 'ALL';
let chatHistory = [];
let allTransactions = [];
let currentNetBalance = 0;

// DOM Elements
const form = document.getElementById('transaction-form');
const inputType = document.getElementById('input-type');
const btnTypeExpense = document.getElementById('btn-type-expense');
const btnTypeIncome = document.getElementById('btn-type-income');
const inputCategory = document.getElementById('input-category');
const inputAmount = document.getElementById('input-amount');
const amountHint = document.getElementById('amount-hint');
const amountErrorMsg = document.getElementById('amount-error-msg');
const inputDate = document.getElementById('input-date');
const inputDescription = document.getElementById('input-description');
const txTableBody = document.getElementById('tx-table-body');
const txCountPill = document.getElementById('tx-count-pill');
const txEmptyState = document.getElementById('tx-empty-state');
const filterTabs = document.querySelectorAll('.filter-tab');

// Metrics DOM
const valBalance = document.getElementById('val-balance');
const valBalanceSub = document.getElementById('val-balance-sub');
const valIncome = document.getElementById('val-income');
const valIncomeSub = document.getElementById('val-income-sub');
const valExpense = document.getElementById('val-expense');
const valNeedsSub = document.getElementById('val-needs-sub');
const valWantsSub = document.getElementById('val-wants-sub');
const valWantsRatio = document.getElementById('val-wants-ratio');
const wantsProgressBar = document.getElementById('wants-progress-bar');
const valSavingsTarget = document.getElementById('val-savings-target');
const valSavingsSub = document.getElementById('val-savings-sub');
const wantsWarningBanner = document.getElementById('wants-warning-banner');
const alertMessage = document.getElementById('alert-message');
const btnAskAiWarning = document.getElementById('btn-ask-ai-warning');
const btnResetSeed = document.getElementById('btn-reset-seed');

// Chat DOM
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');
const btnSendChat = document.getElementById('btn-send-chat');
const functionCallIndicator = document.getElementById('function-call-indicator');
const quickPromptChips = document.querySelectorAll('.chip-prompt');

// Inisialisasi Aplikasi saat DOM Siap
document.addEventListener('DOMContentLoaded', () => {
  // Set default tanggal hari ini
  inputDate.value = new Date().toISOString().split('T')[0];

  // Inisialisasi dropdown kategori
  updateCategoryDropdown('EXPENSE');

  // Event Listeners Tipe Transaksi
  btnTypeExpense.addEventListener('click', () => setTransactionType('EXPENSE'));
  btnTypeIncome.addEventListener('click', () => setTransactionType('INCOME'));

  // Event Listener Form Transaksi
  form.addEventListener('submit', handleAddTransaction);

  // Event Listener Input Nominal Real-Time Validation
  inputAmount.addEventListener('input', validateAmountInput);

  // Event Listeners Filter Transaksi
  filterTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      filterTabs.forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      currentFilter = e.target.dataset.filter;
      renderTransactionTable();
    });
  });

  // Event Listener Chat
  chatForm.addEventListener('submit', handleSendMessage);

  // Event Listener Quick Prompts
  quickPromptChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const promptText = chip.dataset.prompt;
      chatInput.value = promptText;
      chatForm.dispatchEvent(new Event('submit'));
    });
  });

  // Event Listener Warning Action
  btnAskAiWarning.addEventListener('click', () => {
    chatInput.value = 'Rasio pengeluaran kategori Wants saya melebihi 30%. Bagaimana analisis dan langkah konkret untuk memangkas pengeluaran impulsif tersebut?';
    chatForm.dispatchEvent(new Event('submit'));
    // Scroll chat ke tampilan jika di layar kecil
    chatMessages.scrollIntoView({ behavior: 'smooth' });
  });

  // Event Listener Reset Seed Data
  btnResetSeed.addEventListener('click', handleResetSeed);

  // Muat data awal dari backend
  loadDashboardData();
});

// Format Rupiah
function formatRupiah(num) {
  return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
}

// Toggle Tipe Transaksi
function setTransactionType(type) {
  inputType.value = type;
  if (type === 'EXPENSE') {
    btnTypeExpense.classList.add('active');
    btnTypeIncome.classList.remove('active');
  } else {
    btnTypeIncome.classList.add('active');
    btnTypeExpense.classList.remove('active');
  }
  updateCategoryDropdown(type);
  updateAmountHint();
  validateAmountInput();
}

// Perbarui info saldo maksimal yang dapat dikeluarkan
function updateAmountHint() {
  if (!amountHint) return;
  const type = inputType.value;
  if (type === 'EXPENSE') {
    if (currentNetBalance > 0) {
      amountHint.innerHTML = `Maks: <b style="color: var(--brand-primary);">${formatRupiah(currentNetBalance)}</b>`;
    } else {
      amountHint.innerHTML = `<span style="color: var(--color-expense);">Saldo 0 (tidak cukup)</span>`;
    }
  } else {
    amountHint.innerHTML = '';
  }
}

// Validasi input nominal secara real-time
function validateAmountInput() {
  if (!amountErrorMsg || !inputAmount) return true;
  const type = inputType.value;
  const amount = parseFloat(inputAmount.value);

  if (type === 'EXPENSE' && !isNaN(amount) && amount > 0) {
    if (amount > currentNetBalance) {
      inputAmount.style.borderColor = 'var(--color-expense)';
      amountErrorMsg.style.display = 'block';
      amountErrorMsg.textContent = `Nominal pengeluaran melebihi saldo bersih (${formatRupiah(currentNetBalance)})`;
      return false;
    }
  }
  inputAmount.style.borderColor = '';
  amountErrorMsg.style.display = 'none';
  amountErrorMsg.textContent = '';
  return true;
}

// Perbarui pilihan kategori
function updateCategoryDropdown(type) {
  inputCategory.innerHTML = '';
  
  if (type === 'EXPENSE') {
    // Optgroup Needs
    const optgroupNeeds = document.createElement('optgroup');
    optgroupNeeds.label = 'Kebutuhan Pokok (Needs / Essential)';
    CATEGORY_GROUPS.EXPENSE.NEEDS.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = '🔹 ' + cat;
      optgroupNeeds.appendChild(opt);
    });
    inputCategory.appendChild(optgroupNeeds);

    // Optgroup Wants
    const optgroupWants = document.createElement('optgroup');
    optgroupWants.label = 'Keinginan / Sekunder (Wants / Non-Essential)';
    CATEGORY_GROUPS.EXPENSE.WANTS.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = '🔸 ' + cat;
      optgroupWants.appendChild(opt);
    });
    inputCategory.appendChild(optgroupWants);
  } else {
    // Optgroup Income
    const optgroupIncome = document.createElement('optgroup');
    optgroupIncome.label = 'Pemasukan (Income)';
    CATEGORY_GROUPS.INCOME.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = '🟢 ' + cat;
      optgroupIncome.appendChild(opt);
    });
    inputCategory.appendChild(optgroupIncome);
  }
}

// Ambil & Tampilkan Semua Data
async function loadDashboardData() {
  try {
    await Promise.all([
      fetchSummary(),
      fetchTransactions()
    ]);
  } catch (error) {
    console.error('Gagal memuat data dashboard:', error);
  }
}

// Fetch Ringkasan Finansial (/api/finance/summary)
async function fetchSummary() {
  try {
    const res = await fetch('/api/finance/summary');
    const json = await res.json();
    if (!json.success) return;

    const data = json.data;
    currentNetBalance = data.netBalance;

    // Perbarui hint & validasi input nominal
    updateAmountHint();
    validateAmountInput();

    // Saldo
    valBalance.textContent = formatRupiah(data.netBalance);
    valBalance.style.color = data.netBalance >= 0 ? 'var(--text-primary)' : 'var(--color-expense)';
    valBalanceSub.textContent = data.netBalance >= 0 ? 'Arus kas surplus' : 'Arus kas defisit';

    // Pemasukan & Pengeluaran
    valIncome.textContent = formatRupiah(data.totalIncome);
    valExpense.textContent = formatRupiah(data.totalExpense);

    // Sub-breakdown Needs & Wants
    valNeedsSub.textContent = formatRupiah(data.needsExpense);
    valWantsSub.textContent = formatRupiah(data.wantsExpense);

    // Wants Ratio & Target Tabungan 20%
    valWantsRatio.textContent = data.wantsRatio + '%';
    // Skala linear 0-100%, biar proporsi asli tetep kebaca (10% vs 80%
    // beda jauh secara visual). Titik threshold 30% ditandai marker
    // garis vertikal di progress-bar-bg (lihat main.html/styles.css).
    const progressWidth = Math.min(100, Math.max(0, data.wantsRatio));
    wantsProgressBar.style.width = progressWidth + '%';

    if (data.isWantsWarning) {
      wantsProgressBar.classList.add('warning');
      wantsWarningBanner.classList.remove('hidden');
      alertMessage.textContent = `Rasio pengeluaran sekunder (Wants) Anda saat ini ${data.wantsRatio}%, melampaui batas wajar 30%. Pos pengeluaran terbesar: ${data.topWantsCategory ? data.topWantsCategory.category : '-'}.`;
    } else {
      wantsProgressBar.classList.remove('warning');
      wantsWarningBanner.classList.add('hidden');
    }

    valSavingsTarget.textContent = formatRupiah(data.idealSavingsTarget);
    if (data.isSavingsDeficit) {
      valSavingsSub.innerHTML = `Target 20%: <b>${formatRupiah(data.idealSavingsTarget)}</b> (Defisit: <span style="color:var(--color-expense)">${formatRupiah(data.savingsDeficit)}</span>)`;
    } else {
      valSavingsSub.innerHTML = `Target 20%: <b>${formatRupiah(data.idealSavingsTarget)}</b> (<span style="color:var(--color-income)">Terpenuhi</span>)`;
    }

  } catch (error) {
    console.error('Error fetch summary:', error);
  }
}

// Fetch Transaksi (/api/transactions)
async function fetchTransactions() {
  try {
    const res = await fetch('/api/transactions?limit=200');
    const json = await res.json();
    if (!json.success) return;

    allTransactions = json.data || [];
    renderTransactionTable();

    // Hitung jumlah pemasukan
    const incomeCount = allTransactions.filter(t => t.type === 'INCOME').length;
    valIncomeSub.textContent = `${incomeCount} transaksi pemasukan`;

  } catch (error) {
    console.error('Error fetch transactions:', error);
  }
}

// Render Tabel Transaksi
function renderTransactionTable() {
  const filtered = allTransactions.filter(item => {
    if (currentFilter === 'ALL') return true;
    return item.type === currentFilter;
  });

  txCountPill.textContent = `${filtered.length} Transaksi`;

  if (filtered.length === 0) {
    txTableBody.innerHTML = '';
    txEmptyState.classList.remove('hidden');
    return;
  }

  txEmptyState.classList.add('hidden');
  txTableBody.innerHTML = filtered.map(tx => {
    let badgeClass = 'badge-needs';
    let groupLabel = 'Needs';

    if (tx.type === 'INCOME') {
      badgeClass = 'badge-income';
      groupLabel = 'Income';
    } else if (tx.group === 'WANTS') {
      badgeClass = 'badge-wants';
      groupLabel = 'Wants';
    }

    const isExpense = tx.type === 'EXPENSE';
    const amountSign = isExpense ? '- ' : '+ ';
    const amountClass = isExpense ? 'text-expense' : 'text-income';

    return `
      <tr data-id="${tx.id}">
        <td><span style="font-variant-numeric: tabular-nums;">${tx.date}</span></td>
        <td>
          <div><strong>${escapeHtml(tx.category)}</strong></div>
          <span class="badge-group ${badgeClass}">${groupLabel}</span>
        </td>
        <td>
          <span style="color: var(--text-secondary);">${escapeHtml(tx.description || '-')}</span>
        </td>
        <td class="text-right">
          <strong class="${amountClass}" style="font-variant-numeric: tabular-nums;">
            ${amountSign}${formatRupiah(tx.amount)}
          </strong>
        </td>
        <td class="text-center">
          <button class="btn-delete-tx" onclick="handleDeleteTransaction(${tx.id})" title="Hapus transaksi ini">
            🗑️
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Tambah Transaksi Manual
async function handleAddTransaction(e) {
  e.preventDefault();

  const type = inputType.value;
  const amount = parseFloat(inputAmount.value);
  const category = inputCategory.value;
  const date = inputDate.value;
  const description = inputDescription.value;

  if (isNaN(amount) || amount <= 0) {
    alert('Harap masukkan nominal transaksi yang valid (lebih dari 0).');
    return;
  }

  // Validasi: Pengeluaran tidak boleh melebihi saldo bersih saat ini
  if (type === 'EXPENSE') {
    if (currentNetBalance <= 0) {
      alert(`Saldo bersih Anda saat ini ${formatRupiah(currentNetBalance)}. Anda tidak dapat mencatat pengeluaran karena saldo tidak mencukupi.`);
      return;
    }
    if (amount > currentNetBalance) {
      alert(`Nominal pengeluaran (${formatRupiah(amount)}) melebihi saldo bersih Anda saat ini (${formatRupiah(currentNetBalance)}). Transaksi tidak dapat disimpan.`);
      return;
    }
  }

  try {
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, amount, category, date, description })
    });

    const json = await res.json();
    if (!json.success) {
      alert('Gagal menambah transaksi: ' + json.message);
      return;
    }

    // Reset Form (kecuali tanggal dan tipe)
    inputAmount.value = '';
    inputDescription.value = '';
    validateAmountInput();

    // Refresh Data
    await loadDashboardData();

  } catch (error) {
    alert('Terjadi kesalahan jaringan: ' + error.message);
  }
}

// Hapus Transaksi
async function handleDeleteTransaction(id) {
  if (!confirm('Apakah Anda yakin ingin menghapus transaksi ini?')) return;

  try {
    const res = await fetch(`/api/transactions/${id}`, {
      method: 'DELETE'
    });
    const json = await res.json();
    if (!json.success) {
      alert('Gagal menghapus transaksi: ' + json.message);
      return;
    }

    await loadDashboardData();
  } catch (error) {
    alert('Terjadi kesalahan: ' + error.message);
  }
}

// Reset Seed Data
async function handleResetSeed() {
  if (!confirm('Reset semua data kembali ke seed dummy awal (2 Pemasukan, 7 Pengeluaran)?')) return;

  try {
    const res = await fetch('/api/finance/reset-seed', { method: 'POST' });
    const json = await res.json();
    if (json.success) {
      await loadDashboardData();
      appendSystemMessage('Basis data berhasil di-reset dengan seed data dummy awal.');
    }
  } catch (error) {
    alert('Gagal reset database: ' + error.message);
  }
}

// Handle Chat Message
async function handleSendMessage(e) {
  e.preventDefault();

  const message = chatInput.value.trim();
  if (!message) return;

  // Append Pesan User
  appendMessage('user', message);
  chatInput.value = '';
  chatInput.disabled = true;
  btnSendChat.disabled = true;

  // Tampilkan indikator proses Function Calling
  functionCallIndicator.classList.remove('hidden');

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        history: chatHistory
      })
    });

    const json = await res.json();
    functionCallIndicator.classList.add('hidden');

    if (!json.success) {
      appendMessage('ai', 'Maaf, terjadi kesalahan pada AI: ' + json.message);
      return;
    }

    const aiData = json.data;
    appendMessage('ai', aiData.reply, aiData.toolCalled);

    // Simpan ke riwayat percakapan lokal
    chatHistory.push({ role: 'user', content: message });
    chatHistory.push({ role: 'assistant', content: aiData.reply });

    // Batasi riwayat maksimum 12 turn
    if (chatHistory.length > 12) {
      chatHistory = chatHistory.slice(-12);
    }

  } catch (error) {
    functionCallIndicator.classList.add('hidden');
    appendMessage('ai', 'Gagal terhubung ke server chat: ' + error.message);
  } finally {
    chatInput.disabled = false;
    btnSendChat.disabled = false;
    chatInput.focus();
  }
}

// Tambahkan Bubble Pesan ke Kontainer Chat
function appendMessage(sender, text, toolCalled = false) {
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${sender === 'user' ? 'user-bubble' : 'ai-bubble'}`;

  const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  const authorName = sender === 'user' ? 'Anda' : 'FinAdvisor AI';
  const toolBadge = toolCalled ? `<span style="font-size: 10px; background: rgba(99,102,241,0.2); padding: 1px 6px; border-radius: 4px; color: #c7d2fe;">⚙️ Backend Data Verified</span>` : '';

  bubble.innerHTML = `
    <div class="bubble-header">
      <span>${authorName} ${toolBadge}</span>
      <span class="bubble-time">${timeStr}</span>
    </div>
    <div class="bubble-body markdown-body">
      ${sender === 'user' ? `<p>${escapeHtml(text)}</p>` : renderMarkdown(text)}
    </div>
  `;

  chatMessages.appendChild(bubble);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendSystemMessage(text) {
  const info = document.createElement('div');
  info.style.cssText = 'text-align: center; font-size: 11px; color: var(--text-muted); margin: 8px 0;';
  info.textContent = text;
  chatMessages.appendChild(info);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Parser Markdown Sederhana & Aman untuk Chatbot Output
function renderMarkdown(md) {
  if (!md) return '';

  let html = md;

  // Escape HTML tags to prevent XSS
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Tables
  html = html.replace(/\n\|(.+)\|\n\|[-:\s|]+\|\n((?:\|.+\|\n?)+)/g, (match, header, rows) => {
    const ths = header.split('|').map(h => `<th>${h.trim()}</th>`).filter(h => h !== '<th></th>').join('');
    const trs = rows.trim().split('\n').map(row => {
      const tds = row.split('|').map(td => `<td>${td.trim()}</td>`).filter(td => td !== '<td></td>').join('');
      return `<tr>${tds}</tr>`;
    }).join('');
    return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
  });

  // Blockquotes (e.g. Warnings)
  html = html.replace(/^&gt; ?(.*)$/gm, '<blockquote>$1</blockquote>');

  // Headings
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^# (.*$)/gim, '<h3>$1</h3>');

  // Bold & Italics
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Inline Code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Lists
  html = html.replace(/^\s*[-•]\s+(.*)$/gim, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

  // Paragraphs
  const lines = html.split('\n');
  const processed = [];
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    if (line.startsWith('<h3>') || line.startsWith('<table>') || line.startsWith('<blockquote>') || line.startsWith('<ul>') || line.startsWith('<li>')) {
      processed.push(line);
    } else {
      processed.push(`<p>${line}</p>`);
    }
  }

  return processed.join('');
}

// Utility: Escape HTML
function escapeHtml(string) {
  return String(string)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}