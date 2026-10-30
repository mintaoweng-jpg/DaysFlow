# Regex Fallback Parser

This is the original regex-based notification parser from DaysFlow's `index.html`.
It serves as a fallback when the cloud LLM is unavailable.

## Original Function

The original `parseCopiedMessage()` function in DaysFlow uses pure regex matching
to extract date, time, deadline keywords, and location from pasted text.

## What It Handles

### Date Patterns
| Pattern | Example | Regex |
|---------|---------|-------|
| Full date (Chinese) | 2026年10月30日 | `(20\d{2})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})\s*日?` |
| Month/Day | 10月15日 | `(\d{1,2})\s*月\s*(\d{1,2})\s*日` |
| Relative | 明天, 后天, 大后天 | `大后天\|后天\|明天\|明早\|明晨\|今天\|今日` |
| Weekday | 下周三, 本周五 | `(下周\|下星期\|本周\|这周\|周\|星期)([一二三四五六日天])` |

### Time Patterns
| Pattern | Example | Regex |
|---------|---------|-------|
| Half past | 两点半, 三点半 | `([零一二三四五六七八九十两\d]+)点半` |
| Standard | 14:30, 下午3点 | `(上午\|下午\|晚上\|中午)?\s*(\d{1,2})\s*[:：点时](?:\s*(\d{1,2})\s*分?)?` |

### Deadline Keywords
`截止`, `deadline`, `到期`, `之前完成`, `之前提交`, `前完成`, `前提交`, `前交`, `务必在`, `最晚`, `不晚于`, `截至`

### Location Patterns
`第?[一二三四五六七八九十\d]+(?:教学楼|楼)`, `\d{2,4}教室`

### Title Cleaning
Strips: URLs, @mentions, #hashtags#, "通知", "请于", "麻烦", "烦请", "请", "截止日期", "截止时间", "截止", "deadline", "最晚", "不晚于"

## Limitations vs AI Parser

1. **No semantic understanding** — can't distinguish "下周要交" from "下周去看电影"
2. **Limited date formats** — misses "月底", "月初", "这周末", "下个月"
3. **No multi-item support** — can't extract multiple to-dos from one message
4. **Rigid time parsing** — misses "傍晚", "黄昏", "午后" etc.
5. **Title quality** — regex cleaning often leaves awkward fragments
6. **No confidence scoring** — all results are treated equally

These limitations are what the AI parser addresses.
