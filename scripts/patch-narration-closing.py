#!/usr/bin/env python3

with open('/root/.openclaw/workspace/systems/nirath-master-pipeline.js', 'r') as f:
    content = f.read()

# 修复narration fallback，确保closing场景完整收束
old_narration = """    return scene.description || '这个场景展示了重要内容。';"""

new_narration = """    // 如果场景类型是closing，添加完整收束句
    if (scene.type === 'closing') {
      return `如果出现相关症状，请及时就医。`;
    }
    
    // 确保description以句号结尾
    const desc = scene.description || '这个场景展示了重要内容。';
    if (!desc.endsWith('。') && !desc.endsWith('！') && !desc.endsWith('？')) {
      return desc + '。';
    }
    return desc;"""

content = content.replace(old_narration, new_narration)

with open('/root/.openclaw/workspace/systems/nirath-master-pipeline.js', 'w') as f:
    f.write(content)

print("✅ narration收束修复完成")
