# 📺 BiliBili Redirect tvOS CNHK

基于 [BiliUniverse/Redirect](https://github.com/BiliUniverse/Redirect) 的 tvOS CNHK 兼容 fork。

Surge 模块导入地址：

```text
https://github.com/OctoLeft/BiliBili-Redirect-tvOS/releases/latest/download/BiliBili.Redirect.tvOS.sgmodule
```

本 fork 默认把 tvOS Akamai 分片透明改写到 `cn-hk-eq-01-03.bilivideo.com`，但会原样保留服务端签发的 raw query，避免破坏 `hdnts`/`upsig` 导致 403。
