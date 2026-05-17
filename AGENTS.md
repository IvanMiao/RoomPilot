# AGENTS

## Scope

This project uses:

- TypeScript
- React
- Next.js

All code must optimize for readability first. Prefer simple, explicit code over clever abstractions.

## Core Rules

- Write code for the next reader, not for the shortest diff.
- Keep files focused. One file should usually have one primary responsibility.
- Prefer plain data flow over indirection.
- Avoid premature abstractions.
- If a helper hides important logic, keep the logic inline instead.

## TypeScript

- Use strict typing. Do not use `any` unless there is a documented boundary reason.
- Model domain data with named types or interfaces.
- Prefer narrow unions over loose strings where possible.
- Validate external input at boundaries.
- Keep function signatures small and explicit.
- Prefer return types that are obvious and stable.

## React

- Use function components only.
- Keep components small and composable.
- Separate view components from data/loading logic when the file starts getting dense.
- Derive UI state when possible; do not duplicate state.
- Do not use `useMemo` or `useCallback` by default.
- Use effects only for real side effects, not for ordinary data shaping.
- Keep JSX shallow and easy to scan.

## Readability

- Favor short functions.
- Use descriptive names. Avoid vague names like `data`, `item`, `handleStuff`, `utils`.
- Keep branching simple. If logic becomes nested, extract a well-named helper.
- Comments should explain non-obvious intent, not restate the code.
- Every module should be understandable from top to bottom.

## File Structure

- Directory depth must not exceed 3 levels from the repo root.
- Prefer a small number of clear top-level folders.
- Group by feature first, then by file role only when needed.

Recommended shape:

- `app/`
- `components/`
- `features/`
- `lib/`
- `types/`

Allowed example depths:

- `app/page.tsx`
- `features/search/api.ts`
- `features/search/components/ResultCard.tsx`

Avoid deeper trees such as:

- `features/search/components/cards/internal/ResultCard.tsx`

## Default Standard

Before adding code, ask:

- Is this the simplest readable version?
- Can a new contributor understand this file quickly?
- Is the folder placement obvious?

If not, simplify it.
