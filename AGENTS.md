# TaskDock development

Use uncontrolled forms by default. Never rebuild a page while an input is focused. Distinguish automated checks from human/device acceptance. Local maintainer rules also apply where configured.

Read docs/ARCHITECTURE.md and docs/PROTOCOL.md before changing contracts. Keep each run's request, config snapshot, events and artifacts private to that run. Runtime may only see its pinned capability snapshot and approved knowledge; never load other runs or ambient user agent settings. Learning creates a proposal, never silently modifies stable. Each stable release requires a passing test of the exact bundle digest. Never commit .data, request histories, keys, .env, backups or browser artifacts. Public registry packages contain allowlisted capability configuration only. No public deployment or repository visibility change without explicit maintainer authorization. The maintainer has explicitly authorized the current bilingual MIT open-source release; audit its contents before publishing.

Commands: npm ci; npm test; npm run check; npm start. Node 24+. Keep release records and docs/INDEX.md current. Do not claim live-model verification without an actual provider response. Built-in runners are explicitly deterministic, not an AI fallback.

Read docs/RELIABILITY.md before changing lifecycle or task graph behavior. Capability definitions form a DAG; every call gets a private Run tree and pinned dependency releases. Validate cycles and provenance. Fence state writes by the current Attempt; persist tool intent before calling out, and require reconciliation for uncertain outcomes. State and Outbox commit together. An ACK is not business authorization. Never rebuild editable form nodes when a save response arrives; update only their non-editable projections.
