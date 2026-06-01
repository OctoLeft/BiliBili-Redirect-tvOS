# 📺 BiliBili Redirect tvOS CNHK

基于 [BiliUniverse/Redirect](https://github.com/BiliUniverse/Redirect) 的 tvOS CNHK 兼容 fork。

Surge 模块导入地址：

```text
https://github.com/OctoLeft/BiliBili-Redirect-tvOS/releases/latest/download/BiliBili.Redirect.tvOS.sgmodule
```

本 fork 默认对 tvOS Akamai 分片做启动测速，从 HK 节点池中选择返回 `206` 且小块下载最快的主机。同一个播放 URL 会固定使用同一个 HK 主机，其他 HK 节点放入 `backup_url` 交给播放器切换；同时原样保留服务端签发的 raw query，避免破坏 `hdnts`/`upsig` 导致 403。
