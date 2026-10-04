# Live Market Terminal

Kripto, altın ve S&P 500 hisselerini canlı izleyen, Bloomberg/TradingView tarzı koyu temalı bir finans terminali.

**Canlı demo:** _deploy sonrası eklenecek_

## Özellikler

- **Canlı fiyatlar:** BTC ve ETH için Binance WebSocket işlem akışı, altın için AwesomeAPI, hisseler için Yahoo Finance.
- **Mum grafiği:** TradingView Lightweight Charts ile 1m / 15m / 1h / 1D / 1W zaman dilimleri, hacim histogramı ve OHLC göstergesi. Grafiğin son mumu canlı güncellenir.
- **Haber akışı:** Seçilen varlık için Türkçe (Google News) veya İngilizce (Yahoo Finance / Finnhub) haberler. Türkçe haber azsa otomatik olarak İngilizceye geçer.
- **Mobil uyumlu:** Telefonda alt sekme çubuğu ve yatay varlık şeridi, masaüstünde üç sütunlu terminal düzeni.
- **Dayanıklılık:** Üstel bekleme ile yeniden bağlanma, akış durursa bağlantıyı yenileme, çevrimdışı algılama, panel bazında hata sınırları ve "Yeniden bağlanılıyor…" bildirimi.

## Performans yaklaşımı

- Saniyede onlarca gelen işlem 200 ms'lik bir tamponda birleştirilip store'a tek seferde yazılır.
- Her izleme listesi satırı yalnızca kendi fiyatına abone olur; bir BTC işlemi sadece BTC satırını yeniden render eder.
- Grafik React state'i kullanmaz: canlı mumlar store aboneliğinden doğrudan `series.update()` ile çizilir.
- Fiyat yanıp sönme efekti ve OHLC göstergesi DOM ref üzerinden güncellenir.

## Teknolojiler

Vite · React 19 · TypeScript · Tailwind CSS v4 · Zustand · Lightweight Charts v5 · Lucide · Firebase Hosting + Cloud Functions

## Mimari

```
src/
├── config/      Varlık tanımları, zaman dilimleri, polling süreleri
├── services/    Binance REST + WebSocket, Yahoo, AwesomeAPI, haberler, polling, HTTP/hata katmanı
├── store/       Zustand store ve atomik selektör hook'ları
├── hooks/       Canlı akışlar, mum/haber verisi, gerçek zamanlı mum güncelleme
└── components/  layout, watchlist, chart, news, common
functions/       Yahoo ve Google News için izin listeli, önbellekli proxy (Cloud Functions)
```

Yahoo Finance ve Google News tarayıcıya CORS izni vermediği için bu istekler `/api/*` üzerinden geçer. Geliştirmede Vite proxy'si, canlıda Firebase `api` fonksiyonu bu görevi üstlenir. Fonksiyon yalnızca izin verilen yolları iletir ve yanıtları hem bellekte hem Firebase CDN'de önbelleğe alır.

## Kurulum

```bash
npm install
npm run dev
```

İsteğe bağlı olarak `.env.example` dosyasını `.env` olarak kopyalayıp `VITE_FINNHUB_API_KEY` tanımlayabilirsin.

## Deploy (Firebase)

Cloud Functions için projenin Blaze planında olması gerekir (ücretsiz kota bu proje için yeterlidir).

```bash
npm install --prefix functions
firebase deploy
```

## Veri kaynakları

Binance, AwesomeAPI, Yahoo Finance ve Google News'in herkese açık uç noktaları kullanılır. Veriler yalnızca bilgilendirme amaçlıdır, yatırım tavsiyesi değildir.
