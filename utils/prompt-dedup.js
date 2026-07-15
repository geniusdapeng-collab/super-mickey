// Prompt去重工具：防止创意部分与系统模板重复
module.exports = {
  /**
   * 简单去重：如果创意部分包含系统模板的关键词块，移除重复
   */
  dedup(creative, systemTemplate) {
    // 提取系统模板中的【标签】内容
    const systemBlocks = [];
    const blockRegex = /【([^】]+)】([^【]*)/g;
    let m;
    while ((m = blockRegex.exec(systemTemplate)) !== null) {
      systemBlocks.push({ tag: m[1], content: m[2].trim() });
    }

    let cleaned = creative;
    for (const block of systemBlocks) {
      // 如果创意部分有相同标签，移除
      const tagRegex = new RegExp(`【${block.tag}】[^【]*`);
      if (tagRegex.test(cleaned)) {
        cleaned = cleaned.replace(tagRegex, '');
      }
    }

    // 清理多余分隔符
    return cleaned.replace(/\n{3,}/g, '\n\n').trim();
  }
};
