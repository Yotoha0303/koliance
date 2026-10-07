#!/usr/bin/env bash
# ==============================================================================
# Koliance Dev Context Synchronizer
# Usage:
#   ./scripts/sync-context.sh "你的上下文信息"           # 默认推送到 general 模块
#   ./scripts/sync-context.sh agentcard "卡片规则修改..." # 指定模块推送
#   ./scripts/sync-context.sh pull                     # 拉取最新 5 条上下文
#   ./scripts/sync-context.sh pull 10                  # 拉取最新 10 条上下文
# ==============================================================================

set -euo pipefail

# 1. 解析环境变量或默认值
SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-https://kjsggytvrmpkmlytkdri.supabase.co}"
SUPABASE_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-sb_publishable_bnZzhsY4gqOQc_2n3_wBUA_X622_pre}"

# 如果根目录或 backend 存在 .env.local / .env，尝试读取
if [ -f "$(dirname "$0")/../.env.local" ]; then
    VAL_URL=$(grep "^NEXT_PUBLIC_SUPABASE_URL=" "$(dirname "$0")/../.env.local" | cut -d '=' -f2- | tr -d '"' | tr -d "'" || true)
    VAL_KEY=$(grep "^NEXT_PUBLIC_SUPABASE_ANON_KEY=" "$(dirname "$0")/../.env.local" | cut -d '=' -f2- | tr -d '"' | tr -d "'" || true)
    [ -n "$VAL_URL" ] && SUPABASE_URL="$VAL_URL"
    [ -n "$VAL_KEY" ] && SUPABASE_KEY="$VAL_KEY"
fi

# 获取当前 git 用户名或系统用户名
AUTHOR=$(git config user.name 2>/dev/null || whoami || echo "developer")

# 颜色定义
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

show_help() {
    echo -e "${CYAN}=== Koliance Dev Context Sync Tool ===${NC}"
    echo "用法:"
    echo "  $0 pull [数量]               拉取最近的上下文记录 (默认 5 条)"
    echo "  $0 <内容>                    推送上下文到 'general' 模块"
    echo "  $0 <模块名> <内容>            推送上下文到指定模块 (如 agentcard, steam, market)"
    echo ""
    echo "示例:"
    echo "  $0 pull"
    echo "  $0 \"修复了 Supabase 客户端连接池断连的问题\""
    echo "  $0 agentcard \"BIN 码已规范为 400000，密钥矩阵加入 sessionKey 过期时间\""
}

if [ $# -eq 0 ]; then
    show_help
    exit 0
fi

# ==============================================================================
# 2. PULL 命令
# ==============================================================================
if [ "$1" = "pull" ] || [ "$1" = "list" ]; then
    LIMIT="${2:-5}"
    echo -e "${CYAN}[Koliance Context]${NC} 正在从 Supabase 拉取最新 ${LIMIT} 条上下文记录..."
    
    RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "${SUPABASE_URL}/rest/v1/dev_contexts?select=author,module,summary,created_at&order=created_at.desc&limit=${LIMIT}" \
        -H "apikey: ${SUPABASE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_KEY}" \
        -H "Content-Type: application/json")

    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" != "200" ]; then
        echo -e "${RED}[错误]${NC} 拉取失败 (HTTP $HTTP_CODE): $BODY"
        if echo "$BODY" | grep -q "PGRST205"; then
            echo -e "${YELLOW}[提示]${NC} 数据库表 'dev_contexts' 尚未创建，请先在 Supabase SQL Editor 执行 scripts/init_dev_contexts.sql"
        fi
        exit 1
    fi

    # 格式化输出 (使用 node 解析 JSON，无须额外安装 jq)
    node -e "
        const items = JSON.parse(process.argv[1] || '[]');
        if (!items || items.length === 0) {
            console.log('\x1b[33m暂无任何同步的上下文记录。\x1b[0m');
            process.exit(0);
        }
        console.log('\n------------------------------------------------------------');
        items.forEach((item, idx) => {
            const time = new Date(item.created_at).toLocaleString();
            console.log(\`\x1b[32m#\${idx + 1} [\${item.module || 'general'}]\x1b[0m \x1b[1m\${item.author}\x1b[0m (\${time})\`);
            console.log(\`  \${item.summary.replace(/\\n/g, '\n  ')}\`);
            console.log('------------------------------------------------------------');
        });
    " "$BODY"
    exit 0
fi

# ==============================================================================
# 3. PUSH 命令
# ==============================================================================
MODULE="general"
SUMMARY=""

if [ $# -eq 1 ]; then
    SUMMARY="$1"
else
    MODULE="$1"
    SUMMARY="$2"
fi

if [ -z "$SUMMARY" ]; then
    echo -e "${RED}[错误]${NC} 上下文内容不能为空！"
    exit 1
fi

# 构造 JSON Payload
PAYLOAD=$(node -e "
    console.log(JSON.stringify({
        author: process.argv[1],
        module: process.argv[2],
        summary: process.argv[3]
    }));
" "$AUTHOR" "$MODULE" "$SUMMARY")

echo -e "${CYAN}[Koliance Context]${NC} 正在同步上下文 [模块: ${YELLOW}${MODULE}${NC}, 作者: ${GREEN}${AUTHOR}${NC}]..."

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${SUPABASE_URL}/rest/v1/dev_contexts" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d "$PAYLOAD")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}[成功]${NC} 上下文已写入 Supabase Registry！Co-founder 执行 \`./scripts/sync-context.sh pull\` 即可拉取。"
else
    echo -e "${RED}[错误]${NC} 推送失败 (HTTP $HTTP_CODE): $BODY"
    if echo "$BODY" | grep -q "PGRST205"; then
        echo -e "${YELLOW}[提示]${NC} 数据库表 'dev_contexts' 尚未创建，请先在 Supabase SQL Editor 执行 scripts/init_dev_contexts.sql"
    fi
    exit 1
fi
