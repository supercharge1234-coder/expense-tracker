(() => {
  const STORAGE_KEY = 'expense_tracker_v1';
  const SETTINGS_KEY = 'expense_tracker_settings_v1';

  const CURRENCIES = [
    { code: 'CNY', symbol: '¥', name: '人民币' },
    { code: 'USD', symbol: '$', name: '美元' },
    { code: 'HKD', symbol: 'HK$', name: '港币' },
    { code: 'EUR', symbol: '€', name: '欧元' },
    { code: 'JPY', symbol: '¥', name: '日元' },
    { code: 'GBP', symbol: '£', name: '英镑' },
    { code: 'TWD', symbol: 'NT$', name: '新台币' },
    { code: 'SGD', symbol: 'S$', name: '新加坡元' },
    { code: 'KRW', symbol: '₩', name: '韩元' },
    { code: 'AUD', symbol: 'A$', name: '澳元' },
    { code: 'CAD', symbol: 'C$', name: '加元' },
    { code: 'MOP', symbol: 'MOP$', name: '澳门元' },
    { code: 'THB', symbol: '฿', name: '泰铢' },
    { code: 'MYR', symbol: 'RM', name: '马来西亚林吉特' },
  ];

  const COLORS = ['#3b82f6','#fb7185','#34d399','#fbbf24','#a78bfa','#22d3ee','#f97316','#e879f9','#94a3b8'];

  const CATEGORIES = {
    expense: [
      { id: 'food', name: '餐饮', emoji: '🍜' },
      { id: 'transport', name: '交通', emoji: '🚇' },
      { id: 'shopping', name: '购物', emoji: '🛒' },
      { id: 'housing', name: '居住', emoji: '🏠' },
      { id: 'entertainment', name: '娱乐', emoji: '🎮' },
      { id: 'medical', name: '医疗', emoji: '💊' },
      { id: 'education', name: '学习', emoji: '📚' },
      { id: 'other_exp', name: '其他', emoji: '📦' },
    ],
    income: [
      { id: 'salary', name: '工资', emoji: '💰' },
      { id: 'bonus', name: '奖金', emoji: '🎁' },
      { id: 'invest', name: '理财', emoji: '📈' },
      { id: 'parttime', name: '兼职', emoji: '💼' },
      { id: 'gift', name: '红包', emoji: '🧧' },
      { id: 'other_inc', name: '其他', emoji: '✨' },
    ],
  };

  let transactions = [];
  let currencyCode = 'CNY';
  let currentType = 'expense';
  let selectedCategory = null;
  let editingId = null;

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  function load() {
    try {
      transactions = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch { transactions = []; }
  }
  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  }

  function getCurrency() {
    return CURRENCIES.find(c => c.code === currencyCode) || CURRENCIES[0];
  }

  function formatMoney(n) {
    const cur = getCurrency();
    const num = Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return cur.symbol + ' ' + num;
  }

  function updateCurrencyUI() {
    const cur = getCurrency();
    const sym = document.getElementById('amountSymbol');
    if (sym) sym.textContent = cur.symbol;
    document.querySelectorAll('.currency-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.code === currencyCode);
    });
    const sel = document.getElementById('currencySelect');
    if (sel) sel.value = currencyCode;
  }

  function loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      if (s.currency && CURRENCIES.some(c => c.code === s.currency)) currencyCode = s.currency;
    } catch {}
  }

  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ currency: currencyCode }));
  }

  function initCurrencySelect() {
    const grid = document.getElementById('currencyGrid');
    const sel = document.getElementById('currencySelect');

    if (grid) {
      grid.innerHTML = CURRENCIES.map(c =>
        `<button type="button" class="currency-btn ${c.code === currencyCode ? 'active' : ''}" data-code="${c.code}">
          <span class="sym">${c.symbol}</span>${c.name}
        </button>`
      ).join('');
      grid.querySelectorAll('.currency-btn').forEach(btn => {
        btn.onclick = () => {
          currencyCode = btn.dataset.code;
          saveSettings();
          updateCurrencyUI();
          renderList();
          if (document.getElementById('pageStats') && document.getElementById('pageStats').classList.contains('active')) renderStats();
        };
      });
    }

    if (sel) {
      sel.innerHTML = CURRENCIES.map(c =>
        `<option value="${c.code}">${c.symbol} ${c.name} (${c.code})</option>`
      ).join('');
      sel.value = currencyCode;
      sel.onchange = () => {
        currencyCode = sel.value;
        saveSettings();
        updateCurrencyUI();
        renderList();
        if (document.getElementById('pageStats') && document.getElementById('pageStats').classList.contains('active')) renderStats();
      };
    }
  }
  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }
  function monthKey(d) { return d.slice(0, 7); }
  function getCategory(id) {
    return [...CATEGORIES.expense, ...CATEGORIES.income].find(c => c.id === id) || { name: '未知', emoji: '❓' };
  }
  function escapeHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ---------- Categories in form ----------
  function renderCategories() {
    const list = CATEGORIES[currentType];
    $('#categoryGrid').innerHTML = list.map(c => `
      <button type="button" class="cat-btn ${selectedCategory === c.id ? 'active' : ''}" data-id="${c.id}">
        <span class="emoji">${c.emoji}</span>${c.name}
      </button>`).join('');
    $$('#categoryGrid .cat-btn').forEach(btn => {
      btn.onclick = () => { selectedCategory = btn.dataset.id; renderCategories(); };
    });
  }

  // ---------- Filters ----------
  function populateFilters() {
    const months = [...new Set(transactions.map(t => monthKey(t.date)))].sort().reverse();
    const cur = $('#filterMonth').value;
    $('#filterMonth').innerHTML = '<option value="all">全部月份</option>' +
      months.map(m => `<option value="${m}">${m}</option>`).join('');
    if ([...$('#filterMonth').options].some(o => o.value === cur)) $('#filterMonth').value = cur;

    const used = [...new Set(transactions.map(t => t.category))];
    $('#filterCategory').innerHTML = '<option value="all">分类</option>' +
      used.map(id => {
        const c = getCategory(id);
        return `<option value="${id}">${c.emoji} ${c.name}</option>`;
      }).join('');
  }

  function getFiltered() {
    let list = [...transactions];
    const m = $('#filterMonth').value, t = $('#filterType').value, c = $('#filterCategory').value;
    if (m !== 'all') list = list.filter(x => monthKey(x.date) === m);
    if (t !== 'all') list = list.filter(x => x.type === t);
    if (c !== 'all') list = list.filter(x => x.category === c);
    return list.sort((a,b) => b.date.localeCompare(a.date) || b.created - a.created);
  }

  function updateSummary() {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    let balance = 0, mi = 0, me = 0;
    transactions.forEach(t => {
      if (t.type === 'income') balance += t.amount; else balance -= t.amount;
      if (monthKey(t.date) === thisMonth) {
        if (t.type === 'income') mi += t.amount; else me += t.amount;
      }
    });
    $('#balance').textContent = formatMoney(balance);
    $('#balance').style.color = balance >= 0 ? 'var(--income)' : 'var(--expense)';
    $('#monthIncome').textContent = formatMoney(mi);
    $('#monthExpense').textContent = formatMoney(me);
  }

  function renderList() {
    const list = getFiltered();
    populateFilters();
    updateSummary();

    if (!list.length) {
      $('#transactionList').innerHTML = '';
      $('#emptyState').classList.add('show');
      return;
    }
    $('#emptyState').classList.remove('show');

    const groups = {};
    list.forEach(t => { (groups[t.date] ||= []).push(t); });
    const dates = Object.keys(groups).sort((a,b) => b.localeCompare(a));
    const yesterday = (() => { const d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); })();

    $('#transactionList').innerHTML = dates.map(date => {
      const items = groups[date];
      const dayTotal = items.reduce((s,t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);
      const label = date === todayStr() ? '今天' : date === yesterday ? '昨天' : date;
      return `<div class="day-group">
        <div class="day-header"><span>${label}</span><span>${dayTotal>=0?'+':''}${formatMoney(dayTotal)}</span></div>
        ${items.map(t => {
          const cat = getCategory(t.category);
          const sign = t.type === 'income' ? '+' : '-';
          return `<div class="transaction" data-id="${t.id}">
            <div class="tx-icon ${t.type}">${cat.emoji}</div>
            <div class="tx-info">
              <div class="tx-category">${cat.name}</div>
              ${t.note ? `<div class="tx-note">${escapeHtml(t.note)}</div>` : ''}
            </div>
            <div class="tx-amount ${t.type}">${sign}${formatMoney(t.amount)}</div>
          </div>`;
        }).join('')}
      </div>`;
    }).join('');

    $$('#transactionList .transaction').forEach(el => {
      el.onclick = () => openEdit(el.dataset.id);
    });
  }

  // ---------- Stats ----------
  function populateStatsMonth() {
    const months = [...new Set(transactions.map(t => monthKey(t.date)))].sort().reverse();
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const opts = ['all', ...months];
    if (!months.includes(thisMonth)) opts.splice(1, 0, thisMonth);
    const cur = $('#statsMonth').value || thisMonth;
    $('#statsMonth').innerHTML = opts.map(m =>
      `<option value="${m}">${m === 'all' ? '全部时间' : m}</option>`
    ).join('');
    if ([...$('#statsMonth').options].some(o => o.value === cur)) $('#statsMonth').value = cur;
    else $('#statsMonth').value = months[0] || 'all';
  }

  function renderStats() {
    populateStatsMonth();
    const m = $('#statsMonth').value;
    let list = transactions;
    if (m !== 'all') list = list.filter(t => monthKey(t.date) === m);

    let income = 0, expense = 0;
    const expMap = {}, incMap = {};
    const dayMap = {}; // date -> { income, expense }

    list.forEach(t => {
      if (!dayMap[t.date]) dayMap[t.date] = { income: 0, expense: 0 };
      if (t.type === 'income') {
        income += t.amount;
        incMap[t.category] = (incMap[t.category] || 0) + t.amount;
        dayMap[t.date].income += t.amount;
      } else {
        expense += t.amount;
        expMap[t.category] = (expMap[t.category] || 0) + t.amount;
        dayMap[t.date].expense += t.amount;
      }
    });

    const net = income - expense;
    $('#statsIncome').textContent = formatMoney(income);
    $('#statsExpense').textContent = formatMoney(expense);
    const netEl = $('#statsNet');
    netEl.textContent = (net >= 0 ? '+' : '') + formatMoney(net);
    netEl.className = 'value ' + (net >= 0 ? 'pos' : 'neg');

    // 最大支出分类
    const expEntries = Object.entries(expMap).sort((a, b) => b[1] - a[1]);
    if (expEntries.length) {
      const [topId, topVal] = expEntries[0];
      const cat = getCategory(topId);
      const pct = expense > 0 ? ((topVal / expense) * 100).toFixed(1) : '0';
      $('#topEmoji').textContent = cat.emoji;
      $('#topName').textContent = cat.name;
      $('#topAmt').textContent = formatMoney(topVal);
      $('#topPct').textContent = `占本月支出 ${pct}% · 共 ${expEntries.length} 个分类`;
    } else {
      $('#topEmoji').textContent = '📦';
      $('#topName').textContent = '暂无支出';
      $('#topAmt').textContent = '—';
      $('#topPct').textContent = '';
    }

    // 每日列表 + 累计
    renderDailyList(dayMap);
    drawTrend(dayMap);

    $('#pieTotal').textContent = formatMoney(expense);
    drawPie(expMap, expense);
    renderBars('expenseBars', expMap, expense, 'expense');
    renderBars('incomeBars', incMap, income, 'income');
  }

  function renderDailyList(dayMap) {
    const dates = Object.keys(dayMap).sort((a, b) => b.localeCompare(a));
    const el = $('#dailyList');
    if (!dates.length) {
      el.innerHTML = '<div style="color:var(--muted);font-size:.85rem;padding:8px 0">暂无数据</div>';
      return;
    }
    // 按日期升序算累计，再倒序显示
    const asc = [...dates].sort();
    let cum = 0;
    const cumMap = {};
    asc.forEach(d => {
      const row = dayMap[d];
      cum += row.income - row.expense;
      cumMap[d] = cum;
    });

    el.innerHTML = `
      <div class="daily-row header">
        <span>日期</span><span class="i">收入</span><span class="e">支出</span><span class="n">累计净额</span>
      </div>` +
      dates.map(d => {
        const row = dayMap[d];
        const dayNet = row.income - row.expense;
        const c = cumMap[d];
        const label = d.slice(5); // MM-DD
        return `<div class="daily-row">
          <span class="d">${label}</span>
          <span class="i">${row.income ? formatMoney(row.income) : '—'}</span>
          <span class="e">${row.expense ? formatMoney(row.expense) : '—'}</span>
          <span class="n ${c >= 0 ? 'pos' : 'neg'}">${c >= 0 ? '+' : ''}${formatMoney(c)}</span>
        </div>`;
      }).join('');
  }

  function drawTrend(dayMap) {
    const canvas = $('#trendChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = 340, H = 160;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const dates = Object.keys(dayMap).sort();
    if (!dates.length) {
      ctx.fillStyle = '#8b9bb4';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('暂无数据', W / 2, H / 2);
      return;
    }

    let cum = 0;
    const points = dates.map(d => {
      cum += dayMap[d].income - dayMap[d].expense;
      return { date: d, value: cum };
    });

    const vals = points.map(p => p.value);
    let minV = Math.min(0, ...vals);
    let maxV = Math.max(0, ...vals);
    if (minV === maxV) { minV -= 1; maxV += 1; }
    const pad = (maxV - minV) * 0.1;
    minV -= pad; maxV += pad;

    const left = 40, right = 12, top = 16, bottom = 28;
    const plotW = W - left - right;
    const plotH = H - top - bottom;

    const xAt = i => left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
    const yAt = v => top + plotH - ((v - minV) / (maxV - minV)) * plotH;

    // zero line
    ctx.strokeStyle = '#243044';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const y0 = yAt(0);
    ctx.moveTo(left, y0);
    ctx.lineTo(W - right, y0);
    ctx.stroke();

    // area
    if (points.length >= 1) {
      ctx.beginPath();
      points.forEach((p, i) => {
        const x = xAt(i), y = yAt(p.value);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.lineTo(xAt(points.length - 1), y0);
      ctx.lineTo(xAt(0), y0);
      ctx.closePath();
      const last = points[points.length - 1].value;
      ctx.fillStyle = last >= 0 ? 'rgba(52,211,153,.12)' : 'rgba(251,113,133,.12)';
      ctx.fill();

      // line
      ctx.beginPath();
      points.forEach((p, i) => {
        const x = xAt(i), y = yAt(p.value);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = last >= 0 ? '#34d399' : '#fb7185';
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.stroke();

      // dots
      points.forEach((p, i) => {
        ctx.beginPath();
        ctx.arc(xAt(i), yAt(p.value), 3.5, 0, Math.PI * 2);
        ctx.fillStyle = p.value >= 0 ? '#34d399' : '#fb7185';
        ctx.fill();
      });
    }

    // y labels
    ctx.fillStyle = '#8b9bb4';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(formatMoney(maxV).replace(/\.00$/, ''), left - 4, top + 8);
    ctx.fillText(formatMoney(minV).replace(/\.00$/, ''), left - 4, top + plotH);

    // x labels (first / mid / last)
    ctx.textAlign = 'center';
    const labelIdx = points.length <= 3
      ? points.map((_, i) => i)
      : [0, Math.floor((points.length - 1) / 2), points.length - 1];
    [...new Set(labelIdx)].forEach(i => {
      ctx.fillText(points[i].date.slice(5), xAt(i), H - 8);
    });
  }

  function drawPie(map, total) {
    const canvas = $('#pieChart');
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const size = 200;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const entries = Object.entries(map).sort((a,b) => b[1]-a[1]);
    const legend = $('#expenseLegend');

    if (!entries.length || total <= 0) {
      ctx.beginPath();
      ctx.arc(100, 100, 78, 0, Math.PI * 2);
      ctx.strokeStyle = '#243044';
      ctx.lineWidth = 28;
      ctx.stroke();
      legend.innerHTML = '<span class="legend-item">暂无支出</span>';
      return;
    }

    let start = -Math.PI / 2;
    entries.forEach(([id, val], i) => {
      const angle = (val / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(100, 100, 78, start, start + angle);
      ctx.strokeStyle = COLORS[i % COLORS.length];
      ctx.lineWidth = 28;
      ctx.lineCap = 'butt';
      ctx.stroke();
      start += angle;
    });

    legend.innerHTML = entries.map(([id, val], i) => {
      const c = getCategory(id);
      const pct = ((val / total) * 100).toFixed(1);
      return `<div class="legend-item"><span class="legend-dot" style="background:${COLORS[i%COLORS.length]}"></span>${c.emoji} ${c.name} ${pct}%</div>`;
    }).join('');
  }

  function renderBars(elId, map, total, type) {
    const el = $('#' + elId);
    const entries = Object.entries(map).sort((a,b) => b[1]-a[1]);
    if (!entries.length) {
      el.innerHTML = `<div style="color:var(--muted);font-size:.85rem;padding:8px 0">暂无数据</div>`;
      return;
    }
    el.innerHTML = entries.map(([id, val], i) => {
      const c = getCategory(id);
      const pct = total > 0 ? (val / total) * 100 : 0;
      const color = type === 'expense' ? COLORS[i % COLORS.length] : 'var(--income)';
      return `<div class="bar-row">
        <div class="bar-meta">
          <span class="name">${c.emoji} ${c.name}</span>
          <span class="amt">${formatMoney(val)}</span>
        </div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>
        <div class="bar-pct">${pct.toFixed(1)}%</div>
      </div>`;
    }).join('');
  }

  // ---------- Modal ----------
  function openAdd() {
    editingId = null;
    currentType = 'expense';
    selectedCategory = CATEGORIES.expense[0].id;
    $('#modalTitle').textContent = '添加记录';
    $('#btnDelete').style.display = 'none';
    $('#amount').value = '';
    $('#note').value = '';
    $('#date').value = todayStr();
    $$('.type-tab').forEach(t => t.classList.toggle('active', t.dataset.type === 'expense'));
    renderCategories();
    $('#modal').classList.add('show');
    setTimeout(() => $('#amount').focus(), 150);
  }

  function openEdit(id) {
    const t = transactions.find(x => x.id === id);
    if (!t) return;
    editingId = id;
    currentType = t.type;
    selectedCategory = t.category;
    $('#modalTitle').textContent = '编辑记录';
    $('#btnDelete').style.display = 'block';
    $('#amount').value = t.amount;
    $('#note').value = t.note || '';
    $('#date').value = t.date;
    $$('.type-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.type === t.type));
    renderCategories();
    $('#modal').classList.add('show');
  }

  function closeModal() { $('#modal').classList.remove('show'); }

  $('#form').onsubmit = (e) => {
    e.preventDefault();
    const amount = parseFloat($('#amount').value);
    if (!amount || amount <= 0) return alert('请输入有效金额');
    if (!selectedCategory) return alert('请选择分类');

    const data = {
      id: editingId || 'tx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      type: currentType,
      amount: Math.round(amount * 100) / 100,
      category: selectedCategory,
      note: $('#note').value.trim(),
      date: $('#date').value,
      created: editingId ? (transactions.find(t => t.id === editingId)?.created || Date.now()) : Date.now(),
    };

    if (editingId) {
      const i = transactions.findIndex(t => t.id === editingId);
      if (i >= 0) transactions[i] = data;
    } else transactions.push(data);

    save();
    closeModal();
    renderList();
    if ($('#pageStats').classList.contains('active')) renderStats();
  };

  $('#btnDelete').onclick = () => {
    if (!editingId || !confirm('确定删除这条记录？')) return;
    transactions = transactions.filter(t => t.id !== editingId);
    save();
    closeModal();
    renderList();
    if ($('#pageStats').classList.contains('active')) renderStats();
  };

  $$('.type-tab').forEach(tab => {
    tab.onclick = () => {
      currentType = tab.dataset.type;
      $$('.type-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      selectedCategory = CATEGORIES[currentType][0].id;
      renderCategories();
    };
  });

  // Tabs
  $$('.tab').forEach(tab => {
    tab.onclick = () => {
      $$('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      $$('.page').forEach(p => p.classList.remove('active'));
      $('#' + tab.dataset.page).classList.add('active');
      if (tab.dataset.page === 'pageStats') renderStats();
      // hide FAB on stats? keep it
    };
  });

  ['filterMonth','filterType','filterCategory'].forEach(id => {
    $('#' + id).onchange = renderList;
  });
  $('#statsMonth').onchange = renderStats;

  $('#btnAdd').onclick = openAdd;
  $('#btnCloseModal').onclick = closeModal;
  $('#modal').onclick = (e) => { if (e.target === $('#modal')) closeModal(); };

  $('#btnSettings').onclick = () => $('#settingsModal').classList.add('show');
  $('#btnCloseSettings').onclick = () => $('#settingsModal').classList.remove('show');
  $('#settingsModal').onclick = (e) => { if (e.target === $('#settingsModal')) $('#settingsModal').classList.remove('show'); };

  $('#btnExport').onclick = () => {
    const blob = new Blob([JSON.stringify(transactions, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `收支记录_${todayStr()}.json`;
    a.click();
  };

  $('#btnImport').onclick = () => $('#importFile').click();
  $('#importFile').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data)) throw 0;
        if (!confirm(`将导入 ${data.length} 条记录，是否覆盖当前数据？`)) return;
        transactions = data;
        save();
        renderList();
        $('#settingsModal').classList.remove('show');
        alert('导入成功');
      } catch { alert('导入失败，请检查文件'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  $('#btnClear').onclick = () => {
    if (!confirm('确定清空全部数据？') || !confirm('再次确认：不可恢复！')) return;
    transactions = [];
    save();
    renderList();
    $('#settingsModal').classList.remove('show');
  };

  loadSettings();
  load();
  initCurrencySelect();
  updateCurrencyUI();
  renderList();
})();
