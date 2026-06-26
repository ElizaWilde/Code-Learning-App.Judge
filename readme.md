# Code Learning App & Judge

A small self-hosted code-learning web app with a Node.js backend judge service and a static frontend. This repository contains a frontend learning app (`code-learning-app`) and a backend judge + API (`cl-app-backend`).

## Overview

- Frontend: a static/uni-app based learning interface in `code-learning-app`.
- Backend: Node.js judge service, APIs and data in `cl-app-backend`.

This project provides lessons, practice tasks, a simple code judge, and community features used for learning programming concepts.

## Repository structure

- `cl-app-backend/` — Node.js backend (server.js, judge, data files)
- `code-learning-app/` — Frontend app (HTML, UVue pages, assets)
- `README.md` — This file

Key backend subfolders:

- `cl-app-backend/src/` — TypeScript/JS source files (server, judge, db, auth)
- `cl-app-backend/data` — SQLite database files (runtime and backups)

## Requirements

- Node.js (v14+ recommended)
- npm (or yarn)
- Optional: `npx http-server` (or any static file server) to serve the frontend

## Quick start

1) Backend (Windows)

```powershell
cd cl-app-backend
npm install
# Start the backend (options):
#  - use the bundled script if present
#  - or run node directly
node server.js
# or on Windows you can run
start-backend.cmd
```

Backend notes:
- The backend uses local SQLite DB files stored under `cl-app-backend/data` and `cl-app-backend/data-runtime`.
- If you need to reset runtime DB files, check `data-runtime-clean` for clean copies.

2) Frontend (serve static files)

Option A — lightweight static server (recommended for local testing):

```bash
cd code-learning-app
npx http-server -c-1
# Then open http://localhost:8080 (or the port shown by http-server)
```

Option B — open `code-learning-app/index.html` directly in a browser (some features may require a server).

If the frontend contains a package.json and dev scripts (e.g., a Uni-app setup), you can also:

```bash
cd code-learning-app
npm install
npm run dev     # if provided
```

## Config & runtime files

- Backend configuration is in `cl-app-backend/` source files such as `server.js` and `tsconfig.json`.
- Persistent databases: `cl-app-backend/data/*.db*` and runtime copies in `data-runtime/`.

## Development

- Backend source lives in `cl-app-backend/src/`. Modify and restart the backend to pick up changes.
- Frontend views and pages are under `code-learning-app/pages/`.

Run linters/tests if present via `npm test` or similar scripts in each subproject.

## Contributing

1. Fork the repo and create a feature branch
2. Open a PR with a clear description of changes
3. Prefer small, focused commits and include reproducible steps for testers

## License



