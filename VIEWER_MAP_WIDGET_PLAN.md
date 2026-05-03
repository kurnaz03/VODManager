# Canlı İzleyici Haritası Widget — Uygulama Planı

## Genel Bakış

Dashboard'a "Canlı İzleyici Haritası" (Seçenek B — Zengin) widget'ı eklendi.  
Dünya ısı haritası (SVG) + Top 10 liste + Zaman toggle + Ülke detay modal + Tam ekran.

---

## Mimari Akış

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (React Query, 30s poll)                           │
│                                                             │
│  ViewerMapWidget                                            │
│    ├── TimeRange toggle  (now / 24h / 7d)                   │
│    ├── WorldMap.tsx      (react-simple-maps SVG heatmap)    │
│    ├── TopCountryList.tsx                                   │
│    ├── CountryDetailModal.tsx (on country click)            │
│    └── FullscreenModal.tsx (ESC to close)                   │
└────────────────┬────────────────────────────────────────────┘
                 │  GET /api/v1/dashboard/viewer-map?range=now
                 │  GET /api/v1/dashboard/viewer-map/TR?range=now
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  FastAPI Backend                                            │
│                                                             │
│  dashboard/router.py                                        │
│    └── service.py                                           │
│         ├── "now"  → user_connections WHERE is_active=True  │
│         ├── "24h"  → user_watch_history WHERE started >= -24h│
│         └── "7d"   → user_watch_history WHERE started >= -7d│
│              ↓                                              │
│         Redis cache (TTL: now=10s, 24h=120s, 7d=300s)      │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────┐
│  PostgreSQL                                                 │
│   user_connections  (country_code, is_active, last_seen_at) │
│   user_watch_history (country_code, started_at, duration)   │
└─────────────────────────────────────────────────────────────┘

GeoIP: DB-IP Lite CSV → dashboard/geoip.py (in-memory bisect lookup)
       Yükleme: startup lifespan → load_geoip_csv()
       Fallback: ip-api.com SADECE ISP lock kontrolü için
```

---

## GeoIP Kararı

| | ip-api.com (ESKİ) | DB-IP Lite CSV (YENİ) |
|---|---|---|
| Rate limit | 45 req/min | Yok |
| Hız | ~150ms network | ~0.1ms in-memory |
| Offline | Hayır | Evet |
| GDPR | Üçüncü taraf | Lokal |
| Maliyet | Ücretsiz (limit) | Ücretsiz |
| ISP desteği | Evet | Hayır (ip-api.com fallback) |

**Karar:** DB-IP Lite CSV öncelikli; ip-api.com sadece ISP lock aktifken çağrılır.

CSV indirme URL: `https://download.db-ip.com/free/dbip-country-lite-YYYY-MM.csv.gz`  
Sunucu yolu: `/var/www/vod-manager/data/dbip-country-lite.csv`

---

## Veri Kaynağı Kararı

**Migration YOK** — mevcut tablolar kullanılıyor:

- `user_connections.country_code` → "ANLIK" görünüm
- `user_watch_history.country_code` → "24h / 7d" görünüm
- Her iki tablo zaten `get_geo_info()` üzerinden `country_code` yazıyor

---

## API Endpointler

### GET /api/v1/dashboard/viewer-map

Query param: `range` = `now` | `24h` | `7d` (default: `now`)

**Response:**
```json
{
  "countries": [
    {"country_code": "TR", "country_name": "Türkiye", "viewer_count": 42},
    {"country_code": "DE", "country_name": "Almanya", "viewer_count": 17}
  ],
  "total_viewers": 59,
  "total_countries": 2
}
```

Cache TTL: now=10s, 24h=120s, 7d=300s

### GET /api/v1/dashboard/viewer-map/{country_code}

Query param: `range` = `now` | `24h` | `7d`

**Response:**
```json
{
  "country_code": "TR",
  "country_name": "Türkiye",
  "connections": [
    {
      "ip_address": "1.2.3.4",
      "username": "user123",
      "stream_name": "TRT 1",
      "stream_type": "live",
      "started_at": "2024-01-15T10:00:00Z",
      "duration_seconds": 3600
    }
  ],
  "total": 1
}
```

---

## Redis Cache Stratejisi

```
Key format : viewer_map:summary:{range}
             viewer_map:detail:{country_code}:{range}

TTL        : now → 10s  (canlı veri — çok kısa)
             24h → 120s (2 dakika)
             7d  → 300s (5 dakika)

Fallback   : Redis yoksa/hata varsa direkt DB sorgusu
```

---

## Frontend Bileşen Yapısı

```
DashboardPage.tsx
└── ViewerMapWidget.tsx          (orchestrator, useQuery x2)
    ├── WorldMap.tsx             (react-simple-maps, d3-scale, lazy loaded)
    ├── TopCountryList.tsx       (top 10 ülke butonu listesi)
    ├── CountryDetailModal.tsx   (ülke tıklama detay popup)
    └── FullscreenModal.tsx      (ESC + X butonu ile kapat)

Services:
└── services/viewerMapApi.ts    (axios wrapper)
```

---

## Responsive Tasarım

| Breakpoint | Düzen |
|---|---|
| < 640px (sm) | Tek sütun, harita üstte, liste altta |
| ≥ 640px | 2:1 grid (harita sol, liste sağ) |
| Tam ekran | fullscreen modal, flex-1 |

---

## Yeni Dosyalar

### Backend
```
backend/app/modules/dashboard/__init__.py
backend/app/modules/dashboard/geoip.py        (DB-IP Lite CSV loader + bisect lookup)
backend/app/modules/dashboard/schemas.py       (Pydantic: ViewerMapSummary, CountryDetail)
backend/app/modules/dashboard/service.py       (DB sorguları + Redis cache)
backend/app/modules/dashboard/router.py        (2 endpoint)
```

### Frontend
```
frontend/src/modules/dashboard/services/viewerMapApi.ts
frontend/src/modules/dashboard/components/ViewerMapWidget.tsx
frontend/src/modules/dashboard/components/WorldMap.tsx
frontend/src/modules/dashboard/components/TopCountryList.tsx
frontend/src/modules/dashboard/components/CountryDetailModal.tsx
frontend/src/modules/dashboard/components/FullscreenModal.tsx
```

### Değiştirilen Dosyalar
```
backend/app/main.py                            (+import + load_geoip_csv() çağrısı)
backend/app/api/v1/router.py                   (+dashboard_router import + include)
backend/app/modules/connections/service.py     (get_geo_info → offline, ISP fallback)
frontend/src/modules/dashboard/DashboardPage.tsx (+ViewerMapWidget import + render)
frontend/package.json                          (+react-simple-maps, d3-scale deps)
```

---

## Deploy Adımları

```bash
# 1. Server'a bağlan
ssh root@62.210.92.252

# 2. DB-IP Lite CSV indir (aylık güncelleme)
mkdir -p /var/www/vod-manager/data
cd /var/www/vod-manager/data
# Güncel ayı yaz:
wget -O dbip-country-lite.csv.gz \
  "https://download.db-ip.com/free/dbip-country-lite-$(date +%Y-%m).csv.gz"
gunzip -f dbip-country-lite.csv.gz
# CSV boyutu ~5-8 MB olmalı

# 3. Frontend build
cd /var/www/vod-manager/app
git pull origin main
cd frontend
npm install          # react-simple-maps, d3-scale yükler
npm run build        # dist/ klasörüne çıktı

# 4. world-110m.json asset'i yerleştir (sadece ilk kez)
# react-simple-maps paketi kendi içinde topojson kullanır.
# Eğer özel bir GeoJSON gerekirse:
# cp /path/to/world-110m.json frontend/public/assets/

# 5. Backend pip (gerekli değil — yeni pip paketi yok)
# Redis zaten mevcut

# 6. Backend restart
cd /var/www/vod-manager/app
systemctl restart vod-backend
# veya
supervisorctl restart vod-backend

# 7. Nginx reload (statik dosya değişikliği)
systemctl reload nginx

# 8. Smoke test
curl -H "Authorization: Bearer <TOKEN>" \
  https://panel.example.com/api/v1/dashboard/viewer-map?range=now
```

---

## Rollback Planı

```bash
# Frontend rollback: önceki dist/ geri yükle
cd /var/www/vod-manager/app/frontend
git checkout HEAD~1 -- src/modules/dashboard/
npm run build

# Backend rollback: dashboard router'ı kaldır
# api/v1/router.py'den dashboard_router satırlarını sil
# systemctl restart vod-backend

# GeoIP: connections/service.py eski get_geo_info'yu geri getir
# (git diff ile)
```

---

## Risk Tablosu

| Risk | Olasılık | Etki | Azaltma |
|------|----------|------|---------|
| DB-IP CSV eksik (sunucuda yok) | Orta | Harita boş görünür | Startup warning logu; `user_connections.country_code` varsa yine de çalışır |
| `react-simple-maps` TopoJSON uyumsuzluğu | Düşük | Harita render olmaz | `lazy()` ile izole, hata sadece widget'ı etkiler |
| Redis cache miss (Redis yoksa) | Düşük | Her istekte DB sorgusu | service.py graceful fallback var |
| ISP lock bozulması (ip-api.com replace) | Düşük | ISP kontrolü atlanabilir | `_get_isp_from_api()` fallback sadece ISP lock aktifken çağrılıyor |
| `user_connections.country_code` boş | Orta | "now" veride eksik ülkeler | `is not None AND != ''` filtresi var; tarihsel data geliştikçe dolacak |
| n+1 sorgu (country detail) | Düşük | Yavaş yanıt | JOIN ile tek sorgu, LIMIT 100 |

---

## Test Planı

### Backend
```bash
# Unit test (pytest)
cd /var/www/vod-manager/app/backend
source ../venv/bin/activate

# GeoIP lookup testi
python -c "
from app.modules.dashboard.geoip import load_csv, lookup
load_csv()
print(lookup('8.8.8.8'))     # US
print(lookup('195.175.0.1')) # TR
print(lookup('127.0.0.1'))   # None (private)
"

# API endpoint testi
curl -H "Authorization: Bearer <TOKEN>" \
  http://localhost:8000/api/v1/dashboard/viewer-map?range=now

curl -H "Authorization: Bearer <TOKEN>" \
  http://localhost:8000/api/v1/dashboard/viewer-map/TR?range=now
```

### Frontend
```bash
cd /var/www/vod-manager/app/frontend
npm run build  # TypeScript derleme hatası yok mu?
```

### E2E Manuel Test Checklist
- [ ] Dashboard sayfasında widget görünüyor
- [ ] ANLIK / SON 24H / SON 7G butonları çalışıyor
- [ ] Harita üzerinde ülkeye hover → tooltip gösteriyor
- [ ] Ülkeye tıklama → CountryDetailModal açılıyor
- [ ] Modal'da bağlantı listesi (IP, kullanıcı, içerik, süre) görünüyor
- [ ] Tam ekran butonu çalışıyor
- [ ] ESC ile tam ekrandan çıkılıyor
- [ ] 30 saniyede otomatik yenileme
- [ ] Mobil (< 640px) tek sütun layout
- [ ] Boş veri durumunda "Henüz bağlı izleyici yok" mesajı

---

## Notlar

- `world-110m.json` TopoJSON dosyası: `react-simple-maps` kendi CDN'ini kullanabilir veya
  `/public/assets/world-110m.json` olarak serve edilebilir. İlk kurulumda CDN URL'i
  `WorldMap.tsx:GEO_URL` sabitinde değiştirilebilir.
- DB-IP Lite CSV aylık güncellenir → Celery task ile otomatikleştirilebilir (ileriki sprint).
- Viewer count `user_connections` tablo üzerinden hesaplanır. IPTV bağlantısı koparsa
  `is_active=False` işaretlenir (`_expire_stale_connections` ile 60 saniye timeout).
