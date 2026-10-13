/* Alyntic — shared behaviour. Each block only runs if its elements are on the page. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const store = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Common: year, nav, reveal, count-up, image fallback ---------- */
  $$('.year').forEach(el => el.textContent = new Date().getFullYear());

  const burger = $('#burger'), links = $('#links');
  if (burger) {
    burger.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      burger.setAttribute('aria-expanded', open);
    });
  }

  $$('img[data-fallback]').forEach(img => {
    img.addEventListener('error', () => { if (img.src.indexOf(img.dataset.fallback) === -1) img.src = img.dataset.fallback; }, { once: true });
  });

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { threshold: .12 });
    $$('.reveal').forEach(el => io.observe(el));

    if (!reduce) {
      const co = new IntersectionObserver(es => es.forEach(e => {
        if (!e.isIntersecting) return;
        const el = e.target, end = +el.dataset.count, pre = el.dataset.prefix || '', suf = el.dataset.suffix || '';
        const t0 = performance.now();
        (function step(t) {
          const k = Math.min(1, (t - t0) / 1100);
          el.textContent = pre + Math.round(end * (1 - Math.pow(1 - k, 3))) + suf;
          if (k < 1) requestAnimationFrame(step);
        })(t0);
        co.unobserve(el);
      }), { threshold: .6 });
      $$('[data-count]').forEach(el => co.observe(el));
    }
  } else {
    $$('.reveal').forEach(el => el.classList.add('in'));
  }

  /* ---------- Time helpers ---------- */
  function offsetHours(tz, d = new Date()) {
    const local = new Date(d.toLocaleString('en-US', { timeZone: tz }));
    const utc = new Date(d.toLocaleString('en-US', { timeZone: 'UTC' }));
    return Math.round((local - utc) / 36e5 * 4) / 4;
  }
  function partsIn(tz) {
    const p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false }).formatToParts(new Date());
    const g = t => p.find(x => x.type === t).value;
    const hh = +g('hour') % 24, mm = +g('minute');
    return { h: hh + mm / 60, wd: g('weekday'), label: String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') };
  }
  const CITIES = [
    { name: 'Cape Town', tz: 'Africa/Johannesburg' },
    { name: 'London', tz: 'Europe/London' },
    { name: 'Amsterdam', tz: 'Europe/Amsterdam' },
    { name: 'Sydney', tz: 'Australia/Sydney' },
    { name: 'Auckland', tz: 'Pacific/Auckland' }
  ];

  /* ---------- Live desk clocks (home) ---------- */
  const clocks = $('#clocks');
  function renderClocks() {
    clocks.innerHTML = CITIES.slice(0, 4).map(c => {
      const t = partsIn(c.tz), off = offsetHours(c.tz);
      const open = t.h >= 8 && t.h < 17 && !['Sat', 'Sun'].includes(t.wd);
      return `<div class="clock"><span class="city">${c.name}</span><span class="time">${t.label}</span>
        <span class="meta">${t.wd} · UTC${off >= 0 ? '+' : ''}${off}</span>
        <span class="pill ${open ? 'open' : 'closed'}">${open ? 'Business hours' : 'After hours'}</span></div>`;
    }).join('');
  }
  if (clocks) { renderClocks(); setInterval(renderClocks, 30000); }

  /* ---------- Coverage chart (why Cape Town) ---------- */
  const tzRows = $('#tzRows');
  if (tzRows) {
    let shift = [8, 17];
    const pct = h => (h / 24 * 100) + '%';
    const segs = (s, e) => {
      s = ((s % 24) + 24) % 24; e = ((e % 24) + 24) % 24;
      if (s === e) return [[0, 24]];
      return s < e ? [[s, e]] : [[s, 24], [0, e]];
    };
    const inter = (a, b) => {
      const out = [];
      a.forEach(([s1, e1]) => b.forEach(([s2, e2]) => { const s = Math.max(s1, s2), e = Math.min(e1, e2); if (e > s) out.push([s, e]); }));
      return out;
    };
    function renderCoverage() {
      const sa = offsetHours('Africa/Johannesburg'), now = partsIn('Africa/Johannesburg').h, sh = segs(shift[0], shift[1]);
      tzRows.innerHTML = CITIES.slice(1).map(c => {
        const diff = sa - offsetHours(c.tz);
        const client = segs(8 + diff, 17 + diff), ov = inter(client, sh);
        const hrs = ov.reduce((t, [s, e]) => t + e - s, 0);
        const bar = (arr, cls) => arr.map(([s, e]) => `<span class="seg ${cls}" style="left:${pct(s)};width:${pct(e - s)}"></span>`).join('');
        const d = diff === 0 ? 'same time as Cape Town' : `${Math.abs(diff)}h ${diff > 0 ? 'behind' : 'ahead of'} Cape Town`;
        return `<div class="tz-row"><div class="tz-name">${c.name}<small>${d}</small></div>
          <div class="track">${bar(client, 'client')}${bar(sh, 'shift')}${bar(ov, 'overlap')}<span class="now" style="left:${pct(now)}" title="Now in Cape Town"></span></div>
          <div class="tz-overlap">${hrs % 1 ? hrs.toFixed(1) : hrs}h<small>shared</small></div></div>`;
      }).join('');
    }
    $('#ticks').innerHTML = [0, 3, 6, 9, 12, 15, 18, 21, 24].map(h => `<span style="left:${pct(h)}">${String(h % 24).padStart(2, '0')}:00</span>`).join('');
    $$('[data-shift]').forEach(b => b.addEventListener('click', () => {
      $$('[data-shift]').forEach(x => x.setAttribute('aria-pressed', x === b));
      shift = b.dataset.shift.split(',').map(Number);
      renderCoverage();
    }));
    renderCoverage(); setInterval(renderCoverage, 60000);
  }

  /* ---------- Savings estimator (why Cape Town) ---------- */
  const calcForm = $('#calc');
  if (calcForm) {
    const MKT = {
      UK: { sym: '£', cost: 2600, label: 'UK' },
      EU: { sym: '€', cost: 3000, label: 'European' },
      AU: { sym: 'A$', cost: 6000, label: 'Australian' }
    };
    let mkt = 'UK';
    const agents = $('#agents'), cost = $('#cost');
    const num = s => +String(s).replace(/[^\d]/g, '') || 0;
    const fmt = n => MKT[mkt].sym + Math.round(n).toLocaleString('en-GB');
    function calc() {
      const n = +agents.value, c = num(cost.value), annual = n * c * 12, lo = annual * .4, hi = annual * .6;
      $('#agentsOut').textContent = n;
      $('#saveRange').textContent = `${fmt(lo)} – ${fmt(hi)}`;
      $('#saveSub').textContent = `per year, for a team of ${n} agent${n > 1 ? 's' : ''}`;
      $('#curVal').textContent = `${fmt(annual)} / year`;
      $('#alyVal').textContent = `${fmt(annual - hi)} – ${fmt(annual - lo)} / year`;
      store.set('alyntic_estimate', `${n} agents, ${MKT[mkt].label} market, in-house ${fmt(c)}/agent/month. Estimated saving ${fmt(lo)}–${fmt(hi)} per year.`);
    }
    agents.addEventListener('input', calc);
    cost.addEventListener('input', calc);
    cost.addEventListener('blur', () => { cost.value = num(cost.value).toLocaleString('en-GB'); });
    $$('[data-mkt]').forEach(b => b.addEventListener('click', () => {
      $$('[data-mkt]').forEach(x => x.setAttribute('aria-pressed', x === b));
      mkt = b.dataset.mkt;
      $('#sym').textContent = MKT[mkt].sym;
      cost.value = MKT[mkt].cost.toLocaleString('en-GB');
      calc();
    }));
    calc();
  }

  /* ---------- Services tabs ---------- */
  const svcTabs = $('#svcTabs');
  if (svcTabs) {
    const SVC = [
      { id: 'support', tab: 'Customer support', pick: 'Customer Support', title: 'Multichannel customer support',
        text: 'A dedicated team that knows your product and speaks to your customers the way you would, across every channel they use.',
        ticks: ['Voice, email, live chat, WhatsApp and social media', 'Trained on your tone of voice and knowledge base', 'Quality-checked conversations with regular reporting', 'Escalation paths agreed with your team'],
        ideal: ['Scale-ups outgrowing an in-house inbox', 'Brands that need extended hours'], ch: 'Voice · Email · Chat · WhatsApp · Social' },
      { id: 'ecommerce', tab: 'E-commerce', pick: 'E-commerce Operations', title: 'E-commerce operations',
        text: 'The day-to-day work that keeps an online store running smoothly, from the first "where is my order" to the final refund.',
        ticks: ['Order tracking and delivery queries', 'Returns, exchanges and refunds', 'Stock and product questions', 'Payment and billing support'],
        ideal: ['Online stores and marketplaces', 'Seasonal peaks like Black Friday'], ch: 'Email · Chat · WhatsApp' },
      { id: 'leadgen', tab: 'Sales & lead generation', pick: 'Sales & Lead Generation', title: 'Sales and lead generation',
        text: 'Outbound teams that qualify leads, book appointments and follow up on quotes, run to POPIA and GDPR requirements.',
        ticks: ['Outbound calling and lead qualification', 'Appointment setting for your sales team', 'Quote follow-ups and win-backs', 'Call recordings and QA reports for every campaign'],
        ideal: ['Insurance and financial services', 'B2B sales teams needing more pipeline'], ch: 'Voice · Email · WhatsApp' },
      { id: 'backoffice', tab: 'Back office', pick: 'Back Office Services', title: 'Back-office services',
        text: 'Accurate, process-driven admin that frees your core team to focus on customers and growth.',
        ticks: ['Data entry and data cleansing', 'Document processing and verification', 'CRM updates and record management', 'General administrative support'],
        ideal: ['Teams buried in manual admin', 'Businesses moving to a new CRM'], ch: 'Your systems, our team' }
    ];
    let i = Math.max(0, SVC.findIndex(s => '#' + s.id === location.hash));
    function render() {
      svcTabs.innerHTML = SVC.map((s, n) => `<button class="chip" role="tab" aria-selected="${n === i}" data-i="${n}">${s.tab}</button>`).join('');
      const s = SVC[i];
      $('#svcPanel').innerHTML = `<div><h3>${s.title}</h3><p>${s.text}</p><ul class="ticks">${s.ticks.map(t => `<li>${t}</li>`).join('')}</ul></div>
        <dl class="ideal"><div><dt>Ideal for</dt>${s.ideal.map(x => `<dd>${x}</dd>`).join('')}</div><div><dt>Channels</dt><dd>${s.ch}</dd></div>
        <div><a class="btn btn-primary arrow" href="contact.html?service=${encodeURIComponent(s.pick)}">Ask about ${s.tab.toLowerCase()} </a></div></dl>`;
    }
    svcTabs.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) { i = +b.dataset.i; render(); } });
    render();
  }

  /* ---------- Launch timeline ---------- */
  const phases = $('#phases');
  if (phases) {
    const PH = [
      { days: 'Days 1–2', name: 'Discovery', text: 'We map your customer journeys, channels, volumes and service levels, and agree the coverage window and KPIs.', you: 'Share your processes, FAQs and a point of contact.' },
      { days: 'Days 3–5', name: 'Recruitment', text: 'We shortlist and assess agents for your brand, testing language, tone and the skills your queries need.', you: 'Optional: join final interviews.' },
      { days: 'Days 6–10', name: 'Training', text: 'Agents learn your product, systems and tone of voice through structured training and role-play.', you: 'Give us access to your tools and knowledge base.' },
      { days: 'Days 11–13', name: 'Pilot', text: 'The team handles live contacts under close supervision. We review quality daily and tune scripts and processes.', you: 'Review sample calls and tickets with us.' },
      { days: 'Day 14', name: 'Go live', text: 'Full go-live with agreed reporting, quality checks and regular performance reviews from then on.', you: 'Meet with us for regular performance reviews.' }
    ];
    let p = 0;
    function render() {
      phases.innerHTML = PH.map((x, n) => `<button class="phase" role="tab" aria-selected="${n === p}" data-i="${n}"><span class="days">${x.days}</span><b>${x.name}</b></button>`).join('');
      const x = PH[p];
      $('#phaseDetail').innerHTML = `<span class="phase-num grad-text">${String(p + 1).padStart(2, '0')}</span><div><h3>${x.name} · ${x.days}</h3><p>${x.text}</p><span class="you"><strong>From you:</strong> ${x.you}</span></div>`;
      $('#prog').style.width = ((p + 1) / PH.length * 100) + '%';
    }
    phases.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) { p = +b.dataset.i; render(); } });
    render();
  }

  /* ---------- Live project pipeline (home + projects) ---------- */
  $$('.pipeline[data-live]').forEach(pl => {
    const stages = $$('.stage', pl);
    let k = 0;
    function step() {
      stages.forEach((s, n) => {
        s.classList.toggle('on', n === k);
        s.classList.toggle('done', n < k);
        $('.st', s).textContent = n === k ? 'In progress' : n < k ? 'Done' : 'Queued';
      });
      k = (k + 1) % stages.length;
    }
    step();
    if (!reduce) setInterval(step, 1800);
  });

  /* ---------- Gallery lightbox ---------- */
  const gallery = $('#gallery'), lb = $('#lightbox');
  if (gallery && lb) {
    const items = $$('button', gallery);
    const lbImg = $('img', lb), lbCap = $('#lbCap');
    let cur = 0, opener = null;
    function show(n) {
      cur = (n + items.length) % items.length;
      const img = $('img', items[cur]);
      lbImg.src = img.dataset.large || img.src;
      lbImg.alt = img.alt;
      lbCap.innerHTML = items[cur].dataset.caption;
    }
    function open(n) { opener = document.activeElement; show(n); lb.hidden = false; document.body.style.overflow = 'hidden'; $('#lbClose').focus(); }
    function close() { lb.hidden = true; document.body.style.overflow = ''; if (opener) opener.focus(); }
    items.forEach((b, n) => b.addEventListener('click', () => open(n)));
    $('#lbPrev').addEventListener('click', () => show(cur - 1));
    $('#lbNext').addEventListener('click', () => show(cur + 1));
    $('#lbClose').addEventListener('click', close);
    lb.addEventListener('click', e => { if (e.target === lb) close(); });
    document.addEventListener('keydown', e => {
      if (lb.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(cur - 1);
      if (e.key === 'ArrowRight') show(cur + 1);
    });
  }

  /* ---------- Multi-step contact form ---------- */
  const form = $('#contact-form');
  if (form) {
    const steps = $$('.step', form), bars = $$('.steps span', form);
    const back = $('#back'), next = $('#next'), send = $('#send'), status = $('#form-status');
    let cur = 1;

    const q = new URLSearchParams(location.search);
    const pre = q.get('service');
    if (pre) { const r = form.querySelector(`input[name=service][value="${CSS.escape(pre)}"]`); if (r) r.checked = true; }
    const est = store.get('alyntic_estimate');
    if (est) { $('#estimate').value = est; }

    function show(n) {
      cur = n;
      steps.forEach(s => s.hidden = +s.dataset.step !== n);
      bars.forEach((b, i) => b.classList.toggle('on', i < n));
      back.hidden = n === 1; next.hidden = n === 3; send.hidden = n !== 3;
      if (n === 3) {
        const f = new FormData(form);
        const rows = [['Company', 'company'], ['Name', 'from_name'], ['Email', 'reply_to'], ['Market', 'market'], ['Service', 'service'], ['Volume', 'volume']];
        if (est) rows.push(['Savings estimate', 'estimate']);
        $('#summary').innerHTML = rows.map(([l, k]) => `<div><dt>${l}</dt><dd>${String(f.get(k) || '').replace(/[<&]/g, c => c === '<' ? '&lt;' : '&amp;')}</dd></div>`).join('');
      }
      const first = steps[n - 1].querySelector('input:not([type=hidden]),textarea');
      if (first) first.focus({ preventScroll: true });
    }
    function valid1() {
      let ok = true;
      ['company', 'name', 'email'].forEach(id => {
        const el = document.getElementById(id), err = el.parentElement.querySelector('.err');
        let msg = '';
        if (!el.value.trim()) msg = 'Please fill this in.';
        else if (id === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value.trim())) msg = 'Enter an email like name@company.com.';
        err.textContent = msg; if (msg) ok = false;
      });
      return ok;
    }
    next.addEventListener('click', () => { if (cur === 1 && !valid1()) return; show(cur + 1); });
    back.addEventListener('click', () => show(cur - 1));
    form.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && cur < 3) { e.preventDefault(); next.click(); } });

    if (window.emailjs) emailjs.init({ publicKey: 'ANg1_OriOMRzRfvU2' });
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (!window.emailjs) {
        status.className = 'form-status bad';
        status.textContent = 'The form could not load. Please email alynticz@gmail.com or WhatsApp +27 73 136 9654.';
        return;
      }
      send.disabled = true; status.className = 'form-status'; status.textContent = 'Sending…';
      emailjs.sendForm('service_7m8f43c', 'template_lcz8p4u', form).then(() => {
        status.className = 'form-status ok';
        status.textContent = 'Thank you. We\'ll reply within 4 hours on business days.';
        form.reset(); if (est) $('#estimate').value = est; show(1);
      }, err => {
        console.error('EmailJS error:', err);
        status.className = 'form-status bad';
        status.textContent = 'Your message didn\'t send. Please email alynticz@gmail.com or WhatsApp +27 73 136 9654.';
      }).finally(() => { send.disabled = false; });
    });
  }
})();
