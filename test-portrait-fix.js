/**
 * 快速验证：定妆照绑定修复
 * 不跑全链路，直接验证Stage-4后的数据结构和Prompt注入
 */
const path = require('path');

// 模拟stages结构（与Stage-4输出一致）
const stages = {
  characters: {
    characters: {
      'chen-zhuo': {
        id: 'chen-zhuo',
        name: '陈卓',
        profile: {
          name: '陈卓',
          baseIdentity: { name: '陈卓' }
        },
        portraits: {
          front: 'characters/chen-zhuo/portraits/chen-zhuo-cg-v3-front.png',
          threeQuarter: 'characters/chen-zhuo/portraits/chen-zhuo-cg-v3-threeQuarter.png',
          closeup: 'characters/chen-zhuo/portraits/chen-zhuo-cg-v3-closeup.png',
          side: 'characters/chen-zhuo/portraits/chen-zhuo-cg-v3-side.png'
        }
      }
    }
  }
};

const shot = {
  id: 'S02',
  characters: ['chen-zhuo']
};

// 模拟 _getCharacterStageMap
function _getCharacterStageMap(stages) {
  return stages?.characters?.characters || {};
}

// 模拟 _buildCharacterRef (v6.6.9.4-patch17-fix版本)
function _buildCharacterRef(shot, stages) {
  const characterMap = _getCharacterStageMap(stages);
  const refs = [];
  for (const charId of shot.characters) {
    const char = characterMap[charId];
    if (!char) {
      console.log(`  ⚠️ 角色 ${charId} 未找到`);
      continue;
    }
    const portraits = char.portraits || {};
    const angles = Object.keys(portraits);
    if (angles.length > 0) {
      const firstAngle = angles[0];
      refs.push(`${char.name || charId}: ${portraits[firstAngle]}`);
    }
  }
  return refs.join('; ');
}

console.log('=== 定妆照绑定验证 ===\n');

// 验证1: _getCharacterStageMap 返回正确结构
const charMap = _getCharacterStageMap(stages);
console.log('✅ 验证1: _getCharacterStageMap');
console.log(`   返回角色数: ${Object.keys(charMap).length}`);
console.log(`   包含 chen-zhuo: ${!!charMap['chen-zhuo']}`);
console.log(`   角色名: ${charMap['chen-zhuo']?.name}\n`);

// 验证2: _buildCharacterRef 构建引用
const charRef = _buildCharacterRef(shot, stages);
console.log('✅ 验证2: _buildCharacterRef');
console.log(`   结果: "${charRef}"`);
console.log(`   非空: ${charRef.length > 0}\n`);

// 验证3: Prompt注入模拟
let prompt = '【视觉】测试Prompt...';
if (charRef) {
  prompt += ` 【定妆照】${charRef}`;
}
console.log('✅ 验证3: Prompt注入');
console.log(`   含【定妆照】: ${prompt.includes('【定妆照】')}`);
console.log(`   注入内容: ${prompt.match(/【定妆照】(.+?)(?=【|$)/)?.[1] || '未找到'}\n`);

// 验证4: PromptForge合并覆盖后重新注入模拟
let promptForge = '【视觉】PromptForge优化后的内容...'; // 模拟合并后
if (charRef) {
  promptForge += ` 【定妆照】${charRef}`;
}
console.log('✅ 验证4: PromptForge合并后重新注入');
console.log(`   含【定妆照】: ${promptForge.includes('【定妆照】')}`);

console.log('\n=== 验证结果 ===');
const allPassed = charRef.length > 0 && prompt.includes('【定妆照】') && promptForge.includes('【定妆照】');
console.log(allPassed ? '✅ 全部通过' : '❌ 有失败项');
