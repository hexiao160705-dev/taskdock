async (page) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const samples = [];
  for (const language of ["en", "zh-CN"]) {
    await page.goto("http://127.0.0.1:4640/");
    await page.evaluate(
      (l) => localStorage.setItem("taskdock-language", l),
      language,
    );
    await page.reload();
    await page.waitForSelector(".task-card");
    for (const viewport of [
      { width: 1365, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      for (const name of [
        "home",
        "graph",
        "attention",
        "runs",
        "deliveries",
        "knowledge",
        "schedules",
        "market",
        "settings",
        "research",
      ]) {
        await page.goto("http://127.0.0.1:4640/#" + name);
        await page.waitForSelector("h1");
        await page.waitForTimeout(150);
        const sample = await page.evaluate(() => ({
          lang: document.documentElement.lang,
          title: document.querySelector("h1").textContent,
          overflow: document.body.scrollWidth > innerWidth + 1,
        }));
        if (sample.overflow)
          throw Error(
            "Overflow " + language + " " + name + " " + viewport.width,
          );
        samples.push({
          language,
          page: name,
          width: viewport.width,
          ...sample,
        });
      }
    }
  }
  await page.setViewportSize({ width: 1365, height: 900 });
  await page.evaluate(() => localStorage.setItem("taskdock-language", "en"));
  await page.goto("http://127.0.0.1:4640/#home");
  await page.reload();
  await page.getByRole("button", { name: "New task", exact: true }).click();
  await page.locator("#new-name").fill("私有名称 stays unchanged");
  const original = await page.locator("#new-name").elementHandle();
  await page.waitForTimeout(1200);
  if (
    !(await original.evaluate(
      (e) =>
        e === document.querySelector("#new-name") &&
        e.value === "私有名称 stays unchanged",
    ))
  )
    throw Error("Form changed");
  await page.screenshot({ path: "output/taskdock-0.3/english-form.png" });
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Switch to Simplified Chinese" })
    .click();
  await page.waitForSelector('html[lang="zh-CN"]');
  if (
    (await page
      .getByRole("heading", { name: "让每一次协作，都有积累。" })
      .count()) !== 1
  )
    throw Error("Locale switch failed");
  await page.goto("http://127.0.0.1:4641");
  await page.waitForSelector("#registry-search");
  await page
    .getByRole("button", { name: "Switch to Simplified Chinese" })
    .click();
  await page.waitForSelector('html[lang="zh-CN"]');
  const registryChinese = await page.locator("html").getAttribute("lang");
  await page.getByRole("button", { name: "切换至英文" }).click();
  await page.waitForSelector('html[lang="en"]');
  const registryEnglish = await page.locator("h1").innerText();
  return {
    samples,
    formPreserved: true,
    registryChinese,
    registryEnglish,
    errors,
  };
};
