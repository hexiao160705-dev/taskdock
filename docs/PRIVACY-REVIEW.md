# Public-source privacy review — 2026-11-02

The current public branch history has been sanitized. A separate GitHub cached-commit exposure remains open; do not describe this as complete erasure.

## Scope and correction

The anonymous remote audit covered every advertised ref, four commits, 83 current files, 122 distinct file objects, and both author and committer metadata. The initial secret scan found no credentials, but a broader privacy review found personal email metadata, historical home-directory references, personal UI text and two local test run identifiers. The maintainer explicitly authorized a backed-up rewrite using an exact previous-HEAD lease.

The sanitized baseline is `b6cfd2cfeaac152d27b529de239d863e48ecf15e`. A new anonymous mirror confirmed that all published commits use GitHub noreply email addresses and the identified private text is absent. No tracked runtime database, request history, environment secret file, backup or browser capture was found. The audit did not find actual provider keys, cloud account values, hardware identifiers or non-loopback machine IP addresses. Necessary loopback and generic bind examples remain.

## Evidence and boundaries

- Gitleaks 8.30.1: zero findings on the rewritten remote's reachable history, with redacted logs. Scanner success alone is not privacy clearance.
- Supplemental historical-file and metadata checks: identified personal fields removed; the remaining email-like test fixture uses a reserved example domain.
- Exact rewritten baseline: clean install, JavaScript/translation checks and 44 backend/protocol/offline SDK tests passed. These are development-machine automated checks, not human/device acceptance, live-model evaluation or production validation.
- Anonymous clone and repository access succeeded; GitHub recognizes MIT, with English and Chinese documentation available.
- Former commit patch URLs still return personal metadata after the rewrite. GitHub Support cleanup is pending. No claim is made about third-party clones or copies.

Raw evidence, original history backup and support drafts stay in the maintainer's ignored local maintenance directory. Private values and old leaking URLs are intentionally omitted from public documentation.

## Prevent recurrence

Run `npm run privacy:check -- --history` from a checkout containing all refs that will be published. The heuristic gate reviews tracked files, reachable historical blobs and commit emails. It is a supplement to secret scanning and contextual review, not a substitute. Fetch/review the actual public refs again after pushing.

Use GitHub noreply for both author and committer. Do not publish commits through an adapter that cannot control those fields. Never commit runtime histories, credentials or machine-specific private data. Existing unsanitized local branches must not be pushed back into public history; retain them privately or migrate their changes onto the sanitized baseline.

See GitHub's [commit email guidance](https://docs.github.com/en/account-and-profile/how-tos/email-preferences/setting-your-commit-email-address) and [sensitive-data removal guidance](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).

中文：公开分支历史中的已识别个人信息已脱敏，扫描和自动化测试通过；旧提交 URL 仍可返回缓存元数据，尚需 GitHub 清理，不能宣称隐私已彻底清零。当前暂停推广。测试未覆盖人工实机验收、真实模型质量或互联网副本。
