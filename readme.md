# Code Learning Platform

## Target architecture

This document describes the target production architecture. The current repository is still a prototype based on a uni-app client, a static admin site, an Express API, SQLite/JSON persistence, an in-process judge queue, and Docker-based execution. The migration plan at the end of this document moves the system toward the target incrementally.

The architecture deliberately separates the user application from the administration application while retaining one modular application API. Code execution is a separate infrastructure and security domain because it runs untrusted user input.

```text
                                      Internet
                                         |
                                  CDN / WAF / TLS
                                         |
                        +----------------+----------------+
                        |                                 |
                User application                  Admin application
                React Native / Expo               Next.js
                Independent release               Independent release
                        |                                 |
                        +----------------+----------------+
                                         |
                              Load balancer / API ingress
                                         |
                          +--------------+---------------+
                          |                              |
                   Application API                Notification gateway
                   Modular monolith               SSE (WebSocket later
                   - auth and users               if required)
                   - learning/problems                   |
                   - community                           |
                   - admin/RBAC                    Redis pub/sub
                   - submissions                         |
                   - audit/events                        |
                          |                              |
              +-----------+-----------+                  |
              |           |           |                  |
         PostgreSQL     Redis     Transactional          |
         source of      cache,       outbox              |
         truth          rate limit      |                |
                                      event               |
                                        |                 |
                                  Judge control plane ----+
                                        |
                                     RabbitMQ
                               durable jobs and DLQ
                                        |
                    +-------------------+-------------------+
                    |                   |                   |
              Python pool          Java pool          Other runtimes
              trusted worker       trusted worker     added as needed
                    |                   |                   |
                    +-------------------+-------------------+
                                        |
                              Fresh sandbox per attempt
                            gVisor + Kubernetes RuntimeClass
                      CPU / memory / PID / time / disk / network limits
                                        |
                                 Trusted checker
                                        |
                              Idempotent result update
                                        |
                                    PostgreSQL

                     Object storage: versioned testcase bundles,
                         large artifacts, and execution logs
```

## Architectural principles

1. **PostgreSQL is the system of record.** Redis and RabbitMQ must never be the only place where a submission or result exists.
2. **User and admin clients are separate applications.** They have independent deployments, dependencies, release schedules, and security policies.
3. **Authorization is enforced by the API.** A separate admin site or a hidden UI control is not a security boundary.
4. **The application starts as a modular monolith.** Auth, learning, community, admin, and submission modules remain in one deployable API until scale or organizational ownership justifies another split.
5. **The judge is an independent trust domain.** The API and control plane never execute user code.
6. **Every execution attempt gets a new disposable sandbox.** Sandboxes are not shared between submissions.
7. **Queue delivery is at least once.** Consumers and result updates must therefore be idempotent.
8. **Scale from measured demand.** Kubernetes and KEDA scaling rules are driven by queue latency, queue depth, runtime capacity, and service-level objectives.

## Applications

### User application

The user-facing application is built and deployed independently from the admin application. Its responsibilities include:

- Authentication and account management
- Learning content and progress
- Problem browsing
- Code runs and submissions
- Submission status and result display
- Community features

The target client is React Native with Expo. During migration, the existing uni-app client can continue using the same versioned API.

### Admin application

The administration application is a separate Next.js deployment. Its responsibilities include:

- User and role management
- Problem authoring and testcase-version management
- Submission and judge operations
- Community moderation
- Audit-log and analytics views

Production admin access should require MFA or an external identity provider, shorter sessions, stricter rate limits, and comprehensive audit logging. Admin authorization remains enforced server-side through role- or permission-based policies.

### Shared client contracts

The API publishes an OpenAPI specification. Mobile and admin clients use generated SDKs rather than maintaining handwritten, divergent request types. Shared packages may contain generated API types, validation schemas, and UI-neutral utilities; they must not contain client-specific business logic.

## Application API

The application API is a stateless, horizontally scalable modular monolith. Suggested route groups are:

```text
/api/v1/auth/...
/api/v1/users/...
/api/v1/learning/...
/api/v1/problems/...
/api/v1/community/...
/api/v1/submissions/...
/api/v1/admin/...
```

Each module owns its domain logic and database access. Cross-module access occurs through explicit application interfaces rather than importing another module's internal storage code.

The API is responsible for:

- Authentication, authorization, validation, and rate limiting
- Creating submissions and returning stable submission IDs
- Persisting domain state in PostgreSQL
- Writing integration events to a transactional outbox
- Serving query APIs for clients
- Emitting structured logs, metrics, and traces

The API is not responsible for compiling or running user code.

## Data and infrastructure responsibilities

| Component | Responsibility | Must not be used for |
| --- | --- | --- |
| PostgreSQL | Users, roles, problems, testcase metadata, submissions, attempts, results, audit records, outbox events | Executing jobs or storing large binary bundles |
| Redis | Cache, distributed rate limits, short-lived coordination, notification fan-out | Canonical submissions or canonical results |
| RabbitMQ | Durable judge-job delivery, acknowledgements, retries, routing, dead-letter queues | Long-term submission history |
| Object storage | Immutable/versioned testcase bundles, large logs, optional artifacts | Authorization decisions or mutable job state |

PostgreSQL requires migrations, automated backups, point-in-time recovery, restore testing, connection pooling, and production high availability appropriate to the deployment environment.

## Submission lifecycle

### API contract

```text
POST /api/v1/submissions
  -> 202 Accepted
  -> { submissionId, status: "RECEIVED" }

GET /api/v1/submissions/{submissionId}
  -> current durable state and permitted result details

GET /api/v1/submissions/{submissionId}/events
  -> SSE stream for progress and terminal status
```

SSE is the initial notification mechanism because the primary requirement is server-to-client progress delivery. WebSocket support should be added only if bidirectional realtime behavior is required.

### Durable workflow

1. The API validates authentication, problem version, language, source-size limits, and idempotency key.
2. In one PostgreSQL transaction, it creates the submission and an outbox event.
3. An outbox publisher sends a job containing identifiers and immutable version references to RabbitMQ.
4. A worker acknowledges the message only after it has durably recorded or completed the attempt according to the retry policy.
5. The worker downloads the authorized testcase bundle, creates a fresh sandbox, executes the submission, and runs the trusted checker.
6. The result service performs an idempotent state transition in PostgreSQL.
7. A result event is published for cache invalidation, analytics, and SSE notification.

Jobs contain references, not hidden testcase contents. Access to testcase bundles uses workload identity or short-lived credentials.

### State model

```text
RECEIVED -> QUEUED -> RUNNING -> ACCEPTED
                              -> WRONG_ANSWER
                              -> COMPILE_ERROR
                              -> RUNTIME_ERROR
                              -> TIME_LIMIT_EXCEEDED
                              -> MEMORY_LIMIT_EXCEEDED
                              -> CANCELLED
                              -> INFRA_ERROR
```

Every execution has a distinct attempt number. State updates use the submission ID, attempt number, and expected current state so that late or duplicated worker messages cannot overwrite a newer result.

### Delivery and recovery rules

- Queue delivery is at least once; workers must tolerate duplicate messages.
- Submission creation accepts an idempotency key to prevent duplicate client retries.
- Workers use leases and heartbeats for long-running jobs.
- Expired leases are requeued only when the attempt remains eligible for retry.
- Infrastructure failures use bounded exponential backoff and a maximum-attempt policy.
- Deterministic user outcomes such as compile errors and wrong answers are not retried.
- Poison jobs are moved to a dead-letter queue and remain visible to operators.
- A reconciliation process detects submissions stuck in non-terminal states.
- Graceful shutdown stops accepting new work, extends or releases leases safely, and finishes or abandons current attempts according to policy.

## Judge domain

### Control plane

The judge control plane manages job publication, leases, runtime policy, attempt metadata, reconciliation, and result acceptance. It is a trusted service and does not mount the container runtime socket or execute submitted source code.

### Workers and runtime pools

Workers share a common job and result protocol. Runtime-specific deployments may be created for Python, Java, C++, or JavaScript when their images, resource profiles, or scaling characteristics differ. Separate codebases are not required merely because languages differ.

RabbitMQ routing keys can route jobs to compatible pools:

```text
judge.python
judge.java
judge.cpp
judge.javascript
```

Runtime images are pinned by digest, scanned, signed where practical, and pre-pulled on judge nodes. Image names and execution commands are deployment-controlled configuration rather than freely editable application data.

### Sandbox boundary

Each attempt runs in a new sandbox with:

- gVisor `RuntimeClass` on a dedicated judge node pool
- Non-root user and no privilege escalation
- Dropped Linux capabilities
- Read-only root filesystem
- No Kubernetes service-account token
- Default-deny network access
- CPU, memory, PID, wall-time, output, and ephemeral-disk limits
- Seccomp and AppArmor/SELinux controls where supported
- Automatic termination and cleanup

The checker is trusted code outside the untrusted execution container. Workers and sandboxes cannot read arbitrary platform secrets or access the application database directly.

## Security

- Production startup fails if required secrets or dependencies are missing.
- Secrets are supplied through a managed secret store and rotated.
- Passwords use a reviewed password-hashing implementation and parameters.
- Admin accounts use MFA or federated identity where possible.
- CORS uses explicit user-app and admin-app origin allowlists.
- Authentication, submission, and admin routes have separate rate-limit policies.
- Request bodies and submitted source have strict size limits.
- Hidden testcases are never returned by user-facing APIs.
- Testcase bundles are encrypted and versioned in object storage.
- All privileged admin changes and result overrides produce immutable audit events.
- Dependencies, runtime images, and build artifacts are scanned in CI.
- Network policies isolate application, data, broker, and judge namespaces.

## Observability and service objectives

All services use OpenTelemetry and propagate a correlation context containing the request ID, submission ID, attempt number, and trace ID. Logs are structured and must not contain passwords, tokens, submitted secrets, or hidden testcase contents.

Prometheus/Grafana dashboards should cover:

- API request rate, latency, errors, and saturation
- Submission end-to-end and queue-wait latency by language
- Queue depth, oldest-message age, retries, and dead-letter count
- Worker capacity, sandbox startup time, and infrastructure failures
- Outcome distribution and checker failures
- PostgreSQL, Redis, RabbitMQ, and object-storage health

Initial service-level indicators should include API availability and the percentage of submissions reaching a terminal state within a defined time. Alerts should be derived from service objectives rather than raw CPU usage alone.

## Deployment topology

```text
Kubernetes cluster
|
+-- edge namespace
|   +-- ingress / certificate integration
|
+-- application namespace
|   +-- application-api (multiple replicas)
|   +-- notification-gateway (multiple replicas)
|   +-- outbox-publisher
|
+-- judge namespace
|   +-- judge-control-plane
|   +-- runtime worker pools
|   +-- disposable gVisor sandboxes
|
+-- observability namespace
    +-- OpenTelemetry collectors
    +-- Prometheus / Grafana integration
```

Managed PostgreSQL, Redis, RabbitMQ, and object storage are preferred when available. Judge nodes are isolated from general application workloads. KEDA scales runtime pools from queue depth and oldest-message age, with configured minimums, maximums, stabilization windows, and capacity limits.

The user app, admin app, API, control plane, and worker images have separate CI/CD pipelines. Database migrations run as an explicit deployment step. Deployments use readiness, liveness, startup probes, graceful termination, rolling or canary rollout, and automatic rollback criteria.

Example public endpoints:

```text
app.example.com       User web entry if applicable
admin.example.com     Administration application
api.example.com       Application API and SSE
```

The mobile application is distributed independently and calls the same versioned API.

## Suggested repository layout

```text
apps/
  mobile/                 React Native / Expo user application
  admin-web/              Next.js administration application
  api/                    Modular application API

services/
  judge-control-plane/    Queue, lease, reconciliation, result coordination
  judge-worker/           Shared worker implementation

packages/
  api-client/             Generated OpenAPI client
  contracts/              Shared protocol schemas
  observability/          Logging, metrics, and tracing setup
  config/                 Typed configuration loaders

deploy/
  kubernetes/             Manifests or Helm charts
  observability/          Dashboards and alert rules
```

Sharing generated contracts is encouraged. Sharing database repositories or importing another service's internal modules is not.

## Migration plan

### Phase 1: establish production foundations

- Define the OpenAPI contract and generated clients.
- Add centralized validation, errors, structured logging, correlation IDs, rate limiting, and explicit CORS policies.
- Remove fallback production secrets and default administrator credentials.
- Add automated unit, integration, API-contract, and security tests.

### Phase 2: separate clients and durable storage

- Create independent mobile and Next.js admin applications and pipelines.
- Keep the existing clients operational during gradual migration.
- Replace SQLite and JSON stores with PostgreSQL migrations and repositories.
- Add audit records and explicit role/permission policies.

### Phase 3: asynchronous judge

- Add durable submission and attempt tables plus the transactional outbox.
- Introduce RabbitMQ, retry policy, dead-letter queues, and idempotent consumers.
- Return submission IDs immediately and provide query plus SSE APIs.
- Move all code execution out of the application API process.

### Phase 4: hardened sandbox platform

- Deploy dedicated judge nodes and gVisor runtime classes.
- Use fresh disposable sandboxes and versioned object-storage bundles.
- Add runtime image signing/scanning, workload identity, and network policies.
- Perform adversarial sandbox, resource-exhaustion, and escape testing.

### Phase 5: scale and resilience

- Add KEDA policies based on measured queue behavior.
- Test duplicate delivery, worker loss, broker loss, database failover, and regional dependency degradation.
- Define service objectives, alerts, backup recovery targets, and incident runbooks.
- Conduct load, soak, chaos, restore, and disaster-recovery exercises.

Microservices beyond the judge boundary should be introduced only when independent scaling, security isolation, deployment cadence, or team ownership provides a measured benefit.
