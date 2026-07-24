# Proje bilgileri

**Proje Bilgileri** penceresi, projenin meta verilerini artı planlama seçeneklerine sahip **Hesaplama** bölümünü tutar. Aynı form, **Yeni** için proje sihirbazı olarak da işlev görür.

## Açma

- **Ayarlar** (şerit sekmesi) → **Proje** şerit grubu → **Proje bilgisi**.
- Ayarlar penceresi (dişli ⚙) → **Genel** sekmesi → **Proje bilgileri...**
- **Dosya** → **Proje bilgisi** — Backstage'de, yalnızca meta veri alanlarına sahip basitleştirilmiş bir varyant (Hesaplama bölümü yok).

**Uygula** tüm değişiklikleri tek seferde işler; **İptal**, **Esc** veya pencerenin dışına bir tıklama onları atar. **Enter**, Uygula ile aynı şeyi yapar.

## Meta veri

- **Proje adı** — başlık çubuğundaki ve belge sekmesindeki ad.
- **Açıklama** — serbest metin.
- **Mühendis** ve **Şirket** — serbest metin; IFC dosyasında saklanır.
- **Başlangıç tarihi** — hesaplamanın saydığı proje başlangıcı.
- **Bitiş tarihi** — projenin bilgilendirici bitişi.

## Hesaplama

Bu proje için planlama seçenekleri — uygulamayla değil, dosyayla birlikte saklanır, bu yüzden başka makinelere seyahat ederler. Burada bir şey değiştirirseniz, plan **Uygula**'dan sonra otomatik olarak yeniden hesaplanır.

- **Kritik tanımı** — **Toplam bolluk ≤ eşik** (**Eşik (iş günü)** ile, varsayılan 0) veya **En uzun yol**.
- **Bolluk hesaplaması** — **En küçük (başlangıç/bitiş)** (varsayılan), **Başlangıç bolluğu** veya **Bitiş bolluğu**.
- **Açık uçlu görevler kritik** — ardılı olmayan görevleri kritik olarak işaretler.
- **Kritiğe yakın olarak işaretle** — işaretlemek ekstra bir **Eşik** ortaya çıkarır (varsayılan 2 iş günü; birim Süre gösterimini takip eder, bu yüzden muhtemelen saat): az bolluğu olan görevler "kritiğe yakın" işareti alır.
- **Birden çok bolluk yolu** — işaretlemek **Yöntem**i (**Serbest bolluk (peeling)** veya **Toplam bolluk (sıralama)**) ve **Maks. yol**u (varsayılan 10) ortaya çıkarır: hesaplama daha sonra en önemli bolluk yollarını numaralandırır.
- **Gecikme takvimi** — bir ilişkinin gecikmesini hangi takvimin saydığı: **Öncül** (varsayılan), **Ardıl**, **24 saat** veya **Proje takvimi**.

Bu sonuçların nasıl okunacağı [Kritik yol & ileri düzey analiz](docs://gids-kritiek-pad-analyse)'de ele alınır.

## Proje sihirbazı (Yeni)

**Yeni**, aynı pencereyi bir sihirbaz olarak açar (başlık **Yeni proje**, düğme **Oluştur**). Meta veri alanlarının yanı sıra, sihirbaz şunları içerir:

- **Faz şablonu** — **Boş**, **Konut inşaatı** veya **Ticari yapı / yenileme**: yeni projeyi bir faz yapısıyla doldurur.
- **Vardiya** — yalnızca saat planlaması etkinken görünür: **Gündüz vardiyası** (varsayılan), **2 vardiya**, **3 vardiya** veya **24/7**.
- **Tatil seti** — proje takvimini oluşturur: bir ülke seçin (uygunsa bölge ve inşaat tatiliyle), **Tatil yok**, veya **Özel…** — sonuncusu, takvimi elle oluşturabilmeniz için oluşturmadan hemen sonra takvim iletişim penceresini açar. Bkz. [Takvim iletişim penceresi](docs://ref-kalenderdialoog).

Hesaplama bölümü sihirbazda yoktur; sonradan yukarıdaki girişlerden biri üzerinden ayarlayın.
