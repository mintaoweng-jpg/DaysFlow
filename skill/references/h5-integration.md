# H5 Integration Guide (Future — Secure Backend)

> **WARNING: This document describes a FUTURE integration plan.**
> It must NOT be implemented until ALL of the following are true:
> 1. The WorkBuddy cloud service is available and activated.
> 2. A secure backend endpoint exists that holds credentials server-side.
> 3. The user has EXPLICITLY requested AI integration in the H5.
>
> The H5 must NEVER contain API keys, publishable keys, endpoints, or any
> cloud credentials. All AI calls go through a backend endpoint.

## Security Model

```
+-------------------+          +-------------------+          +-------------------+
|   H5 Front-end    |  HTTPS   |  Backend Endpoint |  Server  |  Cloud LLM API    |
|   (index.html)    | -------> |  /api/parse       | -------> |  (server-side     |
|                   |  POST    |                   |  creds   |   credentials)    |
|   No secrets.     | <------- |                   | <------- |                   |
|   No SDK loaded.  |  JSON    |                   |  JSON    |                   |
+-------------------+          +-------------------+          +-------------------+
```

### What the H5 contains
- The backend endpoint URL (public, no secrets)
- An "AI 识别" toggle (default OFF)
- The local regex parser (always available)

### What the H5 does NOT contain
- No API keys
- No publishable keys
- No cloud endpoint URLs
- No SDK script tags
- No cloud client initialization

### What the backend contains
- Cloud service credentials (server-side only)
- The system prompt (from references/parse-prompt.md)
- The LLM call logic
- Rate limiting and validation

## Backend Endpoint Specification

### POST /api/parse-notification

**Request:**
```json
{
  "message": "string - the raw pasted notification text",
  "today": "string - YYYY-MM-DD, provided by the H5 for date context"
}
```

**Response (200):**
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

**Response (error):**
```json
{
  "error": "string - human-readable error message",
  "code": "string - error code"
}
```

The backend should:
1. Validate the message is not empty and not excessively long (max 2000 chars)
2. Rate-limit per IP to prevent abuse
3. Call the cloud LLM with the system prompt
4. Parse and validate the JSON output
5. Return structured JSON or an error

## H5 Front-end Changes (when implemented)

### 1. AI Toggle UI

Add a toggle in the parse section of the add-task modal:

```html
<!-- Inside the parse section, after the "识别并填入" button -->
<label class="ai-toggle-wrap" style="display:flex;align-items:center;gap:8px;margin-top:8px;font-size:11px;color:#888;cursor:pointer;">
  <input type="checkbox" id="aiModeToggle" style="accent-color:#222;width:14px;height:14px;">
  <span>AI 智能识别<span style="color:#bbb;margin-left:4px;">（关闭时使用本地规则）</span></span>
</label>
```

### 2. Parse Function (with AI opt-in)

```js
// The backend endpoint URL — set this only when the backend is deployed.
// This is a public URL, NOT a secret.
const PARSE_API_URL = null; // e.g. 'https://daysflow-planner.workbuddy.link/api/parse-notification'

// User preference stored in localStorage
let aiModeEnabled = localStorage.getItem('daysflow-ai-mode') === 'true';

// Toggle handler
document.getElementById('aiModeToggle')?.addEventListener('change', e => {
  aiModeEnabled = e.target.checked;
  localStorage.setItem('daysflow-ai-mode', String(aiModeEnabled));
});

async function parseCopiedMessage() {
  const raw = document.getElementById('sourceMessage').value.trim();
  const out = document.getElementById('parseResult');
  if (!raw) {
    out.textContent = '请先粘贴一条包含待办内容的消息。';
    out.classList.add('show');
    return;
  }

  // Check if AI mode is explicitly enabled AND backend URL is configured
  if (aiModeEnabled && PARSE_API_URL) {
    out.innerHTML = '<span style="color:#888">AI 识别中...</span>';
    out.classList.add('show');
    try {
      const resp = await fetch(PARSE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: raw,
          today: iso(today),
        }),
      });
      if (!resp.ok) throw new Error('backend error');
      const parsed = await resp.json();
      if (parsed && parsed.title) {
        applyParsedResult(parsed, out);
        return;
      }
    } catch (e) {
      console.warn('AI parse failed, falling back to regex:', e);
      out.innerHTML = '<span style="color:#999">AI 暂不可用，使用本地规则识别。</span>';
    }
  }

  // Default: local regex parser (unchanged from original)
  regexParseFallback(raw, out);
}

function applyParsedResult(parsed, out) {
  const kind = parsed.type === 'future' ? 'future' : 'today';
  const lockedFuture = document.getElementById('modalBack').classList.contains('future-only');
  const finalKind = (parsed.deadline || lockedFuture) ? 'future' : kind;

  parsedTargetDate = parsed.date && !parsed.deadline && !lockedFuture ? parsed.date : '';
  setKind(finalKind);

  if (parsed.date && finalKind === 'future')
    document.getElementById('taskDate').value = parsed.date;
  else if (finalKind === 'future')
    document.getElementById('taskDate').value = '';

  if (parsed.time)
    document.getElementById(finalKind === 'future' ? 'taskTime' : 'todayTime').value = parsed.time;

  document.getElementById('taskTitle').value = (parsed.title || '').slice(0, 90);
  if (parsed.note) document.getElementById('taskNote').value = parsed.note;

  renderNameTokens((parsed.title || '').slice(0, 90));

  const dateLabel = parsed.date
    ? fmtDate(new Date(parsed.date + 'T00:00:00'), { year: 'numeric', month: 'long', day: 'numeric' })
    : (finalKind === 'future' ? '需要手动补充截止日期' : '今天');
  const timeLabel = parsed.time ? ` · ${parsed.time}` : '';
  const confLabel = parsed.confidence != null ? ` · 置信度 ${Math.round(parsed.confidence * 100)}%` : '';
  const warnLabel = parsed.confidence != null && parsed.confidence < 0.5
    ? '<br><span style="color:#c66">置信度较低，请仔细检查。</span>' : '';

  out.innerHTML = `AI 识别：<strong>${finalKind === 'future' ? '截止待办' : '普通待办'}</strong> · ${dateLabel}${timeLabel}${confLabel}${warnLabel}<br>请检查或修改上方内容，再点"确认并添加"。`;
  out.classList.add('show');
}

// The original regex parser — renamed but otherwise unchanged
function regexParseFallback(raw, out) {
  // ... original parseCopiedMessage regex logic, unchanged ...
  // See references/regex-fallback.md for the documented code.
}
```

### 3. Initialization

```js
// On page load, set the toggle to match stored preference
document.getElementById('aiModeToggle').checked = aiModeEnabled;
// If PARSE_API_URL is null (backend not deployed), disable the toggle
if (!PARSE_API_URL) {
  const toggle = document.getElementById('aiModeToggle');
  if (toggle) {
    toggle.disabled = true;
    toggle.closest('.ai-toggle-wrap').style.opacity = '0.4';
    toggle.closest('.ai-toggle-wrap').title = 'AI 后端尚未部署';
  }
}
```

## Checklist Before Implementing

- [ ] WorkBuddy cloud service is activated and `billingStatus` is `normal`
- [ ] Backend endpoint is created and tested
- [ ] The endpoint URL is a public URL (no secrets in it)
- [ ] The H5 toggle defaults to OFF
- [ ] User preference is stored in localStorage (`daysflow-ai-mode`)
- [ ] The original regex parser is preserved as fallback
- [ ] No API keys, publishable keys, or SDK loads in the H5
- [ ] User has explicitly asked to enable AI mode
