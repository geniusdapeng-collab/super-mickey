    // 通用提取：取标题前10字 + "主题"
    // 【v2.1.15-fix 主题漂移】取标题第一个语义完整子句（≤20字符）+ "主题"
    // 原实现硬截前10字："滕王阁穿越记：60多主题"式的腰斩标签
    const clause = String(title).split(/[，。！？；：:]/)[0].trim();
    const base = (clause.length <= 20 ? clause : clause.substring(0, 20)) || String(title).substring(0, 20);
    return base + '主题';
