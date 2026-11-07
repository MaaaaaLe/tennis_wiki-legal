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
      ch: e[0], meaning: e[1], strokes: e[2], element: e[3], edu: !!e[4], freq: e[5], estimated: e[6] === 1, elSource: ['부수', '발음 추정', '작명 관용'][e[6] || 0], reading
    }));
  }
  function findHanja(reading, ch) { return hanjaList(reading).find(h => h.ch === ch) || null; }

  // ── 81수리 4격 ────────────────────────────────────────
  function suri(n) {
    let k = n;
    while (k > 81) k -= 80; // 81을 넘으면 80을 뺌 (82→2, 161→81)
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
  function jdToDate(jd) { // JD(UT) -> {y,m,d,h} (UTC)
    const ms = (jd - 2440587.5) * 86400000, t = new Date(ms);
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), h: t.getUTCHours() + t.getUTCMinutes() / 60 };
  }

  // ── 한국 표준시 이력 (서머타임·UTC+8:30 시기) ─────────
  // [시작, 끝) 벽시계 기준 'YYYYMMDDHH'
  const KR_DST = [[1948060100, 1948091300], [1949040300, 1949091100], [1950040100, 1950091000], [1951050600, 1951090900],
    [1955050500, 1955090900], [1956052000, 1956093000], [1957050500, 1957092200], [1958050400, 1958092100],
    [1959050300, 1959092000], [1960050100, 1960091800], [1987051002, 1987101103], [1988050802, 1988100903]];
  function utcOffsetHours(y, m, d, h) {
    const key = ((y * 100 + m) * 100 + d) * 100 + Math.floor(h);
    let base = (key >= 1954032100 && key < 1961081000) ? 8.5 : 9;
    const dst = KR_DST.some(([a, b]) => key >= a && key < b);
    return { offset: base + (dst ? 1 : 0), dst, base };
  }

  // ── 음력 → 양력 (삭·중기 천문 계산, 한국 표준시 기준) ─
  function newMoonJDE(k) {
    const r = Math.PI / 180, T = k / 1236.85;
    let jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T * T - 0.00000015 * T * T * T + 0.00000000073 * T ** 4;
    const E = 1 - 0.002516 * T - 0.0000074 * T * T;
    const M = (2.5534 + 29.1053567 * k - 0.0000014 * T * T) * r;
    const Mp = (201.5643 + 385.81693528 * k + 0.0107582 * T * T + 0.00001238 * T ** 3) * r;
    const F = (160.7108 + 390.67050284 * k - 0.0016118 * T * T - 0.00000227 * T ** 3) * r;
    const Om = (124.7746 - 1.56375588 * k + 0.0020672 * T * T) * r;
    const s = Math.sin;
    jde += -0.4072 * s(Mp) + 0.17241 * E * s(M) + 0.01608 * s(2 * Mp) + 0.01039 * s(2 * F) + 0.00739 * E * s(Mp - M)
      - 0.00514 * E * s(Mp + M) + 0.00208 * E * E * s(2 * M) - 0.00111 * s(Mp - 2 * F) - 0.00057 * s(Mp + 2 * F)
      + 0.00056 * E * s(2 * Mp + M) - 0.00042 * s(3 * Mp) + 0.00042 * E * s(M + 2 * F) + 0.00038 * E * s(M - 2 * F)
      - 0.00024 * E * s(2 * Mp - M) - 0.00017 * s(Om) - 0.00007 * s(Mp + 2 * M) + 0.00004 * s(2 * Mp - 2 * F)
      + 0.00004 * s(3 * M) + 0.00003 * s(Mp + M - 2 * F) + 0.00003 * s(2 * Mp + 2 * F) - 0.00003 * s(Mp + M + 2 * F)
      + 0.00003 * s(Mp - M + 2 * F) - 0.00002 * s(Mp - M - 2 * F) - 0.00002 * s(3 * Mp + M) + 0.00002 * s(4 * Mp);
    return jde - 69 / 86400; // ΔT 근사 → UT
  }
  // 한국 날짜(자정 기준)의 일련번호: KST 벽시계 날짜의 JDN
  function kstDayNumber(jdUT) {
    const t = jdToDate(jdUT);
    const off = utcOffsetHours(t.y, t.m, t.d, t.h).base; // 음력 날짜는 표준시 기준
    return Math.floor(jdUT + off / 24 + 0.5);
  }
  function solarTermJD(targetLon, approxJD) { // 태양황경이 targetLon이 되는 시각
    let jd = approxJD;
    for (let i = 0; i < 50; i++) {
      let diff = targetLon - sunLongitude(jd);
      diff = ((diff + 540) % 360) - 180;
      if (Math.abs(diff) < 1e-6) break;
      jd += diff * 365.2422 / 360;
    }
    return jd;
  }
  // 동지(year년 12월)를 포함하는 달부터 다음 동지 달까지의 음력 달 목록
  const lunarCache = {};
  function lunarCycle(sy) {
    if (lunarCache[sy]) return lunarCache[sy];
    const ws1 = solarTermJD(270, jdFromUTC(sy, 12, 21, 0)), ws2 = solarTermJD(270, jdFromUTC(sy + 1, 12, 21, 0));
    const d1 = kstDayNumber(ws1), d2 = kstDayNumber(ws2);
    let k = Math.floor((sy + 11.5 / 12 - 2000) * 12.3685) - 2;
    const starts = [];
    while (true) {
      const day = kstDayNumber(newMoonJDE(k));
      if (day > d2) break;
      starts.push(day); k++;
    }
    // 동지가 든 달의 시작: 동지 날 이하인 마지막 삭
    const i1 = starts.filter(x => x <= d1).length - 1, i2 = starts.filter(x => x <= d2).length - 1;
    const months = starts.slice(i1, i2 + 1).map(s => ({ start: s }));
    // 각 달의 끝(다음 삭 전날)과 중기 포함 여부
    const allStarts = starts.slice(i1, i2 + 2);
    let next = allStarts[allStarts.length - 1];
    if (allStarts.length < months.length + 1) next = kstDayNumber(newMoonJDE(k));
    months.forEach((mo, i) => {
      const end = (i + 1 < allStarts.length ? allStarts[i + 1] : next);
      mo.end = end;
      mo.hasZhongqi = false;
      for (let lon = 0; lon < 360; lon += 30) {
        const jdApprox = jdFromUTC(sy, 12, 21, 0) + ((lon - 270 + 360) % 360) * 365.2422 / 360;
        const day = kstDayNumber(solarTermJD(lon, jdApprox));
        if (day >= mo.start && day < end) { mo.hasZhongqi = true; break; }
      }
    });
    const leapNeeded = months.length === 14; // 동지달~다음 동지달 포함 13개월 + 1
    let num = 11, ly = sy, leapUsed = false;
    months.forEach((mo, i) => {
      if (i > 0 && leapNeeded && !leapUsed && !mo.hasZhongqi) { mo.leap = true; leapUsed = true; mo.month = num; mo.year = ly; return; }
      if (i > 0) { num++; if (num > 12) { num = 1; ly++; } }
      mo.month = num; mo.year = ly; mo.leap = false;
    });
    lunarCache[sy] = months;
    return months;
  }
  // 음력(y,m,d,윤달) → 양력 {y,m,d}
  function lunarToSolar(y, m, d, leap) {
    for (const sy of [y - 1, y]) {
      const mo = lunarCycle(sy).find(x => x.year === y && x.month === m && !!x.leap === !!leap);
      if (mo) {
        if (d < 1 || d > mo.end - mo.start) return null;
        const t = jdToDate(mo.start + d - 1 - 0.5 + 0.5 / 24);
        return { y: t.y, m: t.m, d: t.d };
      }
    }
    return null;
  }
  function solarToLunar(y, m, d) {
    const day = jdn(y, m, d);
    for (const sy of [y - 1, y]) {
      const mo = lunarCycle(sy).find(x => day >= x.start && day < x.end);
      if (mo) return { y: mo.year, m: mo.month, d: day - mo.start + 1, leap: !!mo.leap };
    }
    return null;
  }

  // ── 사주 ──────────────────────────────────────────────
  // birth: {y, m, d, hour?, minute?} (한국 벽시계 시각). opts.lmt: 서울 진태양시(UTC+8:28) 기준
  function saju(birth, opts) {
    opts = opts || {};
    const hasTime = birth.hour !== undefined && birth.hour !== null && birth.hour !== '';
    const hh = hasTime ? +birth.hour : 12, mi = hasTime ? +(birth.minute || 0) : 0;
    const tz = utcOffsetHours(birth.y, birth.m, birth.d, hh);
    const utcMs = Date.UTC(birth.y, birth.m - 1, birth.d, hh, mi) - tz.offset * 3600000;
    const jdUT = utcMs / 86400000 + 2440587.5;
    // 년주·월주: 절기(태양황경)로 판단
    const lon = sunLongitude(jdUT);
    let year = birth.y;
    if (birth.m === 1 || (birth.m === 2 && lon >= 270 && lon < 315)) year -= 1; // 입춘 전
    const ys = ((year - 4) % 10 + 10) % 10, yb = ((year - 4) % 12 + 12) % 12;
    const mIdx = Math.floor((((lon - 315) % 360) + 360) % 360 / 30); // 0 = 寅월
    const ms = (ys * 2 + 2 + mIdx) % 10, mb = (2 + mIdx) % 12;

    // 일주·시주: 현지 시각 (진태양시 보정 시 UTC+8:28, 아니면 UTC+9)
    const local = new Date(utcMs + (opts.lmt ? 8 * 60 + 28 : 9 * 60) * 60000);
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
    const res = { pillars, count, lacking, excess, hasTime, dayMaster: STEMS[ds], dayMasterEl: STEM_EL[ds], dst: tz.dst, utcOffset: tz.offset };
    res.yong = yongsin(res);
    return res;
  }

  // ── 용신 (억부법 + 조후 보정, 간이 판단) ──────────────
  const PARENT = { '木': '水', '火': '木', '土': '火', '金': '土', '水': '金' }; // 나를 생하는 오행
  function yongsin(sj) {
    const me = sj.dayMasterEl;
    const w = { '木': 0, '火': 0, '土': 0, '金': 0, '水': 0 };
    sj.pillars.forEach((p, i) => {
      if (i !== 2) w[p.stemEl] += 1;           // 일간 자신은 제외
      w[p.branchEl] += (i === 1 ? 2 : 1);       // 월지(월령) 가중치 2
    });
    const total = ELEMENTS.reduce((a, e) => a + w[e], 0);
    const bi = w[me], in_ = w[PARENT[me]];
    const sik = w[GEN[me]], jae = w[CTRL[me]], gwan = w[CTRL_BY(me)];
    const support = bi + in_;
    const strong = support >= total / 2;
    let yong, reason;
    if (!strong) {
      if (jae >= Math.max(sik, gwan) && jae >= 3) { yong = me; reason = '재성이 많아 약해진 일간을 같은 기운(비겁)으로 돕습니다'; }
      else { yong = PARENT[me]; reason = '약한 일간을 생해 주는 기운(인성)으로 돕습니다'; }
    } else {
      if (in_ >= bi && in_ >= 3) { yong = CTRL[me]; reason = '인성이 많아 지나치게 강하므로 재성으로 조절합니다'; }
      else if (sik >= 3) { yong = CTRL_BY(me); reason = '강한 일간을 관성으로 다스립니다'; }
      else { yong = GEN[me]; reason = '강한 일간의 기운을 식상으로 풀어 줍니다'; }
    }
    const hui = [PARENT[yong]];
    const gi = CTRL_BY(yong);
    // 조후: 여름생 수(水) 없음, 겨울생 화(火) 없음
    const mb = sj.pillars[1].b;
    let johu = null;
    if ([5, 6, 7].includes(mb) && sj.count['水'] === 0) johu = '水';
    if ([11, 0, 1].includes(mb) && sj.count['火'] === 0) johu = '火';
    if (johu && johu !== yong && !hui.includes(johu) && johu !== gi) hui.push(johu);
    return { strong, support, total, yong, hui: hui.filter(e => e !== gi), gi, reason, johu };
  }
  function CTRL_BY(e) { return ELEMENTS.find(x => CTRL[x] === e); } // e를 극하는 오행

  // ── 이름 평가 ─────────────────────────────────────────
  // surname: [{syl, hanja}], given: [{syl, hanja}]  (hanja = hanjaList 원소)
  function evaluate(surname, given, opts) {
    opts = opts || {};
    const all = surname.concat(given);
    const four = fourPillars(surname.map(x => x.hanja.strokes), given.map(x => x.hanja.strokes));
    // 수리 4격: 길 9, 반길 4, 흉 0 → /36
    const suriScore = four.reduce((a, f) => a + (f.level === 2 ? 9 : f.level === 1 ? 4 : 0), 0);

    // 수리오행: 각 격 수의 끝자리 (1·2 木, 3·4 火, 5·6 土, 7·8 金, 9·0 水) 흐름 원→형→이→정
    four.forEach(f => { f.element = suriElement(f.n); });
    const relPt = { gen: 10, same: 6, ctrl: 0 };
    const suriElPairs = [];
    for (let i = 0; i < 3; i++) suriElPairs.push({ a: four[i].key, b: four[i + 1].key, ea: four[i].element, eb: four[i + 1].element, rel: relation(four[i].element, four[i + 1].element) });
    const suriElScore = Math.round(suriElPairs.reduce((a, p) => a + relPt[p.rel], 0) / 3); // /10

    // 발음오행 (연속 음절 간 관계) → /20
    const sounds = all.map(x => soundElement(x.syl, opts.school));
    const soundPairs = [];
    for (let i = surname.length - 1; i < all.length - 1; i++) {
      soundPairs.push({ a: all[i].syl, b: all[i + 1].syl, ea: sounds[i], eb: sounds[i + 1], rel: relation(sounds[i], sounds[i + 1]) });
    }
    const soundScore = Math.round(soundPairs.reduce((a, p) => a + relPt[p.rel], 0) / soundPairs.length * 2);

    // 획수 음양 (홀수 陽, 짝수 陰) → /8
    const yy = all.map(x => (x.hanja.strokes % 2 ? '陽' : '陰'));
    const balanced = yy.some(v => v === '陽') && yy.some(v => v === '陰');
    const yyScore = balanced ? 8 : 0;

    // 자원오행 → /20
    const jawon = given.map(x => x.hanja.element);
    let jawonScore, jawonNote;
    const lab = e => e + '(' + EL_KO[e] + ')';
    if (opts.saju && opts.saju.yong) {
      const Y = opts.saju.yong;
      const pt = e => e === Y.yong ? 10 : Y.hui.includes(e) ? 8 : e === Y.gi ? 0 : 4;
      jawonScore = Math.round(jawon.reduce((a, e) => a + pt(e), 0) / jawon.length * 2);
      const yc = jawon.filter(e => e === Y.yong).length, hc = jawon.filter(e => Y.hui.includes(e)).length, gc = jawon.filter(e => e === Y.gi).length;
      const parts = [];
      if (yc) parts.push(`용신 ${lab(Y.yong)} ${yc}글자`);
      if (hc) parts.push(`희신 ${Y.hui.map(lab).join('·')} ${hc}글자`);
      jawonNote = parts.length ? parts.join(', ') + '가 사주를 보완합니다.' : `용신 ${lab(Y.yong)}·희신 ${Y.hui.map(lab).join('·')}에 해당하는 글자가 없습니다.`;
      if (gc) jawonNote += ` 기신 ${lab(Y.gi)}에 해당하는 글자가 ${gc}개 있습니다.`;
    } else {
      const seq = [surname[surname.length - 1].hanja.element].concat(jawon);
      let s = 0;
      for (let i = 0; i < seq.length - 1; i++) s += relPt[relation(seq[i], seq[i + 1])];
      jawonScore = Math.round(s / (seq.length - 1) * 2);
      jawonNote = '생년월일을 입력하면 사주의 용신을 기준으로 평가합니다. (현재: 성과 이름 글자 간 상생 흐름 기준)';
    }

    // 글자 적합도 (불용한자, 이름 다빈도 한자) → /6
    const avoid = given.filter(x => (W.AVOID_HANJA || '').includes(x.hanja.ch)).map(x => x.hanja.ch);
    const common = given.filter(x => ((W.NAME_HANJA || {})[x.syl] || '').includes(x.hanja.ch)).length;
    const charScore = Math.max(0, Math.min(6, 2 + common * 2 - avoid.length * 3 + (given.every(x => x.hanja.meaning) ? 0 : -2)));

    const total = suriScore + suriElScore + soundScore + yyScore + jawonScore + charScore;
    return {
      total, four, suriScore, suriElPairs, suriElScore, soundPairs, soundScore, yinyang: yy, balanced, yyScore,
      jawon, jawonScore, jawonNote, avoid, charScore,
      grade: total >= 90 ? '최상' : total >= 80 ? '상' : total >= 68 ? '중상' : total >= 55 ? '중' : '하'
    };
  }
  function suriElement(n) { return ['水', '木', '木', '火', '火', '土', '土', '金', '金', '水'][n % 10]; }

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
    lunarToSolar, solarToLunar, yongsin, utcOffsetHours, suriElement,
    STEMS, BRANCHES };
  root.NameEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
