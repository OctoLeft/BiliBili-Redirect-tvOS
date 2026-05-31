# 📺 BiliBili Redirect tvOS CNHK

基于 [BiliUniverse/Redirect](https://github.com/BiliUniverse/Redirect) 的 tvOS CNHK 兼容 fork。

Surge 模块导入地址：

```text
https://github.com/OctoLeft/BiliBili-Redirect-tvOS/releases/latest/download/BiliBili.Redirect.tvOS.sgmodule
```

本 fork 优先在播放地址响应中选择服务端已签好的 CNHK backup URL；如果播放地址仍落到 `upos-hz-mirrorakam.akamaized.net`，再补齐缺失的 `buvid`/`build` 并以 302 跳转至 `cn-hk-eq-01-03.bilivideo.com`。
