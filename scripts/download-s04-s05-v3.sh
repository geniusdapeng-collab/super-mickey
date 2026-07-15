#!/bin/bash
# 下载 S04/S05 新渲染版本（v6.2-patch90）

cd /root/.openclaw/workspace/taotie-ep01-production

# S04 新渲染
curl -L -o S04-v3.mp4 \
  "https://ark-acg-cn-beijing.tos-cn-beijing.volces.com/doubao-seedance-2-0/02178024646688800000000000000000000ffffac152ff3ebfc7d.mp4?X-Tos-Algorithm=TOS4-HMAC-SHA256&X-Tos-Credential=AKLTYWJkZTExNjA1ZDUyNDc3YzhjNTM5OGIyNjBhNDcyOTQ%2F20260531%2Fcn-beijing%2Ftos%2Frequest&X-Tos-Date=20260531T165753Z&X-Tos-Expires=86400&X-Tos-Signature=824aa8e9e993f019456cedca5d529ff5e0ec151e9a14c40f96a05bfb7de3a1c0&X-Tos-SignedHeaders=host"

# S05 新渲染
curl -L -o S05-v3.mp4 \
  "https://ark-acg-cn-beijing.tos-cn-beijing.volces.com/doubao-seedance-2-0/02178024648114600000000000000000000ffffac17783f4631a1.mp4?X-Tos-Algorithm=TOS4-HMAC-SHA256&X-Tos-Credential=AKLTYWJkZTExNjA1ZDUyNDc3YzhjNTM5OGIyNjBhNDcyOTQ%2F20260531%2Fcn-beijing%2Ftos%2Frequest&X-Tos-Date=20260531T165719Z&X-Tos-Expires=86400&X-Tos-Signature=c7a9b3f8e5bb3f118e18cd8e8306f51057272530597a552df9dafaef2989cd7b&X-Tos-SignedHeaders=host"

ls -la S04-v3.mp4 S05-v3.mp4
