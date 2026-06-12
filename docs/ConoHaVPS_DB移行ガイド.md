# 移行ガイド: Azure PostgreSQL → ConoHa VPS（2本目以降のアプリ DB 追加）

> **対象読者**: AIStory 以外の Next.js + Prisma + Vercel + Azure Database for PostgreSQL 構成のアプリを、構築済みの共有 ConoHa VPS へ移行する人（または Claude Code セッション）。
> **前提**: VPS の初期構築（OS 堅牢化・PostgreSQL 17・PgBouncer・バックアップ cron）は AIStory の Phase 1 で**完了済み**。本ガイドは「共有基盤に DB を1つ追加する」手順のみを扱う。初回構築の全容と設計判断は [features/20260611_ConoHaVPS移行Phase1_DB移行.md](features/20260611_ConoHaVPS移行Phase1_DB移行.md) を参照。
> **秘匿情報の扱い**: `<VPS_IP>`・`<PGB_PORT>`・パスワード類は本ガイドにもリポジトリにも書かない。実値はパスワードマネージャおよび VPS 上の `/root/<app>-db-credentials.txt` で管理する。

---

## 0. 構築済みの共有基盤（再構築不要）

| 要素 | 状態 |
|------|------|
| VPS | ConoHa 2GB / Ubuntu 24.04。SSH は `deploy@<VPS_IP>`（鍵認証のみ・ポート22・sudo NOPASSWD） |
| PostgreSQL | 17（PGDG）。`localhost` のみ listen。設定は `/etc/postgresql/17/main/conf.d/99-aistory.conf` |
| PgBouncer | 1.25.x。`0.0.0.0:<PGB_PORT>` で TLS 必須・scram・transaction モード。**全アプリでこの1ポートを共有**（DB 名でルーティング） |
| バックアップ | postgres ユーザーの cron（毎日 04:00 JST）が `/usr/local/bin/backup-db.sh` を実行 → `/var/backups/postgres/`（7世代） |
| ConoHa セキュリティグループ | SSH(22) と `<PGB_PORT>` 開放済み。**追加アプリで新規開放は不要** |

**方針（Phase 1 §3-3 で合意済み）**: アプリごとに「DB 1つ + owner ロール 1つ」を追加する。命名は DB = `<app>`、ロール = `<app>_app`（例: `aistory` / `aistory_app`）。

---

## 1. 事前確認（移行元 Azure）

アプリのリポジトリで、Prisma 経由で確認する（ローカルに psql は不要）:

```bash
npx tsx -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const main = async () => {
  console.log(await p.\$queryRawUnsafe('SELECT version()'));
  console.log(await p.\$queryRawUnsafe('SELECT pg_size_pretty(pg_database_size(current_database()))'));
  console.log(await p.\$queryRawUnsafe('SELECT extname FROM pg_extension'));
};
main().finally(() => p.\$disconnect());
"
```

| 確認項目 | 判断 |
|---------|------|
| PG バージョン | **17 以下なら OK**（VPS は 17.10）。18 以上なら VPS の PG をアップグレードしてから（pg_dump は新→旧に restore できない） |
| DB サイズ | 数百 MB までなら本ガイドの手順そのままで数分。GB 級なら dump 所要時間を見て切替時間帯を計画 |
| 拡張 | `plpgsql` 以外があれば、§2 の DB 作成後に VPS 側で `CREATE EXTENSION <名前>;` が必要 |

---

## 2. VPS 側: DB・ロール・PgBouncer エントリの追加

`<app>` を実際のアプリ名に置換し、deploy ユーザーで実行する。

### 2-1. ロールと DB の作成（パスワードは表示せずファイル保管）

```bash
ssh deploy@<VPS_IP> 'bash -s' <<'EOF'
set -e
APP=<app>
PW=$(openssl rand -base64 64 | tr -dc "A-Za-z0-9" | head -c 40)
sudo install -m 600 -o root -g root /dev/null /root/${APP}-db-credentials.txt
echo "${APP}_app / ${APP} DB password: $PW" | sudo tee /root/${APP}-db-credentials.txt > /dev/null
echo "CREATE ROLE ${APP}_app LOGIN PASSWORD '$PW';
CREATE DATABASE ${APP} OWNER ${APP}_app;" | sudo -u postgres psql -q
echo "done"
EOF
```

### 2-2. pg_hba にアプリ行を追加

```bash
ssh deploy@<VPS_IP> 'sudo sed -i "/^# TYPE/a host  <app>  <app>_app  127.0.0.1\/32  scram-sha-256" /etc/postgresql/17/main/pg_hba.conf && sudo systemctl reload postgresql@17-main'
```

### 2-3. PgBouncer に DB エントリとユーザーを追加

```bash
ssh deploy@<VPS_IP> 'bash -s' <<'EOF'
set -e
APP=<app>
# [databases] セクション直後にエントリ追加
sudo sed -i "/^\[databases\]/a ${APP} = host=127.0.0.1 port=5432 dbname=${APP}" /etc/pgbouncer/pgbouncer.ini
# userlist.txt に SCRAM ハッシュを追記（平文は書かない）
sudo -u postgres psql -Atc \
  "SELECT '\"' || rolname || '\" \"' || rolpassword || '\"' FROM pg_authid WHERE rolname='${APP}_app'" \
  | sudo tee -a /etc/pgbouncer/userlist.txt > /dev/null
# stats_users に追記したい場合は pgbouncer.ini の stats_users をカンマ区切りで編集（任意）
sudo systemctl reload pgbouncer   # reload なら既存アプリの接続は切れない
EOF
```

> **注意**: `restart` ではなく `reload` を使うこと。restart すると稼働中の他アプリ（AIStory 等）の接続が一瞬切れる。

### 2-4. バックアップ対象に追加

`/usr/local/bin/backup-db.sh` の pg_dump 行を複製して新 DB を追加する:

```bash
ssh deploy@<VPS_IP> 'sudo sed -i "/^pg_dump -Fc/a pg_dump -Fc <app> -f \"\$BACKUP_DIR/<app>_\$(date +%Y%m%d).dump\"" /usr/local/bin/backup-db.sh'
# 世代削除の find は aistory_*.dump 固定なので、初回のみ全 DB 共通パターンに直す:
ssh deploy@<VPS_IP> "sudo sed -i \"s/-name 'aistory_\*.dump'/-name '*_*.dump'/\" /usr/local/bin/backup-db.sh"
# 動作確認（手動実行 → 新 DB の dump ができること）
ssh deploy@<VPS_IP> 'sudo -u postgres /usr/local/bin/backup-db.sh && sudo ls -lh /var/backups/postgres/'
```

### 2-5. 接続検証（移行先がまだ空の状態で）

アプリのリポジトリから、本番と同じ経路（PgBouncer + TLS）で疎通確認:

```bash
# パスワードを一時取得（表示しない）
ssh deploy@<VPS_IP> 'sudo awk "{print \$NF}" /root/<app>-db-credentials.txt' > /tmp/dbpw && chmod 600 /tmp/dbpw

PW=$(tr -d '\n' < /tmp/dbpw) \
&& TEST_URL="postgresql://<app>_app:${PW}@<VPS_IP>:<PGB_PORT>/<app>?pgbouncer=true&sslmode=require&connection_limit=5" \
npx tsx -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient({ datasourceUrl: process.env.TEST_URL });
p.\$queryRawUnsafe('SELECT current_database()').then(console.log).finally(() => p.\$disconnect());
"
rm -f /tmp/dbpw
```

---

## 3. リハーサル（本番切替前に必ず1回）

実データで dump → restore → 件数照合を予行する。**Azure は読み取りのみでサービス無停止**。

```bash
# ローカル .env の DATABASE_URL から Prisma 専用パラメータを除去した URL を作る（重要・§6 ハマりどころ参照）
AZURE_URL="$(grep -m1 '^DATABASE_URL=' .env | cut -d'"' -f2 | cut -d'?' -f1)?sslmode=require"

ssh deploy@<VPS_IP> "AZURE_URL='${AZURE_URL}' bash -s" <<'EOF'
set -e
APP=<app>
pg_dump "$AZURE_URL" -Fc -f /tmp/${APP}_rehearsal.dump
sudo -u postgres createdb -O ${APP}_app ${APP}_verify
PW=$(sudo awk '{print $NF}' /root/${APP}-db-credentials.txt)
pg_restore -d "postgresql://${APP}_app:$PW@127.0.0.1:5432/${APP}_verify" --no-owner --no-privileges /tmp/${APP}_rehearsal.dump
# 全テーブル行数を Azure と突き合わせ（ゼロ差分なら成功）
Q='SELECT relname || $$:$$ || n_live_tup FROM pg_stat_user_tables ORDER BY relname'
diff <(psql "$AZURE_URL" -Atc "$Q") <(PGPASSWORD=$PW psql -h 127.0.0.1 -U ${APP}_app -d ${APP}_verify -Atc "$Q") && echo "完全一致"
# 後片付け
sudo -u postgres dropdb ${APP}_verify
rm -f /tmp/${APP}_rehearsal.dump
EOF
```

---

## 4. 本番切替（実施中はそのアプリを使わない）

dump 取得〜Vercel 切替の間の書き込みは失われる。アクセスの少ない時間帯に実施する。

1. **直前バックアップ**: アプリに既存のバックアップツールがあれば実行（AIStory なら `npx tsx tools/export-to-sql.ts`）
2. **最終 dump → 本番リストア → 照合**（§3 とほぼ同じ。restore 先を `<app>` 本体に、dump は切り戻し用に VPS へ保管）:

```bash
AZURE_URL="$(grep -m1 '^DATABASE_URL=' .env | cut -d'"' -f2 | cut -d'?' -f1)?sslmode=require"
ssh deploy@<VPS_IP> "AZURE_URL='${AZURE_URL}' bash -s" <<'EOF'
set -e
APP=<app>
pg_dump "$AZURE_URL" -Fc -f /tmp/azure_final.dump
sudo install -m 600 -o postgres -g postgres /tmp/azure_final.dump /var/backups/postgres/${APP}_azure_final_$(date +%Y%m%d).dump
PW=$(sudo awk '{print $NF}' /root/${APP}-db-credentials.txt)
pg_restore -d "postgresql://${APP}_app:$PW@127.0.0.1:5432/${APP}" --no-owner --no-privileges /tmp/azure_final.dump
rm -f /tmp/azure_final.dump
Q='SELECT relname || $$:$$ || n_live_tup FROM pg_stat_user_tables ORDER BY relname'
diff <(psql "$AZURE_URL" -Atc "$Q") <(PGPASSWORD=$PW psql -h 127.0.0.1 -U ${APP}_app -d ${APP} -Atc "$Q") && echo "全テーブル行数: 完全一致"
PGPASSWORD=$PW psql -h 127.0.0.1 -U ${APP}_app -d ${APP} -Atc "SELECT migration_name FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 3"
EOF
```

3. **Vercel 切替**: Settings → Environment Variables → `DATABASE_URL` を以下に差し替え（**旧 Azure 値は切り戻し用に必ず控える**）→ Redeploy:

```
postgresql://<app>_app:<PW>@<VPS_IP>:<PGB_PORT>/<app>?pgbouncer=true&sslmode=require&connection_limit=5
```

4. **ローカル `.env` も同じ URL に切替**（migrate 時の注意は §5）
5. **動作確認**: 本番サイトで読み取り・書き込み両方を踏む操作を1巡
6. **並走監視（2週間）**: Azure は停止せず残置。Vercel Functions ログのエラー有無・日次バックアップの生成・接続プール状況を確認。問題なければ Azure の該当 DB を削除（全アプリ移行完了後にサーバーごと解約）

**切り戻し**: Vercel の `DATABASE_URL` を控えておいた Azure 値に戻して Redeploy（5分）。切替後に VPS へ書き込まれたデータは戻らないため、判断は早いほど良い。

---

## 5. 移行後の運用ルール

- **`prisma migrate` は PgBouncer 経由では実行不可**。スキーマ変更時は SSH トンネルで直結する:
  ```bash
  ssh -f -N -L 15432:localhost:5432 deploy@<VPS_IP>
  DATABASE_URL="postgresql://<app>_app:<PW>@localhost:15432/<app>?schema=public" npx prisma migrate deploy
  ```
- アプリ実行用 URL には **`pgbouncer=true` を必ず付ける**（Prisma が prepared statement を無効化し transaction モードと互換になる）
- パスワードは VPS の `/root/<app>-db-credentials.txt` が原本。`ssh deploy@<VPS_IP> 'sudo cat /root/<app>-db-credentials.txt'` で取得

---

## 6. ハマりどころ集（AIStory 移行の実体験）

| 症状 | 原因と対処 |
|------|-----------|
| `pg_dump: error: invalid URI query parameter: "schema"` / `"connection_limit"` | `.env` の URL に付く **Prisma 専用パラメータを pg_dump は解釈できない**。`?` 以降を全部捨てて `?sslmode=require` だけ付け直す（§3 の URL 加工コマンドを使う） |
| PgBouncer 経由で `prisma migrate` がエラー | 仕様（transaction モード非対応）。SSH トンネル直結で実行する（§5） |
| 非 TLS で接続できてしまう気がする | 正常なら `FATAL: SSL required` で拒否される。なるなら `client_tls_sslmode = require` を確認 |
| `sudo -u postgres <スクリプト>` が `find: Failed to restore initial working directory` で失敗 | postgres が読めないディレクトリ（/home/deploy 等）から実行したのが原因。backup-db.sh には `cd "$BACKUP_DIR"` を入れて対策済み |
| PgBouncer の設定変更後、他アプリの接続が切れた | `systemctl restart` を使ったため。**`reload` を使う** |
| Azure の PG バージョンが VPS より新しい | pg_restore 不可。VPS 側 PG を PGDG で揃えてから移行する（AIStory 時は Azure 17.9 → VPS 17.10 で問題なし） |

---

## 7. 完了チェックリスト（アプリごと）

- [ ] Azure 事前確認（バージョン・サイズ・拡張）
- [ ] ロール・DB 作成、パスワードは `/root/<app>-db-credentials.txt` とパスワードマネージャのみ
- [ ] pg_hba 追記 + reload
- [ ] PgBouncer `[databases]` + userlist 追記 + **reload**
- [ ] backup-db.sh に dump 行追加・手動実行で生成確認
- [ ] PgBouncer 経由の疎通確認（Prisma・TLS）
- [ ] リハーサル（verify DB で全テーブル行数一致 → 破棄）
- [ ] 本番切替（最終 dump 保管 → リストア → 照合 → Vercel/ローカル URL 切替 → 動作確認）
- [ ] 2週間並走 → Azure 側 DB 削除

---

## 改訂履歴

| 版数 | 日付 | コミット | 内容 | 担当 |
|------|------|---------|------|------|
| 1.0 | 2026-06-12 | - | 初版作成（AIStory Phase 1 移行の実績から汎用化） | Claude |
