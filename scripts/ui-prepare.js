// Run with the existing Playwright CLI run-code command; browser artifacts stay in output/.
async (page) => {
  await page.setViewportSize({ width: 1365, height: 900 });
  await page.goto("http://127.0.0.1:4640/#graph");
  await page.getByRole("heading", { name: "任务关系", exact: true }).waitFor();
  await page.screenshot({
    path: "output/playwright/taskdock-v02/graph-before.png",
    fullPage: true,
  });
  const shared = await page.getByText(/^[2-9] 个父任务共享$/).count();
  if (shared < 1)
    throw new Error("Expected a shared child capability in graph");
  await page.getByRole("link", { name: "任务工作台", exact: true }).click();
  await page
    .getByRole("textbox", { name: "搜索任务" })
    .fill("人工等待与恢复演示");
  await page
    .getByRole("article")
    .filter({ hasText: "人工等待与恢复演示" })
    .getByRole("button", { name: "管理任务" })
    .click();
  await page.getByRole("button", { name: "正式调用", exact: true }).click();
  await page
    .getByRole("textbox", { name: "来源会话标签" })
    .fill("浏览器恢复演示 A");
  await page
    .getByRole("textbox", { name: "本次请求上下文 JSON" })
    .fill(
      JSON.stringify(
        {
          evidence: "BROWSER_A_ONLY",
          confirmed: false,
          privateNote: "DO_NOT_FORWARD_THIS_FIELD",
        },
        null,
        2,
      ),
    );
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/client/runs") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "提交独立请求", exact: true }).click();
  const run = await (await response).json();
  await page.locator(".attention-card").waitFor();
  const before = await page.evaluate(
    async (id) => await (await fetch(`/api/runs/${id}`)).json(),
    run.id,
  );
  if (before.status !== "waiting_human" || before.children.length)
    throw new Error("Before gate must pause before child dispatch");
  const note = page.getByRole("textbox", { name: "补充说明 *", exact: true });
  await note.fill("演示材料已核对；这不是生产上线放行。");
  await note.focus();
  await note.evaluate((el) => (window.__taskdockFocus = el));
  await page.waitForTimeout(1700);
  const focusStable = await note.evaluate(
    (el) =>
      window.__taskdockFocus === el &&
      document.activeElement === el &&
      el.value.includes("演示材料已核对"),
  );
  if (!focusStable) throw new Error("Focused answer input was replaced");
  await page.screenshot({
    path: "output/playwright/taskdock-v02/human-waiting.png",
  });
  return {
    runId: run.id,
    digest: run.digest,
    attentionId: before.attentions[0].id,
    status: before.status,
    childrenBeforeAnswer: before.children.length,
    focusStable,
    sharedReferences: shared,
  };
};
