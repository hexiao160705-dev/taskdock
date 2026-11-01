// Deliberately deterministic provider stand-in for real process-crash tests.
// This exercises the scheduler/ledger, not model quality or a live provider.
import { writeFileSync, appendFileSync } from "node:fs";
import path from "node:path";
import { Store } from "../../src/store.js";
import { Executor } from "../../src/runner.js";
const dir = process.env.TASKDOCK_TEST_DIR,
  mode = process.env.TASKDOCK_TEST_MODE;
const store = new Store(dir);
const waitForAbort = (signal) =>
  new Promise((_, reject) => {
    if (signal.aborted) reject(signal.reason);
    else
      signal.addEventListener("abort", () => reject(signal.reason), {
        once: true,
      });
  });
const runner = async (options) => {
  const saved = options.checkpoint("fixture-stage");
  if (mode === "checkpoint-crash") {
    options.checkpoint("fixture-stage", { value: options.input.marker });
    process.send({ phase: "checkpoint-written" });
    await waitForAbort(options.signal);
  }
  if (mode === "tool-crash") {
    await options.invokeTool({
      stage: 0,
      server: "evidence",
      name: "write",
      args: { value: options.input.marker },
      execute: async () => {
        appendFileSync(
          path.join(dir, "external-actions.txt"),
          "one external action\n",
        );
        process.send({ phase: "external-succeeded" });
        await waitForAbort(options.signal);
      },
    });
  }
  if (mode === "receipt-crash") {
    await options.invokeTool({
      stage: 0,
      server: "evidence",
      name: "write",
      args: { value: options.input.marker },
      execute: async () => {
        appendFileSync(
          path.join(dir, "external-actions.txt"),
          "one external action\n",
        );
        return {
          content: [{ type: "text", text: "committed tool receipt" }],
          details: {},
        };
      },
    });
    process.send({ phase: "receipt-written" });
    await waitForAbort(options.signal);
  }
  return {
    executionMode: "fixture-deterministic",
    verdict: "passed",
    summary:
      saved?.value ||
      options.toolReceipts()[0]?.result.content[0].text ||
      "fixture complete",
    checks: [],
    stages: [],
    limitations: ["No live model"],
  };
};
try {
  const executor = new Executor(store, { runner, pollMs: 20 });
  await executor.idle();
  process.send({
    phase: "idle",
    runs: store.runs().map((r) => ({ id: r.id, status: r.status })),
  });
  await executor.close();
  store.close();
  process.disconnect();
} catch (error) {
  process.send?.({ phase: "error", message: error.message });
  process.exitCode = 1;
  process.disconnect?.();
}
