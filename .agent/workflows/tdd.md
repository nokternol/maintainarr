---
description: Start a Test-Driven Development (TDD) loop for a new feature or bug fix.
---

# TDD Workflow

This workflow sets up the agent to execute a rigorous Red-Green-Refactor loop specifically tailored for Maintainarr.

1. **Context Loading**: 
   - Read the global TDD rules: `view_file ~/.agents/skills/tdd/SKILL.md`
   - Read the project-specific TDD wrapper: `view_file .agent/skills/maintainarr-tdd/SKILL.md`
2. **Architecture Familiarity**: Identify if the task targets the Frontend (`src/`) or Backend (`server/`). Verify you understand the environment bounds (`happy-dom` vs `node`) and the specific helpers to use.
3. **Planning & Agreement**: Plan the vertical slice (Tracer Bullet test) with the user before writing any code. Make a checklist in the task artifact. Ask for clarifying requirements if anything is vague. DO NOT pre-write all tests at once (horizontal slicing).
4. **Execution Loop**: Write one test -> Run `yarn test:run <filename>` -> Watch it fail -> Write implementation -> Run `yarn test:run <filename>` -> Watch it pass.
5. **Refactor & Verification**: Refactor your code, then run the god script `yarn verify:fast` to ensure no linting or type-checking issues were introduced repo-wide. You are only done when this script passes.
6. **Documentation**: Consider after the feature is functional whether it needs to be conventionally maintained or understood. If so, then it needs documenting for purpose and intent. Update existing docs or create new ones as appropriate.
