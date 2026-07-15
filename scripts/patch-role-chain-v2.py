#!/usr/bin/env python3
import re

with open('/root/.openclaw/workspace/systems/nirath-master-pipeline.js', 'r') as f:
    content = f.read()

# 1. 修复角色信息部分，添加角色出场规则
old_role = """    parts.push(`\\n【角色信息】`);
    Object.values(core || {}).forEach((c) => {
      parts.push(`- ${c.id || ''} | 名称:${c.name || ''} | 角色:${c.role || ''}`);
    });"""

new_role = """    parts.push(`\\n【角色信息】`);
    parts.push(`- 当前场景必须包含以下角色之一，禁止空角色`);
    Object.values(core || {}).forEach((c) => {
      parts.push(`- ${c.id || ''} | 名称:${c.name || ''} | 角色:${c.role || ''} | 必须在dialogue中体现`);
    });
    parts.push(`\\n【角色出场规则】`);
    parts.push(`- 每个场景必须明确包含角色名称`);
    parts.push(`- dialogue中角色名称必须完整出现，不能省略`);
    parts.push(`- 禁止生成无角色或角色为"无"的场景`);"""

content = content.replace(old_role, new_role)

# 2. 在场景列表中添加角色绑定要求
old_scene = """    parts.push(`\\n【场景列表】`);
    batch.forEach((scene, idx) => {
      parts.push(`场景${idx + 1}`);
      parts.push(`- id: ${scene.id}`);
      parts.push(`- 名称: ${scene.name || '未命名'}`);
      parts.push(`- 类型: ${scene.type || 'explanation'}`);
      parts.push(`- 时长: ${scene.duration || 10}秒`);
      parts.push(`- 描述: ${scene.description || '无描述'}`);
      parts.push(`- 角色: ${(scene.characters || []).join(', ') || '无'}`);
    });"""

new_scene = """    parts.push(`\\n【场景列表】`);
    batch.forEach((scene, idx) => {
      const sceneChars = (scene.characters || []).join(', ') || '无';
      parts.push(`场景${idx + 1}`);
      parts.push(`- id: ${scene.id}`);
      parts.push(`- 名称: ${scene.name || '未命名'}`);
      parts.push(`- 类型: ${scene.type || 'explanation'}`);
      parts.push(`- 时长: ${scene.duration || 10}秒`);
      parts.push(`- 描述: ${scene.description || '无描述'}`);
      parts.push(`- 角色: ${sceneChars}`);
      parts.push(`- 强制要求: dialogue必须包含角色"${sceneChars}"，禁止空角色`);
    });"""

content = content.replace(old_scene, new_scene)

with open('/root/.openclaw/workspace/systems/nirath-master-pipeline.js', 'w') as f:
    f.write(content)

print("✅ 角色链路修复完成")
