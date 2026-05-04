/**
 * PreToolUse フック: git commit 前の型チェック
 *
 * Claude Code の `if` フィールドは公式仕様ではないため、コマンド判定は
 * 本スクリプト内で stdin の JSON (tool_input.command) を読んで行う。
 *
 * - `git commit` を含むコマンド時のみ型チェックを実行
 * - それ以外の Bash コマンドは即 exit 0 でスキップ
 * - node_modules/.bin/tsc が存在しない場合はスキップ（テンプレート利用開始直後など）
 * - 型エラー検出時はエラー内容の先頭15行を表示してコミットをブロックする
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

let input = "";
try {
  input = fs.readFileSync(0, "utf-8");
} catch {
  process.exit(0);
}

let payload = {};
try {
  payload = JSON.parse(input || "{}");
} catch {
  process.exit(0);
}

const command = payload?.tool_input?.command || "";

if (!/\bgit\s+commit\b/.test(command)) {
  process.exit(0);
}

const tscBin = path.join(process.cwd(), "node_modules", ".bin", "tsc");
const tscBinCmd = tscBin + ".cmd";

if (!fs.existsSync(tscBin) && !fs.existsSync(tscBinCmd)) {
  console.log(
    JSON.stringify({
      systemMessage:
        "Skipping type check: TypeScript not installed locally. Run `npm install` to enable.",
    })
  );
  process.exit(0);
}

try {
  execSync("npx tsc --noEmit --pretty false 2>&1", {
    encoding: "utf-8",
    timeout: 60000,
  });
  console.log(JSON.stringify({ systemMessage: "Type check passed." }));
} catch (e) {
  const out = (e.stdout || "").split("\n").slice(0, 15).join("\n");
  console.log(
    JSON.stringify({
      continue: false,
      stopReason: "Type check failed. Fix errors before committing:\n" + out,
    })
  );
}
