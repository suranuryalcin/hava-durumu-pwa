// =========================================================
//  Hava Durumu PWA - Open-Meteo API kullanan uygulama
// =========================================================

const API_GEO = "https://geocoding-api.open-meteo.com/v1/search";
const API_WEATHER = "https://api.open-meteo.com/v1/forecast";

// WMO hava durumu kodlarını Türkçe açıklama ve emojiye çevir
const WEATHER_CODES = {
  0:  { desc: "Açık",                 icon: "☀️" },
  1:  { desc: "Az bulutlu",           icon: "🌤️" },
  2:  { desc: "Parçalı bulutlu",      icon: "⛅" },
  3:  { desc: "Kapalı",               icon: "☁️" },
  45: { desc: "Puslu",                icon: "🌫️" },
  48: { desc: "Kırağılı pus",         icon: "🌫️" },
  51: { desc: "Hafif çisenti",        icon: "🌦️" },
  53: { desc: "Çisenti",              icon: "🌦️" },
  55: { desc: "Yoğun çisenti",        icon: "🌧️" },
  61: { desc: "Hafif yağmur",         icon: "🌦️" },
  63: { desc: "Yağmurlu",             icon: "🌧️" },
  65: { desc: "Şiddetli yağmur",      icon: "🌧️" },
  71: { desc: "Hafif kar",            icon: "🌨️" },
  73: { desc: "Kar yağışlı",          icon: "❄️" },
  75: { desc: "Yoğun kar",            icon: "❄️" },
  80: { desc: "Sağanak yağış",        icon: "🌦️" },
  81: { desc: "Şiddetli sağanak",     icon: "🌧️" },
  82: { desc: "Çok şiddetli sağanak", icon: "⛈️" },
  95: { desc: "Gök gürültülü fırtına",icon: "⛈️" },
  96: { desc: "Dolulu fırtına",       icon: "⛈️" },
  99: { desc: "Şiddetli dolulu fırtına", icon: "⛈️" },
};

const TR_DAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

// ---- DOM referansları ----
const $ = (id) => document.getElementById(id);
const cityInput    = $("city-input");
const searchBtn    = $("search-btn");
const locationBtn  = $("location-btn");
const errorBox     = $("error-message");
const loading      = $("loading");
const currentSec   = $("current-weather");
const forecastSec  = $("forecast");
const forecastList = $("forecast-list");
const offlineBanner= $("offline-banner");
const themeToggle  = $("theme-toggle");


// WMO kodundan arka plan sınıfı belirleme
function getBackgroundClass(code, isNight = false) {
  // Gece ise bazı durumlarda gece teması
  if (isNight && (code === 0 || code === 1)) {
    return "bg-night";
  }

  // 0: Açık
  if (code === 0) return "bg-clear";

  // 1-2: Az/parçalı bulutlu
  if (code === 1 || code === 2) return "bg-partly-cloudy";

  // 3: Kapalı
  if (code === 3) return "bg-overcast";

  // 45, 48: Puslu
  if (code === 45 || code === 48) return "bg-fog";

  // 51-57: Çisenti
  if (code >= 51 && code <= 57) return "bg-rain";

  // 61-67: Yağmur
  if (code >= 61 && code <= 67) return "bg-rain";

  // 71-77: Kar
  if (code >= 71 && code <= 77) return "bg-snow";

  // 80-82: Sağanak
  if (code >= 80 && code <= 82) return "bg-rain";

  // 85-86: Kar sağanağı
  if (code === 85 || code === 86) return "bg-snow";

  // 95-99: Fırtına
  if (code >= 95) return "bg-storm";

  return "bg-clear";
}

// Gece mi kontrolü (basit: 20:00 - 06:00 arası)
function isNightTime() {
  const h = new Date().getHours();
  return h >= 20 || h < 6;
}

// Arka planı uygula
function applyWeatherBackground(code) {
  const bgLayer = document.getElementById("bg-layer");
  if (!bgLayer) return;

  const newClass = getBackgroundClass(code, isNightTime());

  // Eski bg-* sınıflarını temizle
  const classes = Array.from(bgLayer.classList).filter((c) => c.startsWith("bg-"));
  classes.forEach((c) => bgLayer.classList.remove(c));

  // Yeni sınıfı ekle
  bgLayer.classList.add(newClass);
}

// ---- Yardımcı fonksiyonlar ----
function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.remove("hidden");
}
function hideError() {
  errorBox.classList.add("hidden");
}
function showLoading(show) {
  loading.classList.toggle("hidden", !show);
}
function weatherInfo(code) {
  return WEATHER_CODES[code] || { desc: "Bilinmiyor", icon: "❓" };
}
function formatDate(iso) {
  const d = new Date(iso);
  return `${TR_DAYS[d.getDay()]}, ${d.getDate()}.${(d.getMonth()+1).toString().padStart(2,"0")}`;
}
function formatUpdateTime(date) {
  return date.toLocaleString("tr-TR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

// =========================================================
//  Tema yönetimi
// =========================================================
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeToggle.textContent = theme === "dark" ? "☀️" : "🌙";
  localStorage.setItem("theme", theme);
}
function initTheme() {
  const saved = localStorage.getItem("theme");
  if (saved) return applyTheme(saved);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(prefersDark ? "dark" : "light");
}
themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  applyTheme(current === "dark" ? "light" : "dark");
});

// =========================================================
//  API çağrıları
// =========================================================
async function geocodeCity(name) {
  const url = `${API_GEO}?name=${encodeURIComponent(name)}&count=1&language=tr&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Geocoding servisi hatası");
  const data = await res.json();
  if (!data.results || data.results.length === 0) {
    throw new Error(`"${name}" için sonuç bulunamadı. Lütfen şehir adını kontrol edin.`);
  }
  const r = data.results[0];
  const displayName = [r.name, r.admin1, r.country].filter(Boolean).join(", ");
  return { lat: r.latitude, lon: r.longitude, name: displayName };
}

async function fetchWeather(lat, lon, name) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: "temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    timezone: "auto",
    forecast_days: "5",
    temperature_unit: "celsius",
    wind_speed_unit: "kmh",
  });
  const res = await fetch(`${API_WEATHER}?${params}`);
  if (!res.ok) throw new Error("Hava durumu servisi hatası");
  const data = await res.json();
  renderWeather(data, name);
}

// =========================================================
//  Arayüz güncelleme
// =========================================================
function renderWeather(data, name) {
  const cur = data.current;
  //const info = weatherInfo(cur.weather_code);
  //window.__lastWeatherCode = cur.weather_code;  // ⬅️ sakla

applyWeatherBackground(cur.weather_code);
  $("current-city").textContent = name;
  $("current-temp").textContent = `${Math.round(cur.temperature_2m)}°C`;
  $("current-icon").textContent = info.icon;
  $("current-desc").textContent = info.desc;
  $("current-humidity").textContent = `${cur.relative_humidity_2m}%`;
  $("current-wind").textContent = `${cur.wind_speed_10m} km/s`;
  $("last-updated").textContent = `Son güncelleme: ${formatUpdateTime(new Date())}`;

  // 5 günlük tahmin
  forecastList.innerHTML = "";
  const daily = data.daily;
  for (let i = 0; i < daily.time.length; i++) {
    const dInfo = weatherInfo(daily.weather_code[i]);
    const item = document.createElement("div");
    item.className = "forecast-item";
    item.innerHTML = `
      <div class="day">${i === 0 ? "Bugün" : formatDate(daily.time[i])}</div>
      <div class="f-icon">${dInfo.icon}</div>
      <div class="temps">
        <span class="temp-max">${Math.round(daily.temperature_2m_max[i])}°</span>
        <span class="temp-min">${Math.round(daily.temperature_2m_min[i])}°</span>
      </div>
    `;
    forecastList.appendChild(item);
  }

  currentSec.classList.remove("hidden");
  forecastSec.classList.remove("hidden");
}

// =========================================================
//  Ana akış: şehir arama
// =========================================================
async function searchCity() {
  const city = cityInput.value.trim();
  hideError();
  if (!city) {
    showError("Lütfen bir şehir adı girin.");
    return;
  }
  if (!navigator.onLine) {
    showError("İnternet bağlantısı yok. Lütfen bağlantınızı kontrol edin.");
    return;
  }
  showLoading(true);
  try {
    const loc = await geocodeCity(city);
    await fetchWeather(loc.lat, loc.lon, loc.name);
  } catch (err) {
    showError(err.message || "Bir hata oluştu. Lütfen tekrar deneyin.");
  } finally {
    showLoading(false);
  }
}

// =========================================================
//  Ana akış: konum ile arama
// =========================================================
async function searchByLocation() {
  hideError();
  if (!navigator.geolocation) {
    showError("Bu cihaz konum servisini desteklemiyor.");
    return;
  }
  showLoading(true);
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      try {
        const { latitude, longitude } = pos.coords;
        // Open-Meteo reverse geocoding endpoint'i resmi olarak yok.
        // Bu yüzden yakın şehri bulmak için Nominatim (OSM) kullanıyoruz.
        let name = "Konumunuz";
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=tr`
          );
          if (r.ok) {
            const j = await r.json();
            const a = j.address || {};
            name = a.city || a.town || a.village || a.county || a.state || name;
          }
        } catch (_) { /* isim alınamazsa varsayılan kullan */ }

        await fetchWeather(latitude, longitude, name);
      } catch (err) {
        showError(err.message || "Hava durumu alınamadı.");
      } finally {
        showLoading(false);
      }
    },
    (err) => {
      showLoading(false);
      const messages = {
        1: "Konum izni reddedildi. Lütfen tarayıcı ayarlarından izin verin.",
        2: "Konum bilgisi alınamadı.",
        3: "Konum alma zaman aşımına uğradı.",
      };
      showError(messages[err.code] || "Konum alınamadı.");
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
  );
}

// =========================================================
//  Olay dinleyicileri
// =========================================================
searchBtn.addEventListener("click", searchCity);
cityInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") searchCity();
});
locationBtn.addEventListener("click", searchByLocation);

// =========================================================
//  Çevrimdışı / çevrimiçi tespiti
// =========================================================
function updateOnlineStatus() {
  offlineBanner.classList.toggle("hidden", navigator.onLine);
}
window.addEventListener("online", updateOnlineStatus);
window.addEventListener("offline", updateOnlineStatus);

// =========================================================
//  Başlatma
// =========================================================
initTheme();
updateOnlineStatus();

// =========================================================
//  Service Worker kaydı
// =========================================================
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js")
      .then(() => console.log("Service Worker kayıtlı."))
      .catch((err) => console.error("SW kayıt hatası:", err));
  });
}

// PWA kurulum istemi (isteğe bağlı)
let deferredPrompt;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  // İsterseniz bir "Yükle" butonu gösterebilirsiniz.
  // Basitlik için otomatik olarak prompt göstermiyoruz.
});

// İlk açılışta varsayılan olarak İstanbul'u göster
window.addEventListener("load", () => {
  if (navigator.onLine) {
    cityInput.value = "İstanbul";
    searchCity();
  }
});
// Her 5 dakikada bir gece/gündüz kontrolü yap
setInterval(() => {
  const currentSec = document.getElementById("current-weather");
  if (currentSec && !currentSec.classList.contains("hidden")) {
    // Son bilinen weather_code'u saklayalım
    const lastCode = window.__lastWeatherCode;
    if (typeof lastCode === "number") {
      applyWeatherBackground(lastCode);
    }
  }
}, 5 * 60 * 1000);