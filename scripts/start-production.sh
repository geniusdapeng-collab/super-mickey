#!/bin/bash
# SuperMickey v2.1.0 生产环境启动脚本
# Usage: ./scripts/start-production.sh

set -e

echo "🎬 [SuperMickey v2.1.0] 生产环境启动"
echo "===================================="

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装"
    exit 1
fi
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 版本过低，需要 >= 18"
    exit 1
fi
echo "✅ Node.js $(node -v)"

# 检查 Python（用于 PandaCineForge）
if ! command -v python3 &> /dev/null; then
    echo "⚠️ Python3 未安装，PandaCineForge 将不可用"
else
    echo "✅ Python3 $(python3 --version)"
fi

# 安装依赖（如果 node_modules 不存在）
if [ ! -d "node_modules" ]; then
    echo "📦 安装 Node.js 依赖..."
    npm install
fi

# 检查 Python 依赖（用于 PandaCineForge）
if command -v python3 &> /dev/null; then
    echo "📦 检查 Python 依赖..."
    pip3 install -q openai numpy 2>/dev/null || echo "⚠️ pip install 可能需要手动执行"
fi

# 启动 PandaCineForge 服务（如果需要）
PCF_PORT=${PCF_PORT:-8765}
if lsof -Pi :$PCF_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "✅ PandaCineForge 服务已在端口 $PCF_PORT 运行"
else
    echo "🐼 启动 PandaCineForge 服务..."
    python3 hyperreality-system/skills/panda-cineforge/server.py &
    PCF_PID=$!
    sleep 2
    
    # 等待服务启动
    for i in {1..10}; do
        if curl -s http://127.0.0.1:$PCF_PORT/health >/dev/null 2>&1; then
            echo "✅ PandaCineForge 服务启动成功 (PID: $PCF_PID)"
            break
        fi
        sleep 1
    done
fi

echo ""
echo "🚀 启动 SuperMickey CLI..."
echo "===================================="
node app/cli.js "$@"
