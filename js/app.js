/* =========================================================
   Restify — YouTube Music Player dengan Supabase
   ========================================================= */

const SUPABASE_URL = "https://vzgnmzgserqaknvtdgjr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_VUzTLgVIdBuQcqEnNh1IvA_dquGkDG5";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const USER_KEY = "restify_username";
const LEGACY_TRACKS_KEY = "restify_saved_tracks";
const LEGACY_PLAYLISTS_KEY = "restify_playlists";
const OWNER_SECRET_CODE = "#1234";
const OWNER_NAME = "Rsym";
const OWNER_ICON = "⚡";

let currentUser = localStorage.getItem(USER_KEY) || "";

const defaultTracks = [];

let tracks = [];
let playlists = {};
let activeTab = "all";
let activePlaylistName = null;
let activeDisplayTracks = [];
let searchQuery = "";
let currentIndex = -1;
let isShuffle = false;
let selectedTrackForPlaylist = null;

/* ---------------- Elemen DOM ---------------- */
const userNameDisplay = document.querySelector("#userNameDisplay");
const loginLogoutBtn = document.querySelector("#loginLogoutBtn");
const loginModal = document.querySelector("#loginModal");
const modalLoginForm = document.querySelector("#modalLoginForm");
const modalNameInput = document.querySelector("#modalNameInput");
const closeModalBtn = document.querySelector("#closeModalBtn");

const addLinkForm = document.querySelector("#addLinkForm");
const linkInput = document.querySelector("#linkInput");
const searchForm = document.querySelector("#searchForm");
const searchInput = document.querySelector("#searchInput");
const searchButton = document.querySelector("#searchButton");
const statusElement = document.querySelector("#status");
const resultsElement = document.querySelector("#results");
const resultsHeading = document.querySelector("#resultsHeading");

const navTabs = document.querySelectorAll(".nav-tab");
const playlistSection = document.querySelector("#playlistSection");
const playlistChipsContainer = document.querySelector("#playlistChipsContainer");
const createPlaylistBtn = document.querySelector("#createPlaylistBtn");

const playlistModal = document.querySelector("#playlistModal");
const playlistListOptions = document.querySelector("#playlistListOptions");
const closePlaylistModalBtn = document.querySelector("#closePlaylistModalBtn");

const playButton = document.querySelector("#playButton");
const playIcon = document.querySelector("#playIcon");
const pauseIcon = document.querySelector("#pauseIcon");
const prevButton = document.querySelector("#prevButton");
const nextButton = document.querySelector("#nextButton");
const shuffleBtn = document.querySelector("#shuffleBtn");
const progress = document.querySelector("#progress");
const currentTimeElement = document.querySelector("#currentTime");
const durationElement = document.querySelector("#duration");
const playerTitle = document.querySelector("#playerTitle");
const playerArtist = document.querySelector("#playerArtist");
const playerCover = document.querySelector("#playerCover");

/* ---------------- Helper UI & Storage ---------------- */

function updateAuthUI() {
  if (currentUser) {
    if (currentUser === OWNER_NAME) {
      userNameDisplay.textContent = `${currentUser} ${OWNER_ICON}`;
      userNameDisplay.parentElement.classList.add("is-owner-user");
    } else {
      userNameDisplay.textContent = currentUser;
      userNameDisplay.parentElement.classList.remove("is-owner-user");
    }
    loginLogoutBtn.textContent = "Keluar";
  } else {
    userNameDisplay.textContent = "Tamu";
    userNameDisplay.parentElement.classList.remove("is-owner-user");
    loginLogoutBtn.textContent = "Login";
  }
  updateDisplayedTracks();
}

async function persistPlaylist(name) {
  const { error } = await supabaseClient
    .from("playlists")
    .update({ tracks: playlists[name] || [] })
    .eq("name", name);
  if (error) throw error;
}

function showDatabaseError(error, fallback = "Terjadi masalah saat mengakses database.") {
  console.error(error);
  setStatus(fallback);
}

function setStatus(msg) {
  statusElement.textContent = msg;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function setPlayingState(isPlaying) {
  playIcon.toggleAttribute("hidden", isPlaying);
  pauseIcon.toggleAttribute("hidden", !isPlaying);
  playButton.setAttribute("aria-label", isPlaying ? "Jeda" : "Putar");
}

function updatePlayerButtons() {
  const hasTrack = currentIndex >= 0;
  playButton.disabled = !hasTrack;
  prevButton.disabled = !hasTrack || currentIndex <= 0;
  nextButton.disabled = !hasTrack || currentIndex >= activeDisplayTracks.length - 1;
}

function decodeHtml(str) {
  const t = document.createElement("textarea");
  t.innerHTML = str;
  return t.value;
}

function getVideoId(trackUrl) {
  try {
    const cleanUrl = trackUrl.trim();
    if (cleanUrl.includes("youtu.be/")) {
      return new URL(cleanUrl).pathname.slice(1).split("?")[0];
    }
    const parsedUrl = new URL(cleanUrl, "https://www.youtube.com");
    const videoId = parsedUrl.searchParams.get("v");
    if (videoId) return videoId;
    const pathMatch = parsedUrl.pathname.match(/\/(?:shorts|embed|v|e|watch)?\/([^/?]+)/);
    return pathMatch ? pathMatch[1] : null;
  } catch (e) {
    const match = trackUrl.match(/(?:v=|shorts\/|youtu\.be\/)([^&?/]+)/);
    return match ? match[1] : null;
  }
}

/* ---------------- Render Navigasi & Tab ---------------- */

function switchTab(tabName) {
  activeTab = tabName;
  navTabs.forEach(tab => tab.classList.toggle("active", tab.dataset.tab === tabName));
  playlistSection.hidden = (tabName !== "playlists");

  if (searchQuery) {
    resultsHeading.textContent = `Hasil pencarian: ${searchQuery}`;
  } else if (tabName === "all") {
    resultsHeading.textContent = "Daftar Putar Utama";
  } else if (tabName === "playlists") {
    renderPlaylistChips();
    resultsHeading.textContent = activePlaylistName ? `Playlist: ${activePlaylistName}` : "Pilih Playlist";
  }
  updateDisplayedTracks();
}

function updateDisplayedTracks() {
  let baseTracks = [];
  if (activeTab === "all") {
    baseTracks = [...tracks];
  } else if (activeTab === "playlists") {
    baseTracks = activePlaylistName && playlists[activePlaylistName]
      ? [...playlists[activePlaylistName]]
      : [];
  }

  activeDisplayTracks = searchQuery
    ? baseTracks.filter(track => (track.title || "").toLocaleLowerCase("id").includes(searchQuery.toLocaleLowerCase("id")))
    : baseTracks;
  renderTracks();
  updatePlayerButtons();
}

/* ---------------- Playlist Manager ---------------- */

function renderPlaylistChips() {
  playlistChipsContainer.replaceChildren();
  const names = Object.keys(playlists);

  if (names.length === 0) {
    playlistChipsContainer.innerHTML = '<span style="color:var(--muted); font-size:0.8rem;">Belum ada playlist</span>';
    return;
  }

  if (!activePlaylistName || !playlists[activePlaylistName]) {
    activePlaylistName = names[0];
  }

  names.forEach(name => {
    const chip = document.createElement("button");
    chip.className = `playlist-chip ${name === activePlaylistName ? "active" : ""}`;
    chip.textContent = name;
    chip.addEventListener("click", () => {
      activePlaylistName = name;
      resultsHeading.textContent = `Playlist: ${name}`;
      renderPlaylistChips();
      updateDisplayedTracks();
    });
    playlistChipsContainer.append(chip);
  });
}

function openAddToPlaylistModal(track) {
  selectedTrackForPlaylist = track;
  playlistListOptions.replaceChildren();

  const names = Object.keys(playlists);
  if (names.length === 0) {
    playlistListOptions.innerHTML = '<p style="color:var(--muted); font-size:0.8rem;">Belum ada playlist. Buat terlebih dahulu.</p>';
  } else {
    names.forEach(name => {
      const btn = document.createElement("button");
      btn.className = "playlist-option-btn";
      btn.textContent = name;
      btn.addEventListener("click", () => {
        // Cek duplikasi video URL
        const exists = playlists[name].some(t => t.url === track.url);
        if (!exists) {
          playlists[name].push(track);
          persistPlaylist(name).then(() => {
            alert(`Lagu berhasil ditambahkan ke "${name}"`);
            if (activeTab === "playlists") updateDisplayedTracks();
          }).catch(error => {
            playlists[name].pop();
            showDatabaseError(error, "Gagal menyimpan lagu ke playlist.");
          });
        } else {
          alert(`Lagu sudah ada di "${name}"`);
        }
        playlistModal.hidden = true;
        if (activeTab === "playlists") updateDisplayedTracks();
      });
      playlistListOptions.append(btn);
    });
  }

  playlistModal.hidden = false;
}

/* ---------------- Render List Lagu ---------------- */

function createTrackRow(track, index) {
  const row = document.createElement("button");
  row.className = "track-row";
  row.type = "button";
  row.setAttribute("aria-current", String(index === currentIndex));
  row.addEventListener("click", () => playTrack(index));

  const cover = document.createElement("img");
  cover.className = "cover";
  cover.alt = "";
  cover.loading = "lazy";
  cover.src = track.thumbnail || "";

  const details = document.createElement("div");
  details.className = "track-details";

  const title = document.createElement("p");
  title.className = "track-title";
  title.textContent = track.title || "Judul tidak tersedia";

  const artist = document.createElement("p");
  artist.className = "track-artist";
  artist.textContent = track.artist || "Artis tidak diketahui";

  const uploader = document.createElement("p");
  uploader.className = "track-uploader";

  const uploaderName = track.uploader || "Anonim";
  if (uploaderName === OWNER_NAME) {
    uploader.classList.add("is-owner");
    uploader.textContent = `Diupload oleh: ${uploaderName} ${OWNER_ICON}`;
  } else {
    uploader.textContent = `Diupload oleh: ${uploaderName}`;
  }

  details.append(title, artist, uploader);
  row.append(cover, details);

  const actions = document.createElement("div");
  actions.className = "track-actions";

  // Tombol Tambah ke Playlist
  const addPlBtn = document.createElement("button");
  addPlBtn.className = "track-action-btn";
  addPlBtn.type = "button";
  addPlBtn.title = "Tambah ke Playlist";
  addPlBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>';
  addPlBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openAddToPlaylistModal(track);
  });
  actions.append(addPlBtn);

  // Tombol Hapus (Eksklusif Owner)
  if (currentUser === OWNER_NAME) {
    const del = document.createElement("button");
    del.className = "track-action-btn delete-btn";
    del.type = "button";
    del.title = "Hapus lagu";
    del.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14M10 10v6M14 10v6"/></svg>';
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteTrack(index);
    });
    actions.append(del);
  }

  const item = document.createElement("div");
  item.className = "track-item";
  item.append(row, actions);
  return item;
}

function renderTracks() {
  resultsElement.replaceChildren();
  if (activeDisplayTracks.length === 0) {
    resultsElement.innerHTML = '<div class="empty-state">Belum ada lagu dalam daftar ini.</div>';
    return;
  }

  const fragment = document.createDocumentFragment();
  activeDisplayTracks.forEach((track, index) => {
    fragment.append(createTrackRow(track, index));
  });
  resultsElement.append(fragment);
  setStatus(`${activeDisplayTracks.length} lagu`);
}

/* ---------------- Hapus lagu ---------------- */

function stopPlayback() {
  pendingVideoId = null;
  if (ytReady) ytPlayer.stopVideo();
  stopProgressTimer();
  currentIndex = -1;
  playerTitle.textContent = "Belum ada lagu";
  playerArtist.textContent = "-";
  playerCover.removeAttribute("src");
  progress.value = "0";
  progress.disabled = true;
  currentTimeElement.textContent = "0:00";
  durationElement.textContent = "0:00";
  setPlayingState(false);
}

async function deleteTrack(index) {
  if (currentUser !== OWNER_NAME) {
    alert("Hanya Owner yang memiliki akses untuk menghapus lagu!");
    return;
  }

  const track = activeDisplayTracks[index];
  if (!track) return;
  if (!confirm(`Hapus "${track.title}"?`)) return;

  try {
    if (track.id) {
      const { error } = await supabaseClient.from("tracks").delete().eq("id", track.id);
      if (error) throw error;
    }
    tracks = tracks.filter(item => item.url !== track.url);
    for (const name of Object.keys(playlists)) {
      playlists[name] = playlists[name].filter(item => item.url !== track.url);
      await persistPlaylist(name);
    }

    if (index === currentIndex) stopPlayback();
    else if (index < currentIndex) currentIndex--;
    updateDisplayedTracks();
    setStatus("Lagu dihapus");
  } catch (error) {
    showDatabaseError(error, "Gagal menghapus lagu dari database.");
  }
}

/* ---------------- Supabase: lagu & pencarian lokal ---------------- */

async function addTrackFromLink(url) {
  if (!currentUser) {
    loginModal.hidden = false;
    modalNameInput.focus();
    return;
  }

  const videoId = getVideoId(url);
  if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    alert("Link YouTube tidak valid!");
    return;
  }

  setStatus("Memeriksa link...");
  try {
    const existing = tracks.some(track => track.video_id === videoId || getVideoId(track.url) === videoId);
    if (existing) {
      setStatus("Video ini sudah tersimpan.");
      alert("Link video YouTube ini sudah pernah ditambahkan.");
      return;
    }

    const { data: duplicateById, error: duplicateIdError } = await supabaseClient
      .from("tracks").select("id").eq("video_id", videoId).limit(1);
    if (duplicateIdError) throw duplicateIdError;
    const { data: duplicateByUrl, error: duplicateUrlError } = await supabaseClient
      .from("tracks").select("id").eq("url", `https://www.youtube.com/watch?v=${videoId}`).limit(1);
    if (duplicateUrlError) throw duplicateUrlError;
    if ((duplicateById && duplicateById.length) || (duplicateByUrl && duplicateByUrl.length)) {
      setStatus("Video ini sudah tersimpan.");
      alert("Link video YouTube ini sudah pernah ditambahkan.");
      await loadTracks();
      return;
    }

    setStatus("Mengambil informasi lagu...");
    let title = `Lagu (${videoId})`;
    let artist = "YouTube";
    try {
      const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`);
      if (res.ok) {
        const data = await res.json();
        title = data.title || title;
        artist = data.author_name || artist;
      }
    } catch (e) {
      console.warn("Metadata YouTube tidak tersedia; memakai judul cadangan.", e);
    }

    const newTrack = {
      title,
      artist,
      uploader: currentUser,
      video_id: videoId,
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      url: `https://www.youtube.com/watch?v=${videoId}`
    };

    const { data, error } = await supabaseClient.from("tracks").insert(newTrack).select().single();
    if (error) {
      if (error.code === "23505") {
        alert("Video ini sudah pernah ditambahkan.");
        await loadTracks();
        return;
      }
      throw error;
    }

    tracks.unshift(data || newTrack);
    if (currentIndex >= 0) currentIndex++;
    updateDisplayedTracks();
    linkInput.value = "";
    setStatus("Berhasil ditambahkan");
  } catch (error) {
    showDatabaseError(error, "Gagal menyimpan lagu. Periksa koneksi dan kebijakan Supabase.");
  }
}

async function searchTracks(query) {
  searchQuery = query.trim();
  switchTab("all");
  resultsHeading.textContent = searchQuery ? `Hasil pencarian: ${searchQuery}` : "Daftar Putar Utama";
  updateDisplayedTracks();
  setStatus(`${activeDisplayTracks.length} lagu ditemukan`);
}

async function loadTracks() {
  // Migrasikan lagu lama dari localStorage ke Supabase satu kali bila tersedia.
  let legacyTracks = [];
  try {
    const saved = JSON.parse(localStorage.getItem(LEGACY_TRACKS_KEY) || "[]");
    if (Array.isArray(saved)) legacyTracks = saved;
  } catch (e) {
    console.warn("Data lagu lokal lama tidak dapat dibaca.", e);
  }

  const { data: currentRows, error: currentError } = await supabaseClient.from("tracks").select("*");
  if (currentError) throw currentError;
  const knownIds = new Set((currentRows || []).map(track => track.video_id || getVideoId(track.url || "")).filter(Boolean));
  const knownUrls = new Set((currentRows || []).map(track => track.url));

  for (const legacy of legacyTracks) {
    const videoId = legacy.video_id || getVideoId(legacy.url || "");
    if (!videoId || knownIds.has(videoId) || knownUrls.has(legacy.url)) continue;
    const legacyTrack = {
      title: legacy.title || `Lagu (${videoId})`,
      artist: legacy.artist || "YouTube",
      uploader: legacy.uploader || "Anonim",
      video_id: videoId,
      thumbnail: legacy.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      url: `https://www.youtube.com/watch?v=${videoId}`
    };
    const { data: insertedLegacy, error: legacyError } = await supabaseClient.from("tracks").insert(legacyTrack).select().single();
    if (!legacyError && insertedLegacy) {
      currentRows.push(insertedLegacy);
      knownIds.add(videoId);
      knownUrls.add(legacyTrack.url);
    } else if (legacyError && legacyError.code !== "23505") {
      console.warn("Lagu lokal lama tidak dapat dimigrasikan:", legacyError);
    }
  }

  const { data, error } = await supabaseClient.from("tracks").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  tracks = data || [];
  // Lengkapi video_id untuk data lama yang URL-nya masih dapat dikenali.
  for (const track of tracks) {
    const videoId = track.video_id || getVideoId(track.url || "");
    if (videoId && !track.video_id) {
      const { error: updateError } = await supabaseClient.from("tracks").update({ video_id: videoId }).eq("id", track.id);
      if (!updateError) track.video_id = videoId;
    }
  }

  // Tambahkan dua lagu bawaan hanya jika sumbernya belum ada.
  for (const defaultTrack of defaultTracks) {
    const exists = tracks.some(track => track.video_id === defaultTrack.video_id || getVideoId(track.url || "") === defaultTrack.video_id);
    if (exists) continue;
    const { data: inserted, error: insertError } = await supabaseClient.from("tracks").insert(defaultTrack).select().single();
    if (!insertError && inserted) tracks.unshift(inserted);
    else if (insertError && insertError.code !== "23505") console.warn("Lagu bawaan tidak dapat ditambahkan:", insertError);
  }
  tracks.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
}

async function loadPlaylists() {
  const { data, error } = await supabaseClient.from("playlists").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  playlists = {};
  for (const row of data || []) {
    playlists[row.name] = Array.isArray(row.tracks) ? row.tracks : [];
  }

  // Migrasikan playlist lama dari localStorage tanpa menimpa playlist yang sudah ada di Supabase.
  let legacyPlaylists = {};
  try {
    const saved = JSON.parse(localStorage.getItem(LEGACY_PLAYLISTS_KEY) || "{}");
    if (saved && typeof saved === "object" && !Array.isArray(saved)) legacyPlaylists = saved;
  } catch (e) {
    console.warn("Playlist lokal lama tidak dapat dibaca.", e);
  }
  for (const [name, oldItems] of Object.entries(legacyPlaylists)) {
    if (!name.trim() || playlists[name] || !Array.isArray(oldItems)) continue;
    const migratedItems = oldItems.map(oldTrack => {
      const videoId = oldTrack.video_id || getVideoId(oldTrack.url || "");
      return tracks.find(track => (videoId && (track.video_id === videoId || getVideoId(track.url || "") === videoId)) || track.url === oldTrack.url) || null;
    }).filter(Boolean);
    const { data: created, error: createError } = await supabaseClient.from("playlists").insert({ name, tracks: migratedItems }).select().single();
    if (!createError && created) playlists[name] = Array.isArray(created.tracks) ? created.tracks : [];
    else if (createError && createError.code !== "23505") console.warn("Playlist lama tidak dapat dimigrasikan:", createError);
  }

  if (Object.keys(playlists).length === 0) {
    const { data: created, error: createError } = await supabaseClient.from("playlists").insert({ name: "Favorit Saya", tracks: [] }).select().single();
    if (createError && createError.code !== "23505") throw createError;
    if (created) playlists[created.name] = Array.isArray(created.tracks) ? created.tracks : [];
    if (!playlists["Favorit Saya"]) playlists["Favorit Saya"] = [];
  }
  activePlaylistName = Object.keys(playlists)[0] || null;
}

async function initializeDatabaseData() {
  setStatus("Menghubungkan ke database...");
  try {
    await loadTracks();
    await loadPlaylists();
    updateDisplayedTracks();
    setStatus(`${tracks.length} lagu`);
  } catch (error) {
    showDatabaseError(error, "Gagal memuat data Supabase. Periksa key, tabel, dan akses database.");
  }
}

/* =========================================================
   PEMUTAR: YouTube IFrame Player API
   ========================================================= */

let ytPlayer = null;
let ytReady = false;
let pendingVideoId = null;
let progressTimer = null;
let isSeeking = false;

(function loadYouTubeAPI() {
  const tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  tag.onerror = () => setStatus("Gagal memuat YouTube API.");
  document.head.appendChild(tag);
})();

window.onYouTubeIframeAPIReady = function () {
  const playerVars = { playsinline: 1, controls: 0, disablekb: 1, rel: 0, fs: 0, iv_load_policy: 3 };
  if (location.protocol.startsWith("http")) playerVars.origin = location.origin;

  ytPlayer = new YT.Player("ytPlayerHost", {
    width: "200",
    height: "200",
    playerVars,
    events: {
      onReady: () => {
        ytReady = true;
        if (pendingVideoId) {
          ytPlayer.loadVideoById(pendingVideoId);
          pendingVideoId = null;
        }
      },
      onStateChange: onPlayerStateChange,
      onError: onPlayerError
    }
  });
};

function onPlayerStateChange(e) {
  const S = YT.PlayerState;
  switch (e.data) {
    case S.PLAYING:
      setPlayingState(true);
      setStatus("");
      progress.disabled = false;
      durationElement.textContent = formatTime(ytPlayer.getDuration());
      startProgressTimer();
      break;
    case S.PAUSED:
      setPlayingState(false);
      break;
    case S.BUFFERING:
      setPlayingState(true);
      setStatus("Buffering...");
      break;
    case S.ENDED:
      setPlayingState(false);
      stopProgressTimer();
      handleTrackEnd();
      break;
  }
}

function handleTrackEnd() {
  if (activeDisplayTracks.length === 0) return;

  if (isShuffle) {
    let nextRand;
    do {
      nextRand = Math.floor(Math.random() * activeDisplayTracks.length);
    } while (nextRand === currentIndex && activeDisplayTracks.length > 1);
    playTrack(nextRand);
  } else {
    if (currentIndex < activeDisplayTracks.length - 1) {
      playTrack(currentIndex + 1);
    }
  }
}

function onPlayerError(e) {
  setPlayingState(false);
  stopProgressTimer();
  setStatus(`Gagal memutar (kode ${e.data})`);
  if ([100, 101, 150].includes(e.data)) {
    setTimeout(handleTrackEnd, 1500);
  }
}

function startProgressTimer() {
  stopProgressTimer();
  progressTimer = setInterval(() => {
    if (!ytReady || isSeeking) return;
    const cur = ytPlayer.getCurrentTime();
    const dur = ytPlayer.getDuration();
    currentTimeElement.textContent = formatTime(cur);
    if (dur > 0) {
      durationElement.textContent = formatTime(dur);
      progress.value = String((cur / dur) * 1000);
    }
  }, 500);
}

function stopProgressTimer() {
  if (progressTimer) clearInterval(progressTimer);
  progressTimer = null;
}

function playTrack(index) {
  const track = activeDisplayTracks[index];
  if (!track) return;

  const videoId = getVideoId(track.url);
  currentIndex = index;
  updatePlayerButtons();
  renderTracks();

  playerTitle.textContent = track.title;
  playerArtist.textContent = track.artist || "Artis tidak diketahui";
  playerCover.src = track.thumbnail || "";

  progress.value = "0";
  progress.disabled = true;
  currentTimeElement.textContent = "0:00";
  durationElement.textContent = "0:00";
  setPlayingState(false);

  if (!videoId) {
    setStatus("ID video tidak valid.");
    return;
  }

  setStatus("Memuat audio...");
  if (ytReady) {
    ytPlayer.loadVideoById(videoId);
  } else {
    pendingVideoId = videoId;
  }
}

/* ---------------- Event Listeners ---------------- */

navTabs.forEach(tab => {
  tab.addEventListener("click", () => switchTab(tab.dataset.tab));
});

createPlaylistBtn.addEventListener("click", async () => {
  const name = prompt("Masukkan nama playlist baru:");
  if (!name || !name.trim()) return;
  const cleanName = name.trim();
  if (playlists[cleanName]) {
    alert("Playlist dengan nama ini sudah ada.");
    return;
  }
  try {
    const { data, error } = await supabaseClient.from("playlists").insert({ name: cleanName, tracks: [] }).select().single();
    if (error) {
      if (error.code === "23505") alert("Playlist dengan nama ini sudah ada di database.");
      else throw error;
      return;
    }
    playlists[cleanName] = Array.isArray(data.tracks) ? data.tracks : [];
    activePlaylistName = cleanName;
    switchTab("playlists");
    setStatus("Playlist berhasil dibuat");
  } catch (error) {
    showDatabaseError(error, "Gagal membuat playlist.");
  }
});

closePlaylistModalBtn.addEventListener("click", () => playlistModal.hidden = true);

shuffleBtn.addEventListener("click", () => {
  isShuffle = !isShuffle;
  shuffleBtn.classList.toggle("active", isShuffle);
  setStatus(isShuffle ? "Mode Acak Aktif 🔀" : "Mode Berurutan");
});

loginLogoutBtn.addEventListener("click", () => {
  if (currentUser) {
    currentUser = "";
    localStorage.removeItem(USER_KEY);
    updateAuthUI();
  } else {
    loginModal.hidden = false;
    modalNameInput.focus();
  }
});

closeModalBtn.addEventListener("click", () => loginModal.hidden = true);

modalLoginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const inputVal = modalNameInput.value.trim();

  if (inputVal) {
    if (inputVal === `${OWNER_NAME}${OWNER_SECRET_CODE}`) {
      currentUser = OWNER_NAME;
    } else if (inputVal.toLowerCase() === OWNER_NAME.toLowerCase()) {
      currentUser = "Tamu";
    } else {
      currentUser = inputVal;
    }

    localStorage.setItem(USER_KEY, currentUser);
    updateAuthUI();
    loginModal.hidden = true;
    modalNameInput.value = "";
  }
});

addLinkForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const url = linkInput.value.trim();
  if (url) addTrackFromLink(url);
});

searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  searchTracks(searchInput.value);
});

searchInput.addEventListener("input", () => {
  if (!searchInput.value.trim() && searchQuery) {
    searchQuery = "";
    switchTab("all");
  }
});

playButton.addEventListener("click", () => {
  if (!ytReady || currentIndex < 0) {
    if (currentIndex >= 0) playTrack(currentIndex);
    return;
  }
  const state = ytPlayer.getPlayerState();
  if (state === YT.PlayerState.PLAYING || state === YT.PlayerState.BUFFERING) {
    ytPlayer.pauseVideo();
  } else if (state === YT.PlayerState.PAUSED) {
    ytPlayer.playVideo();
  } else {
    playTrack(currentIndex);
  }
});

prevButton.addEventListener("click", () => { if (currentIndex > 0) playTrack(currentIndex - 1); });
nextButton.addEventListener("click", () => {
  if (isShuffle) {
    handleTrackEnd();
  } else if (currentIndex < activeDisplayTracks.length - 1) {
    playTrack(currentIndex + 1);
  }
});

progress.addEventListener("pointerdown", () => { isSeeking = true; });
progress.addEventListener("input", () => {
  if (!ytReady) return;
  const dur = ytPlayer.getDuration();
  if (dur > 0) currentTimeElement.textContent = formatTime((Number(progress.value) / 1000) * dur);
});
progress.addEventListener("change", () => {
  if (ytReady) {
    const dur = ytPlayer.getDuration();
    if (dur > 0) ytPlayer.seekTo((Number(progress.value) / 1000) * dur, true);
  }
  isSeeking = false;
});

updateAuthUI();
initializeDatabaseData();
