# Repository Guidelines

## Project Structure & Module Organization

BugChain is a Vite + React frontend with a Soroban smart contract workspace. Frontend code lives in `src/`: `main.jsx` mounts the app, `App.jsx` owns view state, `components/` holds reusable navigation UI, `views/` contains screens, and `assets/` stores imported images. Static files live in `public/`. Generated output goes to `dist/` and should not be edited by hand. Smart contracts live under `contracts/`, with the main Rust contract in `contracts/bug_bounty/src/lib.rs`.

## Build, Test, and Development Commands

- `npm install`: install frontend dependencies from `package-lock.json`.
- `npm run dev`: start the Vite dev server with HMR.
- `npm run build`: create the production bundle in `dist/`.
- `npm run lint`: run ESLint over JavaScript and JSX files.
- `npm run preview`: serve the built frontend locally for smoke testing.
- `cd contracts; cargo build --target wasm32-unknown-unknown --release`: compile the Soroban contract to WASM.
- `cd contracts; cargo test`: run Rust contract tests when test modules are added.

## Coding Style & Naming Conventions

Use ES modules and functional React components. Component and view files use PascalCase names such as `TopNavBar.jsx` and `BountyMarketplace.jsx`; local handlers use descriptive camelCase names like `handleSelectBounty`. Keep JSX indentation at two spaces and follow the existing single-quote, semicolon style. Reuse existing CSS files and utility class patterns before adding new styling. Rust contract code should follow `rustfmt` and clear storage key naming in `DataKey`.

## Testing Guidelines

No frontend test framework is currently configured. For UI changes, run `npm run lint` and smoke test affected flows with `npm run dev` or `npm run preview`. If adding frontend tests, prefer colocated `*.test.jsx` files near the component or view under test. For contracts, add Rust unit tests in `contracts/bug_bounty/src/lib.rs` or a dedicated test module, then run `cargo test` from `contracts/`.

## Commit & Pull Request Guidelines

This checkout does not expose Git history, so use concise imperative commit subjects such as `Add bounty submission validation` or `Fix contract reward accounting`. Keep each commit focused. Pull requests should include a summary, testing performed, linked issue or task when available, and screenshots for visible UI changes. Note contract ABI or deployment-impacting changes explicitly.

## Security & Configuration Tips

Do not commit private keys, wallet seed phrases, deployment accounts, or generated contract secrets. Keep Soroban network and contract IDs in environment-specific configuration once integration code is added.
