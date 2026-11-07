#!/usr/bin/env node
// 이름결 정합성 검증 스크립트.  사용법: node baby-name/tools/verify.js
'use strict';
const path = require('path');
const base = path.join(__dirname, '..');
globalThis.window = globalThis;
require(path.join(base, 'hanja-data.js'));
require(path.join(base, 'names-data.js'));
const E = require(path.join(base, 'engine.js'));
const H = window.HANJA_DATA;

let fails = 0, checks = 0;
function check(name, ok, detail) {
  checks++;
  if (!ok) { fails++; console.log('  ✗ ' + name + (detail ? ' — ' + detail : '')); }
}
function section(t) { console.log('\n■ ' + t); }
const fmt = d => d && `${d.y}-${d.m}-${d.d}`;

// 1. 한자 데이터 구조
section('한자 데이터');
let total = 0;
for (const [rd, list] of Object.entries(H)) {
  const seen = new Set();
  for (const e of list) {
    total++;
    check(`형식 ${rd}${e[0]}`, e.length === 7 && typeof e[2] === 'number');
    check(`획수 범위 ${e[0]}`, e[2] >= 1 && e[2] <= 40, String(e[2]));
    check(`오행 값 ${e[0]}`, '木火土金水'.includes(e[3]) && e[3].length === 1, e[3]);
    check(`중복 ${rd}${e[0]}`, !seen.has(e[0]));
    seen.add(e[0]);
  }
}
console.log(`  독음 ${Object.keys(H).length}개, 항목 ${total}개`);
// 같은 한자는 독음이 달라도 획수·오행이 같아야 함
const byChar = {};
for (const list of Object.values(H)) for (const e of list) (byChar[e[0]] = byChar[e[0]] || []).push(e);
for (const [ch, es] of Object.entries(byChar)) {
  check(`독음 간 획수 일치 ${ch}`, es.every(e => e[2] === es[0][2]), es.map(e => e[2]).join('/'));
}

// 2. 원획 기준표 (작명서 통용값)
section('원획 기준표');
const REF = {
  金: ['김', 8], 李: ['이', 7], 朴: ['박', 6], 崔: ['최', 11], 鄭: ['정', 19], 姜: ['강', 9], 趙: ['조', 14], 尹: ['윤', 4],
  張: ['장', 11], 林: ['임', 8], 韓: ['한', 17], 吳: ['오', 7], 徐: ['서', 10], 申: ['신', 5], 權: ['권', 22], 黃: ['황', 12],
  安: ['안', 6], 宋: ['송', 7], 柳: ['유', 9], 洪: ['홍', 10], 高: ['고', 10], 文: ['문', 4], 孫: ['손', 10], 裵: ['배', 14],
  白: ['백', 5], 許: ['허', 11], 南: ['남', 9], 沈: ['심', 8], 盧: ['노', 16], 河: ['하', 9], 郭: ['곽', 15], 成: ['성', 7],
  車: ['차', 7], 閔: ['민', 12], 羅: ['나', 20], 陳: ['진', 16], 池: ['지', 7], 瑞: ['서', 14], 俊: ['준', 9], 潤: ['윤', 16],
  珉: ['민', 10], 敏: ['민', 11], 賢: ['현', 15], 浩: ['호', 11], 恩: ['은', 10], 娜: ['나', 10], 演: ['연', 15], 秀: ['수', 7],
  英: ['영', 11], 道: ['도', 16], 珍: ['진', 10], 福: ['복', 14], 性: ['성', 9], 拓: ['척', 9], 胡: ['호', 11], 海: ['해', 11],
  花: ['화', 10], 志: ['지', 7], 智: ['지', 12], 宇: ['우', 6], 祐: ['우', 10], 旻: ['민', 8], 玟: ['민', 9], 炫: ['현', 9],
  泰: ['태', 10], 昊: ['호', 8], 錫: ['석', 16], 燦: ['찬', 17], 範: ['범', 15], 恕: ['서', 10], 四: ['사', 4], 五: ['오', 5],
  七: ['칠', 7], 九: ['구', 9], 十: ['십', 10], 誠: ['성', 14], 盛: ['성', 12], 城: ['성', 10], 晟: ['성', 11], 承: ['승', 8],
  泳: ['영', 9], 永: ['영', 5], 求: ['구', 7], 康: ['강', 11], 慕: ['모', 15], 恭: ['공', 10], 添: ['첨', 12]
};
let refOk = 0;
for (const [c, [r, n]] of Object.entries(REF)) {
  const h = E.findHanja(r, c);
  const ok = h && h.strokes === n;
  if (ok) refOk++;
  check(`원획 ${c}`, ok, `기대 ${n}, 실제 ${h ? h.strokes : '없음'}`);
}
console.log(`  ${refOk}/${Object.keys(REF).length} 일치`);

// 3. 참고 데이터
section('성씨·추천용 데이터');
for (const [r, cs] of Object.entries(window.SURNAMES)) {
  if (r.length === 1) for (const c of cs) check(`성씨 ${r}${c}`, !!E.findHanja(r, c));
  else [...r].forEach((s, i) => check(`복성 ${r}`, cs.length === r.length && !!E.findHanja(s, cs[i])));
}
for (const [r, cs] of Object.entries(window.NAME_HANJA)) for (const c of cs) check(`이름 한자 ${r}${c}`, !!E.findHanja(r, c));
for (const g of ['M', 'F']) {
  for (const n of window.POPULAR_NAMES[g]) check(`인기 이름 형식 ${n}`, n.length === 2 && [...n].every(E.isHangulSyllable));
  for (const s of window.SYLLABLES[g].first.concat(window.SYLLABLES[g].last)) check(`음절 한자 존재 ${s}`, E.candidatesFor(s, 10).length > 0);
}

// 4. 81수리 표
section('81수리');
check('81수리 개수', window.SURI81.length === 82);
const GOOD = [1, 3, 5, 6, 7, 8, 11, 13, 15, 16, 17, 18, 21, 23, 24, 25, 29, 31, 32, 33, 35, 37, 38, 39, 41, 45, 47, 48, 52, 57, 61, 63, 65, 67, 68, 81];
const BAD = [2, 4, 9, 10, 12, 14, 19, 20, 22, 27, 28, 34, 40, 42, 43, 44, 46, 50, 53, 54, 56, 59, 60, 62, 64, 66, 69, 70, 72, 74, 76, 79, 80];
GOOD.forEach(n => check(`길수 ${n}`, window.SURI81[n][1] === 2, window.SURI81[n][0]));
BAD.forEach(n => check(`흉수 ${n}`, window.SURI81[n][1] === 0, window.SURI81[n][0]));
check('82수 → 2수', E.suri(82).k === 2);
check('161수 → 81수', E.suri(161).k === 81);

// 5. 4격 공식
section('4격 공식');
const f2 = E.fourPillars([8], [14, 9]); // 金瑞俊
check('두 글자 이름', f2.map(f => f.n).join() === '23,22,17,31', f2.map(f => f.n).join());
const f1 = E.fourPillars([8], [14]); // 외자
check('외자 이름', f1.map(f => f.n).join() === '14,22,8,22', f1.map(f => f.n).join());
const fb = E.fourPillars([9, 12], [14, 9]); // 복성 南宮
check('복성', fb.map(f => f.n).join() === '23,35,30,44', fb.map(f => f.n).join());
check('수리오행 끝자리', ['水', '木', '木', '火', '火', '土', '土', '金', '金', '水'].every((e, i) => E.suriElement(i) === e));

// 6. 발음오행
section('발음오행');
const SND = { 가: '木', 카: '木', 나: '火', 다: '火', 라: '火', 타: '火', 아: '土', 하: '土', 사: '金', 자: '金', 차: '金', 마: '水', 바: '水', 파: '水' };
for (const [s, e] of Object.entries(SND)) check(`통용 ${s}`, E.soundElement(s, 'standard') === e);
check('해례본 ㅇ=水', E.soundElement('아', 'haerye') === '水');
check('해례본 ㅁ=土', E.soundElement('마', 'haerye') === '土');
check('상생 木→火', E.relation('木', '火') === 'gen');
check('상극 木→土', E.relation('木', '土') === 'ctrl');
check('상비', E.relation('金', '金') === 'same');

// 7. 음력
section('음력 변환');
const LUNAR = [[2026, 1, 1, 0, '2026-2-17'], [2025, 6, 1, 1, '2025-7-25'], [2023, 2, 1, 1, '2023-3-22'], [2020, 4, 1, 1, '2020-5-23'],
  [2024, 8, 15, 0, '2024-9-17'], [2024, 1, 1, 0, '2024-2-10'], [2000, 1, 1, 0, '2000-2-5'], [1990, 1, 1, 0, '1990-1-27'],
  [2025, 1, 1, 0, '2025-1-29'], [2017, 5, 1, 1, '2017-6-24'], [2012, 3, 1, 1, '2012-4-21'], [1985, 1, 1, 0, '1985-2-20']];
for (const [y, m, d, l, exp] of LUNAR) check(`음력 ${y}.${l ? '윤' : ''}${m}.${d}`, fmt(E.lunarToSolar(y, m, d, !!l)) === exp, fmt(E.lunarToSolar(y, m, d, !!l)));
let rt = 0, rtBad = 0;
for (let t = Date.UTC(1950, 0, 1); t <= Date.UTC(2050, 11, 31); t += 86400000) {
  const dt = new Date(t), y = dt.getUTCFullYear(), m = dt.getUTCMonth() + 1, d = dt.getUTCDate();
  const l = E.solarToLunar(y, m, d); rt++;
  const s = l && E.lunarToSolar(l.y, l.m, l.d, l.leap);
  if (!s || s.y !== y || s.m !== m || s.d !== d) rtBad++;
  if (l && l.d === 1) { // 달 길이 29~30일
    const nx = E.solarToLunar(...[new Date(t + 29 * 86400000)].map(x => [x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate()])[0]);
    if (!(nx.d === 30 || nx.d === 1)) rtBad++;
  }
}
check('1950~2050 왕복 변환·달 길이', rtBad === 0, `${rtBad}건 불일치`);
console.log(`  ${rt}일 확인`);
const LEAP = { 2001: 4, 2004: 2, 2006: 7, 2009: 5, 2012: 3, 2014: 9, 2017: 5, 2020: 4, 2023: 2, 2025: 6, 2028: 5, 2031: 3, 2033: 11 };
for (const [y, m] of Object.entries(LEAP)) check(`윤달 ${y}년 ${m}월`, !!E.lunarToSolar(+y, m, 1, true));
check('없는 윤달 거부', E.lunarToSolar(2024, 6, 1, true) === null);
check('없는 30일 거부', E.lunarToSolar(2024, 6, 30, false) === null);

// 8. 사주
section('사주');
const P = (b, o) => E.saju(b, o || { lmt: true }).pillars.map(p => p.stem + p.branch).join(' ');
check('2000-01-01 12시', P({ y: 2000, m: 1, d: 1, hour: 12 }) === '己卯 丙子 戊午 戊午', P({ y: 2000, m: 1, d: 1, hour: 12 }));
// 2024 입춘: 2월 4일 17:27 KST 전후
check('입춘 직전 → 癸卯년 乙丑월', P({ y: 2024, m: 2, d: 4, hour: 17, minute: 0 }).startsWith('癸卯 乙丑'), P({ y: 2024, m: 2, d: 4, hour: 17 }));
check('입춘 직후 → 甲辰년 丙寅월', P({ y: 2024, m: 2, d: 4, hour: 18, minute: 0 }).startsWith('甲辰 丙寅'), P({ y: 2024, m: 2, d: 4, hour: 18 }));
check('2026년 = 丙午', P({ y: 2026, m: 6, d: 1 }).startsWith('丙午'));
// 일주는 하루에 한 칸씩
let prev = null, cont = true;
for (let i = 0; i < 400; i++) {
  const dt = new Date(Date.UTC(2025, 0, 1) + i * 86400000);
  const sj = E.saju({ y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() }, { lmt: true });
  const idx = E.STEMS.indexOf(sj.pillars[2].stem) * 0 + sj.pillars[2].s * 1000 + sj.pillars[2].b;
  if (prev && !((prev.s + 1) % 10 === sj.pillars[2].s && (prev.b + 1) % 12 === sj.pillars[2].b)) cont = false;
  prev = sj.pillars[2]; void idx;
}
check('일주 60갑자 연속', cont);
// 시주: 진태양시 보정 시 23:20(=22:52)은 亥시, 23:40(=23:12)은 다음날 子시
const h1 = E.saju({ y: 2025, m: 3, d: 10, hour: 23, minute: 20 }, { lmt: true }).pillars;
const h2 = E.saju({ y: 2025, m: 3, d: 10, hour: 23, minute: 40 }, { lmt: true }).pillars;
check('22:52 → 亥시', h1[3].branch === '亥');
check('23:12 → 子시·다음날 일주', h2[3].branch === '子' && h2[2].s === (h1[2].s + 1) % 10);
check('甲일 子시 = 甲子', (() => { for (let i = 0; i < 10; i++) { const dt = new Date(Date.UTC(2025, 0, 1) + i * 86400000); const p = E.saju({ y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate(), hour: 0, minute: 40 }, { lmt: true }).pillars; if (p[2].stem === '甲') return p[3].stem + p[3].branch === '甲子'; } return false; })());
const dst = E.saju({ y: 1987, m: 7, d: 1, hour: 10 }, { lmt: false });
check('1987 서머타임 감지', dst.dst && dst.utcOffset === 10);
check('1958 UTC+8:30', E.saju({ y: 1958, m: 1, d: 10, hour: 10 }, {}).utcOffset === 8.5);
const sjY = E.saju({ y: 2025, m: 7, d: 25, hour: 14, minute: 20 }, { lmt: true });
check('용신 구조', '木火土金水'.includes(sjY.yong.yong) && sjY.yong.hui.length >= 1 && !sjY.yong.hui.includes(sjY.yong.gi) && sjY.yong.yong !== sjY.yong.gi);
check('희신은 용신을 생함', E.relation(sjY.yong.hui[0], sjY.yong.yong) === 'gen');
check('기신은 용신을 극함', E.relation(sjY.yong.gi, sjY.yong.yong) === 'ctrl');

// 9. 점수 범위와 추천
section('점수·추천');
const kim = [{ syl: '김', hanja: E.findHanja('김', '金') }];
const sj = E.saju({ y: 2026, m: 11, d: 7, hour: 9 }, { lmt: true });
let minT = 999, maxT = -1, recCount = 0;
for (const g of ['M', 'F', 'A']) for (const saju of [null, sj]) {
  const r = E.recommend({ surname: kim, gender: g, saju, limit: 1000 });
  recCount += r.length;
  check(`추천 결과 있음 ${g}`, r.length > 0);
  check(`추천 이름 중복 없음 ${g}`, new Set(r.map(x => x.name)).size === r.length);
  for (const x of r) for (const c of [x.best].concat(x.alts)) {
    const ev = c.ev;
    minT = Math.min(minT, ev.total); maxT = Math.max(maxT, ev.total);
    const sum = ev.suriScore + ev.suriElScore + ev.soundScore + ev.yyScore + ev.jawonScore + ev.charScore;
    if (sum !== ev.total || ev.suriScore > 36 || ev.suriElScore > 10 || ev.soundScore > 20 || ev.yyScore > 8 || ev.jawonScore > 20 || ev.charScore > 6 || ev.charScore < 0) {
      check(`점수 합계 ${x.name}`, false, JSON.stringify(ev));
    }
  }
  for (let i = 1; i < r.length; i++) if (r[i].best.ev.total > r[i - 1].best.ev.total) { check('점수순 정렬', false); break; }
}
check('점수 0~100', minT >= 0 && maxT <= 100, `${minT}~${maxT}`);
console.log(`  추천 ${recCount}건, 점수 범위 ${minT}~${maxT}`);
const fixed = E.recommend({ surname: kim, gender: 'M', fixed: { pos: 1, syl: '준', hanja: E.findHanja('준', '俊') } });
check('돌림자 위치·한자 고정', fixed.length > 0 && fixed.every(x => x.name[1] === '준' && x.best.given[1].hanja.ch === '俊'));
const inc = E.recommend({ surname: kim, gender: 'F', include: '윤' });
check('꼭 넣을 음절', inc.length > 0 && inc.every(x => x.name.includes('윤')));
const one = E.evaluate(kim, [{ syl: '훈', hanja: E.findHanja('훈', '勳') }], {});
check('외자 평가', one.total >= 0 && one.total <= 100 && one.soundPairs.length === 1);
const nam = ['남', '궁'].map((s, i) => ({ syl: s, hanja: E.findHanja(s, '南宮'[i]) }));
const evB = E.evaluate(nam, [{ syl: '민', hanja: E.findHanja('민', '敏') }, { syl: '수', hanja: E.findHanja('수', '秀') }], {});
check('복성 발음오행 쌍 수', evB.soundPairs.length === 2 && evB.soundPairs[0].a === '궁');

console.log(`\n${fails ? '✗' : '✓'} ${checks - fails}/${checks} 통과`);
process.exit(fails ? 1 : 0);
