/**
 * PreToolUse フック: npx prisma migrate 実行前の DB バックアップ
 *
 * Claude Code の `if` フィールドは公式仕様ではないため、コマンド判定は
 * 本スクリプト内で stdin の JSON (tool_input.command) を読んで行う。
 *
 * - `npx prisma migrate` を含むコマンド時のみ `tools/export-to-sql.ts` を実行
 * - それ以外の Bash コマンドは即 exit 0 でスキップ
 * - backup 失敗時は continue:false で migrate をブロック
 */
const { execSync } = require("child_process");

let input = "";
try {
  input = require("fs").readFileSync(0, "utf-8");
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

if (!/\bnpx\s+prisma\s+migrate\b/.test(command)) {
  process.exit(0);
}

try {
  execSync("npx tsx tools/export-to-sql.ts", {
    stdio: "inherit",
    timeout: 30000,
  });
  console.log(
    JSON.stringify({ systemMessage: "DB backup completed before migrate." })
  );
} catch (e) {
  console.log(
    JSON.stringify({
      continue: false,
      stopReason: "DB backup failed. Fix before running migrate: " + e.message,
    })
  );
}
