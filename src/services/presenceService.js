import { presenceApi } from '@/lib/api'

let timerId = null
let config = null

const randomJitter = (baseMs, jitterMs) => {
  const delta = Math.floor(Math.random() * (jitterMs * 2 + 1)) - jitterMs
  return baseMs + delta
}

async function tick() {
  if (!config?.usuarioId) return
  try {
    await presenceApi.sendHeartbeat({
      usuarioId: config.usuarioId,
      status: config.status ?? null,
      version: config.version ?? null
    })
  } catch {
    // Silenciar errores de envío; se reintentará en el próximo tick
  }
}

function stopTimerOnly() {
  if (timerId) {
    clearTimeout(timerId)
    timerId = null
  }
}

export function startHeartbeat({
  usuarioId,
  status = 'playing',
  version = null,
  baseIntervalMs = 45_000,
  jitterMs = 5_000
}) {
  stopHeartbeat()
  config = { usuarioId, status, version, baseIntervalMs, jitterMs }

  // Primer latido inmediato
  void tick()

  const scheduleNext = () => {
    const next = randomJitter(baseIntervalMs, jitterMs)
    timerId = setTimeout(async () => {
      await tick()
      scheduleNext()
    }, next)
  }
  scheduleNext()

  const onVisibilityChange = () => {
    if (document.hidden) {
      // Pausa si está oculta la pestaña
      stopTimerOnly()
    } else {
      // Reanuda con un latido inmediato y reprograma
      void tick()
      const { baseIntervalMs, jitterMs } = config
      timerId = setTimeout(async () => {
        await tick()
        startHeartbeat(config)
      }, randomJitter(baseIntervalMs, jitterMs))
    }
  }

  document.addEventListener('visibilitychange', onVisibilityChange)
  window.__presence_cleanup = () => {
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
}

export function stopHeartbeat() {
  stopTimerOnly()
  config = null
  if (window.__presence_cleanup) {
    window.__presence_cleanup()
    delete window.__presence_cleanup
  }
}

export function updatePresenceStatus(newStatus) {
  if (config) config.status = newStatus
}

export function updatePresenceVersion(newVersion) {
  if (config) config.version = newVersion
}


