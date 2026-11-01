async (page) => {
  await page.reload();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const openTask = async (name) => {
    await page.getByRole("link", { name: "任务工作台", exact: true }).click();
    await page.getByRole("textbox", { name: "搜索任务" }).fill(name);
    await page
      .locator(".task-card")
      .filter({ hasText: name })
      .getByRole("button", { name: "管理任务", exact: true })
      .click();
  };
  const testDraft = async (id) => {
    await page.getByRole("button", { name: "调试请求", exact: true }).click();
    const response = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/api/tasks/${id}/test`) &&
        r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "执行草稿测试", exact: true })
      .click();
    const run = await (await response).json();
    await page.waitForFunction(() =>
      document
        .querySelector("#run-detail .run-overview")
        ?.textContent.includes("已完成"),
    );
    await page.getByRole("button", { name: "关闭", exact: true }).click();
    return run.id;
  };
  const promote = async (id) => {
    await page.getByRole("button", { name: "版本与 Git", exact: true }).click();
    const response = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/api/tasks/${id}/promote`) &&
        r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "晋级为正式版", exact: true })
      .click();
    const r = await response;
    if (r.status() !== 200)
      throw new Error("Publish gate failed after passing proof");
    await page.getByText("当前正式版", { exact: true }).waitFor();
    return await r.json();
  };
  const base = await page.evaluate(
    async () => await (await fetch("/api/tasks/shared-evidence")).json(),
  );
  await openTask("共享证据检查");
  await page.getByRole("button", { name: "子任务与派生", exact: true }).click();
  await page.getByRole("button", { name: "派生新任务", exact: true }).click();
  await page
    .getByRole("textbox", { name: "新任务 ID", exact: true })
    .fill("tailored-evidence");
  await page
    .getByRole("textbox", { name: "新任务名称", exact: true })
    .fill("定制证据检查");
  await page
    .getByRole("textbox", { name: "调整执行规则", exact: true })
    .fill(
      "微调：要求调用者明确提交 evidence=true；仍不代表中台探测了真实环境。",
    );
  await page.getByRole("button", { name: "创建派生草稿", exact: true }).click();
  await page
    .getByRole("heading", { name: "定制证据检查", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "能力与工具", exact: true }).click();
  const editor = page.getByRole("textbox", {
    name: "能力配置 JSON",
    exact: true,
  });
  const variant = JSON.parse(await editor.inputValue());
  variant.checks[0] = {
    id: "evidence",
    label: "调用者已明确提交确认值 true",
    field: "evidence",
    operator: "equals",
    expected: true,
  };
  variant.sampleInput = { evidence: true };
  await editor.fill(JSON.stringify(variant, null, 2));
  await page
    .getByRole("button", { name: "校验并保存草稿", exact: true })
    .click();
  await page
    .getByText("已保存草稿；正式版保持固定版本", { exact: true })
    .waitFor();
  const forkProof = await testDraft("tailored-evidence");
  await openTask("定制证据检查");
  const fork = await promote("tailored-evidence");
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await openTask("项目上线流程");
  await page.getByRole("button", { name: "子任务与派生", exact: true }).click();
  await page.getByRole("button", { name: "移除引用", exact: true }).click();
  await page
    .locator("#child-references")
    .getByText("当前没有子任务引用。", { exact: true })
    .waitFor();
  await page
    .getByRole("combobox", { name: "已发布的子任务", exact: true })
    .selectOption("tailored-evidence");
  await page
    .getByRole("textbox", {
      name: "调用 key（在当前父任务内唯一）",
      exact: true,
    })
    .fill("evidence-check");
  await page
    .getByRole("textbox", { name: "输入映射 JSON", exact: true })
    .fill('{"evidence":"evidence"}');
  await page
    .getByRole("button", { name: "保存子任务引用", exact: true })
    .click();
  await page
    .locator("#child-references")
    .getByText("evidence-check → tailored-evidence", { exact: true })
    .waitFor();
  await page.getByRole("button", { name: "版本与 Git", exact: true }).click();
  const refused = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/tasks/launch-flow/promote") &&
      r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "晋级为正式版", exact: true }).click();
  if ((await refused).status() !== 409)
    throw new Error("Untested dependency change must not publish");
  await page.getByRole("button", { name: "调试请求", exact: true }).click();
  await page
    .getByRole("textbox", { name: "本次请求上下文 JSON", exact: true })
    .fill('{"project":"项目 A","evidence":true,"privateNote":"PARENT_ONLY"}');
  const proofResponse = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/tasks/launch-flow/test") &&
      r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "执行草稿测试", exact: true }).click();
  const proof = await (await proofResponse).json();
  await page.waitForFunction(() =>
    document
      .querySelector("#run-detail .run-overview")
      ?.textContent.includes("已完成"),
  );
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await openTask("项目上线流程");
  const parent = await promote("launch-flow");
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("link", { name: "任务关系", exact: true }).click();
  await page.getByRole("heading", { name: "任务关系", exact: true }).waitFor();
  const after = await page.evaluate(async () => ({
    base: await (await fetch("/api/tasks/shared-evidence")).json(),
    other: await (await fetch("/api/tasks/change-flow")).json(),
  }));
  if (
    after.base.stable.digest !== base.stable.digest ||
    after.other.stable.config.children[0].taskId !== "shared-evidence"
  )
    throw new Error("Fork must not mutate other callers");
  if (parent.stable.config.children[0].digest !== fork.stable.digest)
    throw new Error("Expected explicit variant binding");
  await page.screenshot({
    path: "output/playwright/taskdock-v02/graph-variant.png",
    fullPage: true,
  });
  return {
    forkProof,
    parentProof: proof.id,
    forkId: fork.id,
    origin: fork.draft.origin,
    parentVersion: parent.stable.version,
    parentChildId: parent.stable.config.children[0].taskId,
    otherParentChildId: after.other.stable.config.children[0].taskId,
    originalUnchanged: true,
    errors,
  };
};
