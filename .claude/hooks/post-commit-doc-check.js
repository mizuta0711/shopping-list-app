/**
 * PostToolUse フック: git commit 後に設計書同期の必要性をチェック
 *
 * Claude Code の `if` フィールドは公式仕様ではないため、コマンド判定は
 * 本スクリプト内で stdin の JSON (tool_input.command) を読んで行う。
 *
 * - `git commit` を含むコマンド時のみ実行
 * - 直近コミットの変更ファイルに API/サービス/スキーマが含まれている場合、
 *   Claude に /update-docs の実行を促すメッセージを出力する
 */
const fs = require("fs");
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

try {
  const files = execSync("git diff --name-only HEAD~1 HEAD", {
    encoding: "utf-8",
    timeout: 5000,
  }).trim();

  if (!files) process.exit(0);

  const lines = files.split("\n");

  const docTriggers = [];
  const hasApi = lines.some((f) => f.startsWith("src/app/api/"));
  const hasService = lines.some((f) => f.startsWith("src/lib/services/"));
  const hasSchema = lines.some((f) => f.includes("schema.prisma"));
  const hasPrompt = lines.some((f) => f.startsWith("src/lib/ai/prompts/"));
  const hasHook = lines.some((f) => /src\/features\/.*\/hooks\//.test(f));

  if (hasApi) docTriggers.push("API一覧");
  if (hasService) docTriggers.push("サービス一覧");
  if (hasSchema) docTriggers.push("テーブル定義書");
  if (hasPrompt) docTriggers.push("ai-prompt-design");
  if (hasHook) docTriggers.push("フック一覧");

  if (docTriggers.length > 0) {
    console.log(
      JSON.stringify({
        systemMessage: `[doc-sync] このコミットには ${docTriggers.join("・")} の更新が必要な変更が含まれています。M/L規模の作業であれば /update-docs を実行してください。`,
      })
    );
  }
} catch {
  // 初回コミット等で HEAD~1 が存在しない場合は無視
}
