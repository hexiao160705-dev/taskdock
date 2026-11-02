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
- Correction after publication: the original source-only check missed personal commit emails, historical maintainer paths, personal UI text and two local test run identifiers. Those findings were removed from all published branch history using an explicitly authorized, backed-up rewrite. See [privacy review and remaining cache limitation](PRIVACY-REVIEW.md).

## Publication gate

Anonymous Git clone, repository page access, English/Chinese README links and the MIT license have been verified. The rewritten four-commit baseline is `b6cfd2cfeaac152d27b529de239d863e48ecf15e`. This documentation/tooling follow-up does not change runtime behavior or create a new application release.

Privacy cleanup is not fully closed: former commit URLs still return cached metadata. Branch history cleanup does not prove that GitHub caches, forks or other copies have been erased. Promotion is paused while the maintainer resolves this remaining exposure.

## Validation limits

See [machine-readable evidence](verification/0.3.0.json). Browser and native UI automation are distinct from human acceptance. Bilingual 0.3 physical-device/native IME acceptance is not claimed. Earlier 0.2 native desktop core-path evidence is retained separately. Real-model quality, remote business effects, production multi-tenancy and a hosted public marketplace remain unvalidated.
