/* =========================================================
   Restify v2 — Supabase + YouTube IFrame Player API
   ========================================================= */

const SUPABASE_URL = "https://vzgnmzgserqaknvtdgjr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_VUzTLgVIdBuQcqEnNh1IvA_dquGkDG5";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const USER_KEY = "restify_username";
const LEGACY_TRACKS_KEY = "restify_saved_tracks";
const OWNER_SECRET_CODE = "#1234";
const OWNER_NAME = "Rsym";
const OWNER_ICON = "⚡";

const HOME_PAGE_SIZE = 7;       // jumlah lagu yang tampil di beranda sebelum "Tampilkan lebih banyak"
const HOME_PLAYLIST_COUNT = 4;  // jumlah playlist acak di beranda

const ICON_PLUS = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>';
const ICON_MINUS = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/></svg>';
const ICON_TRASH = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14M10 10v6M14 10v6"/></svg>';

/* ---------------- State ---------------- */

let currentUser = localStorage.getItem(USER_KEY) || "";

let tracks = [];                 // semua lagu (Supabase: tabel tracks)
let playlists = [];              // [{ id, owner, name, tracks, created_at }]
let dataLoaded = false;

let view = "home";               // home | mine | detail | upload
let searchQuery = "";
let homeLimit = HOME_PAGE_SIZE;
let activePlaylistId = null;     // playlist terpilih di tab "Playlist Saya"
let detailPlaylistId = null;     // playlist yang dibuka dari beranda
let homePlaylistIds = [];        // playlist acak yang tampil di beranda

let queue = [];                  // antrean yang sedang diputar
let currentIndex = -1;           // posisi di dalam queue
let isShuffle = false;

let selectedTrackForPlaylist = null;
let pendingTrackForNewPlaylist = null;
let creatingPlaylist = false;

/* ---------------- Elemen DOM ---------------- */

const brandLink = document.querySelector("#brandLink");
const userNameDisplay = document.querySelector("#userNameDisplay");
const loginLogoutBtn = document.querySelector("#loginLogoutBtn");
const loginModal = document.querySelector("#loginModal");
const modalLoginForm = document.querySelector("#modalLoginForm");
const modalNameInput = document.querySelector("#modalNameInput");
const closeModalBtn = document.querySelector("#closeModalBtn");

const searchForm = document.querySelector("#searchForm");
const searchInput = document.querySelector("#searchInput");
const statusElement = document.querySelector("#status");
const navTabs = document.querySelectorAll(".nav-tab");

const homeView = document.querySelector("#homeView");
const resultsHeading = document.querySelector("#resultsHeading");
const resultsElement = document.querySelector("#results");
const showMoreWrap = document.querySelector("#showMoreWrap");
const showMoreBtn = document.querySelector("#showMoreBtn");
const homePlaylistsSection = document.querySelector("#homePlaylistsSection");
const homePlaylistGrid = document.querySelector("#homePlaylistGrid");
const reshuffleBtn = document.querySelector("#reshuffleBtn");

const playlistView = document.querySelector("#playlistView");
const playlistSection = document.querySelector("#playlistSection");
const playlistChipsContainer = document.querySelector("#playlistChipsContainer");
const createPlaylistBtn = document.querySelector("#createPlaylistBtn");
const backBtn = document.querySelector("#backBtn");
const playlistMessage = document.querySelector("#playlistMessage");
const playlistPanel = document.querySelector("#playlistPanel");
const playlistTitle = document.querySelector("#playlistTitle");
const playlistMeta = document.querySelector("#playlistMeta");
const playAllBtn = document.querySelector("#playAllBtn");
const deletePlaylistBtn = document.querySelector("#deletePlaylistBtn");
const playlistResults = document.querySelector("#playlistResults");

const uploadView = document.querySelector("#uploadView");
const addLinkForm = document.querySelector("#addLinkForm");
const linkInput = document.querySelector("#linkInput");
const addLinkButton = document.querySelector("#addLinkButton");
const uploadLoginNote = document.querySelector("#uploadLoginNote");
const uploadLoginBtn = document.querySelector("#uploadLoginBtn");

const playlistModal = document.querySelector("#playlistModal");
const playlistListOptions = document.querySelector("#playlistListOptions");
const closePlaylistModalBtn = document.querySelector("#closePlaylistModalBtn");

const createPlaylistModal = document.querySelector("#createPlaylistModal");
const createPlaylistForm = document.querySelector("#createPlaylistForm");
const playlistNameInput = document.querySelector("#playlistNameInput");
const closeCreatePlaylistBtn = document.querySelector("#closeCreatePlaylistBtn");

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

// Detail lagu (Now Playing)
const nowPlayingOpen = document.querySelector("#nowPlayingOpen");
const nowPlayingView = document.querySelector("#nowPlayingView");
const npBackdrop = document.querySelector("#npBackdrop");
const npCloseBtn = document.querySelector("#npCloseBtn");
const npAddBtn = document.querySelector("#npAddBtn");
const npCover = document.querySelector("#npCover");
const npTitle = document.querySelector("#npTitle");
const npArtist = document.querySelector("#npArtist");
const npUploader = document.querySelector("#npUploader");
const npProgress = document.querySelector("#npProgress");
const npCurrentTime = document.querySelector("#npCurrentTime");
const npDuration = document.querySelector("#npDuration");
const npPlayBtn = document.querySelector("#npPlayBtn");
const npPlayIcon = document.querySelector("#npPlayIcon");
const npPauseIcon = document.querySelector("#npPauseIcon");
const npPrevBtn = document.querySelector("#npPrevBtn");
const npNextBtn = document.querySelector("#npNextBtn");
const npShuffleBtn = document.querySelector("#npShuffleBtn");
let npHistory = false;

/* ---------------- Helper umum ---------------- */

function setStatus(msg) {
  statusElement.textContent = msg;
}

function showDatabaseError(error, fallback = "Terjadi masalah saat mengakses database.") {
  console.error(error);
  setStatus(fallback);
}

function dbMessage(error, fallback) {
  const text = `${error?.code || ""} ${error?.message || ""}`;
  if (/owner|PGRST204|42703/i.test(text)) {
    return "Kolom 'owner' belum ada di Supabase. Jalankan supabase.sql dulu.";
  }
  return fallback;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function shuffleArray(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
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

function videoKey(track) {
  return (track && (track.video_id || getVideoId(track.url || ""))) || "";
}

function sameTrack(a, b) {
  if (!a || !b) return false;
  const ka = videoKey(a);
  const kb = videoKey(b);
  if (ka && kb) return ka === kb;
  return a.url === b.url;
}

function isOwnerAdmin() {
  return currentUser === OWNER_NAME;
}

function ownerLabel(name) {
  return name === OWNER_NAME ? `${name} ${OWNER_ICON}` : name;
}

function normalizePlaylist(row) {
  return {
    ...row,
    owner: row.owner || "Anonim",
    tracks: Array.isArray(row.tracks) ? row.tracks : []
  };
}

function myPlaylists() {
  return currentUser ? playlists.filter(p => p.owner === currentUser) : [];
}

function panelPlaylist() {
  const id = view === "detail" ? detailPlaylistId : activePlaylistId;
  return playlists.find(p => p.id === id) || null;
}

function openLoginModal() {
  loginModal.hidden = false;
  modalNameInput.focus();
}

/* ---------------- Auth ---------------- */

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
  renderCurrentView();
}

/* ---------------- Navigasi halaman ---------------- */

function showView(next, opts = {}) {
  const prev = view;
  view = next;

  homeView.hidden = next !== "home";
  playlistView.hidden = next !== "mine" && next !== "detail";
  uploadView.hidden = next !== "upload";

  navTabs.forEach(tab => {
    const t = tab.dataset.tab;
    tab.classList.toggle(
      "active",
      (t === "all" && next === "home") ||
      (t === "playlists" && next === "mine") ||
      (t === "upload" && next === "upload")
    );
  });

  if (next === "home" && prev !== "home") {
    homeLimit = HOME_PAGE_SIZE;
    pickHomePlaylists();
  }

  renderCurrentView();
  if (opts.scroll !== false) window.scrollTo({ top: 0 });
}

function goHome() {
  searchQuery = "";
  searchInput.value = "";
  homeLimit = HOME_PAGE_SIZE;
  pickHomePlaylists();
  showView("home");
}

function renderCurrentView() {
  if (view === "home") renderHome();
  else if (view === "mine") renderMine();
  else if (view === "detail") renderDetail();
  else if (view === "upload") renderUpload();
  updatePlayerButtons();
}

/* ---------------- Render daftar lagu ---------------- */

function isCurrentTrack(track) {
  const cur = queue[currentIndex];
  return !!cur && sameTrack(cur, track);
}

function refreshHighlights() {
  const cur = queue[currentIndex];
  const key = cur ? videoKey(cur) : "";
  document.querySelectorAll(".track-row").forEach(row => {
    row.setAttribute("aria-current", String(!!key && row.dataset.key === key));
  });
}

function makeActionButton(icon, title, extraClass, handler) {
  const btn = document.createElement("button");
  btn.className = `track-action-btn ${extraClass}`.trim();
  btn.type = "button";
  btn.title = title;
  btn.setAttribute("aria-label", title);
  btn.innerHTML = icon;
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    handler();
  });
  return btn;
}

function createTrackRow(track, index, fullList, ctx) {
  const row = document.createElement("button");
  row.className = "track-row";
  row.type = "button";
  row.dataset.key = videoKey(track);
  row.setAttribute("aria-current", String(isCurrentTrack(track)));
  row.addEventListener("click", () => startQueue(fullList, index));

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

  if (ctx.mode === "playlist" && ctx.canEdit) {
    actions.append(makeActionButton(ICON_MINUS, "Hapus dari playlist", "", () => removeTrackFromPlaylist(ctx.playlist, track)));
  } else {
    actions.append(makeActionButton(ICON_PLUS, "Tambah ke playlist", "", () => openAddToPlaylistModal(track)));
  }

  if (ctx.mode === "home" && isOwnerAdmin()) {
    actions.append(makeActionButton(ICON_TRASH, "Hapus lagu", "delete-btn", () => deleteTrack(track)));
  }

  const item = document.createElement("div");
  item.className = "track-item";
  item.append(row, actions);
  return item;
}

function renderTrackList(container, shownList, fullList, ctx, emptyText) {
  container.replaceChildren();
  if (shownList.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = emptyText;
    container.append(empty);
    return;
  }
  const fragment = document.createDocumentFragment();
  shownList.forEach((track, index) => {
    fragment.append(createTrackRow(track, index, fullList, ctx));
  });
  container.append(fragment);
}

/* ---------------- Halaman: Beranda ---------------- */

function getHomeTracks() {
  if (!searchQuery) return tracks;
  const q = searchQuery.toLocaleLowerCase("id");
  return tracks.filter(track => (track.title || "").toLocaleLowerCase("id").includes(q));
}

function renderHome() {
  const all = getHomeTracks();
  const shown = all.slice(0, homeLimit);

  resultsHeading.textContent = searchQuery
    ? `Hasil pencarian: ${searchQuery} (${all.length})`
    : "Daftar Putar Utama";

  renderTrackList(
    resultsElement,
    shown,
    all,
    { mode: "home" },
    dataLoaded ? "Belum ada lagu dalam daftar ini." : "Memuat lagu..."
  );

  const remaining = all.length - shown.length;
  showMoreWrap.hidden = remaining <= 0;

  homePlaylistsSection.hidden = !!searchQuery;
  renderHomePlaylists();
}

function pickHomePlaylists() {
  const candidates = playlists.filter(p => p.tracks.length > 0);
  homePlaylistIds = shuffleArray(candidates).slice(0, HOME_PLAYLIST_COUNT).map(p => p.id);
}

function createPlaylistCard(p) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "playlist-card";
  card.addEventListener("click", () => openPlaylistDetail(p.id));

  const firstThumb = p.tracks.find(t => t.thumbnail)?.thumbnail;
  let cover;
  if (firstThumb) {
    cover = document.createElement("img");
    cover.src = firstThumb;
    cover.alt = "";
    cover.loading = "lazy";
  } else {
    cover = document.createElement("div");
    cover.textContent = "♪";
  }
  cover.className = "playlist-card-cover";

  const body = document.createElement("div");

  const name = document.createElement("p");
  name.className = "playlist-card-name";
  name.textContent = p.name;

  const by = document.createElement("p");
  by.className = "playlist-card-by";
  if (p.owner === OWNER_NAME) by.classList.add("is-owner");
  by.textContent = `Dibuat oleh ${ownerLabel(p.owner)}`;

  const count = document.createElement("p");
  count.className = "playlist-card-count";
  count.textContent = `${p.tracks.length} lagu`;

  body.append(name, by, count);
  card.append(cover, body);
  return card;
}

function renderHomePlaylists() {
  homePlaylistGrid.replaceChildren();
  const list = homePlaylistIds
    .map(id => playlists.find(p => p.id === id))
    .filter(Boolean);

  const candidates = playlists.filter(p => p.tracks.length > 0).length;
  reshuffleBtn.hidden = candidates <= HOME_PLAYLIST_COUNT;

  if (list.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = dataLoaded
      ? "Belum ada playlist dari pengguna."
      : "Memuat playlist...";
    homePlaylistGrid.append(empty);
    return;
  }
  const fragment = document.createDocumentFragment();
  list.forEach(p => fragment.append(createPlaylistCard(p)));
  homePlaylistGrid.append(fragment);
}

function openPlaylistDetail(id) {
  detailPlaylistId = id;
  showView("detail");
}

/* ---------------- Halaman: Playlist Saya & detail ---------------- */

function showPlaylistMessage(text) {
  playlistMessage.textContent = text;
  playlistMessage.hidden = false;
}

function renderPlaylistChips(mine) {
  playlistChipsContainer.replaceChildren();
  mine.forEach(p => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `playlist-chip ${p.id === activePlaylistId ? "active" : ""}`.trim();
    chip.textContent = p.name;
    chip.addEventListener("click", () => {
      activePlaylistId = p.id;
      renderMine();
    });
    playlistChipsContainer.append(chip);
  });
}

function renderPlaylistPanel(p) {
  playlistMessage.hidden = true;
  playlistPanel.hidden = false;

  const canEdit = !!currentUser && p.owner === currentUser;
  playlistTitle.textContent = p.name;
  playlistMeta.textContent = `Dibuat oleh ${ownerLabel(p.owner)} · ${p.tracks.length} lagu`;
  deletePlaylistBtn.hidden = !(canEdit || isOwnerAdmin());
  playAllBtn.disabled = p.tracks.length === 0;

  renderTrackList(
    playlistResults,
    p.tracks,
    p.tracks,
    { mode: "playlist", playlist: p, canEdit },
    canEdit
      ? "Playlist ini masih kosong. Tambahkan lagu dari Daftar Putar lewat tombol +."
      : "Playlist ini masih kosong."
  );
}

function renderMine() {
  backBtn.hidden = true;

  if (!currentUser) {
    playlistSection.hidden = true;
    playlistPanel.hidden = true;
    showPlaylistMessage("Login dulu untuk membuat dan melihat playlist kamu.");
    return;
  }

  playlistSection.hidden = false;
  const mine = myPlaylists();

  if (mine.length === 0) {
    renderPlaylistChips(mine);
    playlistPanel.hidden = true;
    showPlaylistMessage('Kamu belum punya playlist. Klik "+ Buat Playlist Baru" untuk mulai.');
    return;
  }

  if (!mine.some(p => p.id === activePlaylistId)) activePlaylistId = mine[0].id;
  renderPlaylistChips(mine);
  renderPlaylistPanel(mine.find(p => p.id === activePlaylistId));
}

function renderDetail() {
  playlistSection.hidden = true;
  backBtn.hidden = false;

  const p = playlists.find(x => x.id === detailPlaylistId);
  if (!p) {
    playlistPanel.hidden = true;
    showPlaylistMessage("Playlist tidak ditemukan.");
    return;
  }
  renderPlaylistPanel(p);
}

/* ---------------- Halaman: Upload ---------------- */

function renderUpload() {
  const loggedIn = !!currentUser;
  uploadLoginNote.hidden = loggedIn;
  linkInput.disabled = !loggedIn;
  addLinkButton.disabled = !loggedIn;
}

/* ---------------- Playlist: simpan & ubah ---------------- */

async function persistPlaylist(p) {
  const { error } = await supabaseClient
    .from("playlists")
    .update({ tracks: p.tracks })
    .eq("id", p.id);
  if (error) throw error;
}

async function createPlaylist(rawName, trackToAdd = null) {
  if (!currentUser) {
    openLoginModal();
    return null;
  }
  const name = rawName.trim();
  if (!name) return null;

  if (playlists.some(p => p.owner === currentUser && p.name.toLowerCase() === name.toLowerCase())) {
    alert("Kamu sudah punya playlist dengan nama ini.");
    return null;
  }

  try {
    const { data, error } = await supabaseClient
      .from("playlists")
      .insert({ owner: currentUser, name, tracks: trackToAdd ? [trackToAdd] : [] })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") {
        alert("Kamu sudah punya playlist dengan nama ini.");
        return null;
      }
      throw error;
    }
    const created = normalizePlaylist(data);
    playlists.push(created);
    activePlaylistId = created.id;
    setStatus("Playlist berhasil dibuat");
    return created;
  } catch (error) {
    showDatabaseError(error, dbMessage(error, "Gagal membuat playlist."));
    return null;
  }
}

function openCreatePlaylistModal(trackToAdd = null) {
  if (!currentUser) {
    openLoginModal();
    return;
  }
  pendingTrackForNewPlaylist = trackToAdd;
  playlistNameInput.value = "";
  createPlaylistModal.hidden = false;
  playlistNameInput.focus();
}

function openAddToPlaylistModal(track) {
  if (!currentUser) {
    openLoginModal();
    return;
  }
  selectedTrackForPlaylist = track;
  playlistListOptions.replaceChildren();

  const mine = myPlaylists();
  if (mine.length === 0) {
    const p = document.createElement("p");
    p.textContent = "Kamu belum punya playlist.";
    playlistListOptions.append(p);
  } else {
    mine.forEach(pl => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "playlist-option-btn";
      btn.textContent = `${pl.name} (${pl.tracks.length})`;
      btn.addEventListener("click", () => addTrackToPlaylist(pl, track));
      playlistListOptions.append(btn);
    });
  }

  const newBtn = document.createElement("button");
  newBtn.type = "button";
  newBtn.className = "playlist-option-btn is-new";
  newBtn.textContent = "+ Playlist baru";
  newBtn.addEventListener("click", () => {
    playlistModal.hidden = true;
    openCreatePlaylistModal(selectedTrackForPlaylist);
  });
  playlistListOptions.append(newBtn);

  playlistModal.hidden = false;
}

async function addTrackToPlaylist(p, track) {
  playlistModal.hidden = true;
  if (p.tracks.some(t => sameTrack(t, track))) {
    alert(`Lagu sudah ada di "${p.name}"`);
    return;
  }
  const previous = p.tracks;
  p.tracks = [...previous, track];
  try {
    await persistPlaylist(p);
    setStatus(`Lagu ditambahkan ke "${p.name}"`);
  } catch (error) {
    p.tracks = previous;
    showDatabaseError(error, "Gagal menyimpan lagu ke playlist.");
  }
  if (view === "mine" || view === "detail") renderCurrentView();
}

async function removeTrackFromPlaylist(p, track) {
  const previous = p.tracks;
  p.tracks = previous.filter(t => !sameTrack(t, track));
  try {
    await persistPlaylist(p);
    setStatus("Lagu dihapus dari playlist");
  } catch (error) {
    p.tracks = previous;
    showDatabaseError(error, "Gagal menghapus lagu dari playlist.");
  }
  renderCurrentView();
}

async function deletePlaylist(p) {
  if (!p) return;
  const allowed = (currentUser && p.owner === currentUser) || isOwnerAdmin();
  if (!allowed) {
    alert("Kamu tidak punya akses untuk menghapus playlist ini.");
    return;
  }
  if (!confirm(`Hapus playlist "${p.name}"?`)) return;

  try {
    const { error } = await supabaseClient.from("playlists").delete().eq("id", p.id);
    if (error) throw error;
    playlists = playlists.filter(x => x.id !== p.id);
    homePlaylistIds = homePlaylistIds.filter(id => id !== p.id);
    if (activePlaylistId === p.id) activePlaylistId = null;
    setStatus("Playlist dihapus");
    if (view === "detail") showView("home");
    else renderCurrentView();
  } catch (error) {
    showDatabaseError(error, "Gagal menghapus playlist.");
  }
}

/* ---------------- Lagu: tambah & hapus ---------------- */

async function addTrackFromLink(url) {
  if (!currentUser) {
    openLoginModal();
    return;
  }

  const videoId = getVideoId(url);
  if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    alert("Link YouTube tidak valid!");
    return;
  }

  setStatus("Memeriksa link...");
  try {
    const existing = tracks.some(track => videoKey(track) === videoId);
    if (existing) {
      setStatus("Video ini sudah tersimpan.");
      alert("Link video YouTube ini sudah pernah ditambahkan.");
      return;
    }

    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const { data: duplicateById, error: duplicateIdError } = await supabaseClient
      .from("tracks").select("id").eq("video_id", videoId).limit(1);
    if (duplicateIdError) throw duplicateIdError;
    const { data: duplicateByUrl, error: duplicateUrlError } = await supabaseClient
      .from("tracks").select("id").eq("url", watchUrl).limit(1);
    if (duplicateUrlError) throw duplicateUrlError;
    if ((duplicateById && duplicateById.length) || (duplicateByUrl && duplicateByUrl.length)) {
      setStatus("Video ini sudah tersimpan.");
      alert("Link video YouTube ini sudah pernah ditambahkan.");
      await loadTracks();
      renderCurrentView();
      return;
    }

    setStatus("Mengambil informasi lagu...");
    let title = `Lagu (${videoId})`;
    let artist = "YouTube";
    try {
      const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`);
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
      url: watchUrl
    };

    const { data, error } = await supabaseClient.from("tracks").insert(newTrack).select().single();
    if (error) {
      if (error.code === "23505") {
        alert("Video ini sudah pernah ditambahkan.");
        await loadTracks();
        renderCurrentView();
        return;
      }
      throw error;
    }

    tracks.unshift(data || newTrack);
    linkInput.value = "";
    setStatus(`Berhasil ditambahkan: ${title}`);
    renderCurrentView();
  } catch (error) {
    showDatabaseError(error, "Gagal menyimpan lagu. Periksa koneksi dan kebijakan Supabase.");
  }
}

async function deleteTrack(track) {
  if (!isOwnerAdmin()) {
    alert("Hanya Owner yang memiliki akses untuk menghapus lagu!");
    return;
  }
  if (!track || !confirm(`Hapus "${track.title}"?`)) return;

  try {
    if (track.id) {
      const { error } = await supabaseClient.from("tracks").delete().eq("id", track.id);
      if (error) throw error;
    }
    tracks = tracks.filter(t => !sameTrack(t, track));

    // Bersihkan lagu ini dari semua playlist
    for (const p of playlists) {
      if (p.tracks.some(t => sameTrack(t, track))) {
        p.tracks = p.tracks.filter(t => !sameTrack(t, track));
        await persistPlaylist(p);
      }
    }

    // Sesuaikan antrean pemutar
    const cur = queue[currentIndex];
    const wasCurrent = !!cur && sameTrack(cur, track);
    if (wasCurrent) {
      stopPlayback();
    } else {
      let removedBefore = 0;
      if (currentIndex > 0) {
        removedBefore = queue.slice(0, currentIndex).filter(t => sameTrack(t, track)).length;
      }
      queue = queue.filter(t => !sameTrack(t, track));
      currentIndex = queue.length ? Math.max(currentIndex - removedBefore, 0) : -1;
    }

    setStatus("Lagu dihapus");
    renderCurrentView();
  } catch (error) {
    showDatabaseError(error, "Gagal menghapus lagu dari database.");
  }
}

/* ---------------- Supabase: muat data ---------------- */

async function loadTracks() {
  // Migrasikan lagu lama dari localStorage ke Supabase bila masih ada.
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
}

async function loadPlaylists() {
  const { data, error } = await supabaseClient
    .from("playlists")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  playlists = (data || []).map(normalizePlaylist);
}

async function initializeDatabaseData() {
  setStatus("Menghubungkan ke database...");
  try {
    await loadTracks();
    await loadPlaylists();
    dataLoaded = true;
    pickHomePlaylists();
    renderCurrentView();
    setStatus("");
  } catch (error) {
    dataLoaded = true;
    renderCurrentView();
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

/* ---------------- Media Session (notifikasi & kontrol layar kunci) ---------------- */

const hasMediaSession = "mediaSession" in navigator;

// Judul, artis, dan sampul yang tampil di notifikasi / layar kunci
function updateMediaSessionMetadata(track) {
  if (!hasMediaSession || !track) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title || "Judul tidak tersedia",
      artist: track.artist || "Artis tidak diketahui",
      album: "Restify",
      artwork: track.thumbnail
        ? [{ src: track.thumbnail, sizes: "480x360", type: "image/jpeg" }]
        : []
    });
  } catch (e) {
    console.warn("Media Session metadata gagal:", e);
  }
}

// "playing" | "paused" | "none"
function setMediaSessionState(state) {
  if (!hasMediaSession) return;
  try { navigator.mediaSession.playbackState = state; } catch (e) {}
}

// Posisi & durasi agar slider di layar kunci ikut bergerak
function updateMediaSessionPosition() {
  if (!hasMediaSession || !navigator.mediaSession.setPositionState || !ytReady) return;
  try {
    const duration = ytPlayer.getDuration();
    if (!(duration > 0)) return;
    const position = Math.min(Math.max(ytPlayer.getCurrentTime(), 0), duration);
    navigator.mediaSession.setPositionState({ duration, playbackRate: 1, position });
  } catch (e) {}
}

function clearMediaSession() {
  if (!hasMediaSession) return;
  try {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = "none";
  } catch (e) {}
}

function initMediaSessionActions() {
  if (!hasMediaSession) return;
  const setAction = (action, handler) => {
    try { navigator.mediaSession.setActionHandler(action, handler); } catch (e) {}
  };

  setAction("play", () => {
    if (currentIndex < 0 || !queue[currentIndex]) return;
    const state = ytReady ? ytPlayer.getPlayerState() : null;
    if (state === YT.PlayerState.PAUSED) ytPlayer.playVideo();
    else if (state !== YT.PlayerState.PLAYING && state !== YT.PlayerState.BUFFERING) playIndex(currentIndex);
  });
  setAction("pause", () => { if (ytReady) ytPlayer.pauseVideo(); });
  setAction("previoustrack", () => prevButton.click());
  setAction("nexttrack", () => nextButton.click());
  setAction("seekto", (details) => {
    if (ytReady && Number.isFinite(details.seekTime)) ytPlayer.seekTo(details.seekTime, true);
  });
  setAction("seekbackward", (details) => {
    if (ytReady) ytPlayer.seekTo(Math.max(0, ytPlayer.getCurrentTime() - (details.seekOffset || 10)), true);
  });
  setAction("seekforward", (details) => {
    if (ytReady) ytPlayer.seekTo(ytPlayer.getCurrentTime() + (details.seekOffset || 10), true);
  });
}

initMediaSessionActions();

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

function setPlayingState(isPlaying) {
  playIcon.toggleAttribute("hidden", isPlaying);
  pauseIcon.toggleAttribute("hidden", !isPlaying);
  playButton.setAttribute("aria-label", isPlaying ? "Jeda" : "Putar");
  npPlayIcon.toggleAttribute("hidden", isPlaying);
  npPauseIcon.toggleAttribute("hidden", !isPlaying);
  npPlayBtn.setAttribute("aria-label", isPlaying ? "Jeda" : "Putar");
  setMediaSessionState(isPlaying ? "playing" : "paused");
}

function updatePlayerButtons() {
  const hasTrack = currentIndex >= 0 && !!queue[currentIndex];
  playButton.disabled = !hasTrack;
  prevButton.disabled = !hasTrack || currentIndex <= 0;
  nextButton.disabled = !hasTrack || (!isShuffle && currentIndex >= queue.length - 1);

  npPlayBtn.disabled = playButton.disabled;
  npPrevBtn.disabled = prevButton.disabled;
  npNextBtn.disabled = nextButton.disabled;
  npAddBtn.disabled = !hasTrack;
  npShuffleBtn.classList.toggle("active", isShuffle);
}

function onPlayerStateChange(e) {
  const S = YT.PlayerState;
  switch (e.data) {
    case S.PLAYING:
      setPlayingState(true);
      setStatus("");
      progress.disabled = false;
      npProgress.disabled = false;
      durationElement.textContent = formatTime(ytPlayer.getDuration());
      npDuration.textContent = durationElement.textContent;
      startProgressTimer();
      updateMediaSessionPosition();
      break;
    case S.PAUSED:
      setPlayingState(false);
      updateMediaSessionPosition();
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
  if (queue.length === 0) return;

  if (isShuffle) {
    let nextRand;
    do {
      nextRand = Math.floor(Math.random() * queue.length);
    } while (nextRand === currentIndex && queue.length > 1);
    playIndex(nextRand);
  } else if (currentIndex < queue.length - 1) {
    playIndex(currentIndex + 1);
  }
}

function onPlayerError(e) {
  setPlayingState(false);
  stopProgressTimer();
  const msgs = {
    2: "ID video tidak valid.",
    5: "Gagal memutar di browser ini.",
    100: "Video tidak ditemukan / privat.",
    101: "Pemilik video melarang pemutaran di situs lain.",
    150: "Pemilik video melarang pemutaran di situs lain.",
    153: "Referer tidak terkirim. Buka lewat http(s), bukan file://."
  };
  setStatus(`${msgs[e.data] || "Gagal memutar."} (kode ${e.data})`);

  if ([100, 101, 150].includes(e.data)) {
    const idx = currentIndex;
    setTimeout(() => { if (currentIndex === idx) handleTrackEnd(); }, 1500);
  }
}

function startProgressTimer() {
  stopProgressTimer();
  progressTimer = setInterval(() => {
    if (!ytReady || isSeeking) return;
    const cur = ytPlayer.getCurrentTime();
    const dur = ytPlayer.getDuration();
    const curText = formatTime(cur);
    currentTimeElement.textContent = curText;
    npCurrentTime.textContent = curText;
    if (dur > 0) {
      const durText = formatTime(dur);
      const pos = String((cur / dur) * 1000);
      durationElement.textContent = durText;
      npDuration.textContent = durText;
      progress.value = pos;
      npProgress.value = pos;
    }
  }, 500);
}

function stopProgressTimer() {
  if (progressTimer) clearInterval(progressTimer);
  progressTimer = null;
}

function stopPlayback() {
  pendingVideoId = null;
  if (ytReady) ytPlayer.stopVideo();
  stopProgressTimer();
  queue = [];
  currentIndex = -1;
  playerTitle.textContent = "Belum ada lagu";
  playerArtist.textContent = "-";
  playerCover.removeAttribute("src");
  resetNowPlayingView();
  closeNowPlaying();
  progress.value = "0";
  progress.disabled = true;
  currentTimeElement.textContent = "0:00";
  durationElement.textContent = "0:00";
  setPlayingState(false);
  updatePlayerButtons();
  clearMediaSession();
}

function startQueue(list, index) {
  queue = [...list];
  playIndex(index);
}

function playIndex(index) {
  const track = queue[index];
  if (!track) return;

  const videoId = videoKey(track);
  currentIndex = index;
  updatePlayerButtons();
  refreshHighlights();

  playerTitle.textContent = track.title || "Judul tidak tersedia";
  playerArtist.textContent = track.artist || "Artis tidak diketahui";
  playerCover.src = track.thumbnail || "";
  syncNowPlayingMeta(track);
  updateMediaSessionMetadata(track);

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

/* ---------------- Event listeners ---------------- */

brandLink.addEventListener("click", (e) => {
  e.preventDefault();
  goHome();
});

navTabs.forEach(tab => {
  tab.addEventListener("click", () => {
    const t = tab.dataset.tab;
    if (t === "all") showView("home");
    else if (t === "playlists") showView("mine");
    else if (t === "upload") showView("upload");
  });
});

showMoreBtn.addEventListener("click", () => {
  homeLimit += HOME_PAGE_SIZE;
  renderHome();
});

reshuffleBtn.addEventListener("click", () => {
  pickHomePlaylists();
  renderHomePlaylists();
});

backBtn.addEventListener("click", () => showView("home"));

playAllBtn.addEventListener("click", () => {
  const p = panelPlaylist();
  if (p && p.tracks.length) startQueue(p.tracks, 0);
});

deletePlaylistBtn.addEventListener("click", () => deletePlaylist(panelPlaylist()));

createPlaylistBtn.addEventListener("click", () => openCreatePlaylistModal(null));

closePlaylistModalBtn.addEventListener("click", () => { playlistModal.hidden = true; });

closeCreatePlaylistBtn.addEventListener("click", () => {
  createPlaylistModal.hidden = true;
  pendingTrackForNewPlaylist = null;
});

createPlaylistForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (creatingPlaylist) return;
  creatingPlaylist = true;
  const trackToAdd = pendingTrackForNewPlaylist;
  try {
    const created = await createPlaylist(playlistNameInput.value, trackToAdd);
    if (!created) return;
    createPlaylistModal.hidden = true;
    pendingTrackForNewPlaylist = null;
    playlistNameInput.value = "";
    if (trackToAdd) setStatus(`Lagu ditambahkan ke "${created.name}"`);
    if (!trackToAdd && view !== "mine") showView("mine");
    else renderCurrentView();
  } finally {
    creatingPlaylist = false;
  }
});

shuffleBtn.addEventListener("click", () => {
  isShuffle = !isShuffle;
  shuffleBtn.classList.toggle("active", isShuffle);
  setStatus(isShuffle ? "Mode Acak Aktif 🔀" : "Mode Berurutan");
  updatePlayerButtons();
});

loginLogoutBtn.addEventListener("click", () => {
  if (currentUser) {
    currentUser = "";
    localStorage.removeItem(USER_KEY);
    updateAuthUI();
  } else {
    openLoginModal();
  }
});

uploadLoginBtn.addEventListener("click", openLoginModal);

closeModalBtn.addEventListener("click", () => { loginModal.hidden = true; });

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
  searchQuery = searchInput.value.trim();
  homeLimit = HOME_PAGE_SIZE;
  showView("home");
  setStatus(`${getHomeTracks().length} lagu ditemukan`);
});

searchInput.addEventListener("input", () => {
  if (!searchInput.value.trim() && searchQuery) {
    searchQuery = "";
    homeLimit = HOME_PAGE_SIZE;
    showView("home", { scroll: false });
    setStatus("");
  }
});

playButton.addEventListener("click", () => {
  if (currentIndex < 0 || !queue[currentIndex]) return;
  if (!ytReady) {
    playIndex(currentIndex);
    return;
  }
  const state = ytPlayer.getPlayerState();
  if (state === YT.PlayerState.PLAYING || state === YT.PlayerState.BUFFERING) {
    ytPlayer.pauseVideo();
  } else if (state === YT.PlayerState.PAUSED) {
    ytPlayer.playVideo();
  } else {
    playIndex(currentIndex);
  }
});

prevButton.addEventListener("click", () => { if (currentIndex > 0) playIndex(currentIndex - 1); });
nextButton.addEventListener("click", () => {
  if (isShuffle) handleTrackEnd();
  else if (currentIndex < queue.length - 1) playIndex(currentIndex + 1);
});

[progress, npProgress].forEach(slider => {
  slider.addEventListener("pointerdown", () => { isSeeking = true; });
  slider.addEventListener("input", () => {
    progress.value = slider.value;
    npProgress.value = slider.value;
    if (!ytReady) return;
    const dur = ytPlayer.getDuration();
    if (dur > 0) {
      const text = formatTime((Number(slider.value) / 1000) * dur);
      currentTimeElement.textContent = text;
      npCurrentTime.textContent = text;
    }
  });
  slider.addEventListener("change", () => {
    if (ytReady) {
      const dur = ytPlayer.getDuration();
      if (dur > 0) ytPlayer.seekTo((Number(slider.value) / 1000) * dur, true);
    }
    isSeeking = false;
  });
});

/* ---------------- Detail lagu (Now Playing) ---------------- */

function syncNowPlayingMeta(track) {
  npTitle.textContent = track.title || "Judul tidak tersedia";
  npArtist.textContent = track.artist || "Artis tidak diketahui";
  const uploaderName = track.uploader || "Anonim";
  npUploader.textContent = `Diupload oleh ${uploaderName === OWNER_NAME ? `${uploaderName} ${OWNER_ICON}` : uploaderName}`;

  if (track.thumbnail) {
    npCover.src = track.thumbnail;
    npBackdrop.style.backgroundImage = `url(${JSON.stringify(track.thumbnail)})`;
  } else {
    npCover.removeAttribute("src");
    npBackdrop.style.backgroundImage = "";
  }

  npProgress.value = "0";
  npProgress.disabled = true;
  npCurrentTime.textContent = "0:00";
  npDuration.textContent = "0:00";
}

function resetNowPlayingView() {
  npTitle.textContent = "Belum ada lagu";
  npArtist.textContent = "-";
  npUploader.textContent = "";
  npCover.removeAttribute("src");
  npBackdrop.style.backgroundImage = "";
  npProgress.value = "0";
  npProgress.disabled = true;
  npCurrentTime.textContent = "0:00";
  npDuration.textContent = "0:00";
}

function openNowPlaying() {
  if (!nowPlayingView.hidden) return;
  if (currentIndex < 0 || !queue[currentIndex]) return;
  nowPlayingView.hidden = false;
  document.body.classList.add("np-open");
  // Tombol Kembali di HP menutup detail lagu, bukan keluar dari aplikasi
  try {
    history.pushState({ restifyNowPlaying: true }, "");
    npHistory = true;
  } catch (e) {
    npHistory = false;
  }
  npCloseBtn.focus();
}

function closeNowPlaying(fromPopState = false) {
  if (nowPlayingView.hidden) return;
  nowPlayingView.hidden = true;
  document.body.classList.remove("np-open");
  const hadHistory = npHistory;
  npHistory = false;
  if (!fromPopState && hadHistory) history.back();
}

nowPlayingOpen.addEventListener("click", openNowPlaying);
nowPlayingOpen.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    openNowPlaying();
  }
});

npCloseBtn.addEventListener("click", () => closeNowPlaying());
npAddBtn.addEventListener("click", () => {
  const track = queue[currentIndex];
  if (track) openAddToPlaylistModal(track);
});

// Tombol di detail lagu memakai logika yang sama dengan tombol di bar bawah
npPlayBtn.addEventListener("click", () => playButton.click());
npPrevBtn.addEventListener("click", () => prevButton.click());
npNextBtn.addEventListener("click", () => nextButton.click());
npShuffleBtn.addEventListener("click", () => shuffleBtn.click());

window.addEventListener("popstate", () => closeNowPlaying(true));

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !nowPlayingView.hidden && !document.querySelector(".modal:not([hidden])")) {
    closeNowPlaying();
  }
});

/* ---------------- Mulai ---------------- */

updateAuthUI();
initializeDatabaseData();