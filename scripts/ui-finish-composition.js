// Continues a demo after the variant exists; includes a delayed real PUT response
// to verify that save completion does not replace the form being edited.
async (page) => {
  await page.reload();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.getByRole("link", { name: "任务工作台", exact: true }).click();
  await page.getByRole("textbox", { name: "搜索任务" }).fill("项目上线流程");
  await page
    .locator(".task-card")
    .filter({ hasText: "项目上线流程" })
    .getByRole("button", { name: "管理任务", exact: true })
    .click();
  await page.getByRole("button", { name: "子任务与派生", exact: true }).click();
  await page.route("**/api/tasks/launch-flow/draft", async (route) => {
    await new Promise((r) => setTimeout(r, 700));
    await route.continue();
  });
  const removed = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/tasks/launch-flow/draft") &&
      r.request().method() === "PUT",
  );
  await page.getByRole("button", { name: "移除引用", exact: true }).click();
  await page
    .getByRole("combobox", { name: "已发布的子任务", exact: true })
    .selectOption("tailored-evidence");
  const key = page.getByRole("textbox", {
    name: "调用 key（在当前父任务内唯一）",
    exact: true,
  });
  await key.fill("evidence-check");
  await key.focus();
  await key.evaluate((el) => (window.__compositionInput = el));
  await removed;
  await page
    .locator("#child-references")
    .getByText("当前没有子任务引用。", { exact: true })
    .waitFor();
  const inputPreserved = await key.evaluate(
    (el) =>
      el === window.__compositionInput &&
      document.activeElement === el &&
      el.value === "evidence-check",
  );
  if (
    !inputPreserved ||
    (await page.locator("#child-task").inputValue()) !== "tailored-evidence"
  )
    throw new Error("Save response replaced edited composition form");
  await page.unroute("**/api/tasks/launch-flow/draft");
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
  const untestedRefused = (await refused).status() === 409;
  if (!untestedRefused) throw new Error("Expected exact-digest release gate");
  await page.getByRole("button", { name: "调试请求", exact: true }).click();
  await page
    .getByRole("textbox", { name: "本次请求上下文 JSON", exact: true })
    .fill('{"project":"项目 A","evidence":true,"privateNote":"PARENT_ONLY"}');
  const started = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/tasks/launch-flow/test") &&
      r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "执行草稿测试", exact: true }).click();
  const proof = await (await started).json();
  await page.waitForFunction(() =>
    document
      .querySelector("#run-detail .run-overview")
      ?.textContent.includes("已完成"),
  );
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page
    .locator(".task-card")
    .filter({ hasText: "项目上线流程" })
    .getByRole("button", { name: "管理任务", exact: true })
    .click();
  await page.getByRole("button", { name: "版本与 Git", exact: true }).click();
  const promoted = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/tasks/launch-flow/promote") &&
      r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "晋级为正式版", exact: true }).click();
  const response = await promoted;
  if (!response.ok()) throw new Error("Expected parent promotion after proof");
  const parent = await response.json();
  await page.getByText("当前正式版", { exact: true }).waitFor();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("link", { name: "任务关系", exact: true }).click();
  await page.getByRole("heading", { name: "任务关系", exact: true }).waitFor();
  const verify = await page.evaluate(async () => {
    const get = async (id) => await (await fetch(`/api/tasks/${id}`)).json();
    return {
      base: await get("shared-evidence"),
      variant: await get("tailored-evidence"),
      other: await get("change-flow"),
    };
  });
  if (
    verify.base.stable.digest !== verify.variant.draft.origin.digest ||
    verify.other.stable.config.children[0].taskId !== "shared-evidence" ||
    parent.stable.config.children[0].digest !== verify.variant.stable.digest
  )
    throw new Error("Unexpected shared/fork version mutation");
  await page.screenshot({
    path: "output/playwright/taskdock-v02/graph-variant.png",
    fullPage: true,
  });
  return {
    inputPreserved,
    untestedRefused,
    parentProof: proof.id,
    parentVersion: parent.stable.version,
    parentChildId: parent.stable.config.children[0].taskId,
    otherParentChildId: verify.other.stable.config.children[0].taskId,
    originalUnchanged: true,
    variantOrigin: verify.variant.draft.origin,
    variantVersion: verify.variant.stable.version,
    errors,
  };
};
