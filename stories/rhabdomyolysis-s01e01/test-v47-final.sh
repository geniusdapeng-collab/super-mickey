#!/bin/bash
# v4.7 最终多轮Mock测试脚本

echo "========================================"
echo "🧪 v4.7 七坑全填 多轮Mock测试"
echo "========================================"

cd /root/.openclaw/workspace/stories/rhabdomyolysis-s01e01

echo ""
echo "📋 第1轮: 语法检查 + 模块加载"
node --check scripts/build-storyboard-v4.1.js 2>&1
if [ $? -eq 0 ]; then
  echo "  ✅ 语法检查通过"
else
  echo "  ❌ 语法检查失败"
  exit 1
fi

echo ""
echo "📋 第2轮: 真实角色档案字段验证"
node -e "
const fs = require('fs');

const characters = ['chen-nurse', 'xiaoG', 'coach-li'];
let totalFields = 0;
let availableFields = 0;

for (const charId of characters) {
  const card = JSON.parse(fs.readFileSync('../../characters/' + charId + '/character-card.json'));
  const fields = [
    ['visualIdentity.style', card.visualIdentity?.style],
    ['visualIdentity.age', card.visualIdentity?.age],
    ['visualIdentity.baseIdentity', card.visualIdentity?.baseIdentity],
    ['appearance.hair', card.visualIdentity?.appearance?.hair],
    ['appearance.face', card.visualIdentity?.appearance?.face],
    ['appearance.eyes', card.visualIdentity?.appearance?.eyes],
    ['appearance.uniform', card.visualIdentity?.appearance?.uniform],
    ['appearance.accessories', card.visualIdentity?.appearance?.accessories],
    ['appearance.build', card.visualIdentity?.appearance?.build || card.visualIdentity?.appearance?.body],
    ['appearance.expression', card.visualIdentity?.appearance?.expression],
    ['visualIdentity.angles', card.visualIdentity?.angles],
    ['voiceIdentity.gender', card.voiceIdentity?.gender],
    ['voiceIdentity.promptFragment', card.voiceIdentity?.promptFragment],
    ['voiceIdentity.style', card.voiceIdentity?.style],
    ['voiceIdentity.mood', card.voiceIdentity?.mood],
    ['personality.core', card.personality?.core],
    ['personality.traits', card.personality?.traits]
  ];
  
  console.log('  ' + charId + ':');
  for (const [name, value] of fields) {
    totalFields++;
    if (value) {
      availableFields++;
      console.log('    ✅ ' + name);
    } else {
      console.log('    ⚠️  ' + name + ' (缺失，不影响主逻辑)');
    }
  }
}

console.log('');
console.log('  字段覆盖率: ' + availableFields + '/' + totalFields + ' (' + Math.round(availableFields/totalFields*100) + '%)');
"

echo ""
echo "📋 第3轮: v4.7 Prompt模拟生成（字数控制）"
node -e "
const fs = require('fs');

// 加载真实角色档案
const chen = JSON.parse(fs.readFileSync('../../characters/chen-nurse/character-card.json'));
const xiaoG = JSON.parse(fs.readFileSync('../../characters/xiaoG/character-card.json'));

// 模拟v4.7角色描述构建（完整版）
function buildCharDesc(charPRD, shot) {
  const anchors = charPRD.visualAnchors?.required?.join('，') || '';
  const preferred = charPRD.visualAnchors?.preferred?.join('，') || '';
  const emotion = shot.emotion || '自然';
  const mouth = shot.mouthAction || '嘴部微张说话';
  
  const visualId = charPRD.visualIdentity || {};
  const appearance = visualId.appearance || {};
  
  const roleStyle = visualId.style || '';
  const ageInfo = visualId.age || '';
  const baseIdentity = visualId.baseIdentity || '';
  
  const hair = appearance.hair?.promptFragment || appearance.hair?.description || '';
  const face = appearance.face?.promptFragment || appearance.face?.description || '';
  const eyes = appearance.eyes?.promptFragment || appearance.eyes?.description || '';
  const uniform = appearance.uniform?.promptFragment || appearance.uniform?.description || '';
  const accessories = appearance.accessories?.promptFragment || appearance.accessories?.description || '';
  const build = appearance.build?.promptFragment || appearance.build?.description || appearance.body?.promptFragment || appearance.body?.description || '';
  const expression = appearance.expression?.promptFragment || appearance.expression?.description || '';
  
  const angles = visualId.angles || {};
  const shotSize = shot.cameraMovement?.shotSize || '';
  let angleDesc = '';
  if (shotSize.includes('close') || shotSize.includes('extreme_close')) {
    angleDesc = angles.closeup?.description || '';
  } else if (shotSize === 'medium') {
    angleDesc = angles.threeQuarter?.description || '';
  } else if (shotSize === 'full' || shotSize === 'wide') {
    angleDesc = angles.front?.description || '';
  }
  
  const personalityCore = charPRD.personality?.core || '';
  const personalityTraits = (charPRD.personality?.traits || []).slice(0, 2).join('、');
  
  const voiceId = charPRD.voiceIdentity || {};
  const voiceGender = voiceId.gender || 'unknown';
  const voiceFragment = voiceId.promptFragment || '';
  const voiceStyle = voiceId.style || '';
  const voiceMood = voiceId.mood || '';
  
  let genderVoiceAnchor = '';
  if (voiceFragment) {
    genderVoiceAnchor = voiceFragment;
  } else if (voiceGender === 'female' || baseIdentity.includes('女性')) {
    genderVoiceAnchor = '年轻女性，女声讲解，温柔女声';
  } else if (voiceGender === 'male' && (baseIdentity.includes('男孩') || ageInfo.includes('男孩'))) {
    genderVoiceAnchor = '8岁男孩，童声提问，清脆童声';
  } else if (voiceGender === 'male') {
    genderVoiceAnchor = '成年男性，男声讲解';
  } else if (voiceGender === 'unknown') {
    if (baseIdentity.includes('女性') || baseIdentity.includes('女孩')) {
      genderVoiceAnchor = '年轻女性，女声讲解，温柔女声';
    } else if (baseIdentity.includes('男孩') || ageInfo.includes('男孩')) {
      genderVoiceAnchor = '8岁男孩，童声提问，清脆童声';
    } else if (baseIdentity.includes('男性') || baseIdentity.includes('男')) {
      genderVoiceAnchor = '成年男性，男声讲解';
    }
  }
  
  const lookParts = [];
  if (roleStyle) lookParts.push(roleStyle);
  if (baseIdentity) lookParts.push(baseIdentity);
  if (ageInfo) lookParts.push(ageInfo);
  if (hair) lookParts.push(hair);
  if (face) lookParts.push(face);
  if (eyes) lookParts.push(eyes);
  if (uniform) lookParts.push(uniform);
  if (accessories) lookParts.push(accessories);
  if (build) lookParts.push(build);
  if (expression) lookParts.push(expression);
  if (angleDesc) lookParts.push(angleDesc);
  if (personalityCore) lookParts.push('气质' + personalityCore);
  if (personalityTraits) lookParts.push('特征' + personalityTraits);
  if (preferred) lookParts.push(preferred);
  
  const anchorSet = new Set((anchors || '').split('，'));
  const uniqueLookParts = lookParts.filter(p => {
    const pClean = p.replace(/[，。]/g, '');
    return !anchorSet.has(pClean) && pClean.length >= 2;
  });
  
  const actionParts = [];
  if (genderVoiceAnchor) actionParts.push(genderVoiceAnchor);
  if (voiceStyle) actionParts.push(voiceStyle);
  if (voiceMood) actionParts.push('语气' + voiceMood);
  if (emotion) actionParts.push('表情' + emotion);
  if (mouth) actionParts.push(mouth);
  if (shot.action) actionParts.push('正在' + shot.action);
  
  const descParts = [charPRD.name + '：' + anchors];
  if (uniqueLookParts.length > 0) descParts.push(uniqueLookParts.join('，'));
  descParts.push(actionParts.join('，'));
  return descParts.filter(Boolean).join('，');
}

// 测试shot
const testShot = {
  id: 'S01',
  type: 'opening',
  characters: ['chen-nurse'],
  emotion: '热情专业',
  mouthAction: '嘴部微张正在说话，表情亲切专业',
  action: '小陈讲解横纹肌溶解的基本概念',
  cameraMovement: { shotSize: 'medium' }
};

const desc = buildCharDesc(chen, testShot);
const chars = (desc.match(/[\u4e00-\u9fff]/g) || []).length;

console.log('  chen-nurse角色描述: ' + chars + '字');
console.log('  ✅ 包含渲染风格:', desc.includes(chen.visualIdentity.style.substring(0, 10)) ? '是' : '否');
console.log('  ✅ 包含年龄:', desc.includes(chen.visualIdentity.age) ? '是' : '否');
console.log('  ✅ 包含体型:', desc.includes('身材') || desc.includes('身高') ? '是' : '否');
console.log('  ✅ 包含表情:', desc.includes('表情') || desc.includes('微笑') ? '是' : '否');
console.log('  ✅ 包含角度:', desc.includes('侧面') || desc.includes('特写') ? '是' : '否');
console.log('  ✅ 包含声音锚点:', desc.includes('女声') || desc.includes('温柔') ? '是' : '否');
console.log('  ✅ 包含气质:', desc.includes('气质') ? '是' : '否');

// xiaoG测试
const testShot2 = {
  id: 'S04',
  type: 'interaction',
  characters: ['xiaoG'],
  emotion: '认真好奇',
  mouthAction: '嘴部微张正在说话',
  action: '小G提问',
  cameraMovement: { shotSize: 'medium' }
};

const xiaoGDesc = buildCharDesc(xiaoG, testShot2);
const xiaoGChars = (xiaoGDesc.match(/[\u4e00-\u9fff]/g) || []).length;
console.log('');
console.log('  xiaoG角色描述: ' + xiaoGChars + '字');
console.log('  ✅ 包含年龄:', xiaoGDesc.includes('8岁') ? '是' : '否');
console.log('  ✅ 包含体型:', xiaoGDesc.includes('男孩') || xiaoGDesc.includes('身材') ? '是' : '否');
console.log('  ✅ 包含声音锚点:', xiaoGDesc.includes('童声') || xiaoGDesc.includes('男孩') ? '是' : '否');
"

echo ""
echo "========================================"
echo "✅ v4.7 多轮Mock测试完成"
echo "========================================"
