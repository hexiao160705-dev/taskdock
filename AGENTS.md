# TaskDock development

Use local maintainer rules where configured. Keep forms uncontrolled and distinguish automation from human acceptance.

Read docs/ARCHITECTURE.md and docs/PROTOCOL.md before changing contracts. Keep each run's request, config snapshot, events and artifacts private to that run. Runtime may only see its pinned capability snapshot and approved knowledge; never load other runs or ambient user agent settings. Learning creates a proposal, never silently modifies stable. Each stable release requires a passing test of the exact bundle digest. Never commit .data, request histories, keys, .env, backups or browser artifacts. Public registry packages contain allowlisted capability configuration only. No automatic public deployment or change to repository visibility.

Commands: npm ci; npm test; npm run check; npm start. Node 24+. Keep release records and docs/INDEX.md current. Do not claim live-model verification without an actual provider response. Built-in runners are explicitly deterministic, not an AI fallback.
