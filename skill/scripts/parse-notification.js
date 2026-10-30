#!/usr/bin/env node

/**
 * Standalone test script for DaysFlow notification parsing.
 *
 * Usage:
 *   node parse-notification.js "请于10月15日下午2点在第三教学楼204教室提交课程论文"
 *
 * This script is for testing the AI parse logic outside the H5.
 * It does NOT use any cloud credentials — it uses the regex fallback
 * logic to demonstrate the parsing rules and output schema.
 *
 * To test with a real LLM, use this within WorkBuddy chat where
 * the AI can directly apply the system prompt from references/parse-prompt.md.
 */

const input = process.argv.slice(2).join(' ');
if (!input) {
  console.error('Usage: node parse-notification.js "your notification text"');
  process.exit(1);
}

const today = new Date();
today.setHours(0, 0, 0, 0);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function cnNumber(s) {
  if (/^\d+$/.test(s)) return Number(s);
  const n = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  return s.includes('十')
    ? (s.startsWith('十') ? 10 : (n[s[0]] || 1) * 10) + (s.endsWith('十') ? 0 : (n[s[s.length - 1]] || 0))
    : (n[s] || 0);
}

function parseMessage(raw) {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  let found = null, work = raw, time = '';
  let m;

  // Full date: 2026年10月30日 / 2026-10-30 / 2026/10/30
  m = work.match(/(20\d{2})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})\s*日?/);
  if (m) { found = new Date(+m[1], +m[2] - 1, +m[3]); work = work.replace(m[0], ' '); }

  // Month/Day: 10月15日
  if (!found && (m = work.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/))) {
    found = new Date(base.getFullYear(), +m[1] - 1, +m[2]);
    if (found < base) found.setFullYear(found.getFullYear() + 1);
    work = work.replace(m[0], ' ');
  }

  // Relative: 今天, 明天, 后天...
  if (!found) {
    const rel = work.match(/大后天|后天|明天|明早|明晨|今天|今日/);
    if (rel) {
      const add = { 今天: 0, 今日: 0, 明天: 1, 明早: 1, 明晨: 1, 后天: 2, 大后天: 3 }[rel[0]];
      found = new Date(base);
      found.setDate(base.getDate() + add);
      work = work.replace(rel[0], ' ');
    }
  }

  // Weekday: 下周三, 本周五...
  if (!found && (m = work.match(/(下周|下星期|本周|这周|周|星期)([一二三四五六日天])/))) {
    const map = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0 };
    const target = map[m[2]];
    const todayWd = base.getDay();
    const next = (target - todayWd + 7) % 7;
    found = new Date(base);
    found.setDate(base.getDate() + next + (/下周|下星期/.test(m[1]) ? (next === 0 ? 7 : 7) : 0));
    work = work.replace(m[0], ' ');
  }

  // Time: X点半
  if ((m = work.match(/([零一二三四五六七八九十两\d]+)点半/))) {
    const h = cnNumber(m[1]);
    time = String(h).padStart(2, '0') + ':30';
    work = work.replace(m[0], ' ');
  }

  // Time: 14:30 / 下午3点 / 上午10点30分
  if ((m = work.match(/(上午|下午|晚上|中午)?\s*(\d{1,2})\s*[:：点时](?:\s*(\d{1,2})\s*分?)?/))) {
    let h = +m[2], min = +(m[3] || 0);
    if (/下午|晚上/.test(m[1] || '') && h < 12) h += 12;
    if (/上午/.test(m[1] || '') && h === 12) h = 0;
    time = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    work = work.replace(m[0], ' ');
  }

  const deadline = /(截止|deadline|到期|之前完成|之前提交|前完成|前提交|前交|务必在|最晚|不晚于|截至)/i.test(raw);

  // Location extraction
  const locations = [...raw.matchAll(/第?[一二三四五六七八九十\d]+(?:教学楼|楼)|\d{2,4}教室/g)].map(x => x[0]);

  // Title cleaning
  let title = work
    .replace(/([零一二三四五六七八九十两\d]+)点半/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/第?[一二三四五六七八九十\d]+(?:教学楼|楼)|\d{2,4}教室/g, ' ')
    .replace(/通知/g, ' ')
    .replace(/[@＃][^\s，。！？,!?]+/g, ' ')
    .replace(/(请于|请在|麻烦|烦请|请|截止日期|截止时间|截止|deadline|最晚|不晚于)/ig, ' ')
    .replace(/^[\s，。,:：;；、]+|[\s，。,:：;；、]+$/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^(前|之前)\s*/, '')
    .trim();
  if (!title) title = raw.slice(0, 90);

  const kind = deadline ? 'future' : 'today';

  return {
    title: title.slice(0, 90),
    date: found ? iso(found) : '',
    time,
    type: kind,
    note: locations.length ? locations.join('，') : '',
    location: locations.length ? locations.join('，') : '',
    deadline,
    confidence: found ? 0.8 : 0.4,
  };
}

const result = parseMessage(input);
console.log(JSON.stringify(result, null, 2));
console.log('\n--- Today:', iso(today), '---');
