export interface Settings {
    Host?: {
    /**
         * [主机名] 重定向 OverseaVideo CDN (港澳台)
         *
         * 请选择 OverseaVideo 要重定向的主机名。
         *
         * @remarks
         *
         * Possible values:
         * - `'upos-sz-mirrorali.bilivideo.com'` - 阿里云 CDN
         * - `'upos-sz-mirrorcos.bilivideo.com'` - 腾讯云 CDN
         * - `'upos-sz-mirrorhw.bilivideo.com'` - 华为云 CDN，融合 CDN
         * - `'upos-sz-mirroraliov.bilivideo.com'` - 阿里云 CDN，海外
         * - `'upos-sz-mirrorcosov.bilivideo.com'` - 腾讯云 CDN，海外
         * - `'upos-sz-mirrorhwov.bilivideo.com'` - 华为云 CDN，海外
         * - `'cn-hk-eq-01-01.bilivideo.com'` - Equinix IX CDN，香港
         * - `'cn-hk-eq-01-03.bilivideo.com'` - Equinix IX CDN，香港
         * - `'cn-hk-eq-01-09.bilivideo.com'` - Equinix IX CDN，香港
         * - `'cn-hk-eq-01-10.bilivideo.com'` - Equinix IX CDN，香港
         * - `'cn-hk-eq-01-12.bilivideo.com'` - Equinix IX CDN，香港
         * - `'cn-hk-eq-01-13.bilivideo.com'` - Equinix IX CDN，香港
         * - `'cn-hk-eq-01-14.bilivideo.com'` - Equinix IX CDN，香港
         *
         * @defaultValue "upos-sz-mirrorali.bilivideo.com"
         */
        OverseaVideo?: 'upos-sz-mirrorali.bilivideo.com' | 'upos-sz-mirrorcos.bilivideo.com' | 'upos-sz-mirrorhw.bilivideo.com' | 'upos-sz-mirroraliov.bilivideo.com' | 'upos-sz-mirrorcosov.bilivideo.com' | 'upos-sz-mirrorhwov.bilivideo.com' | 'cn-hk-eq-01-01.bilivideo.com' | 'cn-hk-eq-01-03.bilivideo.com' | 'cn-hk-eq-01-09.bilivideo.com' | 'cn-hk-eq-01-10.bilivideo.com' | 'cn-hk-eq-01-12.bilivideo.com' | 'cn-hk-eq-01-13.bilivideo.com' | 'cn-hk-eq-01-14.bilivideo.com';
    /**
         * [主机名] tvOS Akamai 兜底 HK CDN
         *
         * 当 HK 节点池测速全部失败或没有缓存时使用的兜底主机名。
         *
         * @remarks
         *
         * Possible values:
         * - `'cn-hk-eq-01-01.bilivideo.com'` - Equinix IX CDN，香港
         * - `'cn-hk-eq-01-03.bilivideo.com'` - Equinix IX CDN，香港
         * - `'cn-hk-eq-01-09.bilivideo.com'` - Equinix IX CDN，香港
         * - `'cn-hk-eq-01-10.bilivideo.com'` - Equinix IX CDN，香港
         * - `'cn-hk-eq-01-12.bilivideo.com'` - Equinix IX CDN，香港
         * - `'cn-hk-eq-01-13.bilivideo.com'` - Equinix IX CDN，香港
         * - `'cn-hk-eq-01-14.bilivideo.com'` - Equinix IX CDN，香港
         *
         * @defaultValue "cn-hk-eq-01-03.bilivideo.com"
         */
        AkamaiCNHK?: 'cn-hk-eq-01-01.bilivideo.com' | 'cn-hk-eq-01-03.bilivideo.com' | 'cn-hk-eq-01-09.bilivideo.com' | 'cn-hk-eq-01-10.bilivideo.com' | 'cn-hk-eq-01-12.bilivideo.com' | 'cn-hk-eq-01-13.bilivideo.com' | 'cn-hk-eq-01-14.bilivideo.com';
    /**
         * [主机名] tvOS Akamai HK 节点池
         *
         * 启动播放时并发测速的 HK 节点列表，使用英文逗号分隔。脚本会选择小块下载最快且返回 206 的节点。
         *
         * @defaultValue "cn-hk-eq-01-03.bilivideo.com,cn-hk-eq-01-13.bilivideo.com,cn-hk-eq-01-12.bilivideo.com,cn-hk-eq-01-01.bilivideo.com"
         */
        AkamaiCNHKPool?: string;
    /**
         * [主机名] 重定向 BStar CDN (国际版)
         *
         * 请选择 BStar 要重定向的主机名。
         *
         * @remarks
         *
         * Possible values:
         * - `'upos-sz-mirrorali.bilivideo.com'` - 阿里云 CDN
         * - `'upos-sz-mirrorcos.bilivideo.com'` - 腾讯云 CDN
         * - `'upos-sz-mirrorhw.bilivideo.com'` - 华为云 CDN，融合 CDN
         * - `'upos-sz-mirroraliov.bilivideo.com'` - 阿里云 CDN，海外
         * - `'upos-sz-mirrorcosov.bilivideo.com'` - 腾讯云 CDN，海外
         * - `'upos-sz-mirrorhwov.bilivideo.com'` - 华为云 CDN，海外
         * - `'cn-hk-eq-01-01.bilivideo.com'` - Equinix IX CDN，香港
         * - `'cn-hk-eq-01-03.bilivideo.com'` - Equinix IX CDN，香港
         * - `'cn-hk-eq-01-09.bilivideo.com'` - Equinix IX CDN，香港
         * - `'cn-hk-eq-01-10.bilivideo.com'` - Equinix IX CDN，香港
         * - `'cn-hk-eq-01-12.bilivideo.com'` - Equinix IX CDN，香港
         * - `'cn-hk-eq-01-13.bilivideo.com'` - Equinix IX CDN，香港
         * - `'cn-hk-eq-01-14.bilivideo.com'` - Equinix IX CDN，香港
         *
         * @defaultValue "upos-sz-mirrorali.bilivideo.com"
         */
        BStar?: 'upos-sz-mirrorali.bilivideo.com' | 'upos-sz-mirrorcos.bilivideo.com' | 'upos-sz-mirrorhw.bilivideo.com' | 'upos-sz-mirroraliov.bilivideo.com' | 'upos-sz-mirrorcosov.bilivideo.com' | 'upos-sz-mirrorhwov.bilivideo.com' | 'cn-hk-eq-01-01.bilivideo.com' | 'cn-hk-eq-01-03.bilivideo.com' | 'cn-hk-eq-01-09.bilivideo.com' | 'cn-hk-eq-01-10.bilivideo.com' | 'cn-hk-eq-01-12.bilivideo.com' | 'cn-hk-eq-01-13.bilivideo.com' | 'cn-hk-eq-01-14.bilivideo.com';
    /**
         * [主机名] 重定向 PCDN 主机名 (中国大陆)
         *
         * 请选择 PCDN 要重定向的主机名。
         *
         * @remarks
         *
         * Possible values:
         * - `'upos-sz-mirrorali.bilivideo.com'` - 阿里云 CDN
         * - `'upos-sz-mirrorcos.bilivideo.com'` - 腾讯云 CDN
         * - `'upos-sz-mirrorhw.bilivideo.com'` - 华为云 CDN，融合 CDN
         * - `'upos-sz-mirroraliov.bilivideo.com'` - 阿里云 CDN，海外
         * - `'upos-sz-mirrorcosov.bilivideo.com'` - 腾讯云 CDN，海外
         * - `'upos-sz-mirrorhwov.bilivideo.com'` - 华为云 CDN，海外
         * - `'cn-hk-eq-01-01.bilivideo.com'` - Equinix IX CDN，香港
         * - `'cn-hk-eq-01-03.bilivideo.com'` - Equinix IX CDN，香港
         * - `'cn-hk-eq-01-09.bilivideo.com'` - Equinix IX CDN，香港
         * - `'cn-hk-eq-01-10.bilivideo.com'` - Equinix IX CDN，香港
         * - `'cn-hk-eq-01-12.bilivideo.com'` - Equinix IX CDN，香港
         * - `'cn-hk-eq-01-13.bilivideo.com'` - Equinix IX CDN，香港
         * - `'cn-hk-eq-01-14.bilivideo.com'` - Equinix IX CDN，香港
         *
         * @defaultValue "upos-sz-mirrorali.bilivideo.com"
         */
        PCDN?: 'upos-sz-mirrorali.bilivideo.com' | 'upos-sz-mirrorcos.bilivideo.com' | 'upos-sz-mirrorhw.bilivideo.com' | 'upos-sz-mirroraliov.bilivideo.com' | 'upos-sz-mirrorcosov.bilivideo.com' | 'upos-sz-mirrorhwov.bilivideo.com' | 'cn-hk-eq-01-01.bilivideo.com' | 'cn-hk-eq-01-03.bilivideo.com' | 'cn-hk-eq-01-09.bilivideo.com' | 'cn-hk-eq-01-10.bilivideo.com' | 'cn-hk-eq-01-12.bilivideo.com' | 'cn-hk-eq-01-13.bilivideo.com' | 'cn-hk-eq-01-14.bilivideo.com';
    /**
         * [主机名] 重定向 MCDN 主机名 (中国大陆)
         *
         * 请选择 MCDN 要重定向的主机名。
         *
         * @remarks
         *
         * Possible values:
         * - `'proxy-tf-all-ws.bilivideo.com'` - proxy-tf-all-ws.bilivideo.com
         *
         * @defaultValue "proxy-tf-all-ws.bilivideo.com"
         */
        MCDN?: 'proxy-tf-all-ws.bilivideo.com';
};
    TVOS?: {
    /**
         * [tvOS] 客户端构建号
         *
         * 当 tvOS Akamai 请求的 build 为空或为 0 时使用的构建号。
         *
         * @defaultValue "89600100"
         */
        Build?: string;
    /**
         * [tvOS] User-Agent
         *
         * tvOS Akamai 请求重定向至 CNHK 时使用的 User-Agent。
         *
         * @defaultValue "Bilibili Freedoooooom/MarkII"
         */
        UserAgent?: string;
    /**
         * [tvOS] Buvid
         *
         * 可选。留空时脚本会在本机生成并持久化随机 buvid。
         *
         * @defaultValue ""
         */
        Buvid?: string;
    /**
         * [tvOS] CNHK 最低吞吐 (Bps)
         *
         * 启动测速时 HK 节点被视为命中缓存的最低吞吐（字节/秒）。低于此值且显著慢于海外 CDN 时，将回退到 *ov 作 primary。
         *
         * @defaultValue "262144"
         */
        CNHKMinThroughput?: string;
    /**
         * [tvOS] 强制使用 tvOS User-Agent
         *
         * 开启后忽略客户端原始 User-Agent，始终使用上方配置的 tvOS User-Agent。
         *
         * @remarks
         *
         * Possible values:
         * - `'true'` - 开启
         * - `'false'` - 关闭
         *
         * @defaultValue "false"
         */
        ForceUserAgent?: 'true' | 'false';
};
    /**
     * [储存] 配置类型
     *
     * 选择要使用的配置类型。未设置此选项或不通过此选项的旧版本的配置顺序依旧是 PersistentStore (BoxJs) > $argument > database.
     *
     * @remarks
     *
     * Possible values:
     * - `'Argument'` - 优先使用来自 $argument 的配置，$argument 不包含的设置项由 PersistentStore (BoxJs) 提供
     * - `'PersistentStore'` - 只使用 PersistentStore (BoxJs) 提供的配置
     * - `'database'` - 只使用由作者的 database.mjs 文件提供的默认配置，其他任何自定义配置不再起作用
     *
     * @defaultValue "Argument"
     */
    Storage?: 'Argument' | 'PersistentStore' | 'database';
    /**
     * [调试] 日志等级
     *
     * 选择脚本日志的输出等级，低于所选等级的日志将全部输出。
     *
     * @remarks
     *
     * Possible values:
     * - `'OFF'` - 关闭
     * - `'ERROR'` - ❌ 错误
     * - `'WARN'` - ⚠️ 警告
     * - `'INFO'` - ℹ️ 信息
     * - `'DEBUG'` - 🅱️ 调试
     * - `'ALL'` - 全部
     *
     * @defaultValue "WARN"
     */
    LogLevel?: 'OFF' | 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'ALL';
}
