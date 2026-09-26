# Kaynak takvimi

**Kaynak takvimi** penceresi, tek bir kaynağın kendi takvimini düzenler — örneğin haftada dört gün çalışan bir ekip. Form, [takvim iletişim penceresi](docs://ref-kalenderdialoog) ile aynıdır; bu makale yalnızca farkları açıklar.

## Açma

- Kaynak panelini açın: **Kaynaklar** → **Yönet** şerit grubu → **Kaynaklar** (tam panel) veya **Kaynak doku** (Gantt'ın yanında sabitlenmiş).
- Bir kaynağın **Takvim** sütununda bir takvim seçin ve onu düzenlemek için yanındaki kalem simgesine (**Düzenle…**) tıklayın; aynı açılır menü üzerinden yeni bir takvim oluşturun.

## Takvim iletişim penceresinden farklar

- **Aynı anda bir takvim** — solda kütüphane listesi yok, proje-varsayılanı yıldızı yok; yalnızca form.
- **Uygula** takvimi kaydeder; **İptal**, **Esc**, kapatma çarpısı veya pencerenin dışına bir tıklama değişiklikleri atar. Açılır listedeki **+ Kaynak takvimi** ile oluşturulan yeni bir takvim ancak **Uygula** ile oluşur ve o anda kaynağa bağlanır (birlikte tek bir Geri Al adımı); **İptal** sonrasında geride hiçbir şey kalmaz. Takvim penceresindeki **+** ile aynı varsayılanla başlar.
- **Otomatik yeniden hesaplama yok** — **Uygula** planı yeniden hesaplamaz. Kaynak takvimi rolünde bir takvim CPM tarihlerini değiştirmez; sırasıyla F5 veya **Dengele…** ile kendiniz yeniden çalıştırdığınız yük (histogram) ve nivellemeye dahildir. Ancak açılır liste projenin tüm takvimlerini sunar: burada aynı zamanda proje takvimi veya bir görev takvimi olan bir takvimi düzenlerseniz plan değişir. Plan o zaman güncel değil olarak işaretlenir ve F5 onu yeniden hesaplar.

## Alanlar

Tam alan referansı için [takvim iletişim penceresi](docs://ref-kalenderdialoog)'ne bakın: **Ad**, **Çalışma günleri** (Pzt–Cum ve Sürekli (24/7) ön ayarlarıyla), **Başlangıç (saat)** / **Bitiş (saat)** / **Günlük saat**, **Çalışma saatleri** bölümü (saat planlaması açıkken), **Tatilleri oluştur…** ve **Tatiller** listesi.

## Daha fazla okuma

- [Takvimler & saat planlaması](docs://gids-kalenders-uren) — bir kaynak takviminin ne zaman doğru seçim olduğu.
- [Kaynaklar, histogram & nivelleme](docs://gids-resources-histogram) — takvimin yük ve nivellemeye nasıl beslendiği.
