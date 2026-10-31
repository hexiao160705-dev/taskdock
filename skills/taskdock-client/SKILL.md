---
name: taskdock-client
description: Before doing reusable work, discover TaskDock task services, delegate matching tasks with a fresh isolated session, and handle unmatched work locally.
---

# TaskDock client contract

For each parent conversation:

1. Call taskdock_search before executing a potentially reusable task. For several goals, call taskdock_plan and validate the matches. A lexical suggestion is not proof of capability.
2. Create a fresh taskdock_open_session for THIS parent conversation. Never reuse a token from another conversation. Treat tokens as credentials; never include them in artifacts or shared memory.
3. Delegate only supported work through taskdock_submit. Only stable is callable. Include minimal necessary context, explicit evidence, and a unique idempotencyKey. Do not submit credentials or unrelated conversation history.
4. Poll taskdock_get_run, respecting backoff. On failed/cancelled/interrupted, report the actual status. On succeeded, read executionMode and evidence limitations; deterministic checks verify supplied evidence, they do not prove a live deployment was checked. Preserve version and run id in the parent result.
5. Complete unmatched goals locally. Never invent a matching task, silently simulate an AI response, claim a health check without performing it, or bypass a required task by creating a role prompt.
6. A run may propose a reusable lesson but cannot mutate stable or read another run. Do not copy raw request history into shared knowledge. Use the maintenance review path for changes, test exact draft digest, then promote.

This skill is guidance, not a security boundary. TaskDock enforces capability access, version pinning and validation independently. MCP authentication does not authorize arbitrary filesystem access or public publication.
