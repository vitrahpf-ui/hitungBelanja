/**
 * ============================================================================
 * HitungBelanja.id - Core Logic, Riwayat Belanja & Google Sheets Integration
 * ============================================================================
 * - State management (Items, Target Anggaran, SHEETS_API_URL, History)
 * - Riwayat Belanja (Save session, Preview, View details, Restore/Re-use, Delete)
 * - Auto-persistence via localStorage (Keys: SHEETS_API_URL, hitungbelanja_history)
 * - Live Calculation & Status Anggaran (Real-time)
 * - Smart Savings Advisor Heuristics
 * - Google Apps Script Integration (HTTP POST to Google Sheets)
 * - WhatsApp Share & Print
 * ============================================================================
 */

(function () {
  'use strict';

  // --- STORAGE KEYS ---
  const STORAGE_DATA_KEY = 'hitungbelanja_v2_data';
  const SHEETS_KEY = 'SHEETS_API_URL';
  const HISTORY_KEY = 'hitungbelanja_history';

  const state = {
    budget: 0,
    items: [],
    sheetsUrl: localStorage.getItem(SHEETS_KEY) || '',
    history: []
  };

  let activeDetailHistoryItem = null;

  // Popular Template Presets
  const TEMPLATES = {
    sembako: [
      { name: 'Beras Premium 5kg', price: 75000, qty: 1 },
      { name: 'Minyak Goreng 2L', price: 34000, qty: 1 },
      { name: 'Telur Ayam 1kg', price: 28000, qty: 1 },
      { name: 'Gula Pasir 1kg', price: 17500, qty: 1 }
    ],
    dapur: [
      { name: 'Ayam Potong 1kg', price: 38000, qty: 1 },
      { name: 'Tempe & Tahu', price: 15000, qty: 1 },
      { name: 'Sayur Bayam & Jagung', price: 8000, qty: 1 },
      { name: 'Cabai & Bawang Campur', price: 20000, qty: 1 },
      { name: 'Bumbu Masak Komplit', price: 10000, qty: 1 }
    ]
  };

  // --- TOAST NOTIFICATION SYSTEM ---
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const bgColors = {
      success: 'bg-emerald-600 text-white shadow-emerald-600/30',
      error: 'bg-rose-600 text-white shadow-rose-600/30',
      warning: 'bg-amber-500 text-white shadow-amber-500/30',
      info: 'bg-slate-900 text-white shadow-slate-900/30'
    };

    const icons = {
      success: `<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>`,
      error: `<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>`,
      warning: `<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`,
      info: `<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`
    };

    toast.className = `fixed top-5 inset-x-4 sm:inset-x-auto sm:right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-xs font-bold transition-all duration-300 transform -translate-y-4 opacity-0 ${bgColors[type] || bgColors.info}`;
    toast.innerHTML = `${icons[type] || icons.info} <span>${message}</span>`;

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.remove('-translate-y-4', 'opacity-0');
    });

    setTimeout(() => {
      toast.classList.add('-translate-y-4', 'opacity-0');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // --- UTILITY FORMATTERS ---
  function formatRupiah(num) {
    if (!num || isNaN(num)) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(num);
  }

  function parseNumber(val) {
    if (typeof val === 'number') return Math.max(0, val);
    if (!val) return 0;
    const cleaned = val.toString().replace(/[^0-9]/g, '');
    return cleaned ? parseInt(cleaned, 10) : 0;
  }

  // --- PERSISTENCE ---
  function saveState() {
    try {
      localStorage.setItem(STORAGE_DATA_KEY, JSON.stringify({
        budget: state.budget,
        items: state.items
      }));
    } catch (e) {
      console.warn('Storage save failed:', e);
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_DATA_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        state.budget = parsed.budget || 0;
        state.items = Array.isArray(parsed.items) ? parsed.items : [];
      }
    } catch (e) {
      console.warn('Storage load failed:', e);
    }

    try {
      const rawHistory = localStorage.getItem(HISTORY_KEY);
      state.history = rawHistory ? JSON.parse(rawHistory) : [];
    } catch (e) {
      state.history = [];
    }

    state.sheetsUrl = localStorage.getItem(SHEETS_KEY) || '';

    // Default initial items if empty
    if (state.items.length === 0) {
      state.items = [
        { id: genId(), name: 'Beras 5kg', price: 75000, qty: 1 },
        { id: genId(), name: 'Telur Ayam 1kg', price: 28000, qty: 1 },
        { id: genId(), name: 'Sayur Sop Komplit', price: 10000, qty: 1 }
      ];
      state.budget = 150000;
    }
  }

  function genId() {
    return 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  }

  // --- ITEM OPERATIONS ---
  function addItem(data = {}) {
    state.items.push({
      id: genId(),
      name: data.name || '',
      price: data.price || 0,
      qty: data.qty || 1
    });
    renderItems();
    updateCalculations();
    saveState();
  }

  function removeItem(id) {
    state.items = state.items.filter(i => i.id !== id);
    renderItems();
    updateCalculations();
    saveState();
  }

  function updateItem(id, field, value) {
    const item = state.items.find(i => i.id === id);
    if (!item) return;

    if (field === 'price') {
      item.price = parseNumber(value);
    } else if (field === 'qty') {
      item.qty = Math.max(1, parseNumber(value));
    } else {
      item[field] = value;
    }

    const subtotalEl = document.getElementById('subtotal_' + id);
    if (subtotalEl) {
      subtotalEl.textContent = formatRupiah(item.price * item.qty);
    }

    updateCalculations();
    saveState();
  }

  function stepQty(id, delta) {
    const item = state.items.find(i => i.id === id);
    if (!item) return;
    item.qty = Math.max(1, item.qty + delta);
    const qtyInput = document.getElementById('qty_' + id);
    if (qtyInput) qtyInput.value = item.qty;
    const subtotalEl = document.getElementById('subtotal_' + id);
    if (subtotalEl) subtotalEl.textContent = formatRupiah(item.price * item.qty);
    updateCalculations();
    saveState();
  }

  function loadTemplate(key) {
    const tpl = TEMPLATES[key];
    if (!tpl) return;
    state.items = tpl.map(t => ({ id: genId(), name: t.name, price: t.price, qty: t.qty }));
    renderItems();
    updateCalculations();
    saveState();
    showToast(`Template ${key === 'sembako' ? 'Sembako' : 'Dapur'} dimuat!`, 'success');
  }

  function resetAll() {
    if (confirm('Yakin ingin mengosongkan seluruh daftar belanja saat ini?')) {
      state.items = [];
      renderItems();
      updateCalculations();
      saveState();
      showToast('Daftar belanja berhasil dikosongkan.', 'info');
    }
  }

  // --- RENDER DOM ---
  function renderItems() {
    const container = document.getElementById('items-container');
    const emptyState = document.getElementById('empty-state');
    const countHeader = document.getElementById('header-item-count');

    if (!container) return;

    if (countHeader) {
      countHeader.textContent = `(${state.items.length} macam)`;
    }

    if (state.items.length === 0) {
      container.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    let html = '';
    state.items.forEach((item, index) => {
      const subtotal = item.price * item.qty;

      html += `
        <div class="bg-slate-50/90 hover:bg-slate-50 border border-slate-200/90 rounded-xl p-3 smooth-transition" id="card_${item.id}">
          <div class="flex items-center gap-2">
            <span class="w-5 h-5 rounded-md bg-white border border-slate-200 text-slate-400 text-[11px] font-bold flex items-center justify-center flex-shrink-0">
              ${index + 1}
            </span>
            <input 
              type="text" 
              list="groceries-list" 
              value="${escapeHtml(item.name)}" 
              placeholder="Ketik nama barang..." 
              class="flex-grow text-xs sm:text-sm font-semibold text-slate-800 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:border-brand-500 focus:outline-none placeholder:text-slate-300"
              onchange="HitungApp.onNameChange('${item.id}', this.value)"
            />
            <button 
              type="button" 
              onclick="HitungApp.removeItem('${item.id}')"
              class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
              title="Hapus barang"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>

          <div class="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between gap-2">
            <div class="relative w-28 sm:w-36 flex-shrink-0">
              <span class="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-[11px] font-mono-num text-slate-400">Rp</span>
              <input 
                type="text" 
                inputmode="numeric" 
                value="${item.price ? item.price.toLocaleString('id-ID') : ''}" 
                placeholder="Harga" 
                class="w-full pl-7 pr-2 py-1 text-xs font-mono-num font-semibold text-slate-800 bg-white border border-slate-200 rounded-lg focus:border-brand-500 focus:outline-none"
                oninput="HitungApp.onPriceInput('${item.id}', this)"
              />
            </div>

            <div class="flex items-center gap-1">
              <button 
                type="button" 
                onclick="HitungApp.stepQty('${item.id}', -1)"
                class="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 font-bold text-sm active:bg-slate-200 transition"
              >-</button>
              <input 
                type="number" 
                id="qty_${item.id}"
                min="1" 
                value="${item.qty}" 
                class="w-9 text-center text-xs font-bold font-mono-num text-slate-800 bg-white border border-slate-200 rounded-lg py-1 focus:border-brand-500 focus:outline-none"
                onchange="HitungApp.onQtyChange('${item.id}', this.value)"
              />
              <button 
                type="button" 
                onclick="HitungApp.stepQty('${item.id}', 1)"
                class="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 font-bold text-sm active:bg-slate-200 transition"
              >+</button>
            </div>

            <div class="text-right flex-grow">
              <span id="subtotal_${item.id}" class="text-xs sm:text-sm font-bold font-mono-num text-slate-900 block truncate">
                ${formatRupiah(subtotal)}
              </span>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m];
    });
  }

  // --- CALCULATIONS & STATUS UPDATES ---
  function updateCalculations() {
    const totalSpent = state.items.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const budget = state.budget;
    const diff = budget - totalSpent;
    const count = state.items.length;

    const statTotal = document.getElementById('stat-total-spent');
    const badgeCount = document.getElementById('badge-total-items');
    const stickyTotal = document.getElementById('sticky-total');
    if (statTotal) statTotal.textContent = formatRupiah(totalSpent);
    if (badgeCount) badgeCount.textContent = `${count} macam`;
    if (stickyTotal) stickyTotal.textContent = formatRupiah(totalSpent);

    const statusLabel = document.getElementById('stat-status-label');
    const statusBadge = document.getElementById('stat-status-badge');
    const statusDiff = document.getElementById('stat-diff-amount');
    const statusDesc = document.getElementById('stat-status-desc');
    const progressBar = document.getElementById('budget-progress-bar');
    const progressPercent = document.getElementById('progress-percent');
    const progressLabel = document.getElementById('progress-text-label');
    const alertOverBudget = document.getElementById('alert-over-budget');
    const alertOverText = document.getElementById('alert-over-budget-text');
    const stickyStatus = document.getElementById('sticky-status-badge');

    if (budget === 0) {
      if (statusLabel) statusLabel.textContent = 'Target Anggaran';
      if (statusBadge) {
        statusBadge.textContent = 'Belum Diatur';
        statusBadge.className = 'text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600';
      }
      if (statusDiff) statusDiff.textContent = 'Rp 0';
      if (statusDesc) statusDesc.textContent = 'Masukkan target budget';
      if (progressBar) {
        progressBar.style.width = '0%';
        progressBar.className = 'h-full bg-slate-300 rounded-full transition-all';
      }
      if (progressPercent) progressPercent.textContent = '0%';
      if (progressLabel) progressLabel.textContent = 'Pemakaian Budget';
      if (alertOverBudget) alertOverBudget.classList.add('hidden');
      if (stickyStatus) {
        stickyStatus.textContent = 'Atur budget belanja';
        stickyStatus.className = 'text-[11px] font-semibold text-slate-500 truncate mt-0.5';
      }
    } else if (diff >= 0) {
      const pct = Math.min(100, Math.round((totalSpent / budget) * 100));
      if (statusLabel) statusLabel.textContent = 'Sisa Anggaran';
      if (statusBadge) {
        statusBadge.textContent = 'Aman & Hemat ✨';
        statusBadge.className = 'text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800';
      }
      if (statusDiff) {
        statusDiff.textContent = formatRupiah(diff);
        statusDiff.className = 'text-lg sm:text-xl font-extrabold font-mono-num text-emerald-600 mt-2 truncate';
      }
      if (statusDesc) statusDesc.textContent = `Masih tersisa ${100 - pct}% dari anggaran`;

      if (progressBar) {
        progressBar.style.width = `${pct}%`;
        progressBar.className = pct > 85 
          ? 'h-full bg-amber-500 rounded-full transition-all'
          : 'h-full bg-brand-500 rounded-full transition-all';
      }
      if (progressPercent) progressPercent.textContent = `${pct}%`;
      if (progressLabel) progressLabel.textContent = pct > 85 ? 'Hampir mendekati batas!' : 'Pemakaian Terkendali';
      if (alertOverBudget) alertOverBudget.classList.add('hidden');
      if (stickyStatus) {
        stickyStatus.textContent = `✅ Sisa ${formatRupiah(diff)}`;
        stickyStatus.className = 'text-[11px] font-bold text-emerald-600 truncate mt-0.5';
      }
    } else {
      const over = Math.abs(diff);
      const pct = Math.round((totalSpent / budget) * 100);
      if (statusLabel) statusLabel.textContent = 'Defisit Anggaran';
      if (statusBadge) {
        statusBadge.textContent = 'Over Budget! ⚠️';
        statusBadge.className = 'text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 animate-pulse';
      }
      if (statusDiff) {
        statusDiff.textContent = `- ${formatRupiah(over)}`;
        statusDiff.className = 'text-lg sm:text-xl font-extrabold font-mono-num text-rose-600 mt-2 truncate';
      }
      if (statusDesc) statusDesc.textContent = `Melebihi target ${pct - 100}%!`;

      if (progressBar) {
        progressBar.style.width = '100%';
        progressBar.className = 'h-full bg-rose-500 rounded-full transition-all';
      }
      if (progressPercent) progressPercent.textContent = `${pct}%`;
      if (progressLabel) progressLabel.textContent = 'Melebihi Batas Anggaran!';

      if (alertOverBudget) alertOverBudget.classList.remove('hidden');
      if (alertOverText) {
        alertOverText.textContent = `Total belanja melebihi target sebesar ${formatRupiah(over)}. Perlu penyesuaian barang belanjaan.`;
      }

      if (stickyStatus) {
        stickyStatus.textContent = `⚠️ Over Budget: ${formatRupiah(over)}`;
        stickyStatus.className = 'text-[11px] font-bold text-rose-600 truncate mt-0.5';
      }
    }
  }

  // --- AI SAVINGS RECOMMENDATION LOGIC ---
  function generateAISuggestions() {
    const totalSpent = state.items.reduce((s, i) => s + (i.price * i.qty), 0);
    const budget = state.budget;
    const diff = budget - totalSpent;
    const items = [...state.items].sort((a, b) => (b.price * b.qty) - (a.price * a.qty));

    if (items.length === 0) {
      return {
        badge: 'Belum Ada Barang',
        summary: 'Silakan tambahkan beberapa barang belanjaan terlebih dahulu untuk menerima analisis.',
        tips: ['Masukkan nama barang, harga satuan, dan kuantitas.']
      };
    }

    const topItem = items[0];
    const topSubtotal = topItem.price * topItem.qty;
    const topShare = totalSpent > 0 ? Math.round((topSubtotal / totalSpent) * 100) : 0;
    const tips = [];

    if (budget > 0 && diff < 0) {
      const over = Math.abs(diff);
      const badge = `Defisit ${formatRupiah(over)}`;
      const summary = `Belanja Anda melebihi target anggaran sebesar <strong>${formatRupiah(over)}</strong>. Berikut rekomendasi langkah hemat yang bisa Anda ambil:`;

      if (topShare >= 20) {
        tips.push(`🎯 <strong>Pangkas Item Dominan:</strong> <strong>${topItem.name}</strong> menyerap <strong>${topShare}% (${formatRupiah(topSubtotal)})</strong> dari total belanja. Kurangi jumlahnya (${topItem.qty} pcs) atau ganti dengan merk ekonomis.`);
      }

      if (items.length > 2) {
        const secondItem = items[1];
        tips.push(`✂️ <strong>Evaluasi Item Tambahan:</strong> Pertimbangkan untuk menunda pembelian <strong>${secondItem.name}</strong> (${formatRupiah(secondItem.price * secondItem.qty)}) untuk belanja berikutnya.`);
      }

      tips.push(`🍗 <strong>Substitusi Bahan Dapur:</strong> Alokasi daging/ayam dapat diselingi lauk tinggi protein yang hemat seperti telur ayam, tempe, atau tahu.`);
      tips.push(`🧄 <strong>Beli Curah di Pasar:</strong> Bumbu dapur dan sayuran biasanya lebih murah 20-30% jika dibeli secara kiloan/curah di pasar tradisional.`);

      return { badge, summary, tips };
    } else if (budget > 0 && diff >= 0) {
      const badge = `Surplus ${formatRupiah(diff)}`;
      const summary = `Bagus sekali! Pengeluaran belanja Anda masih terkendali dengan sisa hemat sebesar <strong>${formatRupiah(diff)}</strong>.`;
      tips.push(`⭐ <strong>Pengeluaran Tertinggi:</strong> Item biaya terbesar adalah <strong>${topItem.name}</strong> (${formatRupiah(topSubtotal)}), namun masih berada dalam batas wajar.`);
      tips.push(`💰 <strong>Dana Sisa:</strong> Sisa <strong>${formatRupiah(diff)}</strong> dapat disimpan untuk cadangan fluktuasi harga kebutuhan pokok berikutnya.`);
      return { badge, summary, tips };
    } else {
      const badge = 'Tanpa Target Anggaran';
      const summary = `Total estimasi belanja adalah <strong>${formatRupiah(totalSpent)}</strong> untuk ${items.length} macam barang.`;
      tips.push(`🎯 <strong>Rekomendasi Anggaran:</strong> Anda disarankan menetapkan batas anggaran belanja sekitar <strong>${formatRupiah(Math.ceil((totalSpent * 1.1) / 10000) * 10000)}</strong>.`);
      return { badge, summary, tips };
    }
  }

  function openAISuggestions() {
    const analysis = generateAISuggestions();
    const modal = document.getElementById('modal-ai');
    const badge = document.getElementById('ai-modal-badge');
    const summary = document.getElementById('ai-modal-summary');
    const tipsContainer = document.getElementById('ai-modal-tips');

    if (badge) badge.innerHTML = analysis.badge;
    if (summary) summary.innerHTML = analysis.summary;

    if (tipsContainer) {
      tipsContainer.innerHTML = analysis.tips.map(tip => `
        <li class="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
          <span class="mt-0.5 text-base flex-shrink-0">💡</span>
          <div class="leading-relaxed">${tip}</div>
        </li>
      `).join('');
    }

    if (modal) modal.classList.remove('hidden');
  }

  // --- RIWAYAT BELANJA (SHOPPING HISTORY ENGINE) ---
  function saveSessionToHistory(options = {}) {
    if (state.items.length === 0) {
      showToast('Daftar belanja masih kosong!', 'warning');
      return null;
    }

    const totalSpent = state.items.reduce((s, i) => s + (i.price * i.qty), 0);
    const budget = state.budget;
    const diff = budget - totalSpent;
    const statusText = budget === 0
      ? 'Tanpa Budget'
      : diff >= 0
      ? `Aman (Sisa ${formatRupiah(diff)})`
      : `Defisit (Lebih ${formatRupiah(Math.abs(diff))})`;

    const now = new Date();
    const dateFormatted = now.toLocaleDateString('id-ID', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const historyEntry = {
      id: 'hist_' + Date.now(),
      timestamp: now.toISOString(),
      dateFormatted: dateFormatted,
      budget: budget,
      total: totalSpent,
      diff: diff,
      status: statusText,
      itemCount: state.items.length,
      items: state.items.map(it => ({ name: it.name, price: it.price, qty: it.qty })),
      syncedToSheets: options.syncedToSheets || false
    };

    state.history.unshift(historyEntry);

    if (state.history.length > 25) {
      state.history.pop();
    }

    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history));
    } catch (e) {
      console.warn('History save failed:', e);
    }

    renderHistoryPreviews();
    updateHistoryBadges();

    if (options.notify !== false) {
      showToast('Sesi belanja berhasil disimpan ke Riwayat! 🕒', 'success');
    }

    return historyEntry;
  }

  function renderHistoryPreviews() {
    const previewContainer = document.getElementById('preview-history-container');
    const previewCount = document.getElementById('preview-history-count');
    const modalList = document.getElementById('modal-history-list');

    if (previewCount) {
      previewCount.textContent = `(${state.history.length} sesi)`;
    }

    if (previewContainer) {
      if (state.history.length === 0) {
        previewContainer.innerHTML = `
          <div class="py-6 text-center text-slate-400">
            <span class="text-2xl block mb-1">🕒</span>
            <p class="text-xs font-semibold text-slate-600">Belum ada riwayat sesi belanja</p>
            <p class="text-[11px] text-slate-400 mt-0.5">Sesi akan otomatis tercatat setiap kali Anda menyimpannya.</p>
          </div>
        `;
      } else {
        const recents = state.history.slice(0, 3);
        let html = '';
        recents.forEach(entry => {
          const isSafe = entry.diff >= 0;
          html += `
            <div class="p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 flex items-center justify-between gap-3 smooth-transition cursor-pointer" onclick="HitungApp.openHistoryDetail('${entry.id}')">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-[11px] font-bold text-slate-800">${escapeHtml(entry.dateFormatted)}</span>
                  <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isSafe ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
                    ${isSafe ? 'Aman' : 'Defisit'}
                  </span>
                  ${entry.syncedToSheets ? '<span class="text-[10px]" title="Tersinkron ke Sheets">📊</span>' : ''}
                </div>
                <div class="text-[11px] text-slate-500 mt-0.5 truncate">
                  ${entry.itemCount} macam barang · Budget: ${formatRupiah(entry.budget)}
                </div>
              </div>
              <div class="text-right flex-shrink-0">
                <div class="font-mono-num font-extrabold text-xs sm:text-sm text-slate-900">${formatRupiah(entry.total)}</div>
                <span class="text-[10px] font-bold text-brand-600 hover:underline">Lihat Rincian &rarr;</span>
              </div>
            </div>
          `;
        });
        previewContainer.innerHTML = html;
      }
    }

    if (modalList) {
      if (state.history.length === 0) {
        modalList.innerHTML = `
          <div class="py-12 text-center text-slate-400">
            <span class="text-4xl block mb-2">🛍️</span>
            <p class="text-sm font-bold text-slate-700">Riwayat Belanja Masih Kosong</p>
            <p class="text-xs text-slate-400 mt-1 max-w-xs mx-auto">Setiap kali Anda menekan "Simpan ke Google Sheets" atau "Simpan ke Riwayat", sesi belanja Anda akan tersimpan di sini.</p>
          </div>
        `;
      } else {
        let html = '';
        state.history.forEach((entry, idx) => {
          const isSafe = entry.diff >= 0;
          const itemsListPreview = entry.items.slice(0, 3).map(i => `${i.name} (${i.qty}x)`).join(', ') + (entry.items.length > 3 ? '...' : '');

          html += `
            <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 smooth-transition space-y-2">
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <span class="w-6 h-6 rounded-md bg-white border border-slate-200 text-slate-500 font-bold text-xs flex items-center justify-center">
                    ${idx + 1}
                  </span>
                  <div>
                    <div class="text-xs font-bold text-slate-900">${escapeHtml(entry.dateFormatted)}</div>
                    <div class="text-[10px] text-slate-400">Budget: ${formatRupiah(entry.budget)}</div>
                  </div>
                </div>
                <div class="text-right">
                  <div class="font-mono-num font-extrabold text-sm text-slate-900">${formatRupiah(entry.total)}</div>
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${isSafe ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
                    ${entry.status}
                  </span>
                </div>
              </div>

              <div class="text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-100 truncate">
                🛒 <strong>${entry.itemCount} barang:</strong> ${escapeHtml(itemsListPreview)}
              </div>

              <div class="flex items-center justify-between pt-1 text-xs">
                <button 
                  type="button" 
                  onclick="HitungApp.openHistoryDetail('${entry.id}')"
                  class="font-bold text-brand-600 hover:text-brand-700 text-xs flex items-center gap-1"
                >
                  <span>Lihat Rincian</span> &rarr;
                </button>
                <div class="flex items-center gap-2">
                  <button 
                    type="button" 
                    onclick="HitungApp.restoreHistorySession('${entry.id}')"
                    class="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-[11px] border border-emerald-200 transition"
                    title="Muat kembali barang belanjaan ini ke kalkulator"
                  >
                    🔄 Pakai Lagi
                  </button>
                  <button 
                    type="button" 
                    onclick="HitungApp.deleteHistoryItem('${entry.id}')"
                    class="p-1 text-slate-400 hover:text-rose-600 rounded-md transition"
                    title="Hapus riwayat ini"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                </div>
              </div>
            </div>
          `;
        });
        modalList.innerHTML = html;
      }
    }
  }

  function updateHistoryBadges() {
    const headerBadge = document.getElementById('header-history-badge');
    if (headerBadge) {
      if (state.history.length > 0) {
        headerBadge.textContent = state.history.length;
        headerBadge.classList.remove('hidden');
      } else {
        headerBadge.classList.add('hidden');
      }
    }
  }

  function openHistoryModal() {
    renderHistoryPreviews();
    const modal = document.getElementById('modal-history');
    if (modal) modal.classList.remove('hidden');
  }

  function closeHistoryModal() {
    const modal = document.getElementById('modal-history');
    if (modal) modal.classList.add('hidden');
  }

  function openHistoryDetail(id) {
    const entry = state.history.find(h => h.id === id);
    if (!entry) return;

    activeDetailHistoryItem = entry;
    const modal = document.getElementById('modal-history-detail');
    const title = document.getElementById('detail-history-title');
    const content = document.getElementById('detail-history-content');

    if (title) {
      title.textContent = `Sesi: ${entry.dateFormatted}`;
    }

    if (content) {
      let rowsHtml = '';
      entry.items.forEach((it, idx) => {
        const sub = it.price * it.qty;
        rowsHtml += `
          <div class="flex items-center justify-between py-2 border-b border-slate-100 text-xs">
            <div>
              <div class="font-bold text-slate-800">${idx + 1}. ${escapeHtml(it.name)}</div>
              <div class="text-[11px] text-slate-400">${it.qty}x @ ${formatRupiah(it.price)}</div>
            </div>
            <div class="font-mono-num font-bold text-slate-900">${formatRupiah(sub)}</div>
          </div>
        `;
      });

      content.innerHTML = `
        <div class="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
          <div>
            <span class="text-[10px] font-bold uppercase text-slate-400">Target Budget</span>
            <div class="font-mono-num font-bold text-sm text-slate-800">${formatRupiah(entry.budget)}</div>
          </div>
          <div class="text-right">
            <span class="text-[10px] font-bold uppercase text-slate-400">Total Belanja</span>
            <div class="font-mono-num font-extrabold text-sm text-slate-900">${formatRupiah(entry.total)}</div>
          </div>
        </div>

        <div class="flex items-center justify-between text-xs">
          <span class="text-slate-500 font-semibold">Status Anggaran:</span>
          <span class="font-bold px-2 py-0.5 rounded-full ${entry.diff >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
            ${entry.status}
          </span>
        </div>

        <div>
          <h5 class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Daftar Barang (${entry.items.length}):</h5>
          <div class="space-y-1">
            ${rowsHtml}
          </div>
        </div>
      `;
    }

    if (modal) modal.classList.remove('hidden');
  }

  function restoreHistorySession(id) {
    const entry = state.history.find(h => h.id === id);
    if (!entry) return;

    if (confirm(`Ganti daftar belanja saat ini dengan sesi riwayat tanggal ${entry.dateFormatted}?`)) {
      state.budget = entry.budget || 0;
      state.items = entry.items.map(it => ({
        id: genId(),
        name: it.name,
        price: it.price,
        qty: it.qty
      }));

      const budgetInput = document.getElementById('budget-input');
      if (budgetInput) {
        budgetInput.value = state.budget ? state.budget.toLocaleString('id-ID') : '';
      }

      renderItems();
      updateCalculations();
      saveState();

      const modalDetail = document.getElementById('modal-history-detail');
      if (modalDetail) modalDetail.classList.add('hidden');
      closeHistoryModal();

      showToast('Sesi riwayat berhasil dimuat ke kalkulator! 🔄', 'success');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function deleteHistoryItem(id) {
    if (confirm('Hapus sesi riwayat ini?')) {
      state.history = state.history.filter(h => h.id !== id);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history));
      } catch (e) {}
      renderHistoryPreviews();
      updateHistoryBadges();

      const modalDetail = document.getElementById('modal-history-detail');
      if (modalDetail && !modalDetail.classList.contains('hidden')) {
        modalDetail.classList.add('hidden');
      }

      showToast('Sesi riwayat dihapus.', 'info');
    }
  }

  function clearAllHistory() {
    if (state.history.length === 0) return;
    if (confirm('Yakin ingin menghapus seluruh riwayat belanja? Tindakan ini tidak dapat dibatalkan.')) {
      state.history = [];
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history));
      } catch (e) {}
      renderHistoryPreviews();
      updateHistoryBadges();
      showToast('Seluruh riwayat berhasil dibersihkan.', 'info');
    }
  }

  // --- GOOGLE SHEETS SETTINGS MODAL & LOGIC ---
  function updateSheetsHeaderStatus() {
    const dot = document.getElementById('header-sheets-dot');
    const badge = document.getElementById('sheets-connection-badge');
    const urlInput = document.getElementById('sheets-api-url-input');

    const savedUrl = localStorage.getItem(SHEETS_KEY) || '';
    state.sheetsUrl = savedUrl;

    if (urlInput) urlInput.value = savedUrl;

    if (savedUrl && savedUrl.trim().length > 15) {
      if (dot) {
        dot.className = 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse';
      }
      if (badge) {
        badge.textContent = 'Berhasil Terhubung ✅';
        badge.className = 'px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800';
      }
    } else {
      if (dot) {
        dot.className = 'w-2 h-2 rounded-full bg-slate-300';
      }
      if (badge) {
        badge.textContent = 'Belum Disetel ⚠️';
        badge.className = 'px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600';
      }
    }
  }

  function openSheetsModal() {
    const modal = document.getElementById('modal-sheets-settings');
    const feedback = document.getElementById('sheets-test-feedback');
    if (feedback) feedback.classList.add('hidden');
    updateSheetsHeaderStatus();
    if (modal) modal.classList.remove('hidden');
  }

  function closeSheetsModal() {
    const modal = document.getElementById('modal-sheets-settings');
    if (modal) modal.classList.add('hidden');
  }

  function saveSheetsUrl() {
    const input = document.getElementById('sheets-api-url-input');
    const url = input ? input.value.trim() : '';

    if (!url) {
      showToast('Masukkan URL Google Apps Script!', 'warning');
      return;
    }

    if (!url.startsWith('https://script.google.com/macros/s/')) {
      showToast('URL harus diawali https://script.google.com/macros/s/...', 'error');
      return;
    }

    if (!url.endsWith('/exec')) {
      showToast('URL Web App harus berakhiran /exec', 'warning');
    }

    localStorage.setItem(SHEETS_KEY, url);
    state.sheetsUrl = url;
    updateSheetsHeaderStatus();
    showToast('URL Google Sheets berhasil disimpan!', 'success');
    closeSheetsModal();
  }

  function clearSheetsUrl() {
    if (confirm('Hapus konfigurasi URL Google Sheets dari browser ini?')) {
      localStorage.removeItem(SHEETS_KEY);
      state.sheetsUrl = '';
      const input = document.getElementById('sheets-api-url-input');
      if (input) input.value = '';
      updateSheetsHeaderStatus();
      showToast('Konfigurasi Google Sheets dihapus.', 'info');
    }
  }

  async function testSheetsConnection() {
    const input = document.getElementById('sheets-api-url-input');
    const url = input ? input.value.trim() : '';
    const feedback = document.getElementById('sheets-test-feedback');

    if (!url) {
      showFeedback('Harap masukkan URL Web App terlebih dahulu!', 'error');
      return;
    }

    if (!url.startsWith('https://script.google.com/macros/s/')) {
      showFeedback('URL tidak valid. Harus dari script.google.com!', 'error');
      return;
    }

    showFeedback('Menguji koneksi ke endpoint Google Sheets...', 'loading');

    try {
      await fetch(url, { method: 'GET', mode: 'no-cors' });
      showFeedback('✅ Berhasil Terhubung! Endpoint Google Apps Script merespons dan siap digunakan.', 'success');
    } catch (err) {
      console.error('Test connection error:', err);
      showFeedback('❌ Gagal menghubungi URL. Pastikan akses deployment Web App diset ke "Anyone".', 'error');
    }
  }

  function showFeedback(text, type) {
    const fb = document.getElementById('sheets-test-feedback');
    if (!fb) return;
    fb.classList.remove('hidden');

    if (type === 'loading') {
      fb.className = 'text-xs p-3 rounded-xl bg-slate-100 text-slate-700 flex items-center gap-2 border border-slate-200';
      fb.innerHTML = `<svg class="animate-spin w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg> <span>${text}</span>`;
    } else if (type === 'success') {
      fb.className = 'text-xs p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium';
      fb.innerHTML = text;
    } else {
      fb.className = 'text-xs p-3 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 font-medium';
      fb.innerHTML = text;
    }
  }

  // --- SEND DATA TO GOOGLE SHEETS API ---
  async function syncToGoogleSheets() {
    if (state.items.length === 0) {
      showToast('Daftar belanja masih kosong!', 'warning');
      return;
    }

    const url = localStorage.getItem(SHEETS_KEY) || state.sheetsUrl;

    if (!url || url.trim() === '') {
      showToast('URL Google Sheets belum disetel! Buka menu Pengaturan Sheets.', 'warning');
      openSheetsModal();
      return;
    }

    const totalSpent = state.items.reduce((s, i) => s + (i.price * i.qty), 0);
    const budget = state.budget;
    const diff = budget - totalSpent;
    const statusText = budget === 0 
      ? 'Tanpa Budget' 
      : diff >= 0 
      ? `Aman (Sisa ${formatRupiah(diff)})` 
      : `Defisit (Lebih ${formatRupiah(Math.abs(diff))})`;

    const itemSummary = state.items
      .map((item, idx) => `${idx + 1}. ${item.name} (${item.qty}x @ ${formatRupiah(item.price)} = ${formatRupiah(item.price * item.qty)})`)
      .join('\n');

    const aiAnalysis = generateAISuggestions();
    const saranText = aiAnalysis.summary.replace(/<[^>]+>/g, '') + ' | ' + aiAnalysis.tips.map(t => t.replace(/<[^>]+>/g, '')).join('; ');

    const payload = {
      targetAnggaran: budget,
      totalBelanja: totalSpent,
      sisaAnggaran: diff,
      status: statusText,
      detailBarang: itemSummary,
      saranAI: saranText
    };

    const btnSync = document.getElementById('btn-sync-sheets');
    const btnLabel = document.getElementById('btn-sync-sheets-label');
    const stickySync = document.getElementById('sticky-btn-sync');

    if (btnSync) btnSync.setAttribute('disabled', 'true');
    if (btnLabel) btnLabel.textContent = 'Menyimpan ke Google Sheets...';
    if (stickySync) stickySync.setAttribute('disabled', 'true');

    try {
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      saveSessionToHistory({ syncedToSheets: true, notify: false });
      showToast('🎉 Berhasil Disimpan ke Google Sheets & Riwayat!', 'success');
    } catch (error) {
      console.error('Save to Sheets error:', error);
      showToast('Gagal menyimpan ke Google Sheets. Periksa URL Anda.', 'error');
    } finally {
      if (btnSync) btnSync.removeAttribute('disabled');
      if (btnLabel) btnLabel.textContent = 'Simpan ke Google Sheets';
      if (stickySync) stickySync.removeAttribute('disabled');
    }
  }

  // --- SHARE VIA WHATSAPP ---
  function shareWhatsApp() {
    if (state.items.length === 0) {
      showToast('Daftar belanja masih kosong!', 'warning');
      return;
    }

    const totalSpent = state.items.reduce((s, i) => s + (i.price * i.qty), 0);
    const budget = state.budget;
    const diff = budget - totalSpent;

    let msg = `🛒 *CATATAN BELANJA HARIAN*\n`;
    msg += `📅 ${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}\n`;
    if (budget > 0) msg += `🎯 Target Anggaran: ${formatRupiah(budget)}\n`;
    msg += `--------------------------------\n`;

    state.items.forEach((item, idx) => {
      msg += `${idx + 1}. *${item.name || 'Barang'}*\n`;
      msg += `    ${item.qty}x @ ${formatRupiah(item.price)} = *${formatRupiah(item.price * item.qty)}*\n`;
    });

    msg += `--------------------------------\n`;
    msg += `💰 *TOTAL: ${formatRupiah(totalSpent)}*\n`;

    if (budget > 0) {
      if (diff >= 0) {
        msg += `✅ *STATUS: AMAN (Sisa ${formatRupiah(diff)})*\n`;
      } else {
        msg += `⚠️ *STATUS: OVER BUDGET (${formatRupiah(Math.abs(diff))})*\n`;
      }
    }
    msg += `\nDihitung via HitungBelanja.id ✨`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
  }

  // --- INITIALIZATION ---
  function init() {
    loadState();
    renderItems();

    const budgetInput = document.getElementById('budget-input');
    if (budgetInput && state.budget > 0) {
      budgetInput.value = state.budget.toLocaleString('id-ID');
    }

    updateCalculations();
    updateSheetsHeaderStatus();
    renderHistoryPreviews();
    updateHistoryBadges();

    if (budgetInput) {
      budgetInput.addEventListener('input', (e) => {
        const num = parseNumber(e.target.value);
        state.budget = num;
        e.target.value = num ? num.toLocaleString('id-ID') : '';
        updateCalculations();
        saveState();
      });
    }

    document.querySelectorAll('.btn-quick-budget').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = parseInt(btn.getAttribute('data-val'), 10);
        if (!isNaN(val)) {
          state.budget = val;
          if (budgetInput) budgetInput.value = val.toLocaleString('id-ID');
          updateCalculations();
          saveState();
          showToast(`Budget diatur ke ${formatRupiah(val)}`, 'info');
        }
      });
    });

    const btnClearBudget = document.getElementById('btn-clear-budget');
    if (btnClearBudget) {
      btnClearBudget.addEventListener('click', () => {
        state.budget = 0;
        if (budgetInput) budgetInput.value = '';
        updateCalculations();
        saveState();
      });
    }

    const btnAdd = document.getElementById('btn-add-item');
    if (btnAdd) btnAdd.addEventListener('click', () => addItem());

    const btnReset = document.getElementById('btn-reset-all');
    if (btnReset) btnReset.addEventListener('click', resetAll);

    const btnTplSembako = document.getElementById('btn-tpl-sembako');
    if (btnTplSembako) btnTplSembako.addEventListener('click', () => loadTemplate('sembako'));

    const btnTplDapur = document.getElementById('btn-tpl-dapur');
    if (btnTplDapur) btnTplDapur.addEventListener('click', () => loadTemplate('dapur'));

    const btnOpenAi = document.getElementById('btn-open-ai');
    if (btnOpenAi) btnOpenAi.addEventListener('click', openAISuggestions);

    const modalAiClose = document.getElementById('modal-ai-close');
    if (modalAiClose) {
      modalAiClose.addEventListener('click', () => {
        document.getElementById('modal-ai').classList.add('hidden');
      });
    }

    const btnSyncSheets = document.getElementById('btn-sync-sheets');
    if (btnSyncSheets) btnSyncSheets.addEventListener('click', syncToGoogleSheets);

    const stickySync = document.getElementById('sticky-btn-sync');
    if (stickySync) stickySync.addEventListener('click', syncToGoogleSheets);

    const btnSaveHistory = document.getElementById('btn-save-to-history');
    if (btnSaveHistory) btnSaveHistory.addEventListener('click', () => saveSessionToHistory());

    const btnOpenHistory = document.getElementById('btn-open-history-modal');
    if (btnOpenHistory) btnOpenHistory.addEventListener('click', openHistoryModal);

    const btnViewAllHistory = document.getElementById('btn-view-all-history');
    if (btnViewAllHistory) btnViewAllHistory.addEventListener('click', openHistoryModal);

    const stickyBtnHistory = document.getElementById('sticky-btn-history');
    if (stickyBtnHistory) stickyBtnHistory.addEventListener('click', openHistoryModal);

    const modalHistoryClose = document.getElementById('modal-history-close');
    if (modalHistoryClose) modalHistoryClose.addEventListener('click', closeHistoryModal);

    const btnClearAllHistory = document.getElementById('btn-clear-all-history');
    if (btnClearAllHistory) btnClearAllHistory.addEventListener('click', clearAllHistory);

    const btnRestoreSession = document.getElementById('btn-restore-session');
    if (btnRestoreSession) {
      btnRestoreSession.addEventListener('click', () => {
        if (activeDetailHistoryItem) {
          restoreHistorySession(activeDetailHistoryItem.id);
        }
      });
    }

    const btnOpenSheets = document.getElementById('btn-open-sheets-modal');
    if (btnOpenSheets) btnOpenSheets.addEventListener('click', openSheetsModal);

    const modalSheetsClose = document.getElementById('modal-sheets-close');
    if (modalSheetsClose) modalSheetsClose.addEventListener('click', closeSheetsModal);

    const btnSaveUrl = document.getElementById('btn-save-sheets-url');
    if (btnSaveUrl) btnSaveUrl.addEventListener('click', saveSheetsUrl);

    const btnTestUrl = document.getElementById('btn-test-sheets-url');
    if (btnTestUrl) btnTestUrl.addEventListener('click', testSheetsConnection);

    const btnClearUrl = document.getElementById('btn-clear-sheets-url');
    if (btnClearUrl) btnClearUrl.addEventListener('click', clearSheetsUrl);

    const btnShareWa = document.getElementById('btn-share-wa');
    if (btnShareWa) btnShareWa.addEventListener('click', shareWhatsApp);

    const btnPrint = document.getElementById('btn-print');
    if (btnPrint) btnPrint.addEventListener('click', () => window.print());

    window.addEventListener('click', (e) => {
      const modalAi = document.getElementById('modal-ai');
      const modalSheets = document.getElementById('modal-sheets-settings');
      const modalHistory = document.getElementById('modal-history');
      const modalDetail = document.getElementById('modal-history-detail');
      if (e.target === modalAi) modalAi.classList.add('hidden');
      if (e.target === modalSheets) closeSheetsModal();
      if (e.target === modalHistory) closeHistoryModal();
      if (e.target === modalDetail) modalDetail.classList.add('hidden');
    });
  }

  window.HitungApp = {
    addItem,
    removeItem,
    stepQty,
    openAISuggestions,
    openSheetsModal,
    openHistoryModal,
    openHistoryDetail,
    restoreHistorySession,
    deleteHistoryItem,
    syncToGoogleSheets,
    saveSessionToHistory,
    onNameChange: function (id, name) {
      updateItem(id, 'name', name);
    },
    onPriceInput: function (id, inputEl) {
      const num = parseNumber(inputEl.value);
      inputEl.value = num ? num.toLocaleString('id-ID') : '';
      updateItem(id, 'price', num);
    },
    onQtyChange: function (id, val) {
      updateItem(id, 'qty', val);
    }
  };

  document.addEventListener('DOMContentLoaded', init);
})();
