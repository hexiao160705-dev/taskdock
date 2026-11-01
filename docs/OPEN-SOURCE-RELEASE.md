# TaskDock 0.3 open-source release record

The maintainer requested English and Chinese interfaces, an English-first GitHub presentation, Chinese companion documentation, and public source under MIT.

## Prepared and verified

- English-first README: problem, positioning, runnable quick start, task example, capability table, architecture diagram, MCP integration, honest limits and contribution paths.
- Chinese companion README and English technical guide; MIT LICENSE and package metadata; contribution/security guidance and issue/PR templates.
- English-default control plane and Registry with persistent per-origin Chinese/English selection. Authored literals only are localized; task configuration, requests, model output and raw diagnostics stay unchanged.
- Translation scan: 412 fragments, no missing English mappings. Syntax: 34 JavaScript files.
- Backend/protocol/offline SDK checks: 44 passed, 0 failed, including existing real SIGKILL recovery cases with local side-effect stand-ins.
- Browser automation: 40 layout samples, 12 task-dialog tabs across both languages, invalid JSON, HTTP 422 summary, preserved input nodes/values, Registry locale switching; no unhandled page errors.
- Both running services report 0.3.0; archivePending is zero. Coordinated stopped-service backup completed before restart. Local tag is created with the final source commit.
- GitHub About description and five discovery topics saved and verified in the browser.
- Local history signature/path scan found no credential patterns or runtime files. Three pre-release remote commits were inspected: initial README, 0.1 bootstrap and 0.2 source. Older AGENTS files contain a maintainer filesystem path; it is historical development metadata, not a credential or runtime history. Current AGENTS is portable. History is retained without destructive rewriting.

## Publication gate

Final source synchronization verifies the Git tree digest. Repository visibility remains private until the explicit publication action succeeds; a local commit or code sync alone is not proof of public access. The final delivery receipt must verify anonymous access and MIT recognition.

## Validation limits

See [machine-readable evidence](verification/0.3.0.json). Browser and native UI automation are distinct from human acceptance. Bilingual 0.3 physical-device/native IME acceptance is not claimed. Earlier 0.2 native desktop core-path evidence is retained separately. Real-model quality, remote business effects, production multi-tenancy and a hosted public marketplace remain unvalidated.
