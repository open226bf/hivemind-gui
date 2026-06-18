# Contributing to hivemind-gui

`hivemind-gui` is the Angular web UI for [Hivemind](https://github.com/open226bf/hivemind).
Contribution conventions (branching, commit style, Code of Conduct, security
reporting) are shared across the project and live in the control-plane repo:

- **Contributing guide:** <https://github.com/open226bf/hivemind/blob/main/CONTRIBUTING.md>
- **Code of Conduct:** <https://github.com/open226bf/hivemind/blob/main/CODE_OF_CONDUCT.md>
- **Security policy:** <https://github.com/open226bf/hivemind/blob/main/SECURITY.md>

## Local development

```bash
npm install
npm start          # dev server on http://localhost:4200, proxies /api → :8081
```

You need a running control plane for the API. See the
[Quick start](https://open226bf.github.io/hivemind-doc/start/quick-start/).

## Before opening a PR

```bash
npx prettier --check "src/**/*.{ts,html,scss}"   # formatting
npx tsc -p tsconfig.app.json --noEmit             # type-check
npx ng test --no-watch                            # unit tests (vitest)
npx ng build --configuration production           # build
```

CI runs all of the above on every pull request.

## Conventions

- Standalone components, Angular signals for state, `takeUntilDestroyed()` for
  long-lived subscriptions.
- PrimeNG components + the shared theme in `src/app/theme.ts`. Prefer theme
  tokens / CSS variables over hard-coded colors.
- Keep API types in `src/app/core/models.ts` aligned with the backend DTOs.
