# 📺 BiliBili Redirect tvOS CNHK

基于 [BiliUniverse/Redirect](https://github.com/BiliUniverse/Redirect) 的 tvOS CNHK 兼容 fork。

Surge 模块导入地址：

```text
https://github.com/OctoLeft/BiliBili-Redirect-tvOS/releases/latest/download/BiliBili.Redirect.tvOS.sgmodule
```

本 fork 只单独处理 tvOS 的 `upos-hz-mirrorakam.akamaized.net` 请求：保留签名参数，补齐缺失的 `buvid`/`build`，并默认以 302 跳转至 `cn-hk-eq-01-03.bilivideo.com`。
