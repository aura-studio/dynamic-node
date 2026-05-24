"use strict";

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");

const PORT = Number(process.env.DYNAMIC_NODE_TEST_UI_PORT || 3457);
const SCRIPT_DIR = __dirname;

const steps = [
  ["00-clean", "Clean generated files"],
  ["01-smoke", "Run runtime smoke checks"],
  ["02-build-all", "Build all target artifacts with dynamic-node-cli"],
  ["03-local", "Load direct Tunnel bundle/full artifacts locally"],
  ["04-service", "Load service-node bundle/full artifacts"],
  ["05-wire", "Load wire-node bundle/full artifacts"],
  ["06-default-version", "Verify default-version fallback"],
  ["07-validation-errors", "Verify validation errors"],
  ["08-remote-s3", "Push/load through S3 or local MinIO"],
  ["99-run-all-local", "Run all local steps"],
  ["99-run-all-docker-s3", "Run all steps with Docker MinIO"],
];

const clients = new Map();

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/" && req.method === "GET") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(renderPage());
    return;
  }

  if (url.pathname === "/events" && req.method === "GET") {
    const id = url.searchParams.get("id");
    if (!id) {
      res.writeHead(400);
      res.end("missing id");
      return;
    }
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    res.write(":ok\n\n");
    clients.set(id, res);
    req.on("close", () => clients.delete(id));
    return;
  }

  if (url.pathname === "/run" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        const { step, id } = JSON.parse(body || "{}");
        if (!step || !id) {
          res.writeHead(400);
          res.end("missing step/id");
          return;
        }
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        runStep(step, id);
      } catch {
        res.writeHead(400);
        res.end("bad json");
      }
    });
    return;
  }

  res.writeHead(404);
  res.end("not found");
});

function renderPage() {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>dynamic-node examples</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; color: #17202a; background: #f6f8fb; }
    main { max-width: 1120px; margin: 0 auto; padding: 28px; }
    h1 { margin: 0 0 18px; font-size: 24px; }
    .layout { display: grid; grid-template-columns: 360px 1fr; gap: 18px; align-items: start; }
    .steps, .log { background: white; border: 1px solid #d9e0ea; border-radius: 8px; overflow: hidden; }
    button { width: 100%; text-align: left; border: 0; border-bottom: 1px solid #edf1f6; background: white; padding: 12px 14px; cursor: pointer; }
    button:hover { background: #f0f5ff; }
    button strong { display: block; font-size: 14px; }
    button span { display: block; color: #5c6b7a; font-size: 12px; margin-top: 3px; }
    pre { min-height: 520px; margin: 0; padding: 14px; overflow: auto; font-size: 12px; line-height: 1.45; background: #101722; color: #dbe7ff; }
    @media (max-width: 840px) { .layout { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <h1>dynamic-node examples</h1>
    <div class="layout">
      <section class="steps">
        ${steps.map(([id, label]) => `<button data-step="${id}"><strong>${id}</strong><span>${label}</span></button>`).join("")}
      </section>
      <section class="log"><pre id="log"></pre></section>
    </div>
  </main>
  <script>
    const id = Math.random().toString(16).slice(2);
    const log = document.querySelector("#log");
    const events = new EventSource("/events?id=" + id);
    events.addEventListener("out", (event) => {
      const data = JSON.parse(event.data);
      log.textContent += data.text;
      log.scrollTop = log.scrollHeight;
    });
    events.addEventListener("done", (event) => {
      const data = JSON.parse(event.data);
      log.textContent += "\\n[exit " + data.code + "] " + data.step + "\\n";
      log.scrollTop = log.scrollHeight;
    });
    document.querySelectorAll("button[data-step]").forEach((button) => {
      button.addEventListener("click", async () => {
        const step = button.dataset.step;
        log.textContent = "$ node examples/scripts/" + step + ".js\\n";
        await fetch("/run", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ step, id })
        });
      });
    });
  </script>
</body>
</html>`;
}

function runStep(step, id) {
  const script = path.join(SCRIPT_DIR, `${step}.js`);
  if (!fs.existsSync(script)) {
    send(id, "out", { text: `missing script: ${script}\n` });
    send(id, "done", { step, code: 1 });
    return;
  }

  const child = spawn(process.execPath, [script], {
    cwd: path.dirname(SCRIPT_DIR),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (data) => send(id, "out", { text: data.toString("utf8") }));
  child.stderr.on("data", (data) => send(id, "out", { text: data.toString("utf8") }));
  child.on("close", (code) => send(id, "done", { step, code: code || 0 }));
  child.on("error", (err) => {
    send(id, "out", { text: `spawn failed: ${err.message}\n` });
    send(id, "done", { step, code: 1 });
  });
}

function send(id, event, data) {
  const client = clients.get(id);
  if (!client) return;
  client.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`dynamic-node example UI: http://127.0.0.1:${PORT}`);
  });
}
