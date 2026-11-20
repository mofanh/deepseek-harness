DeepSeek Harness 麒麟 ARM64 离线基础运行包
版本：__VERSION__
源码提交：__SOURCE_SHA__
构建记录：__RUN_URL__

适用：Linux ARM64（aarch64），glibc 2.28 或更高版本。
程序自带供 DSH 使用的 Node 运行环境及 Web 前端，不需要安装 npm、pnpm 或更换系统 Node。

解压后，在本目录打开终端：
sha256sum -c SHA256SUMS
bash doctor.sh
bash start.sh

start.sh 通常会自动打开浏览器；未打开时请复制终端打印的完整地址。
保持终端开启，按 Ctrl+C 停止服务。不需要自动打开浏览器时，运行 bash start.sh --no-open。

在“设置 → 模型 → 添加模型提供商 → 自定义模型 API”填写内部接口地址、协议、模型 ID 和密钥。
是否包含 /v1、是否支持流式和工具调用，以内部接口文档为准。密钥仅在内网机器填写。

默认数据目录：$HOME/.dsh-intranet
默认工作目录：$HOME
可在页面选择工作区，或启动前设置 DSH_WORKSPACE。
需要其他数据目录时，启动前将 DSH_HOME 设为绝对路径；升级时保留数据目录。

系统命令使用本机已有软件；包内 Node 不会升级工作区的 node 命令。
基础包不包含额外的 Python 作者环境、Office 转换引擎或后来安装的插件。
完全断外网时，外部搜索和插件下载等联网功能不可用。包装脚本设置 DSH_TELEMETRY_DISABLED=1。

请保留 app 整个目录，不能只复制主程序。故障时保留 doctor.sh 输出和启动报错。
本包未做本地运行测试，请在麒麟机器验证对话、文件操作和命令执行。

维护此构建：在 build/kylin-arm64 分支提交修改可触发打包，也可在 Actions 中重新运行已有构建。
