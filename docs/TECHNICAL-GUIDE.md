# TaskDock technical guide

[English README](../README.md) · [中文说明](../README.zh-CN.md)

## The product model

A task type is a reusable capability with instructions, checks, reviewed knowledge, tool configuration and optional serial Team stages. Its draft can change; its stable releases are immutable snapshots tied to digests and per-task Git history. The control plane exposes discovery and isolated invocation through MCP and HTTP.

Definitions form a DAG. A parent pins a child's release ID and digest and declares an inputMap. Each invocation expands those definitions into a private request tree; it does not share another invocation's conversation. Forking produces a separate draft with source provenance. Upgrading a child does not silently rebind parents.

## Request lifecycle

1. Discover a suitable stable capability with `taskdock_search` or `taskdock_plan`.
2. Call `taskdock_open_session` for this caller conversation. Keep its token private.
3. Submit minimal input with `taskdock_submit` and a unique idempotency key. Optional authorization can narrow, never expand, the service-issued Mandate.
4. Poll `taskdock_get_run` or receive durable updates through `taskdock_receive`.
5. For human questions, present the saved typed fields and submit the actual answer through `taskdock_answer`. Reconciliation requires evidence, not a model guess.
6. Deduplicate message IDs, process them, then call `taskdock_ack`. Use `taskdock_nack` for delayed redelivery.

States include queued, running, waiting_human, waiting_children, succeeded, needs-attention, failed, interrupted and cancelled. Pending questions are not failures. Retry preserves the same Run and capability snapshot while adding an Attempt. Revoked work cannot be reauthorized by an answer or retry.

## Durability and authorization

SQLite stores request state, persistent Effects, leased/fenced Attempts, checkpoints, tool intents/receipts, human questions and the Outbox. Terminal business state and its Outbox event commit together. Files are rebuildable projections; `/health.archivePending` exposes pending archive writes.

An executor can resume committed stages. Completed same-stage/tool/argument receipts can be reused. A crash after an external action but before its receipt creates an uncertain outcome: require reconciliation before continuing. This does not provide exactly-once external effects or token-perfect model replay.

Mandates limit actions, tools, task dependencies, deadlines and budgets. Descendants share the root tool budget. Authorization is rechecked at execution and recovery boundaries; cancellation and revocation stop descendants. Default limits are 24 hours, 24 tool calls per tree and three failed/interrupted attempts, with a maximum graph depth of eight and 40 expanded nodes.

## Model and resource boundaries

Pi stages receive only their pinned capability, approved knowledge and this request's input, prior stage outputs, answers, completed receipts and declared child results. Ambient user settings, other chats, default shell and file tools are not loaded. MCP tools must be explicitly configured and allowed. This is application isolation, not an OS sandbox.

## Releases, learning and sharing

Test the exact draft digest before promotion. Learning creates a reviewed proposal; approval updates draft and requires another test and explicit promotion. Exported Registry packages omit runtime histories, example inputs, connections and credential references. Packages containing instance-specific composite dependency references are rejected until portable dependency packaging exists.

## Interface languages

English is the default. The header language button selects English or Simplified Chinese; each service origin remembers its own preference. Close an editing dialog before switching language. Only authored interface literals are translated. Task names, configuration, human questions, model outputs, histories and raw server diagnostics stay in their original language. HTTP failures include a localized status summary followed by the original diagnostic.

## Operating locally

Use Node 24+ and Git. `npm ci`, `npm run local:start`, and `npm run demo:reliability` start the local example. Ports default to 4640 and 4641. Credentials belong in restricted local environment files, not manifests. Stop both services before `npm run backup` for a coordinated database/file restore point. Do not expose the local console without independently reviewed authentication and deployment controls.

Detailed contracts: [protocol](PROTOCOL.md), [reliability](RELIABILITY.md), [architecture](ARCHITECTURE.md) (Chinese). Changes to those contracts must preserve the invariants above.
