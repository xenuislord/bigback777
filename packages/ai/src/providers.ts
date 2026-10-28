import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import type { HearthDB } from "../../database/src/index.ts";
import { AppError } from "../../database/src/index.ts";
export class Vault {
  private key: Buffer;
  constructor(private db: HearthDB) {
    if (process.platform === "darwin") {
      try {
        this.key = Buffer.from(
          execFileSync(
            "/usr/bin/security",
            [
              "find-generic-password",
              "-a",
              "HEARTH",
              "-s",
              "local.hearth.encryption",
              "-w",
            ],
            { stdio: ["ignore", "pipe", "ignore"] },
          )
            .toString()
            .trim(),
          "hex",
        );
      } catch {
        const key = randomBytes(32).toString("hex");
        execFileSync(
          "/usr/bin/security",
          [
            "add-generic-password",
            "-U",
            "-a",
            "HEARTH",
            "-s",
            "local.hearth.encryption",
            "-w",
            key,
          ],
          { stdio: "ignore" },
        );
        this.key = Buffer.from(key, "hex");
      }
    } else {
      const file = join(db.dir, "vault.key");
      if (!existsSync(file))
        writeFileSync(file, randomBytes(32), { mode: 0o600, flag: "wx" });
      chmodSync(file, 0o600);
      this.key = readFileSync(file);
    }
    if (this.key.length !== 32)
      throw new Error("Invalid credential encryption key");
  }
  set(name: string, value: string) {
    if (!value) {
      this.db.run("DELETE FROM secret WHERE name=?", name);
      return;
    }
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(value, "utf8"),
      cipher.final(),
    ]);
    this.db.run(
      "INSERT INTO secret VALUES(?,?) ON CONFLICT(name) DO UPDATE SET encrypted=excluded.encrypted",
      name,
      JSON.stringify({
        iv: iv.toString("hex"),
        tag: cipher.getAuthTag().toString("hex"),
        data: encrypted.toString("hex"),
      }),
    );
  }
  has(name: string) {
    return !!this.db.one("SELECT name FROM secret WHERE name=?", name);
  }
  get(name: string) {
    const row = this.db.one("SELECT encrypted FROM secret WHERE name=?", name);
    if (!row) return "";
    const e = JSON.parse(row.encrypted),
      decipher = createDecipheriv(
        "aes-256-gcm",
        this.key,
        Buffer.from(e.iv, "hex"),
      );
    decipher.setAuthTag(Buffer.from(e.tag, "hex"));
    return Buffer.concat([
      decipher.update(Buffer.from(e.data, "hex")),
      decipher.final(),
    ]).toString("utf8");
  }
}
export async function fetchJSON(
  url: string,
  init: RequestInit = {},
  timeout = 15000,
) {
  let r: Response;
  try {
    r = await fetch(url, { ...init, signal: AbortSignal.timeout(timeout) });
  } catch {
    throw new AppError(
      503,
      "The provider could not be reached. Check that it is running and that network access is allowed.",
    );
  }
  if (!r.ok)
    throw new AppError(
      502,
      `Provider returned HTTP ${r.status}. Check authorization, model availability, and usage limits. No fallback was activated.`,
    );
  return r.json();
}
export async function ollamaModels() {
  const data = await fetchJSON(
    (process.env.OLLAMA_URL || "http://127.0.0.1:11434") + "/api/tags",
    {},
    2000,
  );
  return (data.models || []).map((m: any) => ({
    id: m.name,
    name: m.name,
    size: m.size,
  }));
}
export async function apiModels(vault: Vault) {
  if (!vault.has("openai")) throw new AppError(400, "No API key is saved.");
  const data = await fetchJSON("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${vault.get("openai")}` },
  });
  return data.data.map((m: any) => ({ id: m.id, name: m.id }));
}
export async function consumeResponses(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader(),
    decoder = new TextDecoder();
  let buffer = "",
    text = "",
    completed = false;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let end;
    while ((end = buffer.indexOf("\n\n")) >= 0) {
      const chunk = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6);
        if (raw === "[DONE]") continue;
        const e = JSON.parse(raw);
        if (e.type === "response.output_text.delta") text += e.delta;
        if (e.type === "response.completed") completed = true;
        if (
          ["response.failed", "response.incomplete", "error"].includes(e.type)
        )
          throw new AppError(
            502,
            "AI response did not complete. No changes have been applied.",
          );
      }
    }
  }
  if (!completed)
    throw new AppError(
      502,
      "The AI stream was interrupted. No changes have been applied.",
    );
  return text;
}
export async function askProvider(
  db: HearthDB,
  vault: Vault,
  system: string,
  prompt: string,
  routine = false,
) {
  const s = db.settings();
  const provider = routine ? s.routineProvider : s.provider;
  const model = routine ? s.routineModel : s.model;
  if (provider === "none") return null;
  if (provider === "chatgpt")
    throw new AppError(
      503,
      "ChatGPT sign-in is unavailable: official preview documentation could not be accessed and the OAuth protocol has not been verified. No API billing fallback was enabled.",
    );
  if (!model)
    throw new AppError(
      400,
      "Select an installed or authorized model in Settings.",
    );
  if (provider === "ollama") {
    const r = await fetchJSON(
      (process.env.OLLAMA_URL || "http://127.0.0.1:11434") + "/api/chat",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          stream: false,
          format: "json",
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
        }),
      },
      90000,
    );
    if (!r.message?.content)
      throw new AppError(
        502,
        "Ollama returned no content. Check available RAM and model support.",
      );
    return r.message.content;
  }
  if (!s.apiEnabled || !vault.has("openai"))
    throw new AppError(
      400,
      "Separately billed API access is disabled or no key is configured.",
    );
  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${vault.get("openai")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      store: false,
      stream: true,
      instructions: system,
      input: prompt,
    }),
    signal: AbortSignal.timeout(90000),
  });
  if (!r.ok || !r.body)
    throw new AppError(
      502,
      `OpenAI API returned HTTP ${r.status}. No automatic provider fallback was activated.`,
    );
  return consumeResponses(r.body);
}
