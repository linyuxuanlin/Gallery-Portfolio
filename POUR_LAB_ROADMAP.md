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
- [x] 分项评分：轨迹 / 流速 / 节奏 / 粉床
- [x] actualFlow runtime、流量惯性、壶身倾角、250g 锁存与尾流状态机
- [x] 2 / 4 / 6 / 8 g/s 启动、收水、水柱半径与 flow-aware 弹道校准
- [x] 动态粉床扩散 / 排水 / 容量限制与守恒成对通量模型
- [x] Reusable BufferGeometry 水柱，动态更新不再重复 new/dispose TubeGeometry
- [x] 帧率无关目标点 / 壶位平滑与水柱自适应刷新
- [x] 生命周期安全 Training / Replay 时钟，hidden/blur 不污染训练时间
- [x] 统一 Pointer binding：主触点锁定、第二触点隔离、off-canvas release、capture 清理、missed pointerup 自愈
- [x] Service Worker 弱网/离线缓存与 Three.js 多 CDN 超时回退
- [x] Brew Analysis：流速稳定、落点停留、外圈暴露、中圈利用、路径等诊断
- [x] Brew Analysis 结果页与 NEXT BREW 可执行建议
- [x] Brew History：最近 30 杯持久化、去重排序、BEST 标记、任意历史杯设为 Ghost 参考

## 下一阶段优先级

### P0 物理与稳定性
- 浏览器真实交互回归
- Three.js 首次访问仍依赖 CDN：改为仓库自托管 vendor 文件或构建产物
- 校准壶嘴高度 / 壶身位置与目标落点关系，避免壶体穿帮或手柄遮挡
- 页面恢复后的尾流视觉与采样一致性回归
- Brew History 在 storage quota / 私密模式下的容错与数据压缩

### P1 核心训练体验
- Replay 结果轨迹热力图
- Ghost 轨迹偏差时间线
- 暂停节点可视化
- 粉床热点回放
- History 支持“最佳杯 / 指定杯”直接进入 Ghost，不必刷新页面
- History 杯间对比：分数、流速稳定、覆盖率、轨迹差异

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
