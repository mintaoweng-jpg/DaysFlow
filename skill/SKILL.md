---
name: daysflow-parse
description: >-
  AI-powered notification parser for the DaysFlow planner. This skill should be
  used when the user wants to paste a group chat message, notification, or
  announcement and have AI extract structured to-do items from it. It parses
  natural-language text into structured JSON (title, date, time, type, note,
  location) that can be consumed by the DaysFlow H5 app or used standalone.
  Trigger phrases include "parse notification", "extract to-do from message",
  "识别通知", "群消息提取待办", "粘贴通知识别", and any request involving
  notification-to-to-do extraction for DaysFlow or similar planner apps.
agent_created: true
---

# DaysFlow Notification Parser

## Overview

This skill defines the rules, prompt, and output schema for AI-powered parsing
of pasted notifications, group chat messages, and announcements into structured
to-do items. It is an **independent capability** — it is NOT called by the H5
front-end directly. The H5 continues to use its built-in regex parser; this
skill exists to provide a superior AI-based alternative when invoked through
WorkBuddy or a secure backend endpoint.

## Architecture

```
                        +-----------------------+
                        |  WorkBuddy Skill      |
                        |  (daysflow-parse)     |
                        |  - parse-prompt.md    |
                        |  - data-schema.md     |
                        |  - regex-fallback.md  |
                        +-----------------------+
                                   |
          +------------------------+------------------------+
          |                        |                        |
          v                        v                        v
  +----------------+     +------------------+     +------------------+
  | Direct use in  |     | Secure backend   |     | H5 Front-end     |
  | WorkBuddy chat |     | endpoint (future)|     | (index.html)     |
  |                |     |                  |     |                  |
  | User pastes    |     | POST /api/parse  |     | Uses local regex |
  | message, AI    |     | -> calls LLM     |     | parseCopiedMessage()
  | returns JSON   |     | -> returns JSON  |     | (no change)      |
  +----------------+     +------------------+     +------------------+
                                   |
                                   v
                         +------------------+
                         | H5 calls backend |
                         | ONLY when user   |
                         | explicitly opts  |
                         | in to "AI 识别"  |
                         +------------------+
```

### Key principles

1. **No secrets in front-end code.** The H5 never contains API keys, endpoints,
   publishable keys, or any cloud credentials. All AI calls go through a secure
   backend endpoint that holds credentials server-side.

2. **Skill is independent.** The Skill defines parsing rules and prompt; it is
   NOT directly callable by the H5. The Skill can be used:
   - Directly in WorkBuddy chat (user pastes a message, AI returns structured JSON)
   - Through a future secure backend endpoint (when cloud service is available)

3. **Local regex is the default.** The H5's existing `parseCopiedMessage()`
   regex parser remains the default behavior. No automatic AI calls.

4. **User opt-in required.** Even when a secure backend endpoint exists, the H5
   will NOT send pasted messages to it unless the user explicitly enables "AI
   识别" mode (a toggle/switch in the UI). Default is OFF.

5. **Cloud service recovery does not auto-enable.** When the WorkBuddy cloud
   service becomes available again, the H5 does not automatically start sending
   data. The user must explicitly turn on AI mode in the settings.

## When to Use

- The user asks to parse a notification, group message, or announcement into a
  to-do item.
- The user wants to improve or modify how DaysFlow extracts to-dos from pasted
  text.
- The user pastes a raw message in WorkBuddy chat and asks to extract a to-do.
- The user wants to review or modify the AI parsing prompt or rules.
- The user wants to understand the data schema for parsed to-do items.

## Workflow

### 1. Parse a Notification (standalone, in WorkBuddy chat)

1. Receive the raw message text from the user.
2. Load the system prompt from `references/parse-prompt.md`.
3. Get today's date and weekday for context.
4. Construct messages: system prompt (with today's date filled in) + user message
   containing the raw text.
5. Use AI to parse the message into structured JSON.
6. Validate the output against the schema in `references/data-schema.md`.
7. Return the structured to-do item to the user.
8. The user can then manually add it to DaysFlow or any other planner.

### 2. Modify the Parse Logic

1. Read `references/parse-prompt.md` to understand the current system prompt.
2. Read `references/data-schema.md` for the output JSON schema.
3. Edit the prompt to add new date formats, time formats, or extraction rules.
4. If the H5 front-end regex parser also needs updating, read the current
   `parseCopiedMessage()` in DaysFlow's `index.html` and read
   `references/regex-fallback.md` for the documented regex patterns.
5. Push changes to GitHub after testing.

### 3. Future: Integrate with H5 via Secure Backend

This workflow is ONLY for when:
- The WorkBuddy cloud service is available and activated
- A secure backend endpoint has been created
- The user has explicitly requested AI integration in the H5

**Do NOT execute this workflow automatically.** Wait for the user to ask.

1. Activate WorkBuddy cloud service for DaysFlow.
2. Create a backend endpoint (e.g., `/api/parse-notification`) that:
   - Receives POST with message text
   - Calls the cloud LLM using server-side credentials
   - Returns structured JSON
   - Credentials stay server-side; the H5 only knows the endpoint URL
3. Modify the H5 `index.html` to:
   - Add an "AI 识别" toggle in the parse section (default OFF)
   - When toggle is ON and user clicks "识别并填入", POST to the backend endpoint
   - When toggle is OFF or backend is unavailable, use local regex
   - Store the user's preference in localStorage
4. Read `references/h5-integration.md` for the detailed integration code.

### 4. Improve the Local Regex Parser

The H5's regex parser is the always-available fallback. It can be improved
independently of the AI skill:

1. Read `references/regex-fallback.md` for documented patterns and limitations.
2. Identify missing patterns from real-world messages.
3. Add new regex rules to the `parseCopiedMessage()` function in `index.html`.
4. Test with sample messages.
5. Push to GitHub.

## Output JSON Schema

```json
{
  "title": "string - concise to-do title, max 30 chars",
  "date": "string - YYYY-MM-DD format, or empty if not found",
  "time": "string - HH:MM 24h format, or empty if not found",
  "type": "string - 'today' or 'future'",
  "note": "string - additional details, location, or context",
  "location": "string - extracted location, or empty",
  "deadline": "boolean - true if the message implies a deadline",
  "confidence": "number - 0 to 1, how confident the parse is"
}
```

See `references/data-schema.md` for detailed field rules and examples.

## Resources

### references/
- `parse-prompt.md` - The AI system prompt for notification parsing (rules + examples)
- `data-schema.md` - Output JSON schema with field rules and examples
- `h5-integration.md` - Future integration plan for H5 via secure backend (NOT for direct front-end LLM calls)
- `regex-fallback.md` - The original regex-based parser logic, documented patterns and limitations

### scripts/
- `parse-notification.js` - Standalone Node.js script for testing the AI parse
  logic outside the H5 (useful for debugging prompt changes)
