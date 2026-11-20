/** Linux trial shell: own one dsh Web child and its isolated browser window. */
import { app, BrowserWindow, dialog, Menu, session } from 'electron'
import { spawn } from 'node:child_process'
import { appendFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'

/** Own backend readiness, diagnostic redaction, and shutdown before Electron exits. */
class DesktopTrial {
  home = resolve(process.env.DSH_HOME || join(homedir(), '.dsh-intranet'))
  backend = undefined
  window = undefined
  closed = Promise.resolve()
  stopping = false
  failed = false
  logPath = ''

  constructor() {
    mkdirSync(join(this.home, 'logs'), { recursive: true, mode: 0o700 })
    this.logPath = join(this.home, 'logs', `desktop-${Date.now()}-${process.pid}.log`)
    app.setName('DSH 内网试用版')
    app.setPath('userData', join(this.home, 'desktop-browser'))
    if (process.env.DSH_DESKTOP_DISABLE_GPU === '1') app.disableHardwareAcceleration()
    app.on('before-quit', event => {
      if (this.stopping) return
      event.preventDefault()
      this.stopping = true
      void this.stop().finally(() => app.exit(this.failed ? 1 : 0))
    })
    app.on('window-all-closed', () => app.quit())
    process.on('SIGTERM', () => app.quit())
    process.on('SIGINT', () => app.quit())
    process.on('uncaughtException', error => this.fail(error))
    process.on('unhandledRejection', error => this.fail(error))
  }

  /** Append private diagnostics without persisting the Web login token. */
  log(text) {
    const redacted = String(text).replace(/([?&]token=)[A-Za-z0-9_-]+/gu, '$1[redacted]')
    appendFileSync(this.logPath, `${redacted}\n`, { mode: 0o600 })
  }

  /** Report a terminal failure once; shutdown owns disposal of the backend. */
  fail(error) {
    if (this.failed || this.stopping) return
    this.failed = true
    const message = error instanceof Error ? error.stack || error.message : String(error)
    console.error(message)
    try { this.log(message) }
    catch (logError) { console.error('无法写入日志', logError) }
    try { dialog.showErrorBox('DSH 启动或运行失败', `请保留日志并反馈：\n${this.logPath}\n\n${String(error)}`) }
    catch (dialogError) { console.error('无法显示错误窗口', dialogError) }
    app.quit()
  }

  /** Await the documented tokenized entry URL, rejecting child failure or expiry. */
  startBackend() {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
    const executable = join(root, 'backend/app/deepseek_harness_runtime/runtime/deepseek-harness-sdk-runtime-linux-arm64')
    const timeout = Number(process.env.DSH_DESKTOP_START_TIMEOUT_MS || 120000)
    if (!Number.isSafeInteger(timeout) || timeout < 1000) throw new Error('DSH_DESKTOP_START_TIMEOUT_MS 必须是至少 1000 的整数')
    this.backend = spawn(executable, ['web', '--no-open', '--host', '127.0.0.1', '--port', '0'], {
      cwd: process.env.DSH_WORKSPACE || homedir(),
      env: { ...process.env, DSH_HOME: this.home, DSH_TELEMETRY_DISABLED: '1', NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const child = this.backend
    this.closed = new Promise(done => child.once('close', done))
    return new Promise((resolveReady, rejectReady) => {
      let ready = false
      const timer = setTimeout(() => rejectReady(new Error(`DSH 后端在 ${timeout / 1000} 秒内未就绪，请查看日志`)), timeout)
      child.once('error', error => {
        clearTimeout(timer)
        rejectReady(error)
      })
      child.once('exit', (code, signal) => {
        clearTimeout(timer)
        const error = new Error(`DSH 后端已退出：code=${code}, signal=${signal}`)
        if (!ready) rejectReady(error)
        else if (!this.stopping) this.fail(error)
      })
      for (const stream of [child.stdout, child.stderr]) {
        const reader = createInterface({ input: stream })
        child.once('close', () => reader.close())
        reader.on('line', line => {
          this.log(line)
          const match = line.replace(/\x1b\[[0-9;]*m/gu, '').match(/^dsh web: (http:\/\/127\.0\.0\.1:\d+\/\?token=[A-Za-z0-9_-]+)\s*$/u)
          if (ready || match === null) return
          const url = new URL(match[1])
          if (url.port === '' || url.port === '0') return
          ready = true
          clearTimeout(timer)
          resolveReady(url)
        })
      }
    })
  }

  /** Keep navigation on the owned loopback origin, with no renderer Node APIs. */
  async start() {
    const url = await this.startBackend()
    if (this.stopping || this.failed) return
    const ownOrigin = value => {
      try { return new URL(value).origin === url.origin }
      catch (invalidUrl) { this.log(`已阻止无效的导航地址：${invalidUrl}`); return false }
    }
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, respond) => respond(false))
    session.defaultSession.setPermissionCheckHandler(() => false)
    const window = new BrowserWindow({
      title: 'DSH 内网试用版', width: 1280, height: 850, show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true },
    })
    this.window = window
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: '编辑', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
      { label: '视图', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }] },
    ]))
    window.webContents.on('will-navigate', (event, target) => { if (!ownOrigin(target)) event.preventDefault() })
    window.webContents.on('will-redirect', (event, target) => { if (!ownOrigin(target)) event.preventDefault() })
    window.webContents.setWindowOpenHandler(({ url: target }) => {
      if (ownOrigin(target)) void window.loadURL(target).catch(error => this.fail(error))
      return { action: 'deny' }
    })
    window.webContents.on('render-process-gone', (_event, details) => this.fail(new Error(`页面进程退出：${details.reason}，${details.exitCode}`)))
    window.once('ready-to-show', () => window.show())
    window.on('closed', () => { this.window = undefined })
    await window.loadURL(url.href)
    this.log(`Electron=${process.versions.electron}, Chromium=${process.versions.chrome}; Web 已加载`)
  }

  /** Give dsh its graceful SIGTERM path, then kill a child that exceeds the budget. */
  async stop() {
    if (this.backend === undefined) return
    const child = this.backend
    if (child.exitCode !== null || child.signalCode !== null || child.pid === undefined) return
    child.kill('SIGTERM')
    const timer = setTimeout(() => {
      this.failed = true
      console.error(`DSH 退出超时，强制停止。请检查日志：${this.logPath}`)
      child.kill('SIGKILL')
    }, 15000)
    try { await this.closed }
    finally { clearTimeout(timer) }
  }
}

const trial = new DesktopTrial()
await app.whenReady()
if (!app.requestSingleInstanceLock()) app.exit(0)
else {
  app.on('second-instance', () => { trial.window?.show(); trial.window?.focus() })
  void trial.start().catch(error => trial.fail(error))
}
