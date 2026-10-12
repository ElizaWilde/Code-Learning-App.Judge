# Backend characterization tests

Run the deterministic API and persistence suite:

```powershell
npm test
```

This suite copies `data-runtime-clean/app.db` into a temporary directory and
verifies the existing users and legacy column order survive startup. It covers
authentication and roles, public question responses, Run versus Submit,
token-derived submission identity, analytics persistence, and community
moderation. The Docker execution boundary is stubbed; routing, queues, stores,
and HTTP middleware are real.

Run the recorded Python and Java submissions against the real Docker judge:

```powershell
npm run test:judge:docker
```

The Docker suite requires a running Docker daemon and access to the configured
Python and Java images. Its golden inputs and expected results are stored in
`tests/fixtures/representative-submissions.json`.
