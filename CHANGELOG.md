### 🆕 New Features
  * 海外加速增强：启动测速升级为 256KB 吞吐评估，HK 冷门/回源慢时自动回退到 *ov 海外 CDN
  * playurl 改写 backups 现包含 HK、*ov 与 Akamai 原始 URL，播放器可多层兜底切换
  * 默认保留客户端原始 User-Agent，适配 MVision/Cheers 等 PC-UA 第三方客户端
  * 新增 `TVOS.CNHKMinThroughput` 与 `TVOS.ForceUserAgent` 配置项
  * MITM 扩展至 `cn-hk-eq-*.bilivideo.com` 与 `*ov` 主机，修复 HK 直连粘性与 buvid/build 补全
