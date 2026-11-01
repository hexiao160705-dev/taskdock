async (page) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const tabs = [];
  for (const language of ["en", "zh-CN"]) {
    await page.goto("http://127.0.0.1:4640/#home");
    await page.evaluate(
      (l) => localStorage.setItem("taskdock-language", l),
      language,
    );
    await page.reload();
    await page
      .locator('[data-action="task"][data-id="release-check"]')
      .first()
      .click();
    for (const tab of [
      "overview",
      "edit",
      "capabilities",
      "composition",
      "test",
      "versions",
    ]) {
      await page.locator(`[data-action="task-tab"][data-tab="${tab}"]`).click();
      await page.waitForSelector("#modal[open]");
      tabs.push({
        language,
        tab,
        title: await page.locator("#modal h2").innerText(),
      });
    }
    await page.locator('[data-action="task-tab"][data-tab="test"]').click();
    await page.locator("#test-json").fill("{bad");
    await page.locator('[data-action="test-task"]').click();
    await page.waitForFunction(
      () => document.querySelector("#modal .form-error").textContent.length > 0,
    );
    const jsonError = await page.locator("#modal .form-error").innerText();
    if (language === "en" && !jsonError.includes("Invalid JSON"))
      throw Error("JSON error not localized");
    await page.keyboard.press("Escape");
    await page.locator('[data-action="new-task"]').first().click();
    await page.locator("#new-id").fill("INVALID_ID");
    await page.locator("#new-name").fill("private test");
    const original = await page.locator("#new-name").elementHandle();
    await page.locator('[data-action="create-task"]').click();
    await page.waitForFunction(
      () => document.querySelector("#modal .form-error").textContent.length > 0,
    );
    const serverError = await page.locator("#modal .form-error").innerText();
    if (language === "en" && !serverError.includes("HTTP 422"))
      throw Error("HTTP error missing status");
    if (
      !(await original.evaluate(
        (e) =>
          e === document.querySelector("#new-name") &&
          e.value === "private test",
      ))
    )
      throw Error("Error rebuilt input");
    await page.keyboard.press("Escape");
  }
  return {
    tabs,
    invalidJson: true,
    httpValidation: true,
    inputPreserved: true,
    errors,
  };
};
