⏺ Read the full source. Honest assessment:

  What it is: ~30KB TS, your own library, v0.1.1, last push 2026-05-04, 0 deps beyond uuid. Three concepts: WorkflowEngine (sequential step runner), WorkflowContext (passes data +
  collects errors), WorkflowObserver (start/complete/error hooks).

  What it does well: clean shape. addStep builder, BasicStep/ConditionalStep primitives, observer pattern is the right seam for "write step results to PG". TypeScript generics on
  input/result. The observer interface is exactly where a PostgresObserver would hook in to persist every step start/complete/error to a workflow_step table.

  What it does NOT do (the load-bearing gaps):
  1. No durability. Context is in-memory. Process crash mid-workflow = workflow lost. The metadata bag is a JS object.
  2. No resumability. No "pick up at step N" — execute() always starts from step 0.
  3. No retry/backoff. A failing step either stops the workflow or continueOnError: true swallows and moves on. No retry policy, no exponential backoff, no max-attempts.
  4. No idempotency. If you crash after step 3 succeeds and resume, step 3 re-runs.
  5. No sleeps / waits / timers. Can't express sleep("30s") or waitForEvent("server-ready") — both are core to provision-server/deploy-app today.
  6. No concurrency. The maxConcurrency option exists but is unimplemented (// future: support parallel execution in code).

  The honest verdict: executorjs is a fine in-process step runner primitive, but it is not a replacement for Inngest. Inngest's value isn't the step API — it's the durable execution
  engine underneath. To replace Inngest with PG + executorjs, we'd need to build:
  - workflow_run + workflow_step tables (state)
  - A poll-on-startup recovery loop ("find runs where status=running, resume at first non-completed step")
  - A retry policy with backoff + max-attempts per step
  - A step.sleep() equivalent backed by PG (status=sleeping_until=<ts> + a tick that wakes them)
  - A step.waitForEvent() equivalent backed by pg_notify + a waiters table
  - A PostgresObserver that writes every transition

  That's a meaningful chunk of code — 500-1000 LOC plus tests — but it's not infinite. The shape is well-understood (it's what Inngest does internally). And we already have the Phase 4
  substrate experience.

  My recommendation: treat executorjs as a starting point but expect to fork it (or PR upstream) to add WorkflowStateStore as a pluggable interface that the engine consults before/after
  every step. Without that, every workflow we run with it is fragile against restarts. If you want, I can sketch the minimal "executorjs + PG state store" shape — what the new interfaces
  look like, what stays in your lib, what lives in apps/api. Or skip executorjs entirely and build the step-runner native in apps/api since the surface area is small (~5 step types we
  actually use in our workflows).

  Want the sketch?

✻ Brewed for 1m 8s · 4 shells still running

❯ can we build or add to it postgresq/sql/redis/sqlite to do the following?
    What it does NOT do (the load-bearing gaps):
    1. No durability. Context is in-memory. Process crash mid-workflow = workflow lost. The metadata bag is a JS object.
    2. No resumability. No "pick up at step N" — execute() always starts from step 0.
    3. No retry/backoff. A failing step either stops the workflow or continueOnError: true swallows and moves on. No retry policy, no exponential backoff, no max-attempts.
    4. No idempotency. If you crash after step 3 succeeds and resume, step 3 re-runs.
    5. No sleeps / waits / timers. Can't express sleep("30s") or waitForEvent("server-ready") — both are core to provision-server/deploy-app today.
    6. No concurrency. The maxConcurrency option exists but is unimplemented (// future: support parallel execution in code).


⏺ Yes — and the shape executorjs already has is most of the way there. The Engine + Context + Step + Observer split is the right seam. What's missing is one new core interface
  (WorkflowStateStore) and one architectural rule (every step checkpoints before/after execution). Once those land, the six gaps map to concrete additions in clean order:

  1. Durability → WorkflowStateStore interface in core, adapters per backend.
  interface WorkflowStateStore {
    saveRun(run: { id, name, input, status, startedAt }): Promise<void>;
    loadRun(id: string): Promise<RunRow | null>;
    saveStep(step: { runId, name, attempt, status, output, error, startedAt, endedAt }): Promise<void>;
    loadStep(runId: string, name: string): Promise<StepRow | null>;
    listIncompleteRuns(): Promise<RunRow[]>;
  }
  Adapters: PostgresStateStore (the production one — uses two tables, workflow_run and workflow_step, SELECT ... FOR UPDATE SKIP LOCKED for lease), SqliteStateStore (zero-config local dev
   / tests), RedisStateStore (rejectable — Redis isn't durable enough for this; only useful for ephemeral cache layer in front of PG). Recommend PG as the only production target; SQLite
  for dev parity.

  2. Resumability → engine.resume(workflowId) + step naming as the cache key.
  Engine calls loadStep(runId, step.name) before each step. If status='done', skip and inject the cached result into context. If status='running' (crashed mid-step), re-run from scratch
  (because we don't know how far it got). This makes step names load-bearing — must be stable across deploys. Same constraint Inngest has.

  3. Retry/backoff → per-step RetryPolicy + engine wraps execute in a retry loop.
  new BasicStep('install-docker', fn, {
    retry: { maxAttempts: 3, backoff: 'exponential', initialDelayMs: 1000 }
  });
  Engine persists attempt count to PG. Final-failed attempt sets step.status='failed' and the run errors out (or continueOnError proceeds, matching today's behavior).

  4. Idempotency → falls out of (2) for free.
  Once loadStep returns status='done', the step never re-runs in this run. No work needed in step functions. This is the key property — step authors don't have to write idempotent code,
  the engine guarantees once-only-per-step.

  5. Sleeps / waits → two new step types + a tick process.
  - SleepStep('wait-30s', '30s'): writes step.status='sleeping', wake_at=now()+30s and returns control to the engine, which marks the run status='waiting' and exits. A separate "tick"
  worker (or Inngest cron, ironically) polls WHERE status='sleeping' AND wake_at < now() every N seconds and calls engine.resume(runId).
  - WaitForEventStep('server-ready', matcher): writes a row to workflow_waiter table, returns control. Event producers (e.g. apps/api POST /servers/:id/ready) write to PG + pg_notify. A
  subscriber matches waiters by predicate and resumes the run. Same pattern Inngest's step.waitForEvent uses internally — just hand-rolled.

  6. Concurrency → two flavors, both small.
  - Within a single run (parallel branches): add ParallelStep that takes WorkflowStep[] and awaits with Promise.allSettled. Each branch persists independently. The existing maxConcurrency
   knob becomes a Semaphore around the parallel await.
  - Across runs on multiple api pods: SELECT ... FOR UPDATE SKIP LOCKED on the run row when resuming. Only one pod holds the lease. Lease has a TTL (lease_expires_at); the tick process
  steals leases past expiry. Standard pattern.

  ---
  The actual architectural decision: extend executorjs upstream, or fork.

  Extending upstream means the new interfaces ship in executorjs itself (you're the author — you can land them). The library becomes more useful for anyone, and we don't carry a fork. My
  pick: extend upstream. Concretely:
  - executorjs@0.2.0: WorkflowStateStore interface + in-memory default impl + engine.resume() + retry policy on steps. No breaking changes (default in-memory store keeps current
  behavior).
  - @executorjs/store-postgres@0.1.0: separate package, depends on pg or postgres. Owns the schema migrations.
  - @executorjs/store-sqlite@0.1.0: same shape for tests.
  - executorjs@0.3.0: SleepStep, WaitForEventStep, ParallelStep, and the tick-process API.
  - We adopt it in apps/api after 0.2.0 lands — first as a side-by-side pilot for one workflow (start with something simple like sweep-agent-command-queue), then expand.

  Total new code in executorjs: I'd estimate 600-900 LOC including tests for the four additions. In apps/api: ~200 LOC to wire the store + tick process. We get full PG observability
  (SELECT-able workflow state), retry/sleep/wait in our control, and we can delete Inngest from the workflows we migrate.

  One tradeoff to flag: Inngest's dashboard, replay UI, and webhook integrations are real value-adds beyond just durable execution. If we replace Inngest, we own the dashboard too (or
  live with raw SQL queries). That's the price of owning the layer.

  Want me to draft the WorkflowStateStore interface + the two PG tables as a concrete proposal, so you can see exactly what would land in executorjs vs. apps/api?

✻ Worked for 53s · 4 shells still running

⏺ Background command "Wait for first /api/agent/* traffic after libya upgrade" completed (exit code 0)

⏺ (Sidebar: the leftover libya traffic-monitor task from earlier in the session finished — confirms libya is now receiving /api/agent/* traffic post-v0.12.1. Nothing to do; just closing
  the loop.)

  Back to the executorjs proposal — let me know if you want me to draft the WorkflowStateStore interface + PG tables as a concrete RFC, or if you'd rather pick a different starting point.

✻ Crunched for 14s · 3 shells still running

❯ For now, i'd bring this as a built-in package here. i'd copy the src from /Users/aliturki/devspace/workspaces/executorjs to here as a pckage.
  and will start using it for our workflow, as an internative to inngest. and suport all above features. i'd do it in memory/redis/sql/postgres based on the adapter. but one thing want
  to do it. by it, i want to replace redis on the agent as well. for example, want it to be an alternative to inngest with the support that can handle different node, seprate events by
  nodes.

  you get what i mean? what do you understand?

⏺ Yes, I get it. Restating to confirm:

  The vision: packages/executorjs/ becomes a built-in package (copied from /Users/aliturki/devspace/workspaces/executorjs) that does two jobs with one substrate:

  1. Replace Inngest for api-side workflows (deploy-app, provision-server, sweep crons) — durable steps, retry, sleep, waitForEvent, all backed by PG via a pluggable StateStore (memory /
  sqlite / redis / postgres adapters).
  2. Replace Redis pub/sub on the agent dispatch path — agent_command_queue long-poll + cmd:<id> channels become just one specialization of executorjs's event bus. The api publishes
  events into executorjs; the agent (also running an executorjs runtime) subscribes to events scoped to its own nodeId. Cross-node isolation is first-class — events for node A never reach
   node B.

  The key architectural primitive that makes both work is node-scoped event subscriptions. Concretely:

  // api-side: workflow step targeting a specific node
  await ctx.publish("cmd.exec", { nodeId: "lib-23" }, { type: "app.deploy", payload: {...} });
  const ack = await ctx.waitForEvent("cmd.ack", { match: { cmdId } }, { timeout: "10m" });

  // agent-side: same library, subscribed only to its node's events
  runtime.subscribe("cmd.exec", { match: { nodeId: self.nodeId } }, async (evt) => {
    const result = await executeCommand(evt.payload);
    await runtime.publish("cmd.ack", { cmdId: evt.payload.id, nodeId: self.nodeId }, result);
  });

  The event bus is partitioned by nodeId (and probably orgId too) — PG implements this with LISTEN/NOTIFY on channels like evt.node.<nodeId> plus a row in workflow_event for
  durability/replay; Redis implements it with PSUBSCRIBE evt.node.<nodeId>.* for fire-and-forget. Same API surface, different durability guarantees, picked per-event-type.

  The agent stops being a special case. It runs the same executorjs runtime as the api, just with subscribe instead of publish as its primary mode, and its scope filter is nodeId == self.
   Long-poll, ack-with-result, log streaming — all become standard executorjs primitives instead of bespoke /api/agent/longpoll + cmd:<id> Redis channels.

  What this collapses:
  - Inngest workflows → executorjs workflows
  - agent_command_queue long-poll endpoint → executorjs subscribe with nodeId scope
  - Redis cmd:<id> pub/sub for log streaming → executorjs streaming events (probably Redis adapter for high-volume, PG for durable)
  - dispatch-bus.ts + publish.service.ts + long-poll.ts → one runtime.publish() call
  - Per-command audit (agent_command table) → workflow_event table + state store

  Questions I want your call on before sketching the package skeleton:

  1. Event bus adapter split — should subscribe always go through the durable store (PG LISTEN/NOTIFY, slower but replay-capable), or do we let each event type pick { transport: "redis" |
   "postgres" } based on its volume profile? Stdout chunks are 1000s/sec, fire-and-forget; cmd.ack is 1/sec, must-not-lose.
  2. Workflow vs. plain pub/sub — does the agent run workflows (multi-step, durable, resumable) for each command, or just a flat subscribe-execute-publish loop? Today an agent command is
  a single SSH execution; if it's always one step, the workflow machinery is overkill for the agent side — agent just needs the subscription API + publish API, not the durable state
  engine. The api side runs full workflows that wrap those publish/subscribe primitives.
  3. Scope hierarchy — is nodeId the only scope, or do we want (orgId, nodeId, deploymentId) as nested scopes that subscribers can pick from? E.g., admin observability subscribes to
  orgId=* to see fleet-wide; a per-deployment SSE subscribes to deploymentId=X only.
  4. Migration order — start by adopting executorjs in api only (replace one Inngest workflow as pilot, keep agent on existing Redis), then in a Phase 6 migrate the agent dispatch onto
  the same package? Or design + ship both seams together?

  My recommendation on the four:
  1. Per-event-type transport choice (let stdout pick Redis, cmd.ack pick PG)
  2. Agent runs the subscribe/publish API only — no workflow engine on the agent
  3. Scope hierarchy (orgId, nodeId, deploymentId), optional all-null = wildcard
  4. Pilot in api first, then agent — too much in flight otherwise

  Did I read the vision right? Anything you want to redirect before I draft the package layout?

✻ Churned for 1m 2s · 3 shells still running

❯ yes, but also thinking, take the following.
  we have a workflow, for example, a deployment is a workflow, and the workflow can have mutlpe steps, a step on the platform to maybe record the deployment in the database and a step in
   the node/agent to create an instance. but it's a workflow, can involve mutlple workers.

  for the transport, transport can be generic. but, we would have a minimal step, anything else can be plugged.

  can maybe by default have in memory/socket or something like that. if want, can add webhook interface as well.

  or what do you think if we use redpanda?

⏺ Got it — and the multi-worker framing changes the shape meaningfully. Restating to confirm:

  A workflow is one logical thing; its steps are claimed by different worker pools. A deploy workflow declares steps; each step is tagged with a target queue (e.g. "platform",
  "node:<id>"); workers register for queues and pull work via long-poll/socket/whatever the transport supports. The orchestrator is just a state machine driving workflow_step rows — it
  doesn't care where a step runs, just that someone on the right queue claims it and reports back. This is the Temporal / Inngest model, minus the proprietary runtime.

  const deploy = workflow("deploy-app", {
    steps: [
      step("record-deployment", { queue: "platform" }, recordInDb),
      step("create-instance",   { queue: "node:${input.nodeId}" }, createInstance),
      step("wait-ready",        { queue: "platform" }, waitForReady),
      step("install-app",       { queue: "node:${input.nodeId}" }, installApp),
      step("mark-running",      { queue: "platform" }, markRunning),
    ],
  });

  The api process registers a worker for "platform". The agent process registers a worker for "node:<self>". Same library, same step semantics, different queue subscriptions. Cross-node
  isolation is just queue naming — a node only claims work from its own queue.

  Transport interface (minimal core):
  interface Transport {
    enqueue(queue: string, step: StepRecord): Promise<void>;
    claim(queues: string[], workerId: string): Promise<StepRecord | null>;
    ack(stepId: string, result: StepResult): Promise<void>;
    fail(stepId: string, error: StepError, retryAt?: Date): Promise<void>;
    // For sleeps/waits — events are just enqueued steps with a topic
    publish(topic: string, attrs: Record<string,string>, payload: unknown): Promise<void>;
    subscribe(topic: string, match: AttrMatcher, handler: EventHandler): Unsubscribe;
  }

  That's it. Everything else is in the engine (workflow definition, state machine, retry policy, scheduling). Adapters ship as separate packages:

  Built-in (v1):
  - memory — Map-based, single process, for tests + dev.
  - socket — UNIX/TCP socket coordinator, multi-process single-host. Useful for local dev with split api/agent processes.
  - sql/postgres — production. task table + LISTEN/NOTIFY + SELECT FOR UPDATE SKIP LOCKED. This is what we already run in Phase 4 for agent_command_queue — we're just generalizing it.
  - sql/sqlite — same shape as PG, file-backed, for embedded/edge cases or local dev parity.

  Optional adapters (later, if needed):
  - webhook — for inbound event sources: external systems POST to our endpoint, executorjs ingests as events that resume waiting workflows. Stripe webhooks become this. Note: NOT for
  agent dispatch — agents long-poll us because they're behind NAT (Phase 1a tunnel mode work). Webhook ingress only.
  - redis-streams — if we need higher throughput on hot queues. XGROUP/XREADGROUP fits the worker-pool pattern. Skip unless we hit a real bottleneck.
  - redpanda / kafka — see below.

  On Redpanda specifically: the partitioning model (one partition per nodeId, ordered, consumer groups = worker pools) is a perfect shape match for what we're building. If we were
  starting fresh at scale, it'd be the right choice. But:
  - We already run Postgres + Redis. Adding Redpanda is a third durable substrate to operate, monitor, back up, upgrade.
  - Our scale today is hundreds of nodes, ~10s of commands/sec peak. PG LISTEN/NOTIFY + a task table handles this without breaking a sweat — we're running it now and the bottleneck is
  nowhere near transport.
  - Redpanda's wins (millions of messages/sec, replay, log compaction) don't unlock anything for us today.

  My pick: design the Transport interface clean enough that RedpandaTransport is ~300 LOC when we want it, but don't ship it in v1. Default to postgres in prod, memory in tests, sqlite
  for embedded dev. Webhook adapter for inbound external events. That's the minimal core that does all the jobs we have today.

  One concrete question before I sketch the package skeleton: does the agent run a worker that claims tasks (long-poll the queue, execute, ack — pull model) or does the api push to it
  (orchestrator decides which agent, sends, waits — push model)? Today we're pull (agent long-polls /api/agent/longpoll). Pull keeps NAT/firewall story simple. Sticking with pull means
  the agent worker is just transport.claim(["node:self"]) in a loop. Push would require inbound connectivity or tunnels — more complex. Recommend pull.

  Confirm the multi-worker model + transport split, then I'll draft the package layout (packages/executorjs/{core,transports,workers} etc.) and the first concrete workflow we'd port.

✻ Cooked for 1m 12s · 3 shells still running
