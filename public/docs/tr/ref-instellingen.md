# Ayarlar

**Ayarlar** penceresi, uygulama ayarlarını tutar: proje dosyasından bağımsız olarak bu cihaza uygulanan tercihler. Her değişiklik hemen uygulanır ve kaydedilir — bir Tamam düğmesi yoktur. Hesaplanan planı değiştiren planlama seçenekleri bunun yerine projeyle birlikte yaşar — bkz. [Proje bilgileri](docs://ref-projectgegevens).

## Açma — üç giriş, aynı içerik

- Başlık çubuğundaki **dişli** (⚙).
- **Ayarlar** (şerit sekmesi) → **Proje** şerit grubu → **Ayarlar**.
- **Dosya** → **Ayarlar** (Backstage).

Üçü de tam olarak aynı ayarları gösterir. Sürümünüze bağlı olarak üç veya dört sekmeye yayılmıştır — dördüncüsü, **Uygulama**, yakın zamanda ilk sekmenin sonundan ayrıldı — ama ayarların kendisi ve ne yaptıkları her iki durumda da aynıdır; bu makale bunları **Genel**, **Dil** ve **Zaman çizelgesi / Yakınlaştırma** olarak gruplar.

## Genel sekmesi

**Görünüm:**

- **Tema** — **Koyu**, **Açık** veya **Yüksek Kontrast**; geçiş yapmak için bir karta tıklayın.
- **Yazı tipi** — **Varsayılan**, **Sistem**, **Serif** veya **Monospace**; arayüzün yazı tipini geçersiz kılar. Web uygulamaları sistem yazı tipi ayarınızı otomatik olarak takip etmez, bu yüzden bu ve bir sonraki seçenek onu kendiniz seçmenin yoludur.
- **Metin boyutu** — %90, 100, 110 veya 125; arayüz metnini ve düzenini ölçeklendirir.
- **Belge değiştirme stili** — açık belgeler arasında nasıl geçiş yapılacağı: **Yatay sekmeler**, **Dikey sekmeler** veya **Hap**.
- **Tarih biçimi** — **gg-aa-yyyy**, **aa-gg-yyyy** veya **yyyy-aa-gg**. Yalnızca görüntüleme; dosyalar ve hesaplamalar etkilenmez.
- **İnşaat modu** — **İnşaat modunu etkinleştir**, *yeni* projeler için varsayılanları inşaata yönelik (Hollanda resmi tatillerini, inşaat tatilini ve fazlama şablonlarını içeren bir inşaat takvimi) ile nötr, inşaattan bağımsız bir kurulum arasında değiştirir. Mevcut projeler her iki durumda da etkilenmez.

**Uygulama:**

- **Sürüm** — uygulamanın sürüm numarası (salt okunur), güncelleme penceresini açan bir **Güncellemeleri denetle** bağlantısıyla birlikte. Güncellemeleri yüklemek yalnızca masaüstü uygulamasında çalışır; Snap ve AppImage kurulumları kendi kanalları üzerinden güncellenir. Ayrıca, uygulama kendini otomatik güncelledikten sonra ilk açtığınızda, "Az önce güncellendiniz" iletişim penceresi kendiliğinden tek seferlik olarak görünür — sürüm sıçraması, yükleyici boyutu farkı, önceki sürümden bu yana geçen gün sayısı ve GitHub yayın notları, alabildiği hangisiyse. Bu, buradaki elle **Güncellemeleri denetle** bağlantısından farklı, otomatik bir andır.
- **Proje bilgileri...** — [Proje bilgileri](docs://ref-projectgegevens) penceresine kısayol.
- **Tur** — **Turu başlat**, giriş turunu tekrar oynatır. Aynı yeniden başlatma, **Görünüm** şerit sekmesindeki **Tur**'da ve Backstage'de (**Dosya** → **Turu başlat**) de bulunur.
- **Kıyaslama** — bu makinenin planlama/çizim performansını ölçmek için yerleşik kıyaslama aracını açar.
- **Yapay zeka modu** — **Yapay zeka modunu etkinleştir**, MCP köprüsüne sahip **Yapay Zeka** şerit sekmesini gösterir; böylece bir yapay zeka asistanı Model Context Protocol üzerinden planınızla çalışabilir; kapatmak çalışan bir köprüyü hemen durdurur. **Köprüyü otomatik başlat** (yalnızca yapay zeka modu açıkken kullanılabilir), önce Yapay Zeka sekmesini ziyaret etmeden köprüyü uygulama açılır açılmaz devreye alır — yalnızca masaüstü uygulamasında. Tam resim için uygulama içi yapay-zeka-asistanı kılavuzuna bakın.
- **Hata ayıklama terminali** — **Hata ayıklama terminalini etkinleştir**, sorun giderme için günlük panelini gösterir.

## Dil sekmesi

- **Dil** — uygulamanın görüntüleme dili, hemen uygulanır.

## Zaman çizelgesi / Yakınlaştırma sekmesi

- **Saat planlaması** — **Saat planlamasını etkinleştir**, saat ölçeğini ve çalışma saati bantlarını açar. Kapalıyken yeni görevler günle başlar, mevcut saat görevleri kesin değerini korur. Açıkken gün ve saat görevleri birlikte bulunabilir. Bkz. [Takvimler & saat planlaması](docs://gids-kalenders-uren).
- **Süre gösterimi** — **Otomatik (göreve özgü birim)**, **Her zaman gün** veya **Her zaman saat**.
- **Kesintilerde görev çubukları** — **Asla bölme**, **Seçildiğinde böl** veya **Her zaman böl**: bir çubuğun çalışılmayan günler etrafında görsel olarak bölünüp bölünmediği.
- **Zaman ekseni** — **Yalnızca iş günlerini göster**, zaman çizelgesini sıkıştırır: proje takvimindeki hafta sonları ve tatiller atlanır, böylece aralarındaki takvim nasıl görünürse görünsün 5 iş günlük bir görev tam olarak 5 sütun genişliğindedir.
- **Hafta başlangıcı** — **Pazartesi** veya **Pazar** (zaman ölçeğinin hafta düzeni).
- **Çok yakınlaştırıldığında çeyrek saatleri göster** — saat zaman ölçeğinde ekstra çeyrek-saat derecelendirmesi.
- **Hesaplama** — **Otomatik hesapla**, plan güncelliğini yitirdiği anda, F5'i beklemek yerine planı yeniden hesaplar.
- **Kaydırma ve yakınlaştırma** — **Mod**:
- **Yakınlaştır + sürükle** (varsayılan) — kaydırma tekerleği yakınlaştırır (imleç üzerinde sabitlenmiş); görünümü kaydırmak için plan arka planını sürükleyin; Shift+kaydırma tekerleği satırlar arasında kaydırır; Ctrl/⌘+sürükleme bir seçim çerçevesi çizer.
- **Konum** — imlecin konumu kaydırma yönünü belirler; **Ekran bölümü** ile (**Sol/sağ**, **Üst/alt** veya **Sağ üst köşe**). Ctrl+kaydırma = yakınlaştırma, Shift+kaydırma = yatay.
- **Tuşlar** — çipleri sürükleyerek hangi kontrolün (**Kaydırma**, **Ctrl + kaydırma**, **Shift + kaydırma**) hangi işlevi (**Dikey**, **Yatay**, **Yakınlaştırma**) aldığını atayın; dolu bir yuvaya bırakmak kontrolleri değiştirir.
