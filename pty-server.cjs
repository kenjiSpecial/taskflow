#!/usr/bin/env node
// pty-server.cjs — Node.js PTY worker (1 process per session)
// Protocol (newline-delimited JSON):
//   stdin  ← { type: "input", data: string } | { type: "resize", cols, rows }
//   stdout → { type: "output", data: string } | { type: "exit", code: number } | { type: "error", message: string }
"use strict";
const pty = require("./node_modules/node-pty");

const cwd = process.argv[2] || process.env.HOME || "/";
const shell = process.env.SHELL || "/bin/zsh";

let term;
try {
  term = pty.spawn(shell, [], {
    name: "xterm-256color",
    cwd,
    env: { ...process.env, TERM: "xterm-256color" },
    cols: 120,
    rows: 30,
  });
} catch (e) {
  process.stdout.write(JSON.stringify({ type: "error", message: String(e) }) + "\n");
  process.exit(1);
}

term.onData((data) => {
  process.stdout.write(JSON.stringify({ type: "output", data }) + "\n");
});

term.onExit(({ exitCode }) => {
  process.stdout.write(JSON.stringify({ type: "exit", code: exitCode ?? 0 }) + "\n");
  process.exit(exitCode ?? 0);
});

// stdin → PTY (newline-delimited JSON)
let buf = "";
process.stdin.on("data", (chunk) => {
  buf += chunk.toString();
  const parts = buf.split("\n");
  buf = parts.pop() ?? "";
  for (const line of parts) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.type === "input" && typeof msg.data === "string") {
        term.write(msg.data);
      } else if (msg.type === "resize" && msg.cols && msg.rows) {
        term.resize(msg.cols, msg.rows);
      }
    } catch {
      // ignore parse errors
    }
  }
});

process.stdin.on("end", () => {
  try { term.kill(); } catch { /* ignore */ }
});
