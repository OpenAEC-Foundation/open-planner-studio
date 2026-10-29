# Çökmeden sonra kurtarma

Hedef: uygulama veya tarayıcınız beklenmedik şekilde durduysa ve kaydetmediyseniz, çalışmanızı geri kazanmak.

## Ne zaman gerekir

Dizüstü bilgisayarınız kapandı, uygulama dondu veya tarayıcı sekmesi çöktü. Son değişiklikleri henüz kaydetmediniz. Bir yerde bir değişiklik yapıldığında uygulama, açık olan tüm projelerinizin kurtarma kopyalarını arka planda tutar. Bu, en fazla on saniyede bir olur. Bu kopya, proje dosyanızdan ayrıdır. Kaydetme ile Otomatik kaydet arasındaki farkı [Dosyalar ve biçimler](docs://uitleg-bestanden) bölümünde okuyabilirsiniz.

## Adımlar

1. Uygulamayı yeniden başlatın. Tarayıcıda aynı sekmeyi yenilersiniz. Kurtarma kopyası o tek sekmeye aittir.
2. Uygulama kopya bulursa *Kaydedilmemiş çalışmayı geri yükle* penceresi açılır: *Open Planner Studio normal şekilde kapanmadı. Aşağıdaki belgelerde geri yüklenebilecek kaydedilmemiş değişiklikler vardı:* Her proje için ad gösterilir. Projenin bir dosyası varsa dosyanın yolu da gösterilir. Tarayıcıda yalnızca dosya adı gösterilir. Görev sayısı ve kopyanın zamanı gösterilir, örneğin *21 görev* ve *Kaydedildi: Sep 29, 2026 9:41 AM*. Saat, *Saat biçimi* ayarınıza göre gösterilir. Pencerede ayrıca değiştirmediğiniz projeler de görünebilir.
3. *Geri yükle* öğesini seçin. Uygulama listedeki tüm projeleri, her biri ayrı bir sekmede, son kopyanın durumuyla açar. Enter tuşu aynısını yapar.
4. Projelerinizi kontrol edin ve hemen Ctrl+S ile kaydedin.

Geri yüklemek istemiyorsanız iki seçeneğiniz vardır. *Geri yükleme* kopyaları siler. Bunu geri alamazsınız. Pencereyi Escape tuşuyla, çarpı işaretiyle veya yanına tıklayarak kapatırsanız kopyalar kalır. Uygulama bir sonraki başlatmada yeniden sorar.

Pencerenin sağ üstündeki soru işareti, bir seçim yapmadan bu makaleyi açar. Yardımda okurken pencere bekler. Geri döndüğünüzde pencere yeniden görünür. Hâlâ geri yükleyebilirsiniz.

## Dikkat edilmesi gerekenler ve uygulamanın o durumda yaptıkları

**Son kopyanın durumunu geri kazanırsınız.** Çökmeden önceki son saniyelerde yaptıklarınız eksik olabilir. Değişikliği olan bir proje yeniden *Kaydedilmedi* olarak işaretlenir. *Geri al* geçmişi boştur. Çökmeden önceki adımları geri alamazsınız. Yakınlaştırma, kaydırma konumu ve seçim yeniden oluşturulur.

**Masaüstünde kurtarılan proje dosyasını korur, tarayıcıda korumaz.** Masaüstünde *Kaydet*, kurtarılan durumla birlikte özgün dosyaya yazar. Tarayıcıda kurtarılan proje artık dosyasına bağlı değildir. *Kaydet* dosyanın nereye kaydedileceğini sorar. Ayrıca *Otomatik kaydet* anahtarı, projeyi bir kez kaydedene kadar gri görünür.

**Görünümü *Kaydedildiği gibi tarihler* olan bir proje o görünümde kalır.** Bkz. [Kaydedildiği gibi tarihler](docs://uitleg-datums-zoals-opgeslagen).

**Masaüstünde pencere her başlatmada görünmez.** Kurtarma kopyaları uygulamanın veri klasöründe bulunur. Bunlar, adı *recovery* ile başlayan IFC dosyalarıdır. Uygulamayı normal yolla kapatırsanız, kendi kopyalarını siler. Bu yüzden pencere şu durumlarda görünür: beklenmedik bir sonlanmadan sonra, bir uygulama güncellemesi için yeniden başlattıktan sonra veya bir önceki başlatmada kurtarmayı ertelediyseniz.

**Tarayıcıda kopya sekme başına tutulur.** Kopya tarayıcının depolama alanındadır. Yeni bir sekme veya pencere, başka bir sekmenin kopyalarını sunmaz. Artık var olmayan sekmelerin kopyaları, uygulama yeniden kopya yazmaya başlar başlamaz yedi gün sonra silinir.

**Tarayıcıda pencere normal bir yenilemeden sonra da görünür.** Bu, her şeyi kaydetmiş olsanız bile olur. Yenilemeden hemen önce kaydettiyseniz ve ondan sonra hiçbir şey değiştirmediyseniz, *Geri yükleme* seçeneğini güvenle seçebilirsiniz. Dosyanız günceldir.

**Pencere görünmez.** Bu durumda uygulama hiç kopya bulmamıştır. Bu, şu durumlarda olur: henüz hiçbir şey değiştirmediyseniz, tarayıcıda yeni bir sekme kullanıyorsanız, kurtarmayı daha önce *Geri yükleme* ile attıysanız veya çökme uygulama ilk kopyayı tutmadan önce geldiyse. İlk kopya, ilk değişikliğinizden sonra yaklaşık on saniyeye kadar sürebilir.

**Bir kopya bozuk.** Uygulama, nedenini de vererek *Kurtarılan dosya okunamadı* mesajını gösterir ve diğer projeleri sunar. *Geri yükle* seçerseniz, uygulama bundan sonra okunamayan kopya dahil tüm kopyaları siler. Hiçbir kopya okunamıyorsa pencere görünmez ve kopyalar korunur.

**Geri yükleme başarısız olur.** Uygulama nedenini de vererek *Geri yükleme başarısız* mesajını gösterir. Kopyalar kalır ve soru bir sonraki başlatmada yeniden çıkar.

**Bazı projeler yüklenemez.** Uygulama şunu gösterir: *2 kurtarma dosyası yüklenemedi ve atlandı.* Tek bir dosya için *1 kurtarma dosyası yüklenemedi ve atlandı.* yazar. Diğer projeler geri yüklenir. Bir şey atlandığı için tüm kopyalar kalır. Pencere bir sonraki başlatmada aynı listeyle yeniden görünür. Kurtarılabilen her şeyi zaten geri kazandıysanız *Geri yükleme* seçeneğini seçin.

## Ayrıca bakın

- [Dosyalar ve biçimler](docs://uitleg-bestanden): kaydetme, Otomatik kaydet ve çökme kurtarma yan yana.
- [Otomatik kaydetmeyi açma](docs://howto-automatisch-opslaan): uygulamanın dosyanızı kendisinin güncellemesine izin verme.
- [Bir dosyayı açma ve kaydetme](docs://howto-bestand-openen-en-opslaan): kurtardıktan sonra kaydetme.
- [Kaydedildiği gibi tarihler](docs://uitleg-datums-zoals-opgeslagen): o görünümdeki bir projeyle ne olur.
