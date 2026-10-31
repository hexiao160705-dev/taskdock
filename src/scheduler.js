export class Scheduler {
  constructor(store, executor) {
    this.store = store;
    this.executor = executor;
    this.timer = setInterval(() => this.tick(), 1000);
    this.timer.unref();
  }
  tick(at = new Date()) {
    for (const s of this.store
      .schedules()
      .filter((s) => s.enabled && s.next_run_at <= at.toISOString())) {
      try {
        let run;
        this.store.transaction(() => {
          run = this.executor.submit({
            taskId: s.task_id,
            input: s.input,
            sessionId: `schedule:${s.id}`,
            source: "schedule",
            channel: "stable",
            idempotencyKey: `tick:${s.next_run_at}`,
          });
          this.store.db
            .prepare(
              "UPDATE schedules SET last_run_at=?,last_run_id=?,next_run_at=? WHERE id=?",
            )
            .run(
              s.next_run_at,
              run.id,
              this.store.nextTime(s.cron, s.timezone, at),
              s.id,
            );
          this.store.audit("schedule.fired", s.task_id, {
            id: s.id,
            runId: run.id,
          });
        });
      } catch {
        this.store.db
          .prepare("UPDATE schedules SET enabled=0 WHERE id=?")
          .run(s.id);
        this.store.audit("schedule.failed", s.task_id, {
          id: s.id,
          reason: "未发布的任务或调度失败；已停用，请维护者检查",
        });
      }
    }
  }
  close() {
    clearInterval(this.timer);
  }
}
