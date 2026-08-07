# Spec Kit for DACN-Traffic-ETL

This repository now includes a **project-local Spec Kit scaffold** so future work can follow a spec-driven workflow even before the `specify` CLI is installed on every machine.

## What is included

- `constitution.md`: project principles and hard constraints
- `../CONTEXT.md`: shared domain language for humans and coding agents
- `specs/`: feature specifications, plans, and tasks
- `templates/`: lightweight local templates aligned to this repository

## Recommended setup

Spec Kit's official CLI is `specify`. The upstream project recommends installing it with `uv`.

### Windows PowerShell

```powershell
python -m pip install specify-cli
specify init --here --force --integration copilot --script ps
```

If your environment uses `uv`, prefer the upstream install flow from the Spec Kit docs.

## Suggested workflow for this repository

1. Update or review `.specify/constitution.md`
2. Review `CONTEXT.md` so repo terminology stays consistent
3. Create a feature folder under `.specify/specs/`
4. Write `spec.md` with the **what** and **why**
5. Write `plan.md` with architecture and implementation choices
6. Write `tasks.md` with ordered executable work
7. Implement only after spec/plan/tasks are coherent

## Copilot-oriented prompts

When using GitHub Copilot or another coding agent, mirror the Spec Kit process with prompts like:

- `/speckit.constitution` → update repository principles
- `/speckit.specify` → describe the requested feature in user terms
- `/speckit.plan` → describe implementation and architecture choices
- `/speckit.tasks` → generate dependency-ordered tasks
- `/speckit.implement` → execute the approved tasks

This repository keeps the initial scaffold intentionally lightweight and project-local so it does not block current ETL automation work.
