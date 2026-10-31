import { z } from "zod";
import { createHash, randomBytes } from "node:crypto";

export const slug = z.string().regex(/^[a-z][a-z0-9-]{1,62}$/);
const text = (max = 8000) => z.string().max(max);
export const taskSchema = z
  .object({
    id: slug,
    name: text(80).min(1),
    description: text(600).min(1),
    category: z
      .enum(["engineering", "research", "operations", "custom"])
      .default("custom"),
    tags: z.array(text(40)).max(12).default([]),
    runner: z.enum(["checklist", "pi"]).default("checklist"),
    mode: z.enum(["single", "team"]).default("single"),
    instructions: text(18000).default(""),
    skills: z
      .array(z.object({ name: text(80).min(1), content: text(16000) }).strict())
      .max(12)
      .default([]),
    knowledge: z
      .array(
        z
          .object({ id: text(80), content: text(4000), source: text(160) })
          .strict(),
      )
      .max(50)
      .default([]),
    checks: z
      .array(
        z
          .object({
            id: slug,
            label: text(120).min(1),
            field: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_.]{0,100}$/),
            operator: z.enum(["truthy", "exists", "equals"]),
            expected: z
              .union([z.string().max(2000), z.number(), z.boolean(), z.null()])
              .optional(),
          })
          .strict(),
      )
      .max(30)
      .default([]),
    stages: z
      .array(
        z
          .object({ name: text(80).min(1), instructions: text(6000).min(1) })
          .strict(),
      )
      .max(6)
      .default([]),
    model: z
      .object({
        provider: z.enum(["openai", "anthropic"]),
        name: text(120).min(1),
        apiKeyEnv: z.string().regex(/^[A-Z][A-Z0-9_]{1,100}$/),
      })
      .strict()
      .default({
        provider: "openai",
        name: "gpt-4.1-mini",
        apiKeyEnv: "OPENAI_API_KEY",
      }),
    mcpServers: z
      .array(
        z
          .object({
            name: slug,
            url: z
              .string()
              .url()
              .max(1000)
              .refine((s) => {
                const u = new URL(s);
                return (
                  ["http:", "https:"].includes(u.protocol) &&
                  !u.username &&
                  !u.password &&
                  !u.search &&
                  !u.hash
                );
              }, "MCP URL must not include credentials, query or fragment"),
            allowedTools: z
              .array(z.string().regex(/^[a-zA-Z0-9_.-]{1,100}$/))
              .min(1)
              .max(30),
            tokenEnv: z
              .string()
              .regex(/^[A-Z][A-Z0-9_]{1,100}$/)
              .optional(),
          })
          .strict(),
      )
      .max(8)
      .default([]),
    learningPolicy: z
      .enum(["review-required", "disabled"])
      .default("review-required"),
    learningRules: z
      .array(
        z
          .object({
            id: slug,
            when: z.enum(["needs-attention", "failed", "succeeded"]),
            checkId: slug.optional(),
            proposal: text(2000).min(4),
          })
          .strict(),
      )
      .max(12)
      .default([]),
    sampleInput: z.record(z.string(), z.unknown()).default({}),
  })
  .strict()
  .superRefine((t, ctx) => {
    if (t.runner === "checklist" && !t.checks.length)
      ctx.addIssue({ code: "custom", message: "规则运行器至少需要一个检查项" });
    if (t.mode === "team" && !t.stages.length)
      ctx.addIssue({ code: "custom", message: "Team 至少需要一个阶段" });
    if (new Set(t.checks.map((x) => x.id)).size !== t.checks.length)
      ctx.addIssue({ code: "custom", message: "检查项 ID 重复" });
  });

export const inputSchema = z
  .record(z.string(), z.unknown())
  .refine((v) => JSON.stringify(v).length <= 64000, "输入超过 64KB");
export const submitSchema = z
  .object({
    taskId: slug,
    input: inputSchema,
    idempotencyKey: z.string().min(1).max(160),
  })
  .strict();
export const scheduleSchema = z
  .object({
    taskId: slug,
    name: text(100).min(1),
    cron: text(100).min(1),
    timezone: text(100).default("Asia/Shanghai"),
    input: inputSchema,
    enabled: z.boolean().default(false),
  })
  .strict();
export const bundleSchema = z
  .object({
    schemaVersion: z.literal("taskdock/0.1"),
    version: z.string().regex(/^0\.1\.\d+$/),
    task: taskSchema,
    digest: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`)
      .join(",")}}`;
  return JSON.stringify(v);
}
export const digest = (v) =>
  createHash("sha256").update(canonical(v)).digest("hex");
export const token = () => randomBytes(32).toString("base64url");
export function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
export function publicBundle(task, version) {
  // Never export connection addresses, key references, or example request contexts.
  const safe = taskSchema.parse({
    ...task,
    mcpServers: [],
    sampleInput: {},
    model: {
      provider: "openai",
      name: "gpt-4.1-mini",
      apiKeyEnv: "OPENAI_API_KEY",
    },
  });
  const serialized = JSON.stringify(safe);
  if (
    /(?:sk-(?:proj-|ant-)?[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9_]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|Bearer\s+[A-Za-z0-9_.-]{20,})/i.test(
      serialized,
    )
  )
    fail(422, "能力内容疑似包含密钥，请先移除");
  return {
    schemaVersion: "taskdock/0.1",
    version,
    task: safe,
    digest: digest(safe),
  };
}
