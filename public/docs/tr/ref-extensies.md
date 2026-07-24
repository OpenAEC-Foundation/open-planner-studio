# Uzantıları yönetme & yükleme

Uzantılar, uygulamaya özellikler ekler, örneğin ekstra içe aktarma biçimleri veya özel şerit düğmeleri. Uygulama düzeyindedirler: bir proje dosyasına değil, bu cihazdaki bu kuruluma aittirler.

## Açma

**Dosya** → **Uzantılar** (Backstage). Üstte, **ZIP** ve **JS** düğmelerinin yanında iki sekme — **Yüklü** ve **Gözat** — ve altında bir arama alanı (**Uzantı ara...**) bulunur.

## Yüklü

Uzantı başına bir kart, ad, sürüm, kategori, açıklama ve yazarla, artı:

- **Açma/kapama düğmesi** — uzantıyı kaldırmadan etkinleştirir veya devre dışı bırakır.
- **Kaldır** — kalıcı olarak kaldırmak için bir kez daha **Onayla**'ya tıklayın.

Yüklenemeyen bir uzantı kartında bir hata mesajı gösterir. Uzantı yokken sekme şunu bildirir: "Henüz yüklü uzantı yok."

## Gözat (katalog)

**Gözat** sekmesi, çevrimiçi uzantı kataloğunu getirir (internet bağlantısı gerektirir). Her katalog girdisi **Yükle** ile bir karttır; zaten yüklü uzantılar **Yüklü** rozetini gösterir. Yükleme başarısız olursa, **Tekrar dene** ile bir hata mesajı görünür.

## Bir dosyadan yükleme

- **ZIP** — bir uzantı ZIP'i yükler (`manifest.json` + `main.js` ile).
- **JS** — gömülü bir manifesti olan tek bir `.js` dosyası yükler.

Yüklemeden sonra uzantı hemen etkinleştirilir ve varsa şerit düğmeleri hemen görünür.

## Uzantılar üzerinden içe aktarma

**Dosya** → **İçe aktar**, yüklü uzantıların sunduğu içe aktarma biçimlerini listeler; bir biçime tıklayın ve bir dosya seçin. İçe aktarma uzantısı yokken sayfa şunu bildirir: "İçe aktarma uzantısı yüklü değil. Uzantılar bölümünden ekleyin." Yerleşik içe aktarma biçimleri (CSV, MS Project, P6) bundan ayrıdır — bkz. [İçe/dışa aktarma](docs://gids-import-export).

## Kendi uzantılarınızı yazma

Uzantı yazarları için kılavuz (manifest, API, izinler) depoda yaşar: `github.com/OpenAEC-Foundation/open-planner-studio`, dosya `docs/extensions.md`.
