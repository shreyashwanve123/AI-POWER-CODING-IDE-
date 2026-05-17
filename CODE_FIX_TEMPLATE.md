# Code Fix Template / कोड फिक्स टेम्पलेट

Use this template when you paste code into the IDE and want the assistant to fix it and explain the fix.

## 1) Debugging (डिबगिंग)
- Problem / समस्या: (User-provided failing behavior or error message)
- Root cause / कारण: (Concise diagnosis of why the code fails)
- Fix / समाधान: (Describe the exact change or file patch to apply)
- How to apply: (Exact steps or git/file edits required to apply the fix)

### Example
- Problem: Component crashes on render with "Cannot read property 'map' of undefined".
- Root cause: Prop `items` is undefined because default prop missing.
- Fix: Add a guard or default value for `items` (showing the change in plain text rather than a snippet).

## 2) Explanation (व्याख्या)
- What was wrong: (Plain-language summary of the bug)
- Why this fix works: (Explain the root-cause and how the change addresses it)
- Side effects / Notes: (Any tradeoffs, performance or compatibility notes)

---

Use this template to request fixes in Hindi or English. Paste your broken code and the observed error; the assistant will return a filled template with a patch and explanation.
