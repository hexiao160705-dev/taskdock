// Continue ui-prepare after an actual service stop/start. Uses only explicit demo data.
async (page) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.reload();
  await page.getByRole("link", { name: "待你处理", exact: true }).click();
  await page
    .getByRole("button", { name: "查看并回答", exact: true })
    .first()
    .click();
  await page.locator(".attention-card").waitFor();
  const id = await page
    .locator('[data-action="answer-attention"]')
    .getAttribute("data-run");
  await page
    .getByRole("combobox", { name: "确认演示材料 *", exact: true })
    .selectOption("true");
  await page
    .getByRole("textbox", { name: "补充说明 *", exact: true })
    .fill("重启后核对演示材料；这是本次请求的独立回答。");
  await page
    .getByRole("button", { name: "提交回答并恢复", exact: true })
    .click();
  await page.waitForFunction(() =>
    document
      .querySelector("#run-detail .run-overview")
      ?.textContent.includes("已完成"),
  );
  const run = await page.evaluate(
    async (id) => await (await fetch(`/api/runs/${id}`)).json(),
    id,
  );
  if (
    run.status !== "succeeded" ||
    run.attempts.length < 2 ||
    run.children.length !== 1
  )
    throw new Error("Expected same-run human recovery and one child");
  const child = await page.evaluate(
    async (id) => await (await fetch(`/api/runs/${id}`)).json(),
    run.children[0].id,
  );
  if (
    JSON.stringify(child.input) !==
    JSON.stringify({ evidence: "BROWSER_A_ONLY" })
  )
    throw new Error("Unexpected child input projection");
  await page.screenshot({
    path: "output/playwright/taskdock-v02/recovered-request.png",
  });
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("link", { name: "投递回执", exact: true }).click();
  await page.getByRole("button", { name: "接收持久消息", exact: true }).click();
  await page.waitForFunction(
    () => !document.querySelector('[data-action="receive-messages"]:disabled'),
  );
  let acknowledged = 0;
  for (let pass = 0; pass < 3; pass++) {
    while (
      await page
        .getByRole("button", { name: "已处理 · ACK", exact: true })
        .count()
    ) {
      await page
        .getByRole("button", { name: "已处理 · ACK", exact: true })
        .first()
        .click();
      acknowledged++;
      await page.waitForFunction(
        () => !document.querySelector('[data-action="ack-message"]:disabled'),
      );
    }
    await page
      .getByRole("button", { name: "接收持久消息", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        !document.querySelector('[data-action="receive-messages"]:disabled'),
    );
  }
  if (acknowledged < 3)
    throw new Error("Expected waiting, child and completion receipts");
  await page.screenshot({
    path: "output/playwright/taskdock-v02/deliveries.png",
    fullPage: true,
  });
  return {
    runId: id,
    status: run.status,
    attempts: run.attempts.map((a) => a.state),
    childRunId: child.id,
    childInputKeys: Object.keys(child.input),
    acknowledged,
    errors,
  };
};
