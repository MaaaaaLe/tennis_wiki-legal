#!/usr/bin/env python3
"""인명용 한자 데이터 생성 스크립트.

입력
  1) moji.db   : npm 패키지 @mandel59/mojidata 의 dist/moji.db (Unicode Unihan 데이터 포함)
  2) hanja.txt : libhangul 의 data/hanja/hanja.txt (한자 훈음, BSD 라이선스)

출력
  baby-name/hanja-data.js  (window.HANJA_DATA = {...})

계산 방식
  - 인명용 한자: Unihan kKoreanEducationHanja(교육용 1800자) ∪ kKoreanName(대법원 인명용 추가 한자)
  - 원획(성명학 획수): kRSUnicode 의 '부수번호.나머지획' 에서 부수를 원래 글자의 획수로 환산
        예) 氵(水)=4, 扌(手)=4, 忄(心)=4, 艹(艸)=6, 辶(辵)=7, 阝좌(阜)=8, 阝우(邑)=7, 王(玉)=5, 月(肉)=6
    숫자 한자(一~十)는 뜻의 수를 획수로 사용 (四=4, 五=5, 六=6, 七=7, 八=8, 九=9, 十=10)
  - 자원오행: 부수의 뜻에 따른 오행 (부수 표에 없으면 발음오행으로 대체하고 'est' 표시)
  - 상용도: libhangul 단어 사전에서 해당 한자가 쓰인 단어 수

사용법
  python3 build_data.py path/to/moji.db path/to/hanja.txt > ../hanja-data.js
"""
import json
import sqlite3
import sys
import unicodedata
from collections import Counter, defaultdict

DB, HANJA_TXT = sys.argv[1], sys.argv[2]

# ── 부수(강희 214부수) → 자원오행 ─────────────────────────────
E = {}
def put(el, nums):
    for n in nums:
        E[n] = el
# 木: 木 艸 竹 禾 米 糸 麻 瓜 衣 宀 广 巾 手 示 目 門 大 文 虍 角 豆 長 青 風 香 麥
put('木', [75, 140, 118, 115, 119, 120, 200, 97, 145, 40, 53, 50, 64, 113, 109, 169, 37, 67, 141, 148,
           151, 168, 174, 182, 186, 199, 48, 116])
put('火', [86, 72, 61, 9, 10, 155, 187, 172, 196, 124, 60, 57, 59, 147, 158, 189, 194, 176, 128, 156, 144,
           82, 105, 68, 25, 48])
# 火: 火 日 心 人 儿 赤 馬 隹 鳥 羽 彳 弓 彡 見 身 高 鬼 面 耳 走 行 毛 癶 斗 卜 工
put('土', [32, 46, 102, 170, 163, 162, 157, 166, 201, 210, 212, 41, 19, 77, 70, 123, 93, 94, 98, 99, 133,
           139, 131])
# 土: 土 山 田 阜 邑 辵 足 里 黃 齊 龍 寸 力 止 方 羊 牛 犬 瓦 甘 至 色 臣
put('金', [167, 96, 112, 18, 62, 69, 154, 164, 149, 106, 108, 117, 66, 76, 111, 177, 180, 188, 211, 132,
           146, 159, 197])
# 金: 金 玉 石 刀 戈 斤 貝 酉 言 白 皿 立 攴 欠 矢 革 音 骨 齒 自 西 鹵
put('水', [85, 173, 15, 195, 203, 39, 47, 30, 74, 130, 42, 44, 84, 101, 104, 116, 142, 150, 152, 175, 184,
           185, 14])
# 水: 水 雨 冫 魚 黑 子 川 口 月 肉 小 尸 气 用 疒 穴 虫 谷 豕 非 食 首 冖
E[159] = '火'   # 車
E[116] = '水'   # 穴
E[48] = '火'    # 工

# ── 발음오행 (초성) ──────────────────────────────────────────
CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
SOUND = {'ㄱ': '木', 'ㄲ': '木', 'ㅋ': '木', 'ㄴ': '火', 'ㄷ': '火', 'ㄸ': '火', 'ㄹ': '火', 'ㅌ': '火',
         'ㅇ': '土', 'ㅎ': '土', 'ㅅ': '金', 'ㅆ': '金', 'ㅈ': '金', 'ㅉ': '金', 'ㅊ': '金',
         'ㅁ': '水', 'ㅂ': '水', 'ㅃ': '水', 'ㅍ': '水'}

def cho(s):
    code = ord(s[0]) - 0xAC00
    return CHO[code // 588] if 0 <= code < 11172 else None

def dueum(s):
    """두음법칙 적용 독음 (리→이, 라→나, 녀→여 ...)."""
    code = ord(s) - 0xAC00
    if not 0 <= code < 11172:
        return s
    c, v, t = code // 588, (code % 588) // 28, code % 28
    yv = {2, 6, 7, 12, 17, 20}  # ㅑ ㅕ ㅖ ㅛ ㅠ ㅣ
    if c == 5:  # ㄹ
        c = 11 if v in yv else 2
    elif c == 2 and v in yv:  # ㄴ
        c = 11
    else:
        return s
    return chr(0xAC00 + c * 588 + v * 28 + t)

NUM = {'一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10}

con = sqlite3.connect(DB)
q = lambda sql: dict(con.execute(sql).fetchall())
edu = q('select UCS, value from unihan_kKoreanEducationHanja')
name = q('select UCS, value from unihan_kKoreanName')
hangul = q('select UCS, value from unihan_kHangul')
rs = q('select UCS, value from unihan_kRSUnicode')
total = q('select UCS, value from unihan_kTotalStrokes')

# 부수 원래 글자 획수
rad_strokes = {}
for num, ch in con.execute('select radical_number, radical_CJKUI from radicals where radical_simplified=0'):
    rad_strokes[int(num)] = int(total[ch].split()[0])

# 훈(뜻)과 상용도
meaning = {}
freq = Counter()
for line in open(HANJA_TXT, encoding='utf-8'):
    if line.startswith('#'):
        continue
    p = line.rstrip('\n').split(':')
    if len(p) < 3:
        continue
    hg, hj, desc = p[0], p[1], p[2]
    if len(hj) == 1 and len(hg) == 1:
        parts = []
        for part in desc.split(','):
            part = part.strip()
            ws = part.split(' ')
            if len(ws) > 1 and len(ws[-1]) == 1 and '가' <= ws[-1] <= '힣':
                part = ' '.join(ws[:-1])
            if part and part not in parts:
                parts.append(part)
        m = ', '.join(parts[:3])
        if m and (hj, hg) not in meaning:
            meaning[(hj, hg)] = m
            meaning.setdefault((hj, None), m)
    elif len(hj) > 1:
        for ch in set(hj):
            freq[ch] += 1

def won_strokes(ch):
    if ch in NUM:
        return NUM[ch]
    r = rs[ch].split()[0]
    rad, rest = r.split('.')
    rad = rad.rstrip("'")
    rest = int(rest)
    if rest <= 0:
        return int(total[ch].split()[0])
    return rad_strokes[int(rad)] + rest

def jawon(ch, reading):
    r = rs[ch].split()[0]
    rad = int(r.split('.')[0].rstrip("'"))
    if rad in E:
        return E[rad], 0
    return SOUND.get(cho(reading), '土'), 1

out = defaultdict(list)
chars = set(edu) | set(name)
for ch in chars:
    if ch not in hangul or ch not in rs:
        continue
    # 정규화(호환 한자 → 통합 한자)
    if unicodedata.normalize('NFC', ch) != ch:
        continue
    readings = []
    for tok in hangul[ch].split():
        rd, flags = tok.split(':')
        readings.append((rd, flags))
    # 인명용/교육용 독음이 표시된 것 우선
    pref = [rd for rd, f in readings if 'N' in f or 'E' in f] or [rd for rd, _ in readings]
    keys = []
    for rd in pref:
        for k in (rd, dueum(rd)):
            if k not in keys:
                keys.append(k)
    strokes = won_strokes(ch)
    is_edu = 1 if ch in edu else 0
    for rd in pref:
        m = meaning.get((ch, rd)) or meaning.get((ch, None)) or ''
        el, est = jawon(ch, rd)
        entry = [ch, m, strokes, el, is_edu, freq.get(ch, 0), est, rd]
        for k in {rd, dueum(rd)}:
            if not any(e[0] == ch for e in out[k]):
                out[k].append(entry)

for k in out:
    out[k].sort(key=lambda e: (-e[4], -e[5]))

data = {k: [[e[0], e[1], e[2], e[3], e[4], min(e[5], 9999), e[6]] for e in v] for k, v in sorted(out.items())}
sys.stdout.write('// 자동 생성 파일: tools/build_data.py 참고. 형식: 독음 -> [한자, 뜻, 원획, 자원오행, 교육용, 상용도, 오행추정]\n')
sys.stdout.write('window.HANJA_DATA=')
sys.stdout.write(json.dumps(data, ensure_ascii=False, separators=(',', ':')))
sys.stdout.write(';\n')
print(f'chars={len(chars)} readings={len(data)}', file=sys.stderr)
