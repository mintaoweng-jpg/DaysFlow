# DaysFlow Parse Output JSON Schema

## Fields

### title (string, required)
- Concise to-do title, max 30 characters
- Strip notification boilerplate: URLs, @mentions, #hashtags#, "通知", "请于", "麻烦", "烦请", "请"
- Keep the core action + object
- Example: "提交课程论文" (not "请于10月15日提交课程论文")

### date (string, optional)
- Format: `YYYY-MM-DD`
- Inferred from relative dates using today as reference
- Empty string if no date found
- Example: "2026-10-15"

### time (string, optional)
- Format: `HH:MM` (24-hour)
- Converted from Chinese time expressions: "下午3点" → "15:00", "两点半" → "02:30"
- Empty string if no specific time found
- Example: "14:00"

### type (string, required)
- `"today"` — a task to do today (or the inferred date), no hard deadline
- `"future"` — a task with a deadline / due date
- Determined by keywords: "截止", "deadline", "到期", "之前完成", "务必在", "最晚", "不晚于"
- Also `"future"` if the message clearly references a future date as a deadline

### note (string, optional)
- Additional context, special requirements, preparation notes
- Includes location info if present
- Example: "第三教学楼204教室，带学生证"

### location (string, optional)
- Extracted location: classroom, building, meeting room, address
- Patterns: "第X教学楼", "XXX教室", "XX楼", "XX会议室", "地点：XXX", "在XXX"
- Empty string if none found
- Example: "第三教学楼204教室"

### deadline (boolean, required)
- `true` if the message implies a hard deadline
- `false` for soft reminders or general to-dos
- Keywords that set this to true: "截止", "deadline", "到期", "之前完成/提交", "务必在", "最晚", "不晚于", "截至"

### confidence (number, required)
- 0.0 to 1.0
- How confident the parse is
- 1.0 = very clear, unambiguous message
- 0.5 = some ambiguity in date/time/type
- Below 0.3 = the H5 should show the result but warn the user to double-check

## Examples

### Example 1: Classroom deadline
Input: "通知：请于10月15日下午2点在第三教学楼204教室提交课程论文"
```json
{
  "title": "提交课程论文",
  "date": "2026-10-15",
  "time": "14:00",
  "type": "future",
  "note": "第三教学楼204教室",
  "location": "第三教学楼204教室",
  "deadline": true,
  "confidence": 0.95
}
```

### Example 2: Soft reminder
Input: "明天早上8点晨跑，记得带水杯"
```json
{
  "title": "晨跑",
  "date": "2026-10-31",
  "time": "08:00",
  "type": "today",
  "note": "记得带水杯",
  "location": "",
  "deadline": false,
  "confidence": 0.9
}
```

### Example 3: Group @mention with deadline
Input: "@所有人 本周五前完成季度复盘报告，发到群里"
```json
{
  "title": "完成季度复盘报告",
  "date": "2026-11-01",
  "time": "",
  "type": "future",
  "note": "发到群里",
  "location": "",
  "deadline": true,
  "confidence": 0.92
}
```

### Example 4: Ambiguous date
Input: "下周要交那个作业"
```json
{
  "title": "交作业",
  "date": "",
  "time": "",
  "type": "future",
  "note": "",
  "location": "",
  "deadline": false,
  "confidence": 0.4
}
```

## Mapping to DaysFlow Item

The parsed JSON maps to a DaysFlow item like this:

```js
{
  id: Date.now(),
  title: parsed.title,
  date: parsed.date || iso(selectedDate),
  time: parsed.time,
  note: parsed.note,
  source: rawMessageText,
  done: false,
  type: parsed.type,
  color: ['green','pink','blue','yellow','lav'][items.length % 5]
}
```
