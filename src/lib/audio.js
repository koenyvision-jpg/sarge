// Sound + voice cues via Web Audio (iPhone web apps can't vibrate).
// Audio must be unlocked by a tap, so call unlockAudio() from the Start button.

let ctx = null
let enabled = { sound: true, voice: false }

export function configureCues(opts) {
  enabled = { ...enabled, ...opts }
}

export function unlockAudio() {
  try {
    // Play through the silent switch on iOS 17+ (ignored elsewhere).
    if (navigator.audioSession) navigator.audioSession.type = 'playback'
  } catch { /* not supported */ }
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    ctx = new AC()
  }
  if (ctx.state === 'suspended') ctx.resume()
  // A silent blip completes the unlock on older iOS versions.
  tone(440, 0.01, 0.0001)
  if (enabled.voice && 'speechSynthesis' in window) window.speechSynthesis.speak(new SpeechSynthesisUtterance(''))
}

function tone(freq, dur, vol = 0.25, delay = 0, type = 'sine') {
  if (!ctx || !enabled.sound) return
  const t = ctx.currentTime + delay
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(vol, t + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(gain).connect(ctx.destination)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

export const cues = {
  /** 10 seconds of rest left */
  warn: () => { tone(880, 0.12); tone(880, 0.12, 0.25, 0.18) },
  /** 3-2-1 countdown tick */
  tick: () => tone(660, 0.08, 0.2),
  /** Rest over / go */
  go: () => { tone(660, 0.12); tone(880, 0.12, 0.25, 0.14); tone(1175, 0.25, 0.3, 0.28) },
  /** Over time — repeats every 15 s */
  nag: () => { tone(330, 0.18, 0.3, 0, 'square'); tone(330, 0.18, 0.3, 0.26, 'square') },
  /** Timed interval / hold finished */
  done: () => { tone(1175, 0.1); tone(880, 0.18, 0.25, 0.12) },
  finish: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 0.25, i * 0.15)),
}

export function say(text) {
  if (!enabled.voice || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.rate = 1.05
  window.speechSynthesis.speak(u)
}
