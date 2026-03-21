---
name: no-push-without-permission
description: Never push to git remote unless user explicitly says to
type: feedback
---

Do not run `git push` or create pull requests unless the user explicitly says to push.

**Why:** User wants to control when code is pushed to the remote.
**How to apply:** Always stop before any `git push` command and ask the user first, even if they asked for a commit.
