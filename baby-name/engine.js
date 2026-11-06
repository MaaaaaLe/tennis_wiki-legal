// 이름결 — 성명학 계산 엔진 (브라우저/Node 공용)
(function (root) {
  'use strict';
  const W = root;
  const ELEMENTS = ['木', '火', '土', '金', '水'];
  const EL_KO = { '木': '목', '火': '화', '土': '토', '金': '금', '水': '수' };
  const GEN = { '木': '火', '火': '土', '土': '金', '金': '水', '水': '木' };   // 상생
  const CTRL = { '木': '土', '土': '水', '水': '火', '火': '金', '金': '木' };  // 상극

  // ── 한글 ──────────────────────────────────────────────
  const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  function cho(s) { const c = s.charCodeAt(0) - 0xac00; return c >= 0 && c < 11172 ? CHO[Math.floor(c / 588)] : null; }
  function isHangulSyllable(s) { const c = s.charCodeAt(0); return c >= 0xac00 && c <= 0xd7a3; }

  // 발음오행 학설: standard(현대 통용: ㅇㅎ土, ㅁㅂㅍ水) / haerye(훈민정음 해례본: ㅇㅎ水, ㅁㅂㅍ土)
  const SOUND_STD = { 'ㄱ': '木', 'ㄲ': '木', 'ㅋ': '木', 'ㄴ': '火', 'ㄷ': '火', 'ㄸ': '火', 'ㄹ': '火', 'ㅌ': '火',
    'ㅇ': '土', 'ㅎ': '土', 'ㅅ': '金', 'ㅆ': '金', 'ㅈ': '金', 'ㅉ': '金', 'ㅊ': '金', 'ㅁ': '水', 'ㅂ': '水', 'ㅃ': '水', 'ㅍ': '水' };
  const SOUND_HAERYE = Object.assign({}, SOUND_STD, { 'ㅇ': '水', 'ㅎ': '水', 'ㅁ': '土', 'ㅂ': '土', 'ㅃ': '土', 'ㅍ': '土' });
  function soundElement(syl, school) { return (school === 'haerye' ? SOUND_HAERYE : SOUND_STD)[cho(syl)] || '土'; }

  function relation(a, b) {
    if (a === b) return 'same';
    if (GEN[a] === b || GEN[b] === a) return 'gen';
    return 'ctrl';
  }
  const REL_KO = { gen: '상생', same: '상비', ctrl: '상극' };

  // ── 한자 조회 ─────────────────────────────────────────
  // 데이터 형식: [한자, 뜻, 원획, 자원오행, 교육용, 상용도, 오행추정]
  function hanjaList(reading) {
    return ((W.HANJA_DATA || {})[reading] || []).map(e => ({
      ch: e[0], meaning: e[1], strokes: e[2], element: e[3], edu: !!e[4], freq: e[5], estimated: !!e[6], reading
    }));
  }
  function findHanja(reading, ch) { return hanjaList(reading).find(h => h.ch === ch) || null; }

  // ── 81수리 4격 ────────────────────────────────────────
  function suri(n) {
    const k = n > 81 ? ((n - 1) % 80) + 1 : n;
    const s = W.SURI81[k];
    return { n, k, name: s[0], level: s[1], desc: s[2] };
  }
  // surname, given: 획수 배열
  function fourPillars(surname, given) {
    const S = surname.reduce((a, b) => a + b, 0);
    const g1 = given[0], g2 = given.length > 1 ? given[1] : 0;
    const won = given.length > 1 ? g1 + g2 : g1;
    const hyung = S + g1;
    const i = given.length > 1 ? S + g2 : S;
    const jung = S + g1 + g2;
    return [
      Object.assign(suri(won), { key: '원격', period: '초년운 (~20세)', formula: '이름 획수의 합' }),
      Object.assign(suri(hyung), { key: '형격', period: '청년운 (20~40세)', formula: '성 + 이름 첫 글자' }),
      Object.assign(suri(i), { key: '이격', period: '중년운 (40~60세)', formula: given.length > 1 ? '성 + 이름 끝 글자' : '성의 획수' }),
      Object.assign(suri(jung), { key: '정격', period: '말년운·총운 (60세~)', formula: '성과 이름 전체 획수' })
    ];
  }

  // ── 사주 (양력, 한국 표준시 입력) ─────────────────────
  const STEMS = '甲乙丙丁戊己庚辛壬癸', STEMS_KO = '갑을병정무기경신임계';
  const BRANCHES = '子丑寅卯辰巳午未申酉戌亥', BRANCHES_KO = '자축인묘진사오미신유술해';
  const STEM_EL = '木木火火土土金金水水';
  const BRANCH_EL = '水土木木土火火土金金土水';

  function jdFromUTC(y, m, d, h) {
    if (m <= 2) { y -= 1; m += 12; }
    const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + h / 24 + B - 1524.5;
  }
  function sunLongitude(jd) {
    const T = (jd - 2451545.0) / 36525, r = Math.PI / 180;
    const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
    const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
    const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M * r) +
      (0.019993 - 0.000101 * T) * Math.sin(2 * M * r) + 0.000289 * Math.sin(3 * M * r);
    const om = 125.04 - 1934.136 * T;
    let lon = L0 + C - 0.00569 - 0.00478 * Math.sin(om * r);
    lon %= 360; if (lon < 0) lon += 360;
    return lon;
  }
  function jdn(y, m, d) { return Math.floor(jdFromUTC(y, m, d, 12) + 0.5); }

  // birth: {y, m, d, hour?, minute?} (KST). opts.lmt: 서울 진태양시 보정(-32분)
  function saju(birth, opts) {
    opts = opts || {};
    const hasTime = birth.hour !== undefined && birth.hour !== null && birth.hour !== '';
    const hh = hasTime ? +birth.hour : 12, mi = hasTime ? +(birth.minute || 0) : 0;
    // 절기 판단은 실제 시각(UTC)으로
    const utcH = hh + mi / 60 - 9;
    const lon = sunLongitude(jdFromUTC(birth.y, birth.m, birth.d, utcH));
    let year = birth.y;
    if (birth.m <= 2 && lon >= 270 && lon < 315) year -= 1; // 입춘 전
    if (birth.m === 1) year = birth.y - 1;
    const ys = ((year - 4) % 10 + 10) % 10, yb = ((year - 4) % 12 + 12) % 12;
    const mIdx = Math.floor((((lon - 315) % 360) + 360) % 360 / 30); // 0 = 寅월
    const ms = (ys * 2 + 2 + mIdx) % 10, mb = (2 + mIdx) % 12;

    // 일주·시주는 현지 시각 기준
    let local = new Date(Date.UTC(birth.y, birth.m - 1, birth.d, hh, mi));
    if (hasTime && opts.lmt) local = new Date(local.getTime() - 32 * 60000);
    let dy = local.getUTCFullYear(), dm = local.getUTCMonth() + 1, dd = local.getUTCDate();
    const lh = local.getUTCHours();
    if (hasTime && lh >= 23) { const n = new Date(Date.UTC(dy, dm - 1, dd + 1)); dy = n.getUTCFullYear(); dm = n.getUTCMonth() + 1; dd = n.getUTCDate(); }
    const di = ((jdn(dy, dm, dd) + 49) % 60 + 60) % 60;
    const ds = di % 10, db = di % 12;
    const pillars = [
      { label: '년주', s: ys, b: yb }, { label: '월주', s: ms, b: mb }, { label: '일주', s: ds, b: db }
    ];
    if (hasTime) {
      const hb = Math.floor((lh + 1) / 2) % 12;
      const hs = (ds * 2 + hb) % 10;
      pillars.push({ label: '시주', s: hs, b: hb });
    }
    const count = { '木': 0, '火': 0, '土': 0, '金': 0, '水': 0 };
    pillars.forEach(p => {
      p.stem = STEMS[p.s]; p.branch = BRANCHES[p.b];
      p.ko = STEMS_KO[p.s] + BRANCHES_KO[p.b];
      p.stemEl = STEM_EL[p.s]; p.branchEl = BRANCH_EL[p.b];
      count[p.stemEl]++; count[p.branchEl]++;
    });
    const min = Math.min.apply(null, ELEMENTS.map(e => count[e]));
    const lacking = ELEMENTS.filter(e => count[e] === min);
    const excess = ELEMENTS.filter(e => count[e] >= 3);
    return { pillars, count, lacking, excess, hasTime, dayMaster: STEMS[ds], dayMasterEl: STEM_EL[ds] };
  }

  // ── 이름 평가 ─────────────────────────────────────────
  // surname: [{syl, hanja}], given: [{syl, hanja}]  (hanja = hanjaList 원소)
  function evaluate(surname, given, opts) {
    opts = opts || {};
    const all = surname.concat(given);
    const four = fourPillars(surname.map(x => x.hanja.strokes), given.map(x => x.hanja.strokes));
    const suriScore = four.reduce((a, f) => a + (f.level === 2 ? 10 : f.level === 1 ? 5 : 0), 0); // /40

    // 발음오행 (연속 음절 간 관계)
    const sounds = all.map(x => soundElement(x.syl, opts.school));
    const soundPairs = [];
    for (let i = surname.length - 1; i < all.length - 1; i++) {
      soundPairs.push({ a: all[i].syl, b: all[i + 1].syl, ea: sounds[i], eb: sounds[i + 1], rel: relation(sounds[i], sounds[i + 1]) });
    }
    const relPt = { gen: 10, same: 6, ctrl: 0 };
    const soundScore = Math.round(soundPairs.reduce((a, p) => a + relPt[p.rel], 0) / soundPairs.length * 2); // /20

    // 획수 음양 (홀수 陽, 짝수 陰)
    const yy = all.map(x => (x.hanja.strokes % 2 ? '陽' : '陰'));
    const balanced = yy.some(v => v === '陽') && yy.some(v => v === '陰');
    const yyScore = balanced ? 10 : 0; // /10

    // 자원오행
    const jawon = given.map(x => x.hanja.element);
    let jawonScore, jawonNote;
    if (opts.saju) {
      const L = opts.saju.lacking, X = opts.saju.excess;
      const hits = jawon.filter(e => L.includes(e)).length;
      const over = jawon.filter(e => X.includes(e)).length;
      jawonScore = Math.max(0, Math.min(20, Math.round(hits / jawon.length * 16) + (new Set(jawon).size > 1 || jawon.length === 1 ? 4 : 2) - over * 4));
      jawonNote = hits ? `사주에 부족한 ${L.map(e => e + '(' + EL_KO[e] + ')').join('·')} 기운을 ${hits}글자가 보완합니다.`
        : `사주에 부족한 ${L.map(e => e + '(' + EL_KO[e] + ')').join('·')} 기운을 보완하는 글자가 없습니다.`;
      if (over) jawonNote += ` 이미 많은 ${X.join('·')} 기운을 더하는 글자가 ${over}개 있습니다.`;
    } else {
      const seq = [surname[surname.length - 1].hanja.element].concat(jawon);
      let s = 0;
      for (let i = 0; i < seq.length - 1; i++) s += relPt[relation(seq[i], seq[i + 1])];
      jawonScore = Math.round(s / (seq.length - 1) * 2);
      jawonNote = '생년월일을 입력하면 사주에 부족한 오행을 기준으로 평가합니다. (현재: 글자 간 상생 흐름 기준)';
    }

    // 글자 적합도 (불용한자, 상용도)
    const avoid = given.filter(x => (W.AVOID_HANJA || '').includes(x.hanja.ch)).map(x => x.hanja.ch);
    const common = given.filter(x => ((W.NAME_HANJA || {})[x.syl] || '').includes(x.hanja.ch)).length;
    const charScore = Math.max(0, Math.min(10, 4 + common * 3 - avoid.length * 4 + (given.every(x => x.hanja.meaning) ? 0 : -3)));

    const total = suriScore + soundScore + yyScore + jawonScore + charScore;
    return {
      total, four, suriScore, soundPairs, soundScore, yinyang: yy, balanced, yyScore,
      jawon, jawonScore, jawonNote, avoid, charScore,
      grade: total >= 90 ? '최상' : total >= 80 ? '상' : total >= 68 ? '중상' : total >= 55 ? '중' : '하'
    };
  }

  // ── 추천 ──────────────────────────────────────────────
  // 이름에 쓰기 어색한 뜻(부정적 의미)을 걸러내는 키워드
  const NEG = /더러|죽|병들|슬플|슬퍼|근심|울 |울$|망할|잃|벗을|부르짖|거짓|미칠|독|해칠|악할|가난|천할|도둑|싸울|괴로|아플|원망|무덤|시체|눈물|어두|어리석|게으|미워|버릴|흉|재앙|성낼|두려|썩|늙|쇠할|낮을|종 |형벌|벨|칠 |죄|뱀|쥐|모자랄|허물|부끄|탐할|술|아래|작을|그칠|끊|막을|빌|원수|짐승|오랑캐|속일|간사|음란|떨어질|추할|수고|잠잘|어지러|노예|벌레|굶|가둘|빠질|지옥|귀신|마귀|탄식|한탄|외로|홀로|딸|계집|사내|어찌|아닐|없을|말 |갈 /;
  function goodMeaning(h) { return h.meaning && !NEG.test(h.meaning); }
  function candidatesFor(syl, limit) {
    const list = hanjaList(syl).filter(h => h.meaning);
    const pref = (W.NAME_HANJA || {})[syl] || '';
    const avoid = W.AVOID_HANJA || '';
    const preferred = pref.split('').map(c => list.find(h => h.ch === c)).filter(Boolean);
    const fill = preferred.length >= 4 ? 1 : 4 - preferred.length;
    const others = list.filter(h => !pref.includes(h.ch) && h.edu && !avoid.includes(h.ch) && goodMeaning(h));
    return preferred.concat(others.slice(0, fill)).slice(0, limit);
  }

  // opts: {surname:[{syl,hanja}], gender:'M'|'F'|'A', saju, school, fixed:{pos:0|1, syl, hanja}, include, limit}
  function recommend(opts) {
    const gender = opts.gender || 'A';
    const pools = gender === 'A' ? ['M', 'F'] : [gender];
    let names = [];
    if (opts.fixed) {
      pools.forEach(g => {
        const other = opts.fixed.pos === 0 ? W.SYLLABLES[g].last : W.SYLLABLES[g].first;
        other.forEach(s => names.push(opts.fixed.pos === 0 ? opts.fixed.syl + s : s + opts.fixed.syl));
      });
      // 인기 이름 중 돌림자 위치가 맞는 것도 포함
      pools.forEach(g => W.POPULAR_NAMES[g].forEach(n => { if (n[opts.fixed.pos] === opts.fixed.syl) names.push(n); }));
    } else {
      pools.forEach(g => names = names.concat(W.POPULAR_NAMES[g]));
    }
    names = Array.from(new Set(names)).filter(n => n.length === 2 && n[0] !== n[1]);
    if (opts.include) names = names.filter(n => n.includes(opts.include));
    const popRank = {};
    pools.forEach(g => W.POPULAR_NAMES[g].forEach((n, i) => { if (popRank[n] === undefined || popRank[n] > i) popRank[n] = i; }));

    const results = [];
    names.forEach(n => {
      const syls = n.split('');
      const c0 = opts.fixed && opts.fixed.pos === 0 ? [opts.fixed.hanja] : candidatesFor(syls[0], 10);
      const c1 = opts.fixed && opts.fixed.pos === 1 ? [opts.fixed.hanja] : candidatesFor(syls[1], 10);
      if (!c0.length || !c1.length) return;
      const combos = [];
      c0.forEach(h0 => c1.forEach(h1 => {
        if (h0.ch === h1.ch) return;
        const given = [{ syl: syls[0], hanja: h0 }, { syl: syls[1], hanja: h1 }];
        const ev = evaluate(opts.surname, given, opts);
        combos.push({ given, ev });
      }));
      if (!combos.length) return;
      combos.sort((a, b) => b.ev.total - a.ev.total);
      const pop = popRank[n] !== undefined ? popRank[n] : 999;
      results.push({ name: n, best: combos[0], alts: combos.slice(1, 6), pop });
    });
    results.sort((a, b) => (b.best.ev.total - a.best.ev.total) || (a.pop - b.pop));
    return results.slice(0, opts.limit || 40);
  }

  const api = { ELEMENTS, EL_KO, REL_KO, relation, soundElement, cho, isHangulSyllable, hanjaList, findHanja,
    suri, fourPillars, saju, evaluate, recommend, candidatesFor, sunLongitude, jdFromUTC,
    STEMS, BRANCHES };
  root.NameEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
