# Bir eğriyle kaynak atama

Hedef: bir kaynağı bir göreve atamak. Günlük birim ve bir eğri ile bu birimlerin görevin günlerine nasıl yayılacağını belirlersiniz.

## Ne zaman gerekir

Kimin nerede ve ne zaman çalıştığını görmek istediğiniz anda: outer cavity leaf'teki duvarcı, boşluklu döşeme elemanlarındaki vinç. Atama olmadan yük olmaz ve bu nedenle histogram veya aşırı atanmışlık da görünmez.

İki terim var. **Birim** (panelde *Birim* sütunu, *Ata* penceresinde *Birim/gün* alanı) kaynağın görev üzerinde her iş gününde ne kadar çalıştığını gösterir: 1 bir duvarcıdır, 2 bunların ikisidir, 0,5 yarım gündür. **Eğri**, toplamın, yani birim çarpı süre değerinin, görevin iş günlerine nasıl yayılacağını belirler. İş nadiren eşit dağılır: bir duvarda başlangıç sakindir, orta kısım yoğundur ve son yine sakindir.

outer cavity leaf 6 iş günü sürer. Bir duvarcı ve *Tekdüze* eğri ile bu, 6 günün her birinde 1 birim, toplamda 6 birim demektir. *Çan eğrisi* ile toplam yine 6 birimdir, ama dağılım 0, 1, 2, 2, 1 ve 0 olur.

## Adımlar

Bir kaynağı iki yolla atayabilirsiniz. Kaynak önceden var olmalıdır (bkz. [Kaynakları yönetme](docs://howto-resources-beheren)).

### Şerit üzerinden

1. Görev tablosunda bir görev seçin. Bu, normal bir görev olmalıdır; kilometre taşı veya faz olamaz.
2. *Kaynaklar › Atama › Ata ▾* öğesini seçin.
3. Pencerede *Birim/gün* alanını doldurun (varsayılan 1) ve *Eğri* ayarını seçin (varsayılan *Tekdüze*). Bu ayarlar, şimdi seçeceğiniz kaynak için geçerlidir.
4. Kaynağa tıklayın. Pencere kapanır ve atama eklenmiş olur.

İkinci bir kaynak için pencereyi yeniden açın. Görevde zaten bulunan kaynaklar listede yer almaz.

### Özellikler paneli üzerinden

1. Görevi seçin. *Özellikler* paneli sağda yer alır. Bu paneli görmüyorsanız, *Görünüm › Paneller › Özellikler* ile açın.
2. *Atamalar* bölümünde, en altta, *Kaynak ata* öğesinde kaynağı seçin. Atama, 1 birim ve *Tekdüze* eğri ile başlar.
3. Her atama için *Birim* değerini değiştirin. Kaynağın adına tıklayın, *Eğri* görünür ve orada başka bir eğri seçin.

Mevcut bir atamayı da böyle değiştirirsiniz. Satırın sonundaki çöp kutusuyla (*Kaldır*) atamayı görevden çıkarırsınız. Kaynağın kendisi kalır. Kaynağın adına tıklayınca görünen *Taşı…* ile atamayı başka bir göreve taşırsınız.

### Eğriler

- *Tekdüze*: Her gün aynı. Bu varsayılan değerdir ve her gün eşit yoğun olan işe uygundur.
- *Başta yüklü*: Başlangıç, sondan daha yoğundur. Ağır bir girişle başlayan işe uygundur, örneğin aplikasyon.
- *Sonda yüklü*: Son, başlangıçtan daha yoğundur. Tamamlanmaya doğru yoğunlaşan işe uygundur.
- *Çan eğrisi*: Ortada bir zirve, başı ve sonu sakin. Sakin başlayan, ortada tam hızda olan ve sonra yavaşlayan bir duvara uygundur.
- *Erken zirve*: Ortadan önce bir zirve. Hızlıca tam hıza ulaşan işe uygundur.
- *Geç zirve*: Ortadan sonra bir zirve. Yoğun olduğu zaman ancak geç gelen işe uygundur.
- *Çift zirve*: İki zirve. İki yoğun ana sahip işe uygundur.
- *Kaplumbağa*: Sakin bir başlangıç ve son, ortada geniş bir zirve. Uzun süren ve yavaş yavaş yoğunlaşıp yavaş yavaş azalan işe uygundur.

Eğri yalnız dağılımı değiştirir. Süre, tarihler ve toplam aynı kalır. Daha sonra yeniden hesaplamanız gerekmez. Histogram hemen güncellenir. Bunu görmek için *Kaynaklar › Histogram › Histogram* öğesini seçin. Bir görev seçerseniz, histogram yalnız o görevin yükünü gösterir.

## Sorunlu durumlar ve uygulamanın o durumda yaptıkları

**Bir eğri zirveyi birimlerinizin üzerine çıkarabilir.** Birim tam sayı ise, uygulama günlük değeri tam birimlere yuvarlar ve toplam aynı kalır. outer cavity leaf'te birim 1 olan bir duvarcı ve *Çan eğrisi* 0, 1, 2, 2, 1, 0 verir. Ortadaki iki günde bu, *Maks. birim* değeri 1 iken 2 birim demektir. Histogram bu günleri kırmızıyla gösterir ve kaynak aşırı atanmış sayılır. Başka bir eğri seçin ya da saatleri kendiniz dağıtın (bkz. [Saat dağılımını ayarlama](docs://howto-urenverdeling-aanpassen)). 0,5 gibi birimlerde uygulama yüzde birler düzeyinde yuvarlar. Tam birimli kısa bir görevde şekil bu nedenle kabalaşır: 10 günde birim 1 ile *Kaplumbağa*, dağılım olarak 0, 1, 1, 2, 2, 1, 1, 1, 1, 0 verir. Bu, tam olarak *Erken zirve* ile aynıdır.

**Kilometre taşı veya faz yok.** O zaman *Ata* düğmesi devre dışıdır ve *Özellikler* şunu gösterir: *Kilometre taşlarında atama yapılamaz.* veya *Özet görevlerde atama yapılamaz.*

**Bir kaynak bir görevde yalnız bir kez bulunur.** Kaynak görevde zaten varsa, artık listede yer almaz. Tüm kaynaklar zaten görevdeyse, uygulama *Tüm kaynaklar zaten atanmış.* der. Henüz kaynak yoksa, *Önce kaynak oluşturun (Kaynaklar sekmesi).* der.

**Birim 0'dan büyük olmalıdır.** Uygulama 0 veya daha küçük bir değeri kabul etmez.

**Malzeme.** Malzeme kaynağında birim, günlük miktardır ve kaynağın birimiyle yazılır, örneğin m³. Malzeme, görevin süresine dahil edilmez.

**Bir görev türü süreyi ayarlayabilir.** Görev *Sabit iş* veya *Sabit birimler* türündeyse, ikinci bir kaynak görevin süresini değiştirir. Planlama o zaman güncel değildir; **Hesapla** (F5) düğmesine basın. Bkz. [Görev türleri: süre, birim ve iş](docs://uitleg-werkregels).

**Kendi dağılımı.** Atamanın zaten kendi saat dağılımı varsa, eğri devre dışı olur ve *Kontur* gösterir. Önce o dağılımı *Saat dağılımı…* ile serbest bırakın.

**Geri alma.** Bir atamayı oluşturmayı, değiştirmeyi veya kaldırmayı *Geri al* (Ctrl+Z) ile geri alabilirsiniz.

## Ayrıca bakın

- [Saat dağılımını ayarlama](docs://howto-urenverdeling-aanpassen): günlük saatleri kendiniz ayarlama.
- [Aşırı atanmışlığı çözme](docs://howto-overbezetting-oplossen): bir kaynağın bir günde çok işi olduğunda ne yapılacağı.
- [Görev türleri: süre, birim ve iş](docs://uitleg-werkregels): birimleri değiştirdiğinizde süreye ne olduğu.
- [Kaynak paneli](docs://ref-resourcepaneel): kaynak panelindeki tüm alanlar ve düğmeler.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): beş kaynak türünün tümü, sekiz eğriden altısı ve 30 Ağustos 2027'den itibaren kapasite basamağı olan bir kule vinç.
