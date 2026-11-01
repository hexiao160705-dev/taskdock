async (page) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const results = [];
  const pages = [
    ["home", "让每一次协作，都有积累。"],
    ["graph", "任务关系"],
    ["attention", "待你处理"],
    ["runs", "请求记录"],
    ["deliveries", "投递回执"],
    ["knowledge", "经验与学习"],
    ["schedules", "定时任务"],
    ["market", "共享广场"],
    ["settings", "接入与设置"],
    ["research", "为什么做一个任务中台"],
  ];
  for (const [width, height] of [
    [1365, 900],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    for (const [route, title] of pages) {
      await page.goto(`http://127.0.0.1:4640/#${route}`);
      await page.reload();
      await page
        .getByRole("heading", { name: title, exact: true, level: 1 })
        .waitFor();
      const geometry = await page.evaluate(() => ({
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        horizontalOverflow:
          document.documentElement.scrollWidth > innerWidth + 1,
      }));
      if (geometry.horizontalOverflow)
        throw new Error(
          `Body overflow at ${route} ${width}: ${geometry.scrollWidth}`,
        );
      results.push({ route, viewport: `${width}x${height}`, ...geometry });
      if (["graph", "deliveries", "attention"].includes(route))
        await page.screenshot({
          path: `output/playwright/taskdock-v02/${route}-${width}.png`,
        });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const r = await page.evaluate(
    async () =>
      await (
        await fetch("/api/tasks/human-confirm/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input: { evidence: "GEOMETRY_DEMO_ONLY", confirmed: false },
          }),
        })
      ).json(),
  );
  await page.goto("http://127.0.0.1:4640/#runs");
  await page.reload();
  await page
    .getByRole("button", { name: `查看请求 ${r.id.slice(0, 8)}`, exact: true })
    .click();
  await page.locator(".attention-card").waitFor();
  const note = page.getByRole("textbox", { name: "补充说明 *", exact: true });
  await note.scrollIntoViewIfNeeded();
  await note.fill("仅为布局验证，不代表真实生产验收。");
  const modal = await page.evaluate(() => {
    const box = document.querySelector("dialog").getBoundingClientRect(),
      input = document
        .querySelector(".attention-card textarea")
        .getBoundingClientRect(),
      footer = document.querySelector(".modal-footer").getBoundingClientRect();
    return {
      left: box.left,
      right: box.right,
      top: box.top,
      bottom: box.bottom,
      inputBottom: input.bottom,
      footerTop: footer.top,
      viewportHeight: innerHeight,
    };
  });
  if (
    modal.left < 0 ||
    modal.right > 390 ||
    modal.top < 0 ||
    modal.bottom > 844 ||
    modal.inputBottom > modal.footerTop + 1
  )
    throw new Error(`Modal obstruction: ${JSON.stringify(modal)}`);
  await page.screenshot({
    path: "output/playwright/taskdock-v02/human-mobile-390.png",
  });
  await page.getByRole("button", { name: "取消请求", exact: true }).click();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  return {
    pages: results,
    modal,
    errors,
    mobileLayer: "viewport emulation; not physical phone acceptance",
  };
};
