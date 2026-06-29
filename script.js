const isFileProtocol = window.location.protocol === "file:";
// ========== SECRET MESSAGE CONFIG ==========
const GOOGLE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzL47_nNe0g2zt7PMVo4Yfd3a9HM9iScz9UDLJrpdby5zm3Jg2nq5vghsVDH7JTAHRi-A/exec";

// ✅ PERBAIKAN: Tambah fungsi escape khusus untuk attribute (mencegah XSS)
// escapeHtml biasa tidak meng-escape single quote (') yang bisa merusak onclick
function escapeAttr(text) {
  if (text === null || text === undefined) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function submitSecret(e) {
  e.preventDefault();

  const username = document.getElementById("xpUsername").value.trim();
  const message = document.getElementById("xpMessage").value.trim();
  const submitBtn = e.target.querySelector('button[type="submit"]');

  if (!username || !message) {
    showSecretStatus("Semua kolom wajib diisi!", "error");
    return false;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Mengirim...";
  submitBtn.style.opacity = "0.7";

  // ✅ PERBAIKAN: Hapus 'Content-Type: application/json' karena tidak kompatibel dengan mode: 'no-cors'
  // Browser akan menolak header custom pada no-cors request.
  // Gunakan body langsung - Google Apps Script tetap bisa baca via e.postData.contents
  const payload = {
    username: username,
    message: message,
    timestamp: new Date().toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
  };

  fetch(GOOGLE_SCRIPT_URL, {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify(payload),
  })
    .then(() => {
      // Catatan: dengan mode 'no-cors', response tidak bisa dibaca (opaque response)
      // Tapi request akan tetap terkirim ke Google Apps Script
      showSecretStatus("✅ Pesan berhasil dikirim!", "success");
      document.getElementById("secretForm").reset();
    })
    .catch((err) => {
      console.error("Submit error:", err);
      showSecretStatus("❌ Gagal mengirim pesan. Coba lagi.", "error");
    })
    .finally(() => {
      submitBtn.disabled = false;
      submitBtn.textContent = "Kirim";
      submitBtn.style.opacity = "1";
    });

  return false;
}

function showSecretStatus(text, type) {
  const statusDiv = document.getElementById("xpStatus");
  if (!statusDiv) return;
  statusDiv.textContent = text;
  statusDiv.className = "secret-status " + type;

  setTimeout(() => {
    statusDiv.className = "secret-status";
  }, 4000);
}

// ========== PORTFOLIO FUNCTIONS ==========
// ✅ PERBAIKAN: Cek apakah pdfjsLib sudah tersedia sebelum digunakan
if (typeof pdfjsLib !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
} else {
  console.warn("pdfjsLib belum termuat. Fitur PDF tidak akan bekerja.");
}

let portfolioData = null;
let currentFilter = "All";

async function loadData() {
  const isFileProtocol = window.location.protocol === "file:";

  // 1. SELALU COBA FETCH DATA.JSON TERLEBIH DAHULU
  if (!isFileProtocol) {
    try {
      const response = await fetch("data.json?_=" + Date.now(), {
        cache: "no-store", // ← paksa ambil data baru, jangan pakai cache
      });

      if (response.ok) {
        portfolioData = await response.json();

        // Optional: update localStorage sebagai backup offline
        // localStorage.setItem("portfolioData", JSON.stringify(portfolioData));

        renderAll();
        return;
      }
    } catch (err) {
      console.log("Fetch gagal:", err);
    }
  }

  // 2. Fallback ke localStorage kalau fetch benar-benar gagal
  const saved = localStorage.getItem("portfolioData");
  if (saved) {
    try {
      portfolioData = JSON.parse(saved);
      renderAll();
      return;
    } catch (e) {
      console.log("LocalStorage corrupt, pakai default");
    }
  }

  // 3. Fallback terakhir
  portfolioData = EMBED_DATA;
  renderAll();
}

// Tampilkan error message
const loadingEl = document.getElementById("loading");
if (loadingEl) {
  loadingEl.innerHTML = `
        <div style="text-align:center;padding:40px;">
          <div style="font-size:48px;margin-bottom:16px;">📂</div>
          <h3 style="color:var(--win-blue);margin-bottom:12px;">data.json tidak ditemukan</h3>
          <p style="color:var(--win-text-muted);font-size:13px;margin-bottom:16px;">
            Halaman ini perlu dijalankan melalui web server.<br>
            Atau, buka <b>admin.html</b> terlebih dahulu untuk mengisi data.
          </p>
          <button class="win-button primary" onclick="window.open('admin.html','_blank')">
            🛠️ Buka Admin Panel
          </button>
        </div>`;
}

// ✅ PERBAIKAN: Fungsi validasi struktur data
function validatePortfolioData(data) {
  if (!data || typeof data !== "object") return false;
  const required = [
    "profile",
    "education",
    "experience",
    "skills",
    "projects",
    "certificates",
    "contact",
  ];
  return required.every((key) => data.hasOwnProperty(key));
}

function renderAll() {
  if (!portfolioData) return;
  const container = document.getElementById("mainContainer");
  if (!container) return;

  try {
    container.innerHTML =
      renderHero() +
      renderAbout() +
      renderEducation() +
      renderExperience() +
      renderSkills() +
      renderProjects() +
      renderCertificates() +
      renderContact() +
      renderSecretMessage() +
      renderGaleri();

    attachProjectListeners();
    attachSecretFormListeners();

    initGallery();
  } catch (err) {
    console.error("Render error:", err);
    container.innerHTML = `<div class="error-box">❌ Gagal merender data: ${escapeHtml(err.message)}</div>`;
  }
}

function initGallery() {
  const btnGrid = document.getElementById("btnGrid");
  if (btnGrid) btnGrid.classList.add("active");

  // Pastikan loadGallery dipanggil setelah DOM galeri tersedia
  if (document.getElementById("galleryLoading")) {
    loadGallery();
  }
}

function renderHero() {
  const p = portfolioData.profile || {};
  return `
    <div class="win-window" id="beranda">
      <div class="win-titlebar">
        <div class="win-title"><div class="win-title-icon"></div><span>Portfolio.exe - Beranda</span></div>
        <div class="win-buttons"><div class="win-btn">_</div><div class="win-btn">□</div><div class="win-btn close">×</div></div>
      </div>
      <div class="win-content" style="text-align: center; padding: 60px 20px;">
        <div style="font-size: 64px; margin-bottom: 20px;">
          ${p.photo ? `<img src="${escapeAttr(p.photo)}" style="width:120px;height:120px;border-radius:50%;border:4px outset var(--win-border-light);">` : "👤"}
        </div>
        <h2 style="font-size: 28px; color: var(--win-blue); margin-bottom: 8px;">${escapeHtml(p.name || "")}</h2>
        <p style="color: var(--win-text-muted); font-size: 14px; margin-bottom: 16px;">${escapeHtml(p.title || "")}</p>
        <p style="font-size: 13px; max-width: 600px; margin: 0 auto;">${escapeHtml(p.bio || "")}</p>
        <div style="margin-top: 24px;">
          <button class="win-button primary" onclick="document.getElementById('proyek').scrollIntoView({behavior:'smooth'})">📂 Lihat Proyek</button>
        </div>
      </div>
    </div>`;
}

function renderAbout() {
  const p = portfolioData.profile || {};
  return `
    <div class="win-window" id="tentang">
      <div class="win-titlebar">
        <div class="win-title"><div class="win-title-icon" style="background: linear-gradient(135deg, #87CEEB, #4682B4); border-color: #4682B4;"></div><span>TentangSaya.exe</span></div>
        <div class="win-buttons"><div class="win-btn">_</div><div class="win-btn">□</div><div class="win-btn close">×</div></div>
      </div>
      <div class="win-content">
        <div class="section-title">👤 Tentang Saya</div>
        <p style="font-size: 13px; line-height: 1.7; white-space: pre-line;">${escapeHtml(p.about || "")}</p>
      </div>
    </div>`;
}

function renderEducation() {
  const education = portfolioData.education || [];
  const items = education
    .map(
      (edu) => `
        <div class="info-card">
          <div class="info-card-header">🎓 ${escapeHtml(edu.institution || "")}</div>
          <div class="info-card-body">
            <div style="font-weight: bold; margin-bottom: 4px; ">${escapeHtml(edu.degree || "")}</div>
            <div style="color: var(--win-text-muted); font-size: 11px; margin-bottom: 6px;">📅 ${escapeHtml(edu.year || "")}</div>
            <div style="white-space: pre-line;">${escapeHtml(edu.description || "")}</div>
          </div>
        </div>`,
    )
    .join("");
  return `
    <div class="win-window" id="pendidikan">
      <div class="win-titlebar">
        <div class="win-title"><div class="win-title-icon" style="background: linear-gradient(135deg, #DDA0DD, #8B008B); border-color: #8B008B;"></div><span>Pendidikan.exe</span></div>
        <div class="win-buttons"><div class="win-btn">_</div><div class="win-btn">□</div><div class="win-btn close">×</div></div>
      </div>
      <div class="win-content">
        <div class="section-title">🎓 Latar Belakang Pendidikan</div>
        <div class="info-grid">${items}</div>
      </div>
    </div>`;
}

function renderExperience() {
  const experience = portfolioData.experience || [];
  const items = experience
    .map(
      (exp) => `
        <div class="info-card">
          <div class="info-card-header">💼 ${escapeHtml(exp.company || "")}</div>
          <div class="info-card-body">
            <div style="font-weight: bold; margin-bottom: 4px;">${escapeHtml(exp.position || "")}</div>
            <div style="color: var(--win-text-muted); font-size: 11px; margin-bottom: 6px;">📅 ${escapeHtml(exp.year || "")}</div>
            <div>${escapeHtml(exp.description || "")}</div>
          </div>
        </div>`,
    )
    .join("");
  return `
    <div class="win-window" id="pengalaman">
      <div class="win-titlebar">
        <div class="win-title"><div class="win-title-icon" style="background: linear-gradient(135deg, #90EE90, #228B22); border-color: #228B22;"></div><span>Pengalaman.exe</span></div>
        <div class="win-buttons"><div class="win-btn">_</div><div class="win-btn">□</div><div class="win-btn close">×</div></div>
      </div>
      <div class="win-content">
        <div class="section-title">💼 Pengalaman Kerja</div>
        <div class="info-grid">${items}</div>
      </div>
    </div>`;
}

function renderSkills() {
  const skills = portfolioData.skills || [];
  const cats = skills
    .map(
      (s) => `
        <div class="skills-category">
          <div class="skills-category-header">⚡ ${escapeHtml(s.category || "")}</div>
          <div class="skills-category-body">
            ${(s.items || []).map((item) => `<span class="skill-chip">${escapeHtml(item)}</span>`).join("")}
          </div>
        </div>`,
    )
    .join("");
  return `
    <div class="win-window" id="keahlian">
      <div class="win-titlebar">
        <div class="win-title"><div class="win-title-icon" style="background: linear-gradient(135deg, #FFB6C1, #DC143C); border-color: #DC143C;"></div><span>Experience & Skills.exe</span></div>
        <div class="win-buttons"><div class="win-btn">_</div><div class="win-btn">□</div><div class="win-btn close">×</div></div>
      </div>
      <div class="win-content">
        <div class="section-title">⚡ Experience & Skills</div>
        ${cats}
      </div>
    </div>`;
}

function renderProjects() {
  const categories = portfolioData.categories || [];
  const cats = ["All", ...categories];
  const filterBtns = cats
    .map(
      (cat) =>
        `<button class="filter-btn ${cat === currentFilter ? "active" : ""}" onclick="filterProjects('${escapeAttr(cat)}')">${escapeHtml(cat)}</button>`,
    )
    .join("");

  const projects = portfolioData.projects || [];
  const filtered =
    currentFilter === "All"
      ? projects
      : projects.filter((p) => p.category === currentFilter);

  // ✅ PERBAIKAN: Gunakan escapeAttr untuk attribute values
  const cards = filtered
    .map(
      (proj) => `
        <div class="project-card" data-pdf="${escapeAttr(proj.pdf || "")}" data-title="${escapeAttr(proj.title || "")}">
          <div class="project-thumb">
            ${proj.thumbnail ? `<img src="${escapeAttr(proj.thumbnail)}" alt="${escapeAttr(proj.title || "")}">` : "📄"}
          </div>
          <div class="project-info">
            <div class="project-title">${escapeHtml(proj.title || "")}</div>
            <span class="project-cat">${escapeHtml(proj.category || "")}</span>
            <div class="project-desc">${escapeHtml(proj.description || "")}</div>
            ${proj.pdf ? '<div style="margin-top:8px;font-size:11px;color:var(--win-blue);"> Klik untuk membuka </div>' : ""}
          </div>
        </div>`,
    )
    .join("");

  return `
    <div class="win-window" id="proyek">
      <div class="win-titlebar">
        <div class="win-title"><div class="win-title-icon" style="background: linear-gradient(135deg, #FFD700, #FF8C00); border-color: #FF8C00;"></div><span>Proyek.exe</span></div>
        <div class="win-buttons"><div class="win-btn">_</div><div class="win-btn">□</div><div class="win-btn close">×</div></div>
      </div>
      <div class="win-content">
        <div class="section-title">📁 Proyek & Pengalaman</div>
        <div class="filter-bar">${filterBtns}</div>
        <div class="project-grid">${cards}</div>
      </div>
    </div>`;
}

function attachProjectListeners() {
  document.querySelectorAll(".project-card[data-pdf]").forEach((card) => {
    card.addEventListener("click", function () {
      const pdf = this.getAttribute("data-pdf");
      const title = this.getAttribute("data-title");
      if (pdf) openPdf(pdf, title);
    });
  });
}

function renderCertificates() {
  const certificates = portfolioData.certificates || [];
  // ✅ PERBAIKAN: Gunakan escapeAttr untuk mencegah XSS di onclick
  const items = certificates
    .map((cert) => {
      const onclickAttr = cert.pdf
        ? `onclick="openPdf('${escapeAttr(cert.pdf)}', '${escapeAttr(cert.name)}')"`
        : "";
      return `
          <div class="info-card" style="cursor: pointer;" ${onclickAttr}>
            <div class="info-card-header">🏆 ${escapeHtml(cert.name || "")}</div>
            <div class="info-card-body">
              <div style="font-weight: bold; margin-bottom: 4px;">${escapeHtml(cert.issuer || "")}</div>
              <div style="color: var(--win-text-muted); font-size: 11px; margin-bottom: 6px;">📅 ${escapeHtml(cert.year || "")}</div>
              ${cert.pdf ? '<div style="font-size: 11px; color: var(--win-blue);">Klik untuk membuka</div>' : ""}
            </div>
          </div>`;
    })
    .join("");
  return `
    <div class="win-window" id="sertifikat">
      <div class="win-titlebar">
        <div class="win-title"><div class="win-title-icon" style="background: linear-gradient(135deg, #98FB98, #006400); border-color: #006400;"></div><span>Sertifikat.exe</span></div>
        <div class="win-buttons"><div class="win-btn">_</div><div class="win-btn">□</div><div class="win-btn close">×</div></div>
      </div>
      <div class="win-content">
        <div class="section-title">🏆 Sertifikat & Pencapaian</div>
        <div class="info-grid">${items}</div>
      </div>
    </div>`;
}

function renderContact() {
  const c = portfolioData.contact || {};
  return `
    <div class="win-window" id="kontak">
      <div class="win-titlebar">
        <div class="win-title"><div class="win-title-icon" style="background: linear-gradient(135deg, #F0E68C, #B8860B); border-color: #B8860B;"></div><span>Kontak.exe</span></div>
        <div class="win-buttons"><div class="win-btn">_</div><div class="win-btn">□</div><div class="win-btn close">×</div></div>
      </div>
      <div class="win-content">
        <div class="section-title">📧 Hubungi Saya</div>
        <div class="info-grid">
        

          <div class="info-card"
     onclick="window.location.href='mailto:${escapeHtml(c.email || "")}'"
     style="cursor:pointer;transition:transform .15s ease, box-shadow .15s ease;"
     onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='2px 2px 6px rgba(0,0,0,0.25)'"
     onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='none'"
     onmousedown="this.style.transform='scale(0.98)'"
     onmouseup="this.style.transform='translateY(-2px)'">

  <div class="info-card-header">📧 Email</div>

  <div class="info-card-body" style="text-align: center;">
    ${escapeHtml(c.email || "")}
  </div>

</div>


<a href="${escapeHtml(c.linkedin || "")}"
   target="_blank"
   rel="noopener noreferrer"
   style="text-decoration:none;color:inherit;display:block;">

  <div class="info-card"
       style="
         cursor:pointer;
         transition:transform .15s ease, box-shadow .15s ease;
       "
       onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 6px 14px rgba(0,0,0,0.2)'"
       onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'"
       onmousedown="this.style.transform='scale(0.97)'"
       onmouseup="this.style.transform='translateY(-3px)'">

    <div class="info-card-header">💼 LinkedIn</div>

    <div class="info-card-body" style="text-align:center;">
      ${escapeHtml(c.linkedin || "")}
    </div>

  </div>
</a>
          <div class="info-card"><div class="info-card-header">📍 Lokasi</div><div class="info-card-body" style="text-align: center;">${escapeHtml(c.location || "")}</div></div>
        </div>
      </div>



      
    </div>`;
}

function renderSecretMessage() {
  return `
    <div class="win-window" id="secretMessage">
      <div class="win-titlebar">
        <div class="win-title">
          <span class="secret-icon">📝</span>
          <span>Secret Message.exe</span>
        </div>
        <div class="win-buttons">
          <div class="win-btn">_</div>
          <div class="win-btn">□</div>
          <div class="win-btn close">×</div>
        </div>
      </div>
      <div class="win-content">
        <p class="secret-info-text">
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Windows_XP_Warning.png/32px-Windows_XP_Warning.png"
            alt="Warning"
            onerror="this.style.display = 'none'"
          />
          Kirim pesan rahasia, Pesan akan tersimpan secara
          anonim.
        </p>

        <form id="secretForm">
          <div class="secret-form-group">
            <label for="xpUsername">Username / Inisial:</label>
            <input
              type="text"
              id="xpUsername"
              required
              maxlength="30"
              placeholder="Contoh: Gofar"
            />
          </div>

          <div class="secret-form-group">
            <label for="xpMessage">Pesan Rahasia:</label>
            <textarea
              id="xpMessage"
              required
              rows="4"
              maxlength="500"
              placeholder="Tulis pesan di sini..."
            ></textarea>
          </div>

          <div
            class="secret-divider"
            style="display: flex; gap: 8px; justify-content: flex-end"
          >
            <button type="submit" class="win-button">Kirim</button>
            <button
              type="button"
              class="win-button"
              id="btnBatal"
            >
              Batal
            </button>
          </div>
        </form>

        <div class="secret-status" id="xpStatus"></div>
      </div>
    </div>
    `;
}

function renderGaleri() {
  return `
  <div class="win-window" id="galeri">
      <div class="win-titlebar">
        <div class="title-bar-left">
          <div class="window-icon">📷</div>
          <span class="window-title">GaleriFoto.exe</span>
        </div>
        <div class="window-controls">
       <div class="win-buttons">
          <div class="win-btn">_</div>
          <div class="win-btn">□</div>
          <div class="win-btn close">×</div>
        </div>
        </div>
      </div>

      <div class="toolbar">
        <button class="toolbar-btn" onclick="shufflePhotos()">🔀 Acak</button>
        <div class="toolbar-separator"></div>
        <button class="toolbar-btn" id="btnGrid" onclick="viewMode('grid')">
          ⊞ Grid
        </button>
        <button class="toolbar-btn" id="btnList" onclick="viewMode('list')">
          ☰ Daftar
        </button>
      </div>

      <div class="address-bar">
        <span class="address-label">Alamat</span>
        <div class="address-input">
          <span class="icon">📁</span>
          <span id="addressPath">C:\\Dokumen\\Galeri Foto\\Koleksi</span>
        </div>
      </div>

      <div class="content">
        <div class="section-title">
          <span style="font-size: 18px">🖼️</span>
          <h2>Galeri Foto</h2>
        </div>

        <div class="json-info" style="display: none">
          📄 Membaca dari: <code>galeri.json</code> | 🖼️ Folder:
          <code>./galeri/</code>
          <span id="galleryJsonStatus" style="float: right; color: #008000"
            >⏳ Memuat...</span
          >
        </div>

        <!-- Loading State -->
        <div id="galleryLoading" class="loading-container">
          <div class="loading-text">
            <span class="hourglass">⏳</span>
            <span>Memuat galeri...</span>
            <div class="spinner"></div>
          </div>
        </div>

        <!-- Gallery -->
        <div id="galleryGrid" class="gallery-grid" style="display: none"></div>
      </div>

      <!-- Status Bar -->
      <div class="status-bar">
        <div class="status-bar-left">
          <span id="galleryStatusCount">0 objek</span>
          <div class="status-separator"></div>
          <span id="galleryStatusSize">0 KB</span>
        </div>
        <div class="status-bar-right">
          <span id="galleryStatusView">Tampilan: Ikon</span>
        </div>
      </div>
    </div>

    <!-- Lightbox -->
    <div class="lightbox-overlay" id="lightbox" onclick="closeLightbox(event)">
      <div class="lightbox-window" onclick="event.stopPropagation()">
        <div class="lightbox-title-bar">
          <span class="lightbox-title" id="lightbox-title">Pratinjau Foto</span>
          <div
            class="win-btn close"
            onclick="closeLightbox()"
            style="width: 21px; height: 21px"
          >
            <span>×</span>
          </div>
        </div>
        <div class="lightbox-content">
          <img class="lightbox-img" id="lightbox-img" src="" alt="" />
          <div class="lightbox-caption" id="lightbox-caption"></div>
          <div class="lightbox-nav">
            <button onclick="prevPhoto()">◀ Sebelumnya</button>
            <button onclick="closeLightbox()">Tutup</button>
            <button onclick="nextPhoto()">Selanjutnya ▶</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function attachSecretFormListeners() {
  const form = document.getElementById("secretForm");
  const btnBatal = document.getElementById("btnBatal");

  if (form) {
    form.addEventListener("submit", (e) => {
      submitSecret(e);
    });
  }

  if (btnBatal) {
    btnBatal.addEventListener("click", () => {
      if (form) form.reset();
    });
  }
}

function filterProjects(cat) {
  currentFilter = cat;
  renderAll();
  const proyekEl = document.getElementById("proyek");
  if (proyekEl) proyekEl.scrollIntoView({ behavior: "smooth" });
}

async function openPdf(pdfUrl, title) {
  if (!pdfUrl) return;

  // ✅ PERBAIKAN: Cek pdfjsLib tersedia
  if (typeof pdfjsLib === "undefined") {
    alert("PDF viewer belum siap. Silakan refresh halaman.");
    return;
  }

  const modalTitle = document.getElementById("modalTitle");
  const viewer = document.getElementById("pdfViewer");
  const modal = document.getElementById("pdfModal");

  if (modalTitle) modalTitle.textContent = title || "PDF Viewer";
  if (viewer) {
    viewer.innerHTML =
      '<div style="padding:40px;text-align:center;">⏳ Memuat Data....</div>';
  }
  if (modal) modal.classList.add("active");

  try {
    const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
    if (viewer) viewer.innerHTML = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const scale = 1.5;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      await page.render({ canvasContext: ctx, viewport }).promise;
      if (viewer) viewer.appendChild(canvas);
      if (i < pdf.numPages && viewer) {
        const br = document.createElement("div");
        br.style.cssText =
          "height:2px;background:linear-gradient(90deg,transparent,#C0C0C0,transparent);margin:8px 0;";
        viewer.appendChild(br);
      }
      page.cleanup();
    }
    pdf.destroy();
  } catch (err) {
    console.error("PDF Error:", err);
    if (viewer) {
      viewer.innerHTML = `<div class="error-box">❌ Gagal memuat.<br><br>Kemungkinan penyebab:<br>1. File tidak ada di folder <b>uploads/</b><br>2. Buka via server (bukan file://)<br>3. CORS policy browser<br><br><button class="win-button" onclick="closeModal()">Tutup</button></div>`;
    }
  }
}

function closeModal() {
  const modal = document.getElementById("pdfModal");
  const viewer = document.getElementById("pdfViewer");
  if (modal) modal.classList.remove("active");
  if (viewer) viewer.innerHTML = "";
}

function escapeHtml(text) {
  if (text === null || text === undefined) return "";
  const div = document.createElement("div");
  div.textContent = String(text);
  return div.innerHTML;
}

function updateClock() {
  const clockEl = document.getElementById("clock");
  if (!clockEl) return;
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  clockEl.textContent = `${h}:${m}`;
}
updateClock();
setInterval(updateClock, 1000);

function setActive(el) {
  document
    .querySelectorAll(".task-item")
    .forEach((i) => i.classList.remove("active"));
  if (el) el.classList.add("active");
}

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "s")) {
    e.preventDefault();
    return false;
  }
});
document.addEventListener("contextmenu", (e) => e.preventDefault());

// ✅ PERBAIKAN: Pastikan DOM ready sebelum loadData
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadData);
} else {
  loadData();
}

let photos = [];
let currentIndex = 0;
let currentView = "grid";

// ===== LOAD GALLERY DARI JSON =====
async function loadGallery() {
  const loadingEl = document.getElementById("galleryLoading");
  const galleryEl = document.getElementById("galleryGrid");
  const statusEl = document.getElementById("galleryJsonStatus");

  if (loadingEl) loadingEl.style.display = "flex";
  if (galleryEl) galleryEl.style.display = "none";
  if (statusEl) {
    statusEl.textContent = "⏳ Memuat...";
    statusEl.style.color = "#008000";
  }

  try {
    const response = await fetch("./galeri.json?t=" + Date.now(), {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: galeri.json tidak ditemukan`);
    }

    photos = await response.json();

    // Validasi wajib array
    if (!Array.isArray(photos)) {
      throw new Error("Format galeri.json salah: harus berupa array");
    }

    if (statusEl) {
      statusEl.textContent = "✓ Terhubung (" + photos.length + " foto)";
      statusEl.style.color = "#008000";
    }
  } catch (err) {
    console.error("Galeri error:", err);
    if (statusEl) {
      statusEl.textContent = "✗ " + err.message;
      statusEl.style.color = "#c0392b";
    }
    photos = []; // fallback array kosong
  }

  // Render & tampilkan (tanpa setTimeout delay)
  renderGallery();
  if (loadingEl) loadingEl.style.display = "none";
  if (galleryEl) {
    galleryEl.style.display = currentView === "grid" ? "grid" : "flex";
  }
  updateStatus();
}

// ===== RENDER GALLERY =====
function renderGallery() {
  const galleryEl = document.getElementById("galleryGrid");
  if (!galleryEl) return;

  galleryEl.innerHTML = "";

  if (!Array.isArray(photos) || photos.length === 0) {
    galleryEl.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1; text-align:center; padding:40px;">
        <span style="font-size: 32px;">📂</span>
        <p style="color: var(--win-text-muted);">Folder galeri kosong atau gagal dimuat</p>
        <p style="font-size: 12px; color: var(--win-text-muted);">
          Pastikan file <code>galeri.json</code> ada di folder yang sama.
        </p>
      </div>
    `;
    return;
  }

  if (currentView === "grid") {
    galleryEl.className = "gallery-grid";
    photos.forEach((photo, index) => {
      const item = document.createElement("div");
      item.className = "photo-item";
      item.onclick = () => openLightbox(index);

      item.innerHTML = `
        <div class="photo-frame">
          <img src="${photo.url}" alt="${photo.caption || ""}"
               onerror="this.onerror=null; this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22><rect fill=%22%23ddd%22 width=%22400%22 height=%22300%22/><text x=%2250%%22 y=%2250%%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22 font-size=%2214%22>${photo.caption || "No Image"}</text></svg>'"
               loading="lazy">
        </div>
        <div class="photo-caption">${photo.caption || "Untitled"}</div>
      `;
      galleryEl.appendChild(item);
    });
  } else {
    galleryEl.className = "gallery-list";
    photos.forEach((photo, index) => {
      const item = document.createElement("div");
      item.className = "list-item";
      item.onclick = () => openLightbox(index);
      item.innerHTML = `
        <img src="${photo.url}" alt="${photo.caption || ""}"
             onerror="this.onerror=null; this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2230%22><rect fill=%22%23ddd%22 width=%2240%22 height=%2230%22/></svg>'">
        <span>${photo.caption || "Untitled"}</span>
        <span style="margin-left:auto; color:#808080; font-size:11px;">Foto</span>
      `;
      galleryEl.appendChild(item);
    });
  }
}

// ===== SHUFFLE =====
function shufflePhotos() {
  const galleryEl = document.getElementById("gallery");
  const loadingEl = document.getElementById("loading");

  galleryEl.style.display = "none";
  loadingEl.style.display = "flex";

  setTimeout(() => {
    photos.sort(() => Math.random() - 0.5);
    renderGallery();
    loadingEl.style.display = "none";
    galleryEl.style.display = currentView === "grid" ? "grid" : "flex";
  }, 600);
}

// ===== VIEW MODE =====
function viewMode(mode) {
  currentView = mode;
  document
    .getElementById("btnGrid")
    .classList.toggle("active", mode === "grid");
  document
    .getElementById("btnList")
    .classList.toggle("active", mode === "list");
  document.getElementById("status-view").textContent =
    mode === "grid" ? "Tampilan: Ikon" : "Tampilan: Daftar";
  renderGallery();
  const galleryEl = document.getElementById("gallery");
  galleryEl.style.display = mode === "grid" ? "grid" : "flex";
}

// ===== STATUS BAR =====
function updateStatus() {
  const countEl = document.getElementById("galleryStatusCount");
  const sizeEl = document.getElementById("galleryStatusSize");
  const viewEl = document.getElementById("galleryStatusView");

  if (countEl) countEl.textContent = photos.length + " objek";

  if (sizeEl) {
    const totalSize = photos.length * 245;
    sizeEl.textContent =
      totalSize > 1024
        ? (totalSize / 1024).toFixed(1) + " MB"
        : totalSize + " KB";
  }

  if (viewEl) {
    viewEl.textContent =
      currentView === "grid" ? "Tampilan: Ikon" : "Tampilan: Daftar";
  }
}

// ===== LIGHTBOX =====
function openLightbox(index) {
  currentIndex = index;
  const photo = photos[index];
  document.getElementById("lightbox-img").src = photo.url;
  document.getElementById("lightbox-caption").textContent =
    index + 1 + " dari " + photos.length + " - " + photo.caption;
  document.getElementById("lightbox-title").textContent =
    "Pratinjau: " + photo.caption;
  document.getElementById("lightbox").classList.add("active");
}

function closeLightbox(event) {
  if (!event || event.target.id === "lightbox") {
    document.getElementById("lightbox").classList.remove("active");
  }
}

function nextPhoto() {
  currentIndex = (currentIndex + 1) % photos.length;
  openLightbox(currentIndex);
}

function prevPhoto() {
  currentIndex = (currentIndex - 1 + photos.length) % photos.length;
  openLightbox(currentIndex);
}

// ===== KEYBOARD NAVIGATION =====
document.addEventListener("keydown", (e) => {
  if (!document.getElementById("lightbox").classList.contains("active")) return;
  if (e.key === "Escape") closeLightbox();
  if (e.key === "ArrowRight") nextPhoto();
  if (e.key === "ArrowLeft") prevPhoto();
});

// ===== INIT =====
window.onload = () => {
  const btnGrid = document.getElementById("btnGrid");
  if (btnGrid) {
    btnGrid.classList.add("active");
  } else {
    console.warn("btnGrid belum tersedia, inisialisasi galeri ditunda");
  }

  // Panggil loadGallery dengan delay kecil untuk pastikan DOM siap
  // atau panggil langsung kalau elemen sudah ada
  if (document.getElementById("galleryLoading")) {
    loadGallery();
  }
};
