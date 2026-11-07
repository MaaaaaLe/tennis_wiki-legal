// 이름결 — 화면 로직
(function () {
  'use strict';
  const E = window.NameEngine;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const EL_CLASS = { '木': 'wood', '火': 'fire', '土': 'earth', '金': 'metal', '水': 'water' };
  const elTag = el => `<span class="el ${EL_CLASS[el]}">${el}<small>${E.EL_KO[el]}</small></span>`;
  const LEVEL = [['흉', 'bad'], ['반길', 'mid'], ['길', 'good']];

  const store = {
    get(k, d) { try { const v = localStorage.getItem('ireumgyeol.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('ireumgyeol.' + k, JSON.stringify(v)); } catch (e) { /* 저장 불가 환경 */ } }
  };

  const state = Object.assign({
    surname: '김', surnameHanja: '金', gender: 'A', birth: '', lunar: false, leap: false, time: '', noTime: true, lmt: true, school: 'standard',
    fixedSyl: '', fixedPos: 0, fixedHanja: '', include: '', tab: 'rec', anaName: '', anaHanja: []
  }, store.get('state', {}));
  let favorites = store.get('favorites', []);
  const save = () => store.set('state', state);

  // ── 성 ─────────────────────────────────────────────
  function surnameOptions(s) {
    if (!s) return [];
    const opts = [];
    const known = window.SURNAMES[s] || '';
    if (s.length === 2 && known.length === 2) return [known];
    if (s.length === 1) {
      known.split('').forEach(c => opts.push(c));
      E.hanjaList(s).forEach(h => { if (!opts.includes(h.ch)) opts.push(h.ch); });
    } else if (s.length === 2) {
      const a = E.hanjaList(s[0])[0], b = E.hanjaList(s[1])[0];
      if (a && b) opts.push(a.ch + b.ch);
    }
    return opts.slice(0, 12);
  }
  function surnameParts() {
    const s = state.surname, hj = state.surnameHanja;
    if (!s || !hj || s.length !== hj.length) return null;
    const parts = s.split('').map((syl, i) => ({ syl, hanja: E.findHanja(syl, hj[i]) }));
    return parts.every(p => p.hanja) ? parts : null;
  }
  function renderSurname() {
    const box = $('#surnameHanja');
    const opts = surnameOptions(state.surname);
    if (!opts.includes(state.surnameHanja)) state.surnameHanja = opts[0] || '';
    box.innerHTML = opts.map(o => {
      const info = o.length === 1 ? E.findHanja(state.surname, o) : null;
      return `<button type="button" class="chip ${o === state.surnameHanja ? 'on' : ''}" data-v="${esc(o)}">${esc(o)}${info ? `<small>${esc(info.meaning.split(',')[0])}</small>` : ''}</button>`;
    }).join('') || '<span class="muted">한글로 성을 입력하세요</span>';
  }

  // ── 사주 ────────────────────────────────────────────
  function currentSaju() {
    if (!state.birth) return null;
    let [y, m, d] = state.birth.split('-').map(Number);
    if (!y || !m || !d) return null;
    if (state.lunar) {
      const sol = E.lunarToSolar(y, m, d, state.leap);
      if (!sol) return { error: `음력 ${y}년 ${state.leap ? '윤' : ''}${m}월 ${d}일은 없는 날짜예요.` };
      ({ y, m, d } = sol);
    }
    const b = { y, m, d };
    if (!state.noTime && state.time) { const [h, mi] = state.time.split(':').map(Number); b.hour = h; b.minute = mi; }
    const sj = E.saju(b, { lmt: state.lmt });
    sj.solar = b;
    sj.lunarDate = E.solarToLunar(b.y, b.m, b.d);
    return sj;
  }
  // 오류 객체가 아닌 사주만 계산에 사용
  const sajuForCalc = () => { const sj = currentSaju(); return sj && !sj.error ? sj : null; };
  function renderSaju(sj) {
    const box = $('#sajuBox');
    if (!sj) { box.innerHTML = '<p class="muted small">생년월일을 입력하면 사주를 세우고 용신(사주에 필요한 오행)을 찾아 이름으로 보완합니다. 출산 전이라면 예정일로 미리 볼 수 있어요.</p>'; return; }
    if (sj.error) { box.innerHTML = `<p class="warn small">${esc(sj.error)}</p>`; return; }
    const Y = sj.yong, L = sj.lunarDate;
    const max = Math.max.apply(null, E.ELEMENTS.map(e => sj.count[e])) || 1;
    box.innerHTML = `
      <div class="pillars">${sj.hasTime ? '' : '<div class="pillar ghost"><div class="plabel">시주</div><div class="pch">?</div><div class="pch">?</div><div class="pko">시간 모름</div></div>'}${sj.pillars.slice().reverse().map(p => `
        <div class="pillar"><div class="plabel">${p.label}</div>
          <div class="pch ${EL_CLASS[p.stemEl]}">${p.stem}</div><div class="pch ${EL_CLASS[p.branchEl]}">${p.branch}</div>
          <div class="pko">${p.ko}</div></div>`).join('')}
      </div>
      <div class="bars">${E.ELEMENTS.map(e => `
        <div class="bar"><span class="bl">${elTag(e)}</span><span class="track"><span class="fill ${EL_CLASS[e]}" style="width:${sj.count[e] / max * 100}%"></span></span><b>${sj.count[e]}</b></div>`).join('')}
      </div>
      <p class="small muted">양력 ${sj.solar.y}.${sj.solar.m}.${sj.solar.d}${L ? ` · 음력 ${L.y}.${L.leap ? '윤' : ''}${L.m}.${L.d}` : ''}${sj.dst ? ' · 서머타임 시기라 1시간 보정했어요' : ''}${sj.utcOffset === 8.5 ? ' · 당시 표준시(UTC+8:30) 적용' : ''}</p>
      <p class="small">일간(나를 상징하는 글자) <b>${sj.dayMaster}</b> ${elTag(sj.dayMasterEl)} · <b>${Y.strong ? '신강' : '신약'}</b> 사주
        <span class="muted">(일간을 돕는 힘 ${Y.support}/${Y.total})</span></p>
      <div class="yong">
        <div><small>용신</small>${elTag(Y.yong)}</div>
        <div><small>희신</small>${Y.hui.map(elTag).join(' ')}</div>
        <div><small>기신</small>${elTag(Y.gi)}</div>
      </div>
      <p class="small">${esc(Y.reason)}.${Y.johu ? ` ${Y.johu === '水' ? '여름' : '겨울'}에 태어나 ${elTag(Y.johu)} 기운으로 온도를 조절(조후)하는 것도 좋아요.` : ''}</p>
      <p class="muted small">이름 한자의 자원오행이 용신·희신이면 가점, 기신이면 감점합니다. 억부법을 바탕으로 한 간이 판단이며, 전문가마다 용신 판단이 다를 수 있어요.</p>`;
  }

  // ── 분석 결과 렌더 ──────────────────────────────────
  function analysisHTML(surname, given, ev, opts) {
    opts = opts || {};
    const all = surname.concat(given);
    const nameKo = all.map(x => x.syl).join(''), nameHj = all.map(x => x.hanja.ch).join('');
    const favKey = nameKo + '|' + nameHj;
    const isFav = favorites.some(f => f.key === favKey);
    const bar = (label, v, max) => `<div class="sbar"><span>${label}</span><span class="track"><span class="fill accent" style="width:${v / max * 100}%"></span></span><b>${v}/${max}</b></div>`;
    return `
    <div class="result-head">
      <div>
        <div class="big-name">${esc(nameKo)}</div>
        <div class="big-hanja">${esc(nameHj)}</div>
        <div class="meaning">${given.map(g => `${g.hanja.ch} <small>${esc(g.hanja.meaning.split(',')[0] || '')} ${esc(g.syl)}</small>`).join(' · ')}</div>
      </div>
      <div class="score-circle g-${ev.grade}"><b>${ev.total}</b><small>${ev.grade}</small></div>
    </div>
    <button type="button" class="fav-btn ${isFav ? 'on' : ''}" data-fav='${esc(JSON.stringify({ key: favKey, ko: nameKo, hj: nameHj, s: surname.map(x => [x.syl, x.hanja.ch]), g: given.map(x => [x.syl, x.hanja.ch]) }))}'>${isFav ? '♥ 찜한 이름' : '♡ 찜하기'}</button>

    <div class="scores">
      ${bar('수리 4격', ev.suriScore, 36)}${bar('수리오행', ev.suriElScore, 10)}${bar('발음오행', ev.soundScore, 20)}${bar('자원오행', ev.jawonScore, 20)}${bar('획수 음양', ev.yyScore, 8)}${bar('글자 적합도', ev.charScore, 6)}
    </div>

    <h4>글자 풀이</h4>
    <table class="chars"><thead><tr><th>글자</th><th>뜻</th><th>원획</th><th>자원오행</th><th>발음오행</th><th>음양</th></tr></thead><tbody>
      ${all.map((x, i) => `<tr class="${i < surname.length ? 'sur' : ''}"><td><b class="hj">${x.hanja.ch}</b> ${esc(x.syl)}</td><td>${esc(x.hanja.meaning || '-')}</td><td>${x.hanja.strokes}</td>
        <td>${elTag(x.hanja.element)}${x.hanja.estimated ? '<sup title="부수로 판별되지 않아 발음으로 추정">*</sup>' : ''}</td><td>${elTag(E.soundElement(x.syl, state.school))}</td><td>${ev.yinyang[i]}</td></tr>`).join('')}
    </tbody></table>

    <h4>수리 4격 (원형이정)</h4>
    <div class="four">${ev.four.map(f => `
      <div class="frow"><div class="fkey"><b>${f.key}</b><small>${f.period}</small></div>
        <div class="fnum">${f.n}<small>수</small></div>
        <div class="fdesc"><span class="lv ${LEVEL[f.level][1]}">${LEVEL[f.level][0]}</span> <b>${f.name}</b> ${elTag(f.element)}<br><small>${f.desc}</small><br><small class="muted">${f.formula}</small></div></div>`).join('')}
    </div>

    <h4>수리오행</h4>
    <div class="flow">${ev.four.map((f, i) => `<span class="fnode">${f.key} ${elTag(f.element)}</span>${i < 3 ? `<span class="rel ${ev.suriElPairs[i].rel}">${E.REL_KO[ev.suriElPairs[i].rel]}</span>` : ''}`).join('')}</div>
    <p class="small muted">각 격 수의 끝자리로 오행을 정합니다 (1·2 목, 3·4 화, 5·6 토, 7·8 금, 9·0 수). 원격→형격→이격→정격이 서로 살려주면 좋다고 봅니다.</p>

    <h4>발음오행 <small class="muted">${state.school === 'haerye' ? '해례본 기준' : '현대 통용 기준'}</small></h4>
    <div class="flow">${all.map((x, i) => {
      const e = E.soundElement(x.syl, state.school);
      const rel = i >= surname.length - 1 && i < all.length - 1 ? ev.soundPairs[i - (surname.length - 1)] : null;
      return `<span class="fnode">${esc(x.syl)} ${elTag(e)}</span>${rel ? `<span class="rel ${rel.rel}">${E.REL_KO[rel.rel]}</span>` : ''}`;
    }).join('')}</div>
    <p class="small muted">초성의 소리 오행이 이어지며 서로 살려주면(상생) 부르기 좋고 기운이 순하다고 봅니다.</p>

    <h4>획수 음양</h4>
    <p class="small">${ev.yinyang.map((v, i) => `<span class="yy ${v === '陽' ? 'yang' : 'yin'}">${all[i].hanja.ch} ${v}</span>`).join(' ')}
      — ${ev.balanced ? '음과 양이 섞여 조화롭습니다.' : '모두 같은 음양으로 치우쳐 있습니다.'}</p>

    <h4>자원오행 · 사주 보완</h4>
    <p class="small">${given.map(g => `${g.hanja.ch} ${elTag(g.hanja.element)}`).join(' ')} — ${esc(ev.jawonNote)}</p>
    ${ev.avoid.length ? `<p class="warn small">⚠ ${ev.avoid.join(', ')}: 전통적으로 이름에 잘 쓰지 않는 불용한자로 분류되기도 합니다.</p>` : ''}
    ${opts.alts && opts.alts.length ? `<h4>같은 이름, 다른 한자 조합</h4><div class="alts">${opts.alts.map(a =>
      `<button type="button" class="alt" data-alt='${esc(JSON.stringify(a.given.map(g => [g.syl, g.hanja.ch])))}'><b>${a.given.map(g => g.hanja.ch).join('')}</b><small>${a.ev.total}점</small></button>`).join('')}</div>` : ''}`;
  }

  // ── 추천 탭 ─────────────────────────────────────────
  let lastResults = [];
  function renderFixedPicker() {
    const box = $('#fixedHanja');
    const syl = state.fixedSyl;
    if (!syl || !E.isHangulSyllable(syl)) { box.innerHTML = ''; return; }
    const list = E.hanjaList(syl).filter(h => h.meaning);
    const pref = (window.NAME_HANJA[syl] || '');
    const rank = c => { const k = pref.indexOf(c); return k < 0 ? 99 : k; };
    list.sort((a, b) => rank(a.ch) - rank(b.ch));
    if (!list.some(h => h.ch === state.fixedHanja)) state.fixedHanja = list[0] ? list[0].ch : '';
    box.innerHTML = list.slice(0, 30).map(h => `<button type="button" class="chip ${h.ch === state.fixedHanja ? 'on' : ''}" data-v="${h.ch}">${h.ch}<small>${esc(h.meaning.split(',')[0])} · ${h.strokes}획</small></button>`).join('');
  }
  function runRecommend() {
    const sur = surnameParts();
    const out = $('#recResults');
    if (!sur) { out.innerHTML = '<p class="warn">성과 성의 한자를 먼저 선택해주세요.</p>'; return; }
    const sj = sajuForCalc();
    const opts = { surname: sur, gender: state.gender, saju: sj, school: state.school, limit: 40, include: state.include || '' };
    if (state.fixedSyl && state.fixedHanja) opts.fixed = { pos: +state.fixedPos, syl: state.fixedSyl, hanja: E.findHanja(state.fixedSyl, state.fixedHanja) };
    lastResults = E.recommend(opts);
    if (!lastResults.length) { out.innerHTML = '<p class="muted">조건에 맞는 이름이 없습니다. 조건을 바꿔보세요.</p>'; return; }
    out.innerHTML = `<p class="small muted">${sur.map(x => x.hanja.ch).join('')}(${esc(state.surname)})씨 아기를 위한 추천 ${lastResults.length}개 · 점수순</p>` +
      lastResults.map((r, i) => {
        const ev = r.best.ev;
        return `<button type="button" class="card" data-i="${i}">
          <div class="cn"><b>${esc(state.surname + r.name)}</b><span class="hj">${sur.map(x => x.hanja.ch).join('')}${r.best.given.map(g => g.hanja.ch).join('')}</span></div>
          <div class="cm">${r.best.given.map(g => `${g.hanja.ch}<small>${esc(g.hanja.meaning.split(',')[0])}</small>`).join(' ')}</div>
          <div class="ct">${ev.four.map(f => `<span class="dot ${LEVEL[f.level][1]}" title="${f.key} ${f.n}수 ${LEVEL[f.level][0]}"></span>`).join('')}
            ${r.best.given.map(g => elTag(g.hanja.element)).join('')}</div>
          <div class="cs g-${ev.grade}">${ev.total}</div></button>`;
      }).join('');
  }

  // ── 풀이 탭 ─────────────────────────────────────────
  function renderAnalyze() {
    const name = state.anaName;
    const pick = $('#anaPick'), out = $('#anaResult');
    const syls = name.split('').filter(E.isHangulSyllable);
    if (!syls.length) { pick.innerHTML = ''; out.innerHTML = '<p class="muted small">이름(한 글자 또는 두 글자)을 한글로 입력하면 글자마다 한자를 고를 수 있어요.</p>'; return; }
    const q = ($('#anaFilter').value || '').trim();
    pick.innerHTML = syls.map((s, i) => {
      let list = E.hanjaList(s);
      const pref = window.NAME_HANJA[s] || '';
      const rank = c => { const k = pref.indexOf(c); return k < 0 ? 99 : k; };
      list.sort((a, b) => (rank(a.ch) - rank(b.ch)) || (!!b.meaning - !!a.meaning));
      if (!list.some(h => h.ch === state.anaHanja[i])) state.anaHanja[i] = list[0] ? list[0].ch : '';
      const shown = q ? list.filter(h => h.meaning.includes(q) || h.ch === q || h.ch === state.anaHanja[i]) : list;
      return `<div class="pickrow"><div class="pickhead">'${esc(s)}' 한자 <small class="muted">${list.length}자</small></div>
        <div class="chips scroll">${shown.map(h => `<button type="button" class="chip ${h.ch === state.anaHanja[i] ? 'on' : ''}" data-i="${i}" data-v="${h.ch}">${h.ch}<small>${esc((h.meaning || '').split(',')[0] || '-')} · ${h.strokes}획 ${h.element}</small></button>`).join('') || '<span class="muted small">검색 결과 없음</span>'}</div></div>`;
    }).join('');
    state.anaHanja.length = syls.length;
    const sur = surnameParts();
    if (!sur) { out.innerHTML = '<p class="warn">성과 성의 한자를 먼저 선택해주세요.</p>'; return; }
    const given = syls.map((s, i) => ({ syl: s, hanja: E.findHanja(s, state.anaHanja[i]) }));
    if (given.some(g => !g.hanja)) { out.innerHTML = '<p class="warn">이 글자에 해당하는 인명용 한자가 없습니다.</p>'; return; }
    const ev = E.evaluate(sur, given, { saju: sajuForCalc(), school: state.school });
    out.innerHTML = analysisHTML(sur, given, ev);
    save();
  }

  // ── 찜 탭 ───────────────────────────────────────────
  function renderFavs() {
    const box = $('#favList');
    $('#favCount').textContent = favorites.length ? favorites.length : '';
    if (!favorites.length) { box.innerHTML = '<p class="muted">마음에 드는 이름에 ♡를 눌러 모아보세요.</p>'; return; }
    const sj = sajuForCalc();
    box.innerHTML = favorites.map((f, i) => {
      const s = f.s.map(([syl, ch]) => ({ syl, hanja: E.findHanja(syl, ch) }));
      const g = f.g.map(([syl, ch]) => ({ syl, hanja: E.findHanja(syl, ch) }));
      if (s.concat(g).some(x => !x.hanja)) return '';
      const ev = E.evaluate(s, g, { saju: sj, school: state.school });
      return `<div class="card fav" data-f="${i}"><div class="cn"><b>${esc(f.ko)}</b><span class="hj">${esc(f.hj)}</span></div>
        <div class="cm">${g.map(x => `${x.hanja.ch}<small>${esc(x.hanja.meaning.split(',')[0])}</small>`).join(' ')}</div>
        <div class="ct">${ev.four.map(x => `<span class="dot ${LEVEL[x.level][1]}"></span>`).join('')}${g.map(x => elTag(x.hanja.element)).join('')}</div>
        <div class="cs g-${ev.grade}">${ev.total}</div>
        <button type="button" class="del" data-del="${i}" aria-label="삭제">✕</button></div>`;
    }).join('');
  }
  function toggleFav(data) {
    const i = favorites.findIndex(f => f.key === data.key);
    if (i >= 0) favorites.splice(i, 1); else favorites.unshift(data);
    store.set('favorites', favorites);
    renderFavs();
  }

  // ── 모달 ────────────────────────────────────────────
  function openModal(html) {
    $('#modalBody').innerHTML = html;
    $('#modal').hidden = false;
    document.body.classList.add('noscroll');
    $('#modalBody').scrollTop = 0;
  }
  function closeModal() { $('#modal').hidden = true; document.body.classList.remove('noscroll'); }
  function showDetail(sur, given, alts) {
    const ev = E.evaluate(sur, given, { saju: sajuForCalc(), school: state.school });
    openModal(analysisHTML(sur, given, ev, { alts }));
  }

  // ── 이벤트 ──────────────────────────────────────────
  function setTab(t) {
    state.tab = t; save();
    $$('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    $$('.panel').forEach(p => p.hidden = p.id !== 'panel-' + t);
    if (t === 'ana') renderAnalyze();
    if (t === 'fav') renderFavs();
  }
  function refreshAll() {
    renderSaju(currentSaju());
    if (state.tab === 'ana') renderAnalyze();
    if (state.tab === 'fav') renderFavs();
    if (state.tab === 'rec' && lastResults.length) runRecommend();
    save();
  }

  function init() {
    if (!window.HANJA_DATA) { document.body.innerHTML = '<p style="padding:24px">한자 데이터를 불러오지 못했습니다.</p>'; return; }
    // 초기값 반영
    $('#surname').value = state.surname;
    $$('input[name=gender]').forEach(r => r.checked = r.value === state.gender);
    const opt = (v, t) => `<option value="${v}">${t}</option>`;
    const fillDays = () => {
      const max = state.lunar ? 30 : (+$('#by').value && +$('#bm').value ? new Date(+$('#by').value, +$('#bm').value, 0).getDate() : 31);
      const cur = $('#bd').value;
      $('#bd').innerHTML = opt('', '일') + Array.from({ length: max }, (_, i) => opt(i + 1, (i + 1) + '일')).join('');
      if (+cur && +cur <= max) $('#bd').value = cur;
    };
    $('#by').innerHTML = opt('', '년') + Array.from({ length: 2050 - 1930 + 1 }, (_, i) => 2050 - i).map(y => opt(y, y + '년')).join('');
    $('#bm').innerHTML = opt('', '월') + Array.from({ length: 12 }, (_, i) => opt(i + 1, (i + 1) + '월')).join('');
    if (state.birth) { const [y, m, d] = state.birth.split('-'); $('#by').value = +y; $('#bm').value = +m; fillDays(); $('#bd').value = +d; } else fillDays();
    const readBirth = () => {
      const y = $('#by').value, m = $('#bm').value, d = $('#bd').value;
      state.birth = y && m && d ? `${y}-${m}-${d}` : '';
      refreshAll();
    };
    ['#by', '#bm'].forEach(id => $(id).addEventListener('change', () => { fillDays(); readBirth(); }));
    $('#bd').addEventListener('change', readBirth);
    $('#time').value = state.time;
    $('#cal').value = state.lunar ? 'lunar' : 'solar'; $('#leap').checked = state.leap; $('#leapWrap').hidden = !state.lunar;
    $('#noTime').checked = state.noTime; $('#time').disabled = state.noTime;
    $('#lmt').checked = state.lmt; $('#school').value = state.school;
    $('#fixedSyl').value = state.fixedSyl; $('#fixedPos').value = String(state.fixedPos);
    $('#include').value = state.include; $('#anaName').value = state.anaName;
    renderSurname(); renderSaju(currentSaju()); renderFixedPicker(); renderFavs();
    setTab(state.tab);

    $('#surname').addEventListener('input', e => { state.surname = e.target.value.trim(); renderSurname(); refreshAll(); });
    $('#surnameHanja').addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; state.surnameHanja = b.dataset.v; renderSurname(); refreshAll(); });
    $$('input[name=gender]').forEach(r => r.addEventListener('change', () => { state.gender = r.value; save(); }));
    $('#cal').addEventListener('change', e => { state.lunar = e.target.value === 'lunar'; $('#leapWrap').hidden = !state.lunar; fillDays(); readBirth(); });
    $('#leap').addEventListener('change', e => { state.leap = e.target.checked; refreshAll(); });
    $('#time').addEventListener('change', e => { state.time = e.target.value; refreshAll(); });
    $('#noTime').addEventListener('change', e => { state.noTime = e.target.checked; $('#time').disabled = state.noTime; refreshAll(); });
    $('#lmt').addEventListener('change', e => { state.lmt = e.target.checked; refreshAll(); });
    $('#school').addEventListener('change', e => { state.school = e.target.value; refreshAll(); });
    $('#fixedSyl').addEventListener('input', e => { state.fixedSyl = e.target.value.trim().slice(0, 1); renderFixedPicker(); save(); });
    $('#fixedPos').addEventListener('change', e => { state.fixedPos = +e.target.value; save(); });
    $('#fixedHanja').addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; state.fixedHanja = b.dataset.v; renderFixedPicker(); save(); });
    $('#include').addEventListener('input', e => { state.include = e.target.value.trim().slice(0, 1); save(); });
    $('#recBtn').addEventListener('click', runRecommend);
    $('#recResults').addEventListener('click', e => {
      const c = e.target.closest('.card'); if (!c) return;
      const r = lastResults[+c.dataset.i];
      showDetail(surnameParts(), r.best.given, r.alts);
    });
    $('#anaName').addEventListener('input', e => { state.anaName = e.target.value.trim().slice(0, 2); state.anaHanja = []; renderAnalyze(); });
    $('#anaFilter').addEventListener('input', renderAnalyze);
    $('#anaPick').addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; state.anaHanja[+b.dataset.i] = b.dataset.v; renderAnalyze(); });
    $('#favList').addEventListener('click', e => {
      const d = e.target.closest('[data-del]');
      if (d) { favorites.splice(+d.dataset.del, 1); store.set('favorites', favorites); renderFavs(); return; }
      const c = e.target.closest('.card'); if (!c) return;
      const f = favorites[+c.dataset.f];
      showDetail(f.s.map(([syl, ch]) => ({ syl, hanja: E.findHanja(syl, ch) })), f.g.map(([syl, ch]) => ({ syl, hanja: E.findHanja(syl, ch) })));
    });
    $$('.tab').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
    document.addEventListener('click', e => {
      const f = e.target.closest('.fav-btn');
      if (f) {
        const data = JSON.parse(f.dataset.fav); toggleFav(data);
        const on = favorites.some(x => x.key === data.key);
        f.classList.toggle('on', on); f.textContent = on ? '♥ 찜한 이름' : '♡ 찜하기';
        return;
      }
      const a = e.target.closest('.alt');
      if (a) {
        const g = JSON.parse(a.dataset.alt).map(([syl, ch]) => ({ syl, hanja: E.findHanja(syl, ch) }));
        const r = lastResults.find(x => x.name === g.map(x => x.syl).join(''));
        const pool = r ? [r.best].concat(r.alts) : [];
        showDetail(surnameParts(), g, pool.filter(p => p.given.map(x => x.hanja.ch).join('') !== g.map(x => x.hanja.ch).join('')));
      }
    });
    $('#modalClose').addEventListener('click', closeModal);
    $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  }
  document.addEventListener('DOMContentLoaded', init);
})();
