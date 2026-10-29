# Uzantı kurma ve yönetme

Hedef: bir uzantı kurmak, izin sorusunu okumak ve daha sonra uzantıyı devre dışı bırakmak veya kaldırmak.

## Bu bilgiye ne zaman ihtiyacınız olur

Bir uzantı, yeni bir sürümü beklemeden uygulamaya bir şey ekler. Bir uzantı örneğin *Dosya › İçe aktar* içinde görünen bir içe aktarma biçimi ekleyebilir, şeride bir düğme koyabilir veya PDF dışa aktarımı için bir yazı tipi sağlayabilir. Resmi katalog uzantıları kategorilere ayırır: *İçe aktarma/Dışa aktarma*, *Planlama*, *Rapor*, *Yardımcı*, *Yazı tipleri* ve *Diğer*.

Kurmadan önce dikkatli düşünün. Bir uzantı, uygulamanın kendisiyle aynı haklarla çalışan program kodudur. Uygulama bunu sınırlayamaz. Bu yüzden uygulama her kurulumda izin ister. Bu soruda gördükleriniz aşağıda açıklanmıştır.

## Adımlar

### Katalogdan bir uzantı kurun

1. *Dosya › Uzantılar* öğesini seçin.
2. *Gözat* sekmesini seçin. Uygulama katalogu alırken *Katalog yükleniyor...* yazar. Katalogda ne olduğuna, onu yöneten OpenAEC Foundation karar verir. Bu değişebilir.
3. *Uzantı ara...* alanında bir uzantı arayın. Uygulama adda, açıklamada, yazarda ve etiketlerde arar.
4. Her kart adı, sürümü, kategoriyi, açıklamayı ve yazarı gösterir. *Kur* öğesini tıklayın.
5. *Uzantı kurulsun mu?* penceresi açılır. Pencereyi okuyun, sonraki adıma bakın.
6. Devam etmek için *Yükle* öğesini tıklayın. *Kurma* öğesiyle hiçbir şey olmaz. Esc tuşu veya pencerenin yanına tıklamak da reddetmek anlamına gelir. Uygulama o zaman hata mesajı göstermez.

Kurulumdan sonra uzantı hemen etkinleşir. *Gözat* içindeki kartta artık *Yüklü* yazar. Uzantının ne eklediğini uygulamanın içinde görürsünüz: şeride eklenen yeni bir düğme veya *Dosya › İçe aktar* içinde bir içe aktarma biçimi. Bazı uzantılar ayrıca bir mesaj gösterir. Bunu *Uzantı* önekiyle ve ardından uzantının adıyla tanırsınız.

**Eğitimler.** Eğitimler bir uzantıdır. *Yardım* içinde *Eğitimler* altındaki *Eğitimleri yükle* düğmesini görürseniz, bu *Dosya › Uzantılar* öğesini *Gözat* sekmesinde açar. İlk turdan sonra çıkan soru da bu uzantıyı kurar. İki yol da aynı izin sorusunu gösterir; bunu reddedebilirsiniz.

### Bir dosyadan uzantı kurun

Uzantıyı bir dosya olarak aldıysanız, onu şöyle kurun.

1. *Dosya › Uzantılar* öğesini seçin.
2. Sağ üstte bir ZIP dosyası için *ZIP*, ayrı bir JavaScript dosyası için *JS* öğesini tıklayın.
3. Dosyayı seçin. Yukarıdaki gibi *Uzantı kurulsun mu?* penceresi açılır.

Bir ZIP dosyasında `manifest.json` ve uzantının ana dosyası bulunmalıdır. Zaten kurulu bir uzantıyı kurarsanız, yeni sürüm eskisinin yerine geçer. Uygulama dosyayı kuramazsa, örneğin ZIP dosyası bozuk olduğu için, hiçbir şey olmaz: uygulama ZIP ve JS için hata mesajı göstermez ve uzantı listede görünmez. Nedeni yine de hata ayıklama terminalinde yazar. Terminali *Ayarlar › Proje › Uygulama ayarları* yolunda etkinleştirin. Orada *Gelişmiş* sekmesini seçin ve *Hata ayıklama terminalini etkinleştir* öğesini işaretleyin. Durum çubuğundaki *Hata ayıklama terminalini göster* düğmesiyle terminali gösterin. Orada örneğin şu satır yazar: *[Extensies] ZIP-installatie mislukt: Error: Geen manifest.json gevonden in ZIP* (Uygulama bu teknik metni Hollandaca yazar).

### İzin sorusunu okuyun

Soru, neyi karar vermeniz gerektiğini gösterir.

- *Yazar* ve *Depo*, uzantıyı kimin yaptığını ve kaynak kodun nerede olduğunu gösterir.
- *Kaynak*, dosyanın nereden geldiğini ve kontrol edilip edilmediğini gösterir. Kırmızı yazıyla indirmenin doğrulanmadığı yazarsa, yalnızca kaynağı biliyorsanız kurun.
- *Neye evet diyorsunuz* bölümü, uzantının uygulamanın kendisiyle aynı haklarla çalışan program kodu olduğunu ve bunun platformunuzda ne anlama geldiğini tekrarlar. Yalnızca yazarına güvendiğiniz uzantıları kurun.
- *Bu uzantının kullandığını belirttikleri* bölümü, yazarın bildirdiği izinleri küçük etiketler olarak gösterir. Bu bir beyandır, bir kısıtlama değildir. *Hiçbir şey belirtilmemiş.* yazarsa, uzantı yine de planlamanızın verilerini okuyabilir ve değiştirebilir.

Her etiketin anlamı ve pencerenin tam metinleri [Uzantı izinleri](docs://ref-extensiepermissies) bölümünde yer alır.

### Bir uzantıyı devre dışı bırakın, yeniden etkinleştirin veya kaldırın

1. *Dosya › Uzantılar* öğesini seçin ve *Yüklü* sekmesini seçin. Her uzantının adı, sürümü, kategorisi, açıklaması ve yazarı olan bir kartı vardır.
2. Karttaki anahtarla uzantıyı devre dışı bırakırsınız (*Devre dışı bırak*) veya yeniden etkinleştirirsiniz (*Etkinleştir*). Devre dışıyken uzantının eklediği düğmeler ve içe aktarma biçimleri kaybolur, ama uzantı yine de kurulu kalır. Uygulamayı yeniden başlattıktan sonra da kapalı kalır. Etkin bir uzantı, uygulama başladığında kendiliğinden başlar.
3. *Kaldır* öğesini tıklayın. Düğme *Onayla* olur ve *Kalıcı olarak kaldırmak için tekrar tıklayın* açıklaması görünür. Uzantıyı kalıcı olarak kaldırmak için bir kez daha tıklayın. Uygulama, uzantının sakladığı ayarları da temizler.

## Sorunlar ve uygulamanın o durumda ne yaptığı

**Katalog yüklenmez.** Uygulama *Katalog yüklenemedi:* yazar ve ardından teknik nedeni gösterir. Ayrıca *Tekrar dene* düğmesi görünür. Bunun nedeni internet bağlantınızın olmaması olabilir.

**Katalogdaki bir kartın altında *Kurulum başarısız.* yazar.** İndirme veya kurulum başarısız oldu, örneğin sağlama toplamı eşleşmediği için. O durumda hiçbir şey kurulmadı. Bu, soruyu reddetmekten farklıdır. Soruyu reddettiğinizde hata mesajı yoktur.

**Listenin üstünde *Atlanan katalog girdileri: 1* yazar.** Katalogda uygulamanın kullanamadığı bir öğe vardı. Diğer uzantıları her zamanki gibi kurabilirsiniz.

**Bir uzantı başlamaz.** Kartta o zaman bir hata mesajı görünür. Bu bir hata mesajı olabilir: uzantı uygulamanın daha yeni bir sürümünü gerektirir ve mevcut sürümünüz gösterilir. Ya da uzantının kendi hatası görünür. Uzantı o zaman etkin değildir. Uygulamayı güncelleyin veya uzantıyı kaldırın.

**Bir kart *Karantina* ile işaretlenmiştir.** Uygulama saklanan uzantıyı kullanamadı. Adın altında *Neden:* yazar ve ardından neden gelir. *Depolamadan kaldır* ile temizlersiniz.

**Kendiniz bir uzantı yazmak.** Uzantı yazarları için kılavuz (manifest, API, izinler) GitHub'da `OpenAEC-Foundation/open-planner-studio` deposunda, `docs/extensions.md` dosyasında bulunur.

**Bir uzantı bir projeye ait değildir.** Uzantılar uygulamanın içinde saklanır. Masaüstü uygulamasında bu bilgisayarda, tarayıcıda ise o tarayıcının depolamasında saklanır. Uzantılar tüm projelerinizde geçerlidir ve proje dosyanızın parçası değildir. Tarayıcıda sitenin verilerini silerseniz uzantılar da gider.

## Ayrıca bakın

- [Uygulamayı güncelleme](docs://howto-app-bijwerken): bir uzantı uygulamanın daha yeni bir sürümünü isteyebilir.
- [Uzantı izinleri](docs://ref-extensiepermissies): kurulum sorusundaki her iznin ne anlama geldiği.
