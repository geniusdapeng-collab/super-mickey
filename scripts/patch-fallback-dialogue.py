#!/usr/bin/env python3

with open('/root/.openclaw/workspace/systems/nirath-master-pipeline.js', 'r') as f:
    content = f.read()

# 修复fallback dialogue，确保使用正确的角色名称
old_dialogue = """  _buildFallbackDialogue(scene, characters = {}) {
    const name = scene.name || '当前场景';
    
    // v6.5.29: 获取角色名称，确保角色出现在dialogue中
    const charNames = Object.values(characters || {}).map(c => c.name || c.id || '').filter(Boolean);
    const speaker = charNames[0] || '主持人';
    
    if (scene.type === 'establishing') {
      return `大家好，我是${speaker}，今天我们来了解一下${name}相关的核心内容。`;
    }
    
    if (scene.type === 'explanation') {
      return `这一部分${speaker}重点讲解${name}，帮助大家快速抓住关键知识点。`;
    }
    
    if (scene.type === 'demonstration') {
      return `接下来${speaker}通过一个示范动作，直观理解${name}的表现和检查方式。`;
    }
    
    if (scene.type === 'closing') {
      return `最后再强调一次，如果出现相关症状，一定要及时就医，不要拖延。`;
    }
    
    return `下面进入${name}。`;
  }"""

new_dialogue = """  _buildFallbackDialogue(scene, characters = {}) {
    const name = scene.name || '当前场景';
    
    // v6.5.29: 获取角色名称，确保角色出现在dialogue中
    const charNames = Object.values(characters || {}).map(c => c.name || c.id || '').filter(Boolean);
    const speaker = charNames[0] || '主持人';
    
    // 获取场景指定的角色（优先使用场景的角色列表）
    const sceneChars = (scene.characters || []).map(cid => {
      const char = characters[cid];
      return char ? (char.name || char.id) : cid;
    }).filter(Boolean);
    const sceneSpeaker = sceneChars[0] || speaker;
    
    if (scene.type === 'establishing') {
      return `大家好，我是${sceneSpeaker}，今天我们来了解一下${name}相关的核心内容。`;
    }
    
    if (scene.type === 'explanation') {
      return `这一部分${sceneSpeaker}重点讲解${name}，帮助大家快速抓住关键知识点。`;
    }
    
    if (scene.type === 'demonstration') {
      return `接下来${sceneSpeaker}通过一个示范动作，直观理解${name}的表现和检查方式。`;
    }
    
    if (scene.type === 'closing') {
      return `最后${sceneSpeaker}再强调一次，如果出现相关症状，一定要及时就医，不要拖延。`;
    }
    
    return `下面${sceneSpeaker}进入${name}。`;
  }"""

content = content.replace(old_dialogue, new_dialogue)

with open('/root/.openclaw/workspace/systems/nirath-master-pipeline.js', 'w') as f:
    f.write(content)

print("✅ fallback dialogue角色修复完成")
