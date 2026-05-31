# 📺 BiliBili Redirect tvOS CNHK

基于 [BiliUniverse/Redirect](https://github.com/BiliUniverse/Redirect) 的 tvOS CNHK 兼容 fork。

Surge 模块导入地址：

```text
https://github.com/OctoLeft/BiliBili-Redirect-tvOS/releases/latest/download/BiliBili.Redirect.tvOS.sgmodule
```

本 fork 优先在播放地址响应中选择服务端已签好的 CNHK backup URL；默认不会把 Akamai 签名的 m4s URL 强行改到 CNHK，因为这类 URL 会被 CNHK `bvc` 按签名拒绝。
