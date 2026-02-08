import { MediaPlayer, Media } from './libvlc.js';

/**
 * VLC.js Player
 *
 * Full-featured media player UI modeled after VLC media player.
 * Powered by VLC.js WebAssembly build.
 */

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------
const video        = document.getElementById('fallback-video')
const canvas       = document.getElementById('canvas')
const videoArea    = document.getElementById('video-area')
const btnPlay      = document.getElementById('btn-play')
const btnStop      = document.getElementById('btn-stop')
const btnPrev      = document.getElementById('btn-prev')
const btnNext      = document.getElementById('btn-next')
const btnMute      = document.getElementById('btn-mute')
const btnFullscreen= document.getElementById('btn-fullscreen')
const btnPlaylist  = document.getElementById('btn-playlist')
const btnRepeat    = document.getElementById('btn-repeat')
const btnShuffle   = document.getElementById('btn-shuffle')
const seekBar      = document.getElementById('seek-bar')
const seekFill     = document.getElementById('seek-fill')
const seekThumb    = document.getElementById('seek-thumb')
const timeDisplay  = document.getElementById('time-display')
const volSlider    = document.getElementById('vol-slider')
const speedDisplay = document.getElementById('speed-display')
const statusText   = document.getElementById('status-text')
const engineLabel  = document.getElementById('engine-label')
const windowTitle  = document.getElementById('window-title')
const playlistPanel= document.getElementById('playlist-panel')
const playlistList = document.getElementById('playlist-list')
const inputFile    = document.getElementById('input-file')
const inputFolder  = document.getElementById('input-folder')
const inputPlaylist= document.getElementById('input-playlist')
const dialogUrl    = document.getElementById('dialog-url')
const dialogAbout  = document.getElementById('dialog-about')
const dialogShortcuts = document.getElementById('dialog-shortcuts')
const urlInput     = document.getElementById('url-input')

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let vlcModule      = null
let mediaPlayer    = null
let isPlaying      = false
let playbackSpeed  = 1.0
let repeatMode     = 0        // 0=off, 1=all, 2=one
let shuffleOn      = false
let isReady        = false

// Playlist
const playlist     = []       // { name, src, file? }
let playlistIndex  = -1

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------
async function initVLC() {
  try {
    statusText.textContent = 'Loading WASM...'
    
    // Load experimental.js script
    await new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = '/experimental.js'
      s.onload = resolve
      s.onerror = () => reject(new Error('Failed to load experimental.js'))
      document.body.appendChild(s)
    })

    if (typeof window.initModule !== 'function') {
      throw new Error('initModule not found')
    }

    // Initialize Module
    vlcModule = await window.initModule({
      canvas: canvas,
      vlc_access_file: {},
      print: (text) => console.log('[VLC]', text),
      printErr: (text) => console.warn('[VLC]', text),
    })

    // Initialize libvlc with options (copied from oldindex.html / vlc.js)
    const vlcOptions = "--codec=webcodec --aout=emworklet_audio -vv"
    const vlc_opts_array = vlcOptions.split(' ')
    
    let vlc_opts_size = 0
    for (let i in vlc_opts_array) {
        vlc_opts_size += vlc_opts_array[i].length + 1
    }

    const buffer = vlcModule._malloc(vlc_opts_size)
    let wrote_size = 0
    for (let i in vlc_opts_array) {
        vlcModule.writeAsciiToMemory(vlc_opts_array[i], buffer + wrote_size, false)
        wrote_size += vlc_opts_array[i].length + 1
    }

    const vlc_argv = vlcModule._malloc(vlc_opts_array.length * 4 + 4)
    const view_vlc_argv = new Uint32Array(
        vlcModule.wasmMemory.buffer,
        vlc_argv,
        vlc_opts_array.length
    )

    wrote_size = 0
    for (let i in vlc_opts_array) {
        view_vlc_argv[i] = buffer + wrote_size
        wrote_size += vlc_opts_array[i].length + 1
    }

    vlcModule._wasm_libvlc_init(vlc_opts_array.length, vlc_argv)

    // Create MediaPlayer
    // Note: We use "emjsfile://1" as a placeholder or we can pass null. 
    // vlc.js passes "emjsfile://1" but that requires a file to be present at 1?
    // We'll pass null and set media later as we did.
    mediaPlayer = new MediaPlayer(vlcModule, null)
    
    // Set global media player for C calls
    if (vlcModule._set_global_media_player) {
      vlcModule._set_global_media_player(mediaPlayer.media_player_ptr)
    }

    // Set initial volume
    mediaPlayer.set_volume(80)

    // Setup overlay callback
    window.media_player = mediaPlayer
    window.update_overlay = () => {
        if (!mediaPlayer) return
        const pos = mediaPlayer.get_position()
        if (Number.isFinite(pos)) {
            const pct = pos * 100
            seekFill.style.width = `${pct}%`
            seekThumb.style.left = `${pct}%`
            
            // Also update time display if possible
            const len = mediaPlayer.get_length()
            const time = mediaPlayer.get_time()
            if (len > 0) {
                timeDisplay.textContent = `${fmtTimeMs(time)} / ${fmtTimeMs(len)}`
            }
        }
    }

    isReady = true
    statusText.textContent = 'Ready'
    engineLabel.textContent = 'VLC WASM'
    canvas.style.display = 'block'
    video.style.display = 'none'

    // Start UI update loop
    requestAnimationFrame(updateUI)

  } catch (err) {
    console.error(err)
    statusText.textContent = 'Error loading VLC.js'
    engineLabel.textContent = 'Error'
  }
}

// ---------------------------------------------------------------------------
// Time formatting
// ---------------------------------------------------------------------------
function fmtTime(sec) {
  if (!isFinite(sec) || sec < 0) return '--:--'
  sec = Math.floor(sec)
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${m}:${String(s).padStart(2,'0')}`
}

function fmtTimeMs(ms) {
    if (ms < 0) return '--:--';
    return fmtTime(ms / 1000);
}

// ---------------------------------------------------------------------------
// Playlist management
// ---------------------------------------------------------------------------
function addToPlaylist(files) {
  for (const f of files) {
    // For VLC.js we can try to use the File object directly via the virtual filesystem
    playlist.push({ name: f.name, file: f })
  }
  renderPlaylist()
  if (playlistIndex === -1 && playlist.length > 0) {
    playTrack(0)
  }
}

function addUrlToPlaylist(url) {
  const name = url.split('/').pop()?.split('?')[0] || url
  playlist.push({ name: name || url, src: url })
  renderPlaylist()
  if (playlistIndex === -1 || playlist.length === 1) {
    playTrack(playlist.length - 1)
  }
}

// ... parsePlaylistFile, removeFromPlaylist, clearPlaylist, renderPlaylist, escHtml, savePlaylistToFile ...
// Copying these from reference as they are UI logic mainly.

function parsePlaylistFile(text, fileName) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const ext = fileName.toLowerCase().split('.').pop()
  const urls = []

  if (ext === 'm3u' || ext === 'm3u8') {
    for (const line of lines) {
      if (line.startsWith('#')) continue
      urls.push(line)
    }
  } else if (ext === 'pls') {
    for (const line of lines) {
      const m = line.match(/^File\d+=(.+)$/i)
      if (m) urls.push(m[1])
    }
  } else {
    for (const line of lines) {
      if (line.startsWith('http') || line.startsWith('/')) urls.push(line)
    }
  }

  for (const u of urls) {
    const name = u.split('/').pop()?.split('?')[0] || u
    playlist.push({ name: name || u, src: u })
  }
  renderPlaylist()
  if (playlistIndex === -1 && playlist.length > 0) playTrack(0)
}

function removeFromPlaylist(idx) {
  if (idx < 0 || idx >= playlist.length) return
  playlist.splice(idx, 1)
  if (playlistIndex === idx) {
    if (playlist.length > 0) {
      playTrack(Math.min(idx, playlist.length - 1))
    } else {
      playlistIndex = -1
      stopPlayback()
    }
  } else if (playlistIndex > idx) {
    playlistIndex--
  }
  renderPlaylist()
}

function clearPlaylist() {
  playlist.length = 0
  playlistIndex = -1
  stopPlayback()
  renderPlaylist()
}

function renderPlaylist() {
  if (playlist.length === 0) {
    playlistList.innerHTML = '<div class="playlist-empty">Drag files here or use Media → Open File</div>'
    return
  }
  playlistList.innerHTML = ''
  playlist.forEach((item, i) => {
    const el = document.createElement('div')
    el.className = 'playlist-item' + (i === playlistIndex ? ' active' : '')
    el.innerHTML = `
      <span class="pl-num">${i + 1}</span>
      <span class="pl-name" title="${escHtml(item.name)}">${escHtml(item.name)}</span>
      <span class="pl-dur"></span> <!-- Duration not easily available before playing in this setup -->
      <button class="pl-remove" title="Remove">✕</button>
    `
    el.querySelector('.pl-name').addEventListener('dblclick', () => playTrack(i))
    el.querySelector('.pl-remove').addEventListener('click', (e) => {
      e.stopPropagation()
      removeFromPlaylist(i)
    })
    playlistList.appendChild(el)
  })
}

function escHtml(s) {
  return s.replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'"')
}

function savePlaylistToFile() {
  if (playlist.length === 0) return
  let m3u = '#EXTM3U\n'
  for (const item of playlist) {
    m3u += `#EXTINF:-1,${item.name}\n${item.src || item.name}\n`
  }
  const blob = new Blob([m3u], { type: 'audio/x-mpegurl' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'playlist.m3u'
  a.click()
  URL.revokeObjectURL(a.href)
}

// ---------------------------------------------------------------------------
// Playback logic
// ---------------------------------------------------------------------------
function playTrack(idx) {
  if (idx < 0 || idx >= playlist.length) return
  if (!isReady) return

  playlistIndex = idx
  const item = playlist[idx]
  
  // Stop current
  if (mediaPlayer.is_playing()) {
      mediaPlayer.stop()
  }

  let media = null
  if (item.file) {
      // File object
      // We need to mount it. We'll use a simple ID based system.
      // In a real app we might need to manage IDs better.
      const fileId = 1; // Always use 1 for current playing file for simplicity?
      vlcModule.vlc_access_file[fileId] = item.file;
      media = new Media(vlcModule, `emjsfile://${fileId}`);
  } else if (item.src) {
      // URL
      media = new Media(vlcModule, item.src);
  }

  if (media) {
      mediaPlayer.set_media(media)
      media.release() // MediaPlayer keeps a reference
      mediaPlayer.play()
      
      // Restore speed
      mediaPlayer.set_rate(playbackSpeed)
      
      windowTitle.textContent = `${item.name} — VLC.js media player`
      statusText.textContent = item.name
      videoArea.classList.add('has-media')
      isPlaying = true
      btnPlay.textContent = '⏸'
      
      renderPlaylist()
  }
}

function togglePlayPause() {
  if (!isReady) return
  if (playlistIndex === -1 && playlist.length === 0) {
    inputFile.click()
    return
  }
  if (playlistIndex === -1 && playlist.length > 0) {
    playTrack(0)
    return
  }
  
  mediaPlayer.toggle_play()
  // UI update will happen in updateUI loop
}

function stopPlayback() {
  if (!isReady) return
  mediaPlayer.stop()
  isPlaying = false
  btnPlay.textContent = '▶'
  seekFill.style.width = '0%'
  seekThumb.style.left = '0%'
  timeDisplay.textContent = '--:-- / --:--'
  statusText.textContent = 'Ready'
  windowTitle.textContent = 'VLC.js media player'
  videoArea.classList.remove('has-media')
  
  // Reset canvas? 
  // vlcModule.canvas.width = ...
}

function playNext() {
  if (playlist.length === 0) return
  if (repeatMode === 2) {
    // repeat one — restart current
    // mediaPlayer.stop(); mediaPlayer.play(); // Simplified
    mediaPlayer.set_position(0);
    return
  }
  let next = playlistIndex + 1
  if (shuffleOn) {
    next = Math.floor(Math.random() * playlist.length)
  }
  if (next >= playlist.length) {
    if (repeatMode === 1) next = 0
    else { stopPlayback(); return }
  }
  playTrack(next)
}

function playPrev() {
  if (playlist.length === 0) return
  // If more than 3 seconds in, restart current track
  // Check position
  const time = mediaPlayer.get_time();
  if (time > 3000) {
    mediaPlayer.set_position(0);
    return
  }
  let prev = playlistIndex - 1
  if (prev < 0) prev = repeatMode === 1 ? playlist.length - 1 : 0
  playTrack(prev)
}

function setSpeed(spd) {
  if (!isReady) return
  playbackSpeed = Math.max(0.25, Math.min(4.0, spd))
  mediaPlayer.set_rate(playbackSpeed)
  speedDisplay.textContent = `${playbackSpeed.toFixed(1)}×`
}

// ---------------------------------------------------------------------------
// UI Update Loop
// ---------------------------------------------------------------------------
function updateUI() {
    if (isReady && mediaPlayer) {
        // Check play state
        const playing = mediaPlayer.is_playing()
        if (playing !== isPlaying) {
            isPlaying = playing
            btnPlay.textContent = isPlaying ? '⏸' : '▶'
        }

        if (isPlaying && !seeking) {
            const pos = mediaPlayer.get_position() // 0.0 to 1.0
            const len = mediaPlayer.get_length() // in ms
            const time = mediaPlayer.get_time() // in ms

            if (len > 0) {
                const pct = pos * 100
                seekFill.style.width = `${pct}%`
                seekThumb.style.left = `${pct}%`
                timeDisplay.textContent = `${fmtTimeMs(time)} / ${fmtTimeMs(len)}`
            }
        }
    }
    requestAnimationFrame(updateUI)
}


// ---------------------------------------------------------------------------
// Seek bar
// ---------------------------------------------------------------------------
let seeking = false

seekBar.addEventListener('click', (e) => {
  if (!isReady) return
  const rect = seekBar.getBoundingClientRect()
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  mediaPlayer.set_position(pct)
})

seekBar.addEventListener('mousedown', (e) => {
  seeking = true
  updateSeekFromMouse(e)
})
document.addEventListener('mousemove', (e) => { if (seeking) updateSeekFromMouse(e) })
document.addEventListener('mouseup', (e) => { 
    if(seeking) {
        seeking = false
        // Final seek
        if (isReady) {
            const rect = seekBar.getBoundingClientRect()
            const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
            mediaPlayer.set_position(pct)
        }
    }
})

function updateSeekFromMouse(e) {
  const rect = seekBar.getBoundingClientRect()
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  seekFill.style.width = `${pct * 100}%`
  seekThumb.style.left = `${pct * 100}%`
  // Don't seek constantly while dragging to avoid stutter? Or do?
  // Let's seek on mouseup mostly, or maybe throttle.
  // For visual feedback we updated the bar.
}


// ---------------------------------------------------------------------------
// Volume
// ---------------------------------------------------------------------------
volSlider.addEventListener('input', () => {
  if (!isReady) return
  const vol = parseInt(volSlider.value)
  mediaPlayer.set_volume(vol)
  mediaPlayer.set_mute(0)
  updateVolumeIcon()
})

function adjustVolume(delta) {
  if (!isReady) return
  const current = mediaPlayer.get_volume()
  const newVal = Math.max(0, Math.min(100, current + delta))
  volSlider.value = newVal
  mediaPlayer.set_volume(newVal)
  mediaPlayer.set_mute(0)
  updateVolumeIcon()
}

function toggleMute() {
  if (!isReady) return
  mediaPlayer.toggle_mute()
  updateVolumeIcon()
}

function updateVolumeIcon() {
  if (!isReady) return
  const muted = mediaPlayer.get_mute()
  const vol = mediaPlayer.get_volume()
  btnMute.textContent = (muted || vol === 0) ? '🔇' : vol < 50 ? '🔉' : '🔊'
}

// ---------------------------------------------------------------------------
// Menu bar & Buttons (Copying handlers from reference)
// ---------------------------------------------------------------------------
const menuBar = document.getElementById('menu-bar')
let openMenu = null

menuBar.addEventListener('click', (e) => {
  const item = e.target.closest('.menu-item')
  if (!item) return
  if (e.target.closest('.menu-action')) {
    closeMenus()
    return
  }
  if (item.classList.contains('open')) {
    closeMenus()
  } else {
    closeMenus()
    item.classList.add('open')
    openMenu = item
  }
})

menuBar.addEventListener('mouseover', (e) => {
  if (!openMenu) return
  const item = e.target.closest('.menu-item')
  if (item && item !== openMenu) {
    closeMenus()
    item.classList.add('open')
    openMenu = item
  }
})

function closeMenus() {
  document.querySelectorAll('.menu-item.open').forEach(m => m.classList.remove('open'))
  openMenu = null
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.menu-bar')) closeMenus()
})

// Menu actions
document.getElementById('menu-open-file').addEventListener('click', () => inputFile.click())
document.getElementById('menu-open-multiple').addEventListener('click', () => inputFile.click())
document.getElementById('menu-open-folder').addEventListener('click', () => inputFolder.click())
document.getElementById('menu-open-url').addEventListener('click', () => showDialog(dialogUrl))
document.getElementById('menu-open-playlist').addEventListener('click', () => inputPlaylist.click())
document.getElementById('menu-save-playlist').addEventListener('click', savePlaylistToFile)
document.getElementById('menu-quit').addEventListener('click', () => { stopPlayback(); clearPlaylist() })
document.getElementById('menu-play').addEventListener('click', togglePlayPause)
document.getElementById('menu-stop').addEventListener('click', stopPlayback)
document.getElementById('menu-prev').addEventListener('click', playPrev)
document.getElementById('menu-next').addEventListener('click', playNext)
document.getElementById('menu-speed-up').addEventListener('click', () => setSpeed(playbackSpeed + 0.25))
document.getElementById('menu-speed-down').addEventListener('click', () => setSpeed(playbackSpeed - 0.25))
document.getElementById('menu-speed-normal').addEventListener('click', () => setSpeed(1.0))
// Jump
document.getElementById('menu-jump-fwd').addEventListener('click', () => { 
    if (isReady) mediaPlayer.set_time(mediaPlayer.get_time() + 10000)
})
document.getElementById('menu-jump-back').addEventListener('click', () => { 
    if (isReady) mediaPlayer.set_time(mediaPlayer.get_time() - 10000)
})
document.getElementById('menu-vol-up').addEventListener('click', () => adjustVolume(5))
document.getElementById('menu-vol-down').addEventListener('click', () => adjustVolume(-5))
document.getElementById('menu-mute').addEventListener('click', toggleMute)
document.getElementById('menu-fullscreen').addEventListener('click', toggleFullscreen)
document.getElementById('menu-toggle-playlist').addEventListener('click', togglePlaylistPanel)
document.getElementById('menu-about').addEventListener('click', () => showDialog(dialogAbout))
document.getElementById('menu-shortcuts').addEventListener('click', () => showDialog(dialogShortcuts))

// Dialogs
function showDialog(el) { el.classList.add('visible') }
function hideDialog(el) { el.classList.remove('visible') }

document.getElementById('url-cancel').addEventListener('click', () => hideDialog(dialogUrl))
document.getElementById('url-play').addEventListener('click', () => {
  const url = urlInput.value.trim()
  if (url) { addUrlToPlaylist(url); urlInput.value = '' }
  hideDialog(dialogUrl)
})
urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('url-play').click()
  if (e.key === 'Escape') hideDialog(dialogUrl)
})
document.getElementById('about-close').addEventListener('click', () => hideDialog(dialogAbout))
document.getElementById('shortcuts-close').addEventListener('click', () => hideDialog(dialogShortcuts))

;[dialogUrl, dialogAbout, dialogShortcuts].forEach(d => {
  d.addEventListener('click', (e) => { if (e.target === d) hideDialog(d) })
})

// File inputs
inputFile.addEventListener('change', (e) => {
  if (e.target.files?.length) addToPlaylist(e.target.files)
  e.target.value = ''
})
inputFolder.addEventListener('change', (e) => {
  if (e.target.files?.length) addToPlaylist(e.target.files)
  e.target.value = ''
})
inputPlaylist.addEventListener('change', (e) => {
  const file = e.target.files?.[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = () => parsePlaylistFile(reader.result, file.name)
    reader.readAsText(file)
  }
  e.target.value = ''
})

// Drag and drop
videoArea.addEventListener('dragover', (e) => {
  e.preventDefault()
  videoArea.classList.add('drag-over')
})
videoArea.addEventListener('dragleave', () => videoArea.classList.remove('drag-over'))
videoArea.addEventListener('drop', (e) => {
  e.preventDefault()
  videoArea.classList.remove('drag-over')
  if (e.dataTransfer?.files?.length) addToPlaylist(e.dataTransfer.files)
})
playlistList.addEventListener('dragover', (e) => e.preventDefault())
playlistList.addEventListener('drop', (e) => {
  e.preventDefault()
  if (e.dataTransfer?.files?.length) addToPlaylist(e.dataTransfer.files)
})

videoArea.addEventListener('dblclick', toggleFullscreen)

// Buttons
btnPlay.addEventListener('click', togglePlayPause)
btnStop.addEventListener('click', stopPlayback)
btnPrev.addEventListener('click', playPrev)
btnNext.addEventListener('click', playNext)
btnFullscreen.addEventListener('click', toggleFullscreen)
btnMute.addEventListener('click', toggleMute)

btnPlaylist.addEventListener('click', togglePlaylistPanel)
document.getElementById('btn-repeat').addEventListener('click', cycleRepeat)
document.getElementById('btn-shuffle').addEventListener('click', toggleShuffle)
document.getElementById('pl-add-btn').addEventListener('click', () => inputFile.click())
document.getElementById('pl-clear-btn').addEventListener('click', clearPlaylist)
document.getElementById('pl-shuffle-btn').addEventListener('click', toggleShuffle)
document.getElementById('pl-repeat-btn').addEventListener('click', cycleRepeat)

speedDisplay.addEventListener('click', () => setSpeed(1.0))

// Repeat / Shuffle
function cycleRepeat() {
  repeatMode = (repeatMode + 1) % 3
  const labels = ['🔁', '🔁', '🔂']
  const tips   = ['Repeat: Off', 'Repeat: All', 'Repeat: One']
  btnRepeat.textContent = labels[repeatMode]
  btnRepeat.title = tips[repeatMode]
  btnRepeat.classList.toggle('active', repeatMode > 0)
  btnRepeat.style.opacity = repeatMode === 0 ? '0.5' : '1'
  document.getElementById('pl-repeat-btn').textContent = `${labels[repeatMode]} ${tips[repeatMode]}`
}

function toggleShuffle() {
  shuffleOn = !shuffleOn
  btnShuffle.classList.toggle('active', shuffleOn)
  document.getElementById('pl-shuffle-btn').style.color = shuffleOn ? '#ff6600' : ''
}

// Fullscreen
function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen()
  } else {
    document.documentElement.requestFullscreen().catch(() => {})
  }
}

function togglePlaylistPanel() {
  playlistPanel.classList.toggle('visible')
  btnPlaylist.classList.toggle('active', playlistPanel.classList.contains('visible'))
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

  const ctrl = e.ctrlKey || e.metaKey

  switch (e.key) {
    case ' ':
      e.preventDefault()
      togglePlayPause()
      break
    case 's': case 'S':
      if (!ctrl) stopPlayback()
      break
    case 'p': case 'P':
      if (!ctrl) playPrev()
      break
    case 'n': case 'N':
      if (!ctrl) playNext()
      break
    case 'f': case 'F':
      if (!ctrl) toggleFullscreen()
      break
    case 'm': case 'M':
      if (!ctrl) toggleMute()
      break
    case 'ArrowUp':
      e.preventDefault()
      adjustVolume(5)
      break
    case 'ArrowDown':
      e.preventDefault()
      adjustVolume(-5)
      break
    case 'ArrowRight':
      e.preventDefault()
      if (isReady) mediaPlayer.set_time(mediaPlayer.get_time() + 10000)
      break
    case 'ArrowLeft':
      e.preventDefault()
      if (isReady) mediaPlayer.set_time(mediaPlayer.get_time() - 10000)
      break
    case ']':
      setSpeed(playbackSpeed + 0.25)
      break
    case '[':
      setSpeed(playbackSpeed - 0.25)
      break
    case '=':
      setSpeed(1.0)
      break
    case 'o': case 'O':
      if (ctrl) { e.preventDefault(); inputFile.click() }
      break
    case 'l': case 'L':
      if (ctrl) { e.preventDefault(); togglePlaylistPanel() }
      break
    case 'Escape':
      if (document.fullscreenElement) document.exitFullscreen()
      hideDialog(dialogUrl)
      hideDialog(dialogAbout)
      hideDialog(dialogShortcuts)
      break
  }
})

// Ctrl+N
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 'N')) {
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault()
      showDialog(dialogUrl)
    }
  }
})

// Start
initVLC()
