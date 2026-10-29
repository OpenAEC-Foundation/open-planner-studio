# Saat planlamasını açma

Hedef: görevleri çalışma saatleri içinde planlamak; gün cinsinden planlanan görevlerin yanında.

## Ne zaman gerekli

Bir vinci saat başına kiralıyorsunuz, gün başına değil. Altı saatlik bir döküm, tam bir iş gününe sığmaz. Gece ekibi, gündüz ekibinden farklı saatlerde çalışır. Bu tür inşaat çalışması için saat cinsinden bir süre ve saat bilgisiyle bir başlangıç ve bitiş istersiniz. Bir dosya açar ve uygulama *Bu dosya saat bazlı planlama içeriyor.* bildirirse, bunu da etkinleştirirsiniz. Uygulamanın günleri ve saatleri neden farklı saydığını şu bağlantıda okuyabilirsiniz: [Gün ve saat](docs://uitleg-dagen-en-uren).

## Adımlar

### Saat planlamasını etkinleştirme

1. *Ayarlar › Proje › Uygulama ayarları* seçin ve *Planlama* sekmesini açın.
2. *Saat planlaması* altında *Saat planlamasını etkinleştir* kutusunu işaretleyin. Bu hemen çalışır. *Bu dosya saat bazlı planlama içeriyor.* mesajındaki *Saat planlamasını etkinleştir* düğmesi aynı işi yapar.
3. Bunun altında *Karma gün/saat planlamasına izin ver* seçeneği vardır; varsayılan olarak açıktır. Bu seçenekle her görev için gün mü saat mı sayılacağını siz seçersiniz. Bunu kapatırsanız *Süre birimi* listesi kaybolur. Bu durumda süreyi yine de birimiyle yazabilirsiniz, örneğin `12h`.

Bu, bir görevin süresinden fazlasını değiştirir: *Görünüm › Zaman ölçeği* altında *Saat* ölçeğini seçebilirsiniz; *Takvimler* penceresinde normal bir takvim bir *Çalışma saatleri* bandı alabilir (zaten bandı olan bir takvim bunu her zaman gösterir); *Yeni proje* penceresinde *Vardiya* ve *Yeni görevler için varsayılan birim* seçenekleri çıkar.

### Bir görevi saat cinsinden planlama

1. Görevi seçin ve *Özellikler* panelinde, *Zaman* altındaki *Süre* alanına bakın.
2. Süreyi birimiyle yazın ve Enter tuşuna basın: `12h` (`12u`, Hollandaca kısaltma, bu da çalışır) on iki saat için, `1h 30m` bir buçuk saat için. `1.5h` de olur. Birimi olmayan bir sayı, görevin zaten sahip olduğu birimde sayılır.
3. Mevcut bir görevi dönüştürmek istiyorsanız *Süre birimi* altında *Saat* birimini seçin. Uygulama süreyi hemen dönüştürür, örneğin `2` günden `16` saate. Geri dönmek için *Geri al* kullanın.
4. Gün cinsine geri dönebilirsiniz: `2d` yazın veya *Gün* birimini seçin.
5. **Hesapla** (F5) çalıştırın, örneğin *Ana sayfa › Zamanlama › Hesapla* yolunu kullanarak. Görevin artık saat bilgisiyle bir başlangıcı ve bir bitişi vardır.
6. Saatleri Gantt'ta görmek istiyorsanız *Görünüm › Zaman ölçeği* altındaki listeden *Saat* ölçeğini seçin.

### Yeni görevler varsayılan olarak saat cinsinden

1. *Ayarlar › Proje › Proje ayarları* seçin.
2. *Yeni görevler için varsayılan birim* altında *Saat* birimini seçin ve *Uygula* düğmesine tıklayın.

Yeni bir görev o zaman 5 gün yerine 5 saatle başlar. Mevcut görevler değişmez. Yeni bir projede aynı seçim *Yeni proje* penceresinde bulunur. Orada *Vardiya* altında *Gündüz vardiyası* seçerseniz *Saat* devre dışı kalır. Başka bir vardiya seçin ya da projeyi oluşturduktan sonra *Proje ayarları* içinde varsayılan birimi ayarlayın.

## Sorunlar ve uygulamanın o durumda yaptıkları

**Geçerli çalışma saati yok.** Görevin takvimi kullanılabilir çalışma saatleri içermiyorsa uygulama şunu bildirir: *Bu takvimde geçerli çalışma saatleri yok. Çalışma günlerini ve saatlerini kontrol edin.* Hesaplarken *'name' saat görevinin takviminde geçerli çalışma saatleri yok* mesajı da görünebilir.

**Günlerle ondalık sayı yok.** Gün cinsinden bir süre tam sayıdır. `1.5d` yazarsanız *2d veya 12h gibi tam gün ya da saat sayısı girin.* mesajı çıkar. Bir buçuk gün istiyorsanız saat cinsinden hesaplayın.

**Tam olarak yapılamayan bir dönüşüm.** On iki saat, 8 saatlik tam günlere sığmaz. *Özellikler* panelinde ve *Görevi düzenle* penceresinde uygulama sarı bir kutu içinde şunu gösterir: *12h bu takvimde tam günlere karşılık gelmiyor. Birim değişmedi.* Birimi değiştirmez. Görev tablosu daha kısa bir mesaj gösterir: *Bu süre diğer birime tam olarak dönüştürülemiyor.*

**Alan devre dışıdır.** Bir faz, bir hamak veya süresi sıfır olan bir kilometre taşında süre başka bir şeyden belirlenir ve süreyi siz yazamazsınız.

**Saat planlamasını yeniden kapatma.** Saat cinsindeki görevler kalır ve hesaplanmaya devam eder. Bu durumda sürelerini düzenleyemezsiniz; alanda *Bu saat görevini düzenlemek için saat planlamasını etkinleştirin.* yazar ve bunun yanında onu yeniden açmak için bir düğme bulunur.

## Ayrıca bakın

- [Gün ve saat](docs://uitleg-dagen-en-uren): uygulamanın saatleri nasıl saydığı, günler ve saatler bir araya geldiğinde ne olduğu ve nerede yuvarlama yaptığı.
- [Çalışma saatlerini ayarlama](docs://howto-werktijden-instellen): bir takvimin çalışma saatleri, haftanın her günü için.
- [İlişki ekleme](docs://howto-relaties-leggen): iki görev arasında saat cinsinden bir gecikme.
- [Uygulama ayarları](docs://ref-instellingen): Saat planlamasını etkinleştir ayarı ve bu ayarın başka neyi değiştirdiği.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): saat cinsinden görevler içerir (donatı bağlama ve döküm), kendi saat takvimiyle birlikte: *Hourly calendar, rebar fixing & pouring*.
