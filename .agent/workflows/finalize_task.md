---
description: Finalize a task (Update docs, Test, Commit)
---

This workflow ensures that every code change is properly documented, tested, and committed. Run this at the end of a feature implementation or bug fix.

1. **Update `HISTORY.md`**
   - [ ] Add a new entry for today's date (if not exists).
   - [ ] Describe **Context** (What prompted this work?).
   - [ ] List **Changes** (Technical details of what was done).
   - [ ] Note **Lessons Learned** (any pitfalls or architectural decisions).

2. **Update `ARCHITECTURE.md` (If necessary)**
   - [ ] Did you change the directory structure?
   - [ ] Did you add a new key component or change core logic (e.g., new Turndown rule)?
   - [ ] If yes, update the relevant sections in `ARCHITECTURE.md`.

3. **Verify Functionality**
   - [ ] Run the full test suite.
   // turbo
   npm test

4. **Clean Up**
   - [ ] Remove any temporary files (e.g., `test_cover.jpg`, temp scripts) that might have been created.
   - [ ] Ensure `.gitignore` is correct.

5. **Commit Changes**
   - [ ] Stage all changes.
   - [ ] Commit with a descriptive message follows "Type: Subject" format.
   // turbo
   git add . && git status
