#!/usr/bin/env node
/**
 * 角色定妆照状态检查工具
 * 用法：node scripts/check-portraits.js [角色ID]
 * 
 * 示例：
 *   node scripts/check-portraits.js          # 检查所有角色
 *   node scripts/check-portraits.js xiaoG    # 检查AgentX
 *   node scripts/check-portraits.js nuanNuan # 检查暖暖
 */

const { CharacterPortraitEnforcer } = require('../systems/character-portrait-enforcer-v2.js');

const targetChar = process.argv[2];
const enforcer = new CharacterPortraitEnforcer();

console.log('🔍 角色定妆照状态检查\n');

if (targetChar) {
  // 检查指定角色
  console.log(`检查角色: ${targetChar}\n`);
  const result = enforcer._checkCharacter(targetChar);
  
  if (result.pass) {
    console.log('✅ 通过');
    if (result.isNativeCreature) {
      console.log('   类型: Nirath原生幻想生物（文字锚定）');
    } else {
      console.log('   类型: 人类角色（照片定妆照）');
      console.log(`   版本: ${result.version}`);
      console.log(`   定妆照: ${result.portraitCount}张`);
      console.log(`   角度: ${result.angles?.join(', ')}`);
    }
  } else {
    console.log('❌ 未通过');
    console.log(`   原因: ${result.reason}`);
    for (const err of result.errors) {
      console.log(`   ${err}`);
    }
  }
} else {
  // 检查所有角色
  const audit = enforcer.auditAll();
  
  console.log(`总计: ${audit.total}个角色 | ✅${audit.pass}通过 | ❌${audit.fail}待修复\n`);
  
  for (const c of audit.characters) {
    const icon = c.pass ? '✅' : '❌';
    const type = c.isNativeCreature ? '[原生]' : '[人类]';
    const status = c.pass 
      ? (c.isNativeCreature ? '文字锚定OK' : `定妆照v${c.version}`)
      : c.errors[0];
    console.log(`${icon} ${c.charId} ${type} | ${status}`);
  }
  
  if (audit.fail > 0) {
    console.log('\n📋 修复建议:');
    const missing = audit.characters.filter(c => !c.pass);
    for (const c of missing) {
      console.log(`   node generate-portraits.js ${c.charId}`);
    }
  }
}
