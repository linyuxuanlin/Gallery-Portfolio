# POUR Lab 持续开发路线

## 当前阶段：物理交互 + Ghost Training MVP
- [x] Three.js V60 场景
- [x] Raycaster 真实粉床落点
- [x] 壶嘴真实出水点
- [x] 重力弹道水流
- [x] 时间积分水量模型
- [x] 25×25 粉床浸润/均匀度模型
- [x] 注水轨迹记录
- [x] Brew Replay
- [x] Ghost Pour 按累计水量同步
- [x] Ghost 暂停节奏识别与评分
- [x] Ghost 轨迹/流速偏差时间线与最差水量区段定位
- [x] 分项评分：轨迹 / 流速 / 节奏 / 粉床
- [x] actualFlow runtime、流量惯性、壶身倾角、250g 锁存与尾流状态机
- [x] 2 / 4 / 6 / 8 g/s 启动、收水、水柱半径与 flow-aware 弹道校准
- [x] 动态粉床扩散 / 排水 / 容量限制与守恒成对通量模型
- [x] Reusable BufferGeometry 水柱，动态更新不再重复 new/dispose TubeGeometry
- [x] 帧率无关目标点 / 壶位平滑与水柱自适应刷新
- [x] 生命周期安全 Training / Replay 时钟，hidden/blur 不污染训练时间
- [x] Flow runtime suspend settling：后台/锁屏时清除残余 actualFlow，不把隐藏时间伪尾流带回前台
- [x] Flow runtime lifecycle registry：页面 suspend 时统一 settle active runtimes，恢复后 HUD / 水柱从零流量继续
- [x] Replay 生命周期断点：后台/锁屏中断显式落盘，分析跳过跨断点位移，Replay Map 分段显示
- [x] 统一 Pointer binding：主触点锁定、第二触点隔离、off-canvas release、capture 清理、missed pointerup 自愈
- [x] Service Worker 弱网/离线缓存与 Three.js 多 CDN 超时回退
- [x] Brew Analysis：流速稳定、落点停留、外圈暴露、中圈利用、路径等诊断
- [x] Brew Analysis 结果页与 NEXT BREW 可执行建议
- [x] Replay Map：粉床轨迹热力图、真实路径与 ≥0.5s 暂停节点可视化
- [x] Brew History：最近 30 杯持久化、去重排序、BEST 标记、任意历史杯设为 Ghost 参考
- [x] Brew History storage quota / 私密模式容错、轨迹压缩与自动降级
- [x] Ghost reference 按 History ID 持久化，启动时瞬时兼容旧主页面读取，避免重复长期存储 Replay
- [x] Brew History A/B 杯间对比与最近 8 杯训练趋势
- [x] NEXT SESSION 自适应专项训练：流速稳定 / 粉床覆盖 / 均匀度 / 外圈控制
- [x] 持久化专项挑战闭环：baseline → 新杯验收 → 未达标继续 → 达标晋级下一弱项

## 下一阶段优先级

### P0 物理与稳定性
- 浏览器真实交互回归
- Three.js 首次访问仍依赖 CDN：改为仓库自托管 vendor 文件或构建产物
- 校准壶嘴高度 / 壶身位置与目标落点关系，避免壶体穿帮或手柄遮挡

### P1 核心训练体验
- 粉床热点回放
- History 支持指定杯不刷新页面直接进入 Ghost
- 专项挑战连续 2 杯达标模式与训练 streak
- 专项结果页显示“前一杯 → 本杯”的指标变化
- Replay Map 增加时间播放游标与可切换“路径 / 热点 / 暂停”图层

### P2 数据能力
- Recipe JSON 数据结构
- 配方保存 / Fork / 对比
- 历史数据导入导出
- 个人冲煮画像

### P3 AI 能力
- AI Brew Doctor
- 根据轨迹、流速、粉床和节奏自动诊断
- 参数调整建议
- 风味预测与历史相关性

开发原则：每轮优先解决真实用户价值、物理可信度和可验证体验问题，避免堆砌无实际用途的功能。
