/* ===================================================
   ÖNÉRTÉKELŐ TESZTEK – kliensoldali motor
   - A válaszok csak a memóriában vannak: nincs tárolás
     (localStorage/cookie), nincs hálózati küldés.
   - A tesztek adatai: data/tesztek/<id>.json, lista: index.json
   - Nyelv: a main.js `currentLang` változója + 'langchange' esemény.
   =================================================== */
(function () {
  'use strict';

  const DATA_DIR = 'data/tesztek/';
  const listEl = document.getElementById('testList');
  const runnerEl = document.getElementById('testRunner');
  if (!listEl || !runnerEl) return;

  let ui = null;            // lang.json
  let tests = [];           // betöltött tesztek
  let active = null;        // aktív teszt
  let answers = {};         // { kerdesId: ertek }
  let showResult = false;

  const lang = () => (typeof currentLang === 'string' ? currentLang : 'hu');
  const t = (key) => (ui && ui[key] && (ui[key][lang()] || ui[key].hu)) || '';

  // Szöveg a teszt JSON-ból; ha az adott nyelven nincs, angol (jelezve)
  function tx(obj) {
    if (!obj) return { text: '', fallback: false };
    const v = obj[lang()];
    if (v) return { text: v, fallback: false };
    return { text: obj.en || obj.hu || '', fallback: lang() !== 'en' };
  }

  function el(tag, attrs, children) {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];   // csak saját lang.json szövegekhez
      else n.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(c => c && n.appendChild(c));
    return n;
  }

  /* ---------- Betöltés ---------- */
  function load() {
    Promise.all([
      fetch('lang.json').then(r => r.json()),
      fetch(DATA_DIR + 'index.json').then(r => r.json())
    ]).then(([langData, ids]) =>
      Promise.all(ids.map(id => fetch(DATA_DIR + id + '.json').then(r => r.json())))
        .then(list => { ui = langData; tests = list; render(); })
    ).catch(err => {
      console.error('Tesztek betöltése sikertelen:', err);
      listEl.textContent = 'A tesztek betöltése nem sikerült.';
    });
  }

  /* ---------- Lista ---------- */
  function renderList() {
    listEl.innerHTML = '';
    tests.forEach(test => {
      const card = el('article', { class: 'test-card' }, [
        el('h2', { text: tx(test.nev).text }),
        el('p', { text: tx(test.rovid).text }),
        el('p', { class: 'test-meta', text: `${test.kerdesek.length} ${t('tests_items')} · ~${test.perc} ${t('tests_minutes')}` })
      ]);
      const btn = el('button', { class: 'btn btn-primary', type: 'button', text: t('tests_start') });
      btn.addEventListener('click', () => start(test.id));
      card.appendChild(btn);
      listEl.appendChild(card);
    });
  }

  function start(id) {
    active = tests.find(x => x.id === id);
    answers = {};
    showResult = false;
    render();
    runnerEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function backToList() {
    active = null; answers = {}; showResult = false;
    render();
    listEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- Kitöltés ---------- */
  function renderRunner() {
    runnerEl.innerHTML = '';
    const test = active;
    let usedFallback = false;
    const use = (o) => { const r = tx(o); if (r.fallback) usedFallback = true; return r.text; };

    const back = el('button', { class: 'test-back', type: 'button', text: t('tests_back') });
    back.addEventListener('click', backToList);
    runnerEl.appendChild(back);
    runnerEl.appendChild(el('h2', { text: tx(test.nev).text }));

    const notice = el('p', { class: 'test-lang-notice', text: t('tests_lang_notice') });
    runnerEl.appendChild(notice);

    if (test.bevezeto) runnerEl.appendChild(el('p', { class: 'test-intro', text: use(test.bevezeto) }));
    if (test.kerdes_elotag) runnerEl.appendChild(el('p', { class: 'test-prefix', text: use(test.kerdes_elotag) }));

    const form = el('form', { class: 'test-form', novalidate: '' });
    test.kerdesek.forEach((q, i) => {
      const fs = el('fieldset', { class: 'test-item', id: `q-${test.id}-${q.id}` });
      fs.appendChild(el('legend', { text: `${i + 1}. ${use(q)}` }));
      const opts = el('div', { class: 'test-options' });
      test.valaszok.forEach(a => {
        const inputId = `a-${test.id}-${q.id}-${a.ertek}`;
        const input = el('input', { type: 'radio', name: `q${q.id}`, id: inputId, value: String(a.ertek) });
        if (answers[q.id] === a.ertek) input.checked = true;
        input.addEventListener('change', () => {
          answers[q.id] = a.ertek;
          fs.classList.remove('is-missing');
          updateProgress();
        });
        opts.appendChild(el('label', { class: 'test-option', for: inputId }, [input, el('span', { text: use(a) })]));
      });
      fs.appendChild(opts);
      form.appendChild(fs);
    });

    const progress = el('p', { class: 'test-progress', id: 'testProgress' });
    const missingMsg = el('p', { class: 'test-missing', id: 'testMissing', role: 'alert' });
    const submit = el('button', { class: 'btn btn-primary', type: 'submit', text: t('tests_submit') });
    form.appendChild(progress);
    form.appendChild(missingMsg);
    form.appendChild(submit);
    form.addEventListener('submit', (e) => { e.preventDefault(); evaluate(); });
    runnerEl.appendChild(form);

    notice.hidden = !usedFallback;
    updateProgress();

    if (showResult) runnerEl.appendChild(renderResult());
    runnerEl.appendChild(el('p', { class: 'test-source', text: `${t('tests_source')}: ${test.hivatkozas || test.forras}` }));
  }

  function updateProgress() {
    const p = document.getElementById('testProgress');
    if (!p || !active) return;
    const n = Object.keys(answers).length;
    p.textContent = `${n} / ${active.kerdesek.length}`;
  }

  function evaluate() {
    const missing = active.kerdesek.filter(q => !(q.id in answers));
    const msg = document.getElementById('testMissing');
    runnerEl.querySelectorAll('.test-item').forEach(f => f.classList.remove('is-missing'));
    if (missing.length) {
      missing.forEach(q => {
        const f = document.getElementById(`q-${active.id}-${q.id}`);
        if (f) f.classList.add('is-missing');
      });
      msg.textContent = `${t('tests_unanswered')} ${missing.map(q => active.kerdesek.indexOf(q) + 1).join(', ')}`;
      const first = document.getElementById(`q-${active.id}-${missing[0].id}`);
      if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    msg.textContent = '';
    showResult = true;
    render();
    const res = document.getElementById('testResult');
    if (res) res.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function score(test) {
    const raw = test.kerdesek.reduce((s, q) => s + Number(answers[q.id]), 0);
    return raw * (test.pontozas.szorzo || 1);
  }

  /* ---------- Eredmény ---------- */
  function renderResult() {
    const test = active;
    const s = score(test);
    const cat = test.kategoriak.find(c => s >= c.tol && s <= c.ig) || test.kategoriak[test.kategoriak.length - 1];
    const critical = (test.kritikus_tetelek || []).some(k => Number(answers[k.id]) >= k.kuszob);
    const urgent = critical || cat.szint === 'magas';

    const pct = Math.round(100 * (s - test.pontozas.min) / (test.pontozas.max - test.pontozas.min));
    const bar = el('div', { class: 'test-bar', role: 'img', 'aria-label': `${s} / ${test.pontozas.max}` },
      [el('span', { style: `width:${pct}%` })]);

    const box = el('section', { class: `test-result level-${cat.szint}`, id: 'testResult', 'aria-live': 'polite' }, [
      el('h3', { text: t('tests_result_title') }),
      el('p', { class: 'test-score', text: `${t('tests_score')}: ${s} / ${test.pontozas.max}` }),
      bar,
      el('p', { class: 'test-category', text: tx(cat.nev).text }),
      el('p', { text: tx(cat.szoveg).text }),
      el('p', { class: 'test-disclaimer', html: t('tests_disclaimer') })
    ]);

    if (cat.szint !== 'ok') {
      box.appendChild(el('h4', { text: t('tests_next_title') }));
      box.appendChild(el('p', { text: t('tests_next_text') }));
      box.appendChild(el('a', { class: 'btn btn-secondary', href: 'index.html#contact', text: t('tests_contact_btn') }));
    }
    if (urgent) {
      box.appendChild(el('div', { class: 'test-help is-urgent' }, [
        el('h4', { text: t('tests_help_title') }),
        el('div', { html: t('tests_help_body') })
      ]));
    }
    const again = el('button', { class: 'test-back', type: 'button', text: t('tests_retake') });
    again.addEventListener('click', () => start(test.id));
    box.appendChild(again);
    return box;
  }

  function render() {
    if (!ui) return;
    if (active) { listEl.hidden = true; runnerEl.hidden = false; renderRunner(); }
    else { runnerEl.hidden = true; runnerEl.innerHTML = ''; listEl.hidden = false; renderList(); }
  }

  document.addEventListener('langchange', render);
  load();
})();
