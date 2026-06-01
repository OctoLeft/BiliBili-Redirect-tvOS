# 📺 BiliBili Redirect tvOS CNHK

基于 [BiliUniverse/Redirect](https://github.com/BiliUniverse/Redirect) 的 tvOS CNHK 兼容 fork。

Surge 模块导入地址：

```text
https://github.com/OctoLeft/BiliBili-Redirect-tvOS/releases/latest/download/BiliBili.Redirect.tvOS.sgmodule
```

本 fork 默认保留服务端签发的可用播放 URL，并补齐 tvOS 分片请求需要的 `Referer`；不会把已签名 m4s URL 强行改写到其他 host，避免破坏 `hdnts`/`upsig` 导致 403。
