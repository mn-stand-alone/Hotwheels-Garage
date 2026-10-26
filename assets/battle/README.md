# 对战 3D 资源

车辆、赛道、护栏、轮胎、灯光和标识由 `js/battle-scene.js` 与 `js/battle-environment.js` 程序化创建，无外部模型或纹理。海岛场景主题与来源见 [场景参考](场景参考.md)。
五类车身模板用于街机视觉展示，不代表收藏卡对应车辆的精确比例模型。
收藏照片只用于选车与图鉴，不参与 3D 几何生成。

渲染库：Three.js 0.180.0，MIT，来自 npm 官方包的 jsDelivr 分发。
本地依赖及完整许可位于 `vendor/three/`；游戏运行无需外部 CDN。
官方项目：https://github.com/mrdoob/three.js
