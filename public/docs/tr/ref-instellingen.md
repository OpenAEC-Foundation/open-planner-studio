# Ayarlar

**Ayarlar** penceresi, uygulama ayarlarını tutar: proje dosyasından bağımsız olarak bu cihaza uygulanan tercihler. Her değişiklik hemen uygulanır ve kaydedilir — bir Tamam düğmesi yoktur. Hesaplanan planı değiştiren planlama seçenekleri bunun yerine projeyle birlikte yaşar — bkz. [Proje bilgileri](docs://ref-projectgegevens).

## Açma — üç giriş, aynı içerik

- Başlık çubuğundaki **dişli** (⚙).
- **Ayarlar** (şerit sekmesi) → **Proje** şerit grubu → **Ayarlar**.
- **Dosya** → **Ayarlar** (Backstage).

Üçü de tam olarak aynı ayarları gösterir, üç sekmeye yayılmış: **Genel**, **Dil** ve **Zaman çizelgesi / Yakınlaştırma**.

## Genel sekmesi

- **Tema** — **Koyu**, **Açık** veya **Yüksek Kontrast**; geçiş yapmak için bir karta tıklayın.
- **Belge değiştirme stili** — açık belgeler arasında nasıl geçiş yapılacağı: **Yatay sekmeler**, **Dikey sekmeler** veya **Hap**.
- **Tarih biçimi** — **gg-aa-yyyy**, **aa-gg-yyyy** veya **yyyy-aa-gg**. Yalnızca görüntüleme; dosyalar ve hesaplamalar etkilenmez.
- **Sürüm** — uygulamanın sürüm numarası (salt okunur).
- **Güncellemeler** — **Güncellemeleri denetle** güncelleme penceresini açar. Güncellemeleri yüklemek yalnızca masaüstü uygulamasında çalışır; Snap ve AppImage kurulumları kendi kanalları üzerinden güncellenir.
- **Varsayılan yakınlaştırma** — varsayılan yakınlaştırma düzeyi (salt okunur, 30 px/gün).
- **Hata ayıklama terminali** — **Hata ayıklama terminalini etkinleştir**, sorun giderme için günlük panelini gösterir.
- **Proje bilgileri...** — [Proje bilgileri](docs://ref-projectgegevens) penceresine kısayol.
- **Tur** — **Turu başlat**, giriş turunu tekrar oynatır. Aynı yeniden başlatma, **Görünüm** şerit sekmesindeki **Tur**'da ve Backstage'de (**Dosya** → **Turu başlat**) de bulunur.

## Dil sekmesi

- **Dil** — uygulamanın görüntüleme dili; on dört dil, hemen uygulanır.

## Zaman çizelgesi / Yakınlaştırma sekmesi

- **Saat planlaması** — **Saat planlamasını etkinleştir**, saat/dakika zamanlamasını açar: bir saat zaman ölçeği, çalışma-saati bantlarına sahip vardiyalar ve saat hassasiyetinde görev çubukları. Kapalı ⇒ uygulama tamamen gün bazlı kalır. Anahtar açıkken, **Karma gün/saat planlamasına izin ver** görünür (bir projede gün ve saat görevleri). Anahtar kapalıyken saat planlaması içeren bir dosya açarsanız, üstte bir çubuk **Saat planlamasını etkinleştir**'i sunar. Bkz. [Takvimler & saat planlaması](docs://gids-kalenders-uren).
- **Süre gösterimi** — **Otomatik (göreve özgü birim)**, **Her zaman gün** veya **Her zaman saat**.
- **Kesintilerde görev çubukları** — **Asla bölme**, **Seçildiğinde böl** veya **Her zaman böl**: bir çubuğun çalışılmayan günler etrafında görsel olarak bölünüp bölünmediği.
- **Hafta başlangıcı** — **Pazartesi** veya **Pazar** (zaman ölçeğinin hafta düzeni).
- **Çok yakınlaştırıldığında çeyrek saatleri göster** — saat zaman ölçeğinde ekstra çeyrek-saat derecelendirmesi.
- **Hesaplama** — **Otomatik hesapla**, plan güncelliğini yitirdiği anda, F5'i beklemek yerine planı yeniden hesaplar.
- **Kaydırma ve yakınlaştırma** — **Mod**:
- **Konum** — imlecin konumu kaydırma yönünü belirler; **Ekran bölümü** ile (**Sol/sağ**, **Üst/alt** veya **Sağ üst köşe**). Ctrl+kaydırma = yakınlaştırma, Shift+kaydırma = yatay.
- **Tuşlar** — çipleri sürükleyerek hangi kontrolün (**Kaydırma**, **Ctrl + kaydırma**, **Shift + kaydırma**) hangi işlevi (**Dikey**, **Yatay**, **Yakınlaştırma**) aldığını atayın; dolu bir yuvaya bırakmak kontrolleri değiştirir.
- **Yakınlaştır + sürükle** — kaydırma tekerleği yakınlaştırır (imleç üzerinde sabitlenmiş); görünümü kaydırmak için plan arka planını sürükleyin.
