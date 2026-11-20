DSH 麒麟 ARM64 内网桌面试用版

此包为 fork 上的 Linux 便携试用构建，使用原版 DSH Web 前端、已经构建的离线后端与 Electron 窗口。它不依赖系统 Node 或浏览器，不是官方 Windows/macOS 桌面发行包的完整 Linux 移植；官方桌面专属桥接、登录、自动更新、原生拖放能力未移植。普通的 Web 设置、模型接入与会话功能沿用 DSH Web。

使用方式
1. 将整个 tar.gz 复制到内网，解压到自己的主目录或其他可执行的普通用户目录。不要只复制 start.sh 或 electron 文件。
2. 在麒麟桌面终端进入解压目录，执行 ./doctor.sh，保留输出。
3. 执行 ./start.sh。等待 DSH 窗口打开，在模型设置中配置内网提供的接口地址、模型名称和密钥。包内没有预置模型或密钥；模型接口必须与 DSH 支持的提供方协议匹配。
4. 关闭窗口会向后端发出正常退出请求；超过 15 秒仍未退出则强制停止并在启动日志中报告。

数据与配置
默认沿用 $HOME/.dsh-intranet，包含会话、设置、凭据、Electron 缓存和 logs 目录。删除或移动程序包不会主动删除此目录。请避免同时运行旧版 CLI Web 服务和桌面版。
可通过 DSH_HOME 指定其他数据目录；DSH_WORKSPACE 指定启动工作目录（默认自己的主目录）。若旧 Web profile 曾改为监听其他机器或安装了在线插件，请先使用新的 DSH_HOME 进行试用。

启动问题
启动日志位于 $DSH_HOME/logs/desktop-launch-*.log，后端及窗口日志位于同目录的 desktop-*.log。错误弹窗中也会显示日志路径。
若窗口黑屏或图形驱动报错，可在终端执行 DSH_DESKTOP_DISABLE_GPU=1 ./start.sh 再试。
启动慢时可用 DSH_DESKTOP_START_TIMEOUT_MS=240000 ./start.sh 将等待预算改为 4 分钟。
若提示系统库缺失、GLIBC 版本不符或沙箱初始化失败，请保留 doctor.sh 和启动日志。便携包使用内核用户命名空间沙箱，不安装需要 root 权限的 SUID 辅助程序；若内核或策略禁止用户命名空间，启动会失败。它仍依赖麒麟已有的桌面系统库和执行策略；不要通过关闭沙箱或忽略证书校验处理。
此包未在你的麒麟机器进行图形、接口或对话测试。需要你在内网确认启动、模型设置、对话、任务列表和退出行为。

校验与构建
在解压目录执行 sha256sum -c SHA256SUMS，确认文件完整。
build-info.json 记录 DSH 来源提交、Electron 版本、下载摘要、云端构建地址及 ELF 检查结论；elf-report.json 记录每个 ELF 的架构和最高 GLIBC 要求。

English
This experimental Linux ARM64 fork build embeds Electron around the existing DSH Web CLI. Extract the complete archive and run ./start.sh from a graphical desktop terminal as a normal user. It uses $HOME/.dsh-intranet unless DSH_HOME is set. Configure your internal model provider in the application. No system Node, browser, model, API key, or updater is bundled. System desktop libraries and sandbox support are still required. Native official Desktop integrations are not included. Target-host GUI and model tests are left to the recipient. Run ./doctor.sh for library diagnostics and inspect the logs directory for startup failures.
