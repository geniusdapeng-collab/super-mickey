# 教训记录：2026-05-24 片头合并错误

## 问题描述
最终成片使用了旧版S01片头，而不是新渲染的S01-v7。

## 根因分析
**合并脚本使用了错误的文件列表文件。**

- 混音脚本生成：`merge_mixed_v2_list.txt`（指向S01-mixed-v2.mp4，新版）
- 合并脚本使用：`merge_mixed_list.txt`（指向S01-mixed.mp4，旧版）

两个列表文件同时存在，合并脚本硬编码了旧列表文件名。

## 错误链条
1. S01-v7渲染完成 ✅
2. S01替换为v7 ✅
3. 混音生成S01-mixed-v2.mp4 ✅
4. **合并脚本用了旧列表`merge_mixed_list.txt`** ❌
5. 最终成片还是旧版S01 ❌

## 修复方案
修改`merge-jiuwei-final-v6.py`：
- 旧：`list_file_v2 = os.path.join(video_dir, "merge_mixed_list.txt")`
- 新：`list_file_v2 = os.path.join(video_dir, "merge_mixed_v2_list.txt")`

## 预防措施
1. **版本号管理**：列表文件应包含版本号，避免多个版本共存导致混淆
2. **一致性检查**：合并前验证列表文件指向的视频是否是最新版
3. **清理旧文件**：生成新版本后删除旧版列表文件
4. **自动化验证**：合并后提取第一帧验证内容

## 相关文件
- `scripts/merge-jiuwei-final-v6.py` - 合并脚本（已修复）
- `scripts/mix-jiuwei-audio-v2.py` - 混音脚本（生成v2列表）
- `output/jiu-wei-hu-videos/merge_mixed_list.txt` - 旧列表（应删除）
- `output/jiu-wei-hu-videos/merge_mixed_v2_list.txt` - 新列表（正确使用）
