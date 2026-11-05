/**
 * Local smoke check for the Respan Gateway wiring.
 *
 * It starts an OpenAI-compatible fixture on loopback, serves it through the
 * project's gateway.toml with `respan-gateway`, resolves the gateway URL the
 * way `RESPAN_GATEWAY_URL` is resolved in `src/convex/ai.ts`, and then makes
 * that transport's chat-completions request through it. Nothing leaves
 * the machine and no real provider key is read or needed — the fixture answers
 * with a fixed reply, so this proves routing, not model quality.
 *
 *   .venv/bin/python -m pip install --only-binary=:all: -r requirements.txt
 *   bun run gateway:smoke
 */
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { chatCompletionsUrl } from "../src/convex/lib/gatewayConfig";
import {
  NVIDIA_CHAT_URL,
  NVIDIA_TEXT_MODEL,
} from "../src/convex/lib/nvidiaConfig";

const FIXTURE_REPLY = "smoke-fixture reply";
const FIXTURE_KEY = "sk-smoke-provider";
const APP_KEY = "sk-smoke-app";

const failures: string[] = [];
const check = (ok: boolean, label: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failures.push(label);
};

/** Reserves a free loopback port, then releases it for the gateway. */
function freePort(): number {
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: () => new Response(),
  });
  const port = server.port!;
  server.stop(true);
  return port;
}

const gatewayBin = join(process.cwd(), ".venv", "bin", "respan-gateway");
if (!(await Bun.file(gatewayBin).exists())) {
  console.error(
    `respan-gateway is not installed at ${gatewayBin}. Run:\n` +
      "  python3 -m venv .venv\n" +
      "  .venv/bin/python -m pip install --only-binary=:all: -r requirements.txt",
  );
  process.exit(1);
}

/** What the fixture saw upstream: the gateway's own headers and model id. */
const seen: { model?: string; authorization?: string; stream?: boolean } = {};
const fixture = Bun.serve({
  port: 0,
  hostname: "127.0.0.1",
  async fetch(request) {
    if (request.method !== "POST") {
      // The gateway probes each provider's model list at start-up.
      return Response.json({ object: "list", data: [] });
    }
    const raw = await request.text();
    const body = (raw ? JSON.parse(raw) : {}) as {
      model?: string;
      stream?: boolean;
    };
    seen.model = body.model;
    seen.authorization = request.headers.get("authorization") ?? undefined;
    seen.stream = body.stream;
    return Response.json({
      id: "chatcmpl-fixture",
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: body.model,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: FIXTURE_REPLY },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
    });
  },
});

// The committed config has to validate too; a typo there would otherwise only
// show up on the developer's next `respan-gateway` start.
const configCheck = Bun.spawn(
  [gatewayBin, "check", "--config", join(process.cwd(), "gateway.toml")],
  {
    env: {
      ...process.env,
      NVIDIA_API_KEY: process.env.NVIDIA_API_KEY ?? FIXTURE_KEY,
    },
    stdout: "pipe",
    stderr: "pipe",
  },
);
await configCheck.exited;
check(configCheck.exitCode === 0, "gateway.toml validates");

const fixtureBase = `http://127.0.0.1:${fixture.port}/v1`;
const gatewayPort = freePort();
const configDir = await mkdtemp(join(tmpdir(), "respan-gateway-smoke-"));
const configPath = join(configDir, "gateway.toml");
await writeFile(
  configPath,
  [
    `listen = "127.0.0.1:${gatewayPort}"`,
    "",
    "[providers.nvidia_upstream]",
    'formats = ["openai-chat"]',
    `base_url = "${fixtureBase}"`,
    'key = "env:NVIDIA_API_KEY"',
    "",
    '[routes."*"]',
    'to = "nvidia_upstream"',
    "",
  ].join("\n"),
);

const gateway = Bun.spawn([gatewayBin, "--config", configPath], {
  env: { ...process.env, NVIDIA_API_KEY: FIXTURE_KEY },
  stdout: "pipe",
  stderr: "pipe",
});
const gatewayLog = (async () => await new Response(gateway.stderr).text())();

let ready = false;
const deadline = Date.now() + 20_000;
while (Date.now() < deadline) {
  try {
    if ((await fetch(`http://127.0.0.1:${gatewayPort}/healthz`)).ok) {
      ready = true;
      break;
    }
  } catch {
    // Not listening yet.
  }
  await Bun.sleep(200);
}

try {
  check(ready, `gateway is serving on 127.0.0.1:${gatewayPort}`);
  if (!ready) {
    console.error(await gatewayLog);
    throw new Error("gateway did not become ready");
  }

  const url = chatCompletionsUrl(
    `http://127.0.0.1:${gatewayPort}`,
    NVIDIA_CHAT_URL,
  );
  check(
    url === `http://127.0.0.1:${gatewayPort}/v1/chat/completions`,
    `app posts to ${url}`,
  );

  // The body the study-set transport sends, including the Nemotron flag.
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${APP_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: NVIDIA_TEXT_MODEL,
      messages: [{ role: "user", content: "Say hello." }],
      temperature: 0,
      top_p: 1,
      max_tokens: 32,
      stream: false,
      chat_template_kwargs: { enable_thinking: false },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  check(response.ok, `gateway answered HTTP ${response.status}`);

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content ?? "";
  check(
    content === FIXTURE_REPLY,
    `reply came back through the gateway: ${JSON.stringify(content)}`,
  );
  check(
    seen.model === NVIDIA_TEXT_MODEL,
    `upstream saw the full model id: ${seen.model}`,
  );
  check(
    seen.authorization === `Bearer ${FIXTURE_KEY}`,
    "upstream saw the gateway's provider key, not the app's request key",
  );
} finally {
  gateway.kill();
  await gateway.exited;
  await gatewayLog;
  fixture.stop(true);
  await rm(configDir, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll gateway checks passed. No live provider request was made.");
