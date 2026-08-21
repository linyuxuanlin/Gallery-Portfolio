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
- [x] 独立流量惯性与壶身倾角物理模块
- [x] 流量运行时控制器与 FPS 回归测试
- [x] 粉床扩散 / 排水 / 容量上限物理模块与 FPS 回归测试
- [x] actualFlow runtime / 动态粉床 runtime 接入 3D 主页面
- [x] 250g 目标水量锁存，输入与物理尾流解耦
- [x] 完成态 UI 与尾流状态同步
- [x] 2 / 4 / 6 / 8 g/s 启动、收水、水柱半径与 flow-aware 弹道校准
- [x] Flow-aware 弹道与 runtime.streamRadius 接入 Three.js 主页面
- [x] 帧率无关的目标点 / 壶位平滑接入主页面
- [x] 水柱 Material / Mesh 复用 + 自适应几何刷新节流
- [x] 可复用 Tube Mesh TypedArray 拓扑模块，连续更新不重新分配 positions / normals / indices
- [x] Three.js BufferGeometry 适配层：共享 positions / normals / uv / index，仅标记 attribute.needsUpdate

## 下一阶段优先级

### P0 物理与稳定性
- 将 Three.js reusable stream adapter 接入主页面，彻底移除运行时反复 new/dispose TubeGeometry
- 浏览器真实交互回归
- 移动端触控优化
- CDN / 静态依赖可用性优化
- 校准壶嘴高度 / 壶身位置与目标落点关系，避免壶体穿帮或手柄遮挡
- 检查页面可见性切换/后台恢复后的 dt、计时与流量状态，防止恢复瞬间积分异常

### P1 核心训练体验
- Replay 结果轨迹热力图
- Ghost 轨迹偏差时间线
- 暂停节点可视化
- 粉床热点回放
- 支持最佳杯 / 指定历史杯作为 Ghost，而非仅上一杯

### P2 数据能力
- Brew History
- Recipe JSON 数据结构
- 配方保存 / Fork / 对比
- 个人冲煮画像

### P3 AI 能力
- AI Brew Doctor
- 根据轨迹、流速、粉床和节奏自动诊断
- 参数调整建议
- 风味预测与历史相关性

开发原则：每轮优先解决真实用户价值、物理可信度和可验证体验问题，避免堆砌无实际用途的功能。
