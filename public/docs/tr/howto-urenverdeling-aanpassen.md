# Saat dağılımını ayarlamak

Hedef: standart bir eğri kullanmak yerine, bir atama için kaynağın görevin her iş gününde ne kadar çalışacağına kendiniz karar verin.

## Bunu ne zaman kullanırsınız

*Çan eğrisi* gibi bir eğri sabit bir şekildir. Bazen kendiniz daha iyi bilirsiniz. Duvarcı, iskele hâlâ kurulduğu için dış boşluklu duvar yaprağında yarım güçle başlar. Sonra tam zamanlı çalışır. Ya da bir zirveyi kapasitenin hemen altında tutmak istersiniz. Bu durumda **saat dağılımını** ayarlarsınız.

**Aşamalarla** çalışırsınız: kaynağın aynı birimle çalıştığı ardışık iş günleri. Dağılım yalnızca bu tek atamanın günlük saatlerini değiştirir. Görevin tarihleri değişmez.

## Adımlar

Örnek, dış boşluklu duvar yaprağıdır: 6 iş günü, bir duvarcı, 48 saat.

1. Görevi seçin. *Özellikler* paneli sağdadır. Bu paneli görmüyorsanız, *Görünüm › Paneller › Özellikler* ile açın.
2. *Atamalar* bölümünde duvarcının adına tıklayın. Adın altında *Eğri* açılır listesi ve *Saat dağılımı…* düğmesi görünür. *Saat dağılımı…* öğesine tıklayın. *Aşamalara göre saat dağılımı* penceresi açılır. Uygulamanın şu an ayırdığı değerlerle başlarsınız: bu dış boşluklu duvar yaprağı için 6 günlük, birimi 1 olan tek bir aşama.
3. Gerekirse, *Şekil uygula:* alanından bir başlangıç noktası seçin. *Çan eğrisi* seçilirse uygulama beş aşama oluşturur: ilk ve son günde 0,18 birim, ikinci ve beşinci günde 0,84 birim ve ortadaki iki günde 1,98 birim. Toplam 48 saat kalır.

### Aşamaları ayarlamak

Tabloda veya onun üstündeki şeritte çalışabilirsiniz.

- Bir aşamaya başka bir *Efor (birim/gün)* değeri yazın. *Saat/gün* ve *Saat* sütunları buna göre birlikte hesaplanır.
- Bir aşamanın *Gün* sayısını değiştirin. Son aşama her zaman görevin sonuna kadar sürer ve kalan günleri alır.
- Bir aşamayı ikiye bölmek için *Böl* öğesini seçin; bu, 6 günü 3 ve 3 olarak böler. Bir aşamayı sonrakiyle birleştirmek için *Birleştir* öğesini seçin.
- Şeritte bir sınırı sürükleyerek bir aşamayı uzatır veya kısaltırsınız. Üst kenarı sürükleyerek efor ayarlarsınız. Bir güne çift tıklayarak aşamayı bölersiniz.

### Uygulama

*Uygula* öğesini seçin. *İptal* öğesini seçerseniz pencere, değişiklik yapmadan kapanır.

Bir örnek. *Böl* öğesini seçersiniz. İlk aşamanın *Gün* değerini 2 olarak ve bu aşamanın eforunu 0,5 olarak ayarlarsınız. İkinci aşama bu durumda 4 gün sürer, efor 1 olur. Toplam 2 × 0,5 × 8 + 4 × 1 × 8 = 40 saattir.

*Uygula* öğesinden sonra atamanın eğrisi *Kontur* olarak ayarlanır ve devre dışı kalır. *Birim* eski hâlinde kalır. Atama daraltılmış olsa da adının yanında artık bir çubuk grafik simgesi görünür. Histogram ve aşırı atanmışlık hemen yeni dağılıma göre güncellenir. Yeniden hesaplama gerekmez, çünkü hiçbir tarih değişmez.

### Dağılımı kaldırmak

Atamanın kendi dağılımı varsa pencerede ayrıca *Dağılımı kaldır* bulunur. Bu, kendi dağılımınızı kaldırır. Uygulama o zaman *Birim* ve eğriye geri döner. Eğriyi değiştirmek istiyorsanız da bunu seçin, çünkü kendi dağılımı olduğu sürece *Eğri* açılır listesi devre dışıdır.

## Dikkat edilecek noktalar ve uygulamanın o durumda yaptıkları

**Toplam da değişir.** Saatleri bölmezsiniz, onlara kendiniz karar verirsiniz. Bir aşamayı 0,18 yerine 0,5 olarak ayarlarsanız toplam büyür. Saat cinsinden toplam pencerenin altındadır. Bu yüzden *Uygula* öğesini seçmeden önce kontrol edin.

**Birimlerin sonrasında ne yaptığı görev türüne bağlıdır.** *Sabit süre ve birimler* ile diğer *Birim* değerleri dağılımı hiçbir şekilde değiştirmez. *Sabit süre ve iş* ile uygulama, yeni birimlerle birlikte günlük saatleri ölçekler: birimler 1 yerine 2 olduğunda her gün iki katına çıkar ve toplam da (32 saatten 64 saate) iki katına çıkar; süre aynı kalır. *Sabit iş* ile birimler görevin süresini değiştirir: dağılım o zaman yeni süreye sıkıştırılır veya uzatılır, toplam aynı kalır. *Sabit birimler* ile birimler süreyi de değiştirir; sonrasında pencerenin altındaki toplamı kontrol edin.

**Görevin süresini değiştirirseniz, dağılım onunla birlikte uzar.** Şekil aynı kalır. *Sabit süre ve birimler* ve *Sabit birimler* ile toplam süreyle orantılı olarak artar: kendi dağılımı olan bir görevin süresi 4 iş gününden 8 iş gününe çıkarsa, toplam da 32 saatten 64 saate iki katına çıkar. *Sabit süre ve iş* ve *Sabit iş* ile toplam aynı kalır (32 saat yine 32 saattir) ve birimler düşer.

**İş dağılımı izler.** *İş (sa)* sizin aşamalarınızın toplamı olur, *Sabit iş* ile de. Görevin süresi bu yüzden değişmez.

**Geçersiz birim değerleri.** Boş veya negatif bir efor kırmızı bir kenarlık alır ve *Uygula* o zaman devre dışı kalır. Efor 0 olan bir aşamaya izin verilir. Böyle bir aşama görevin süresi içinde kalır.

**Her şey yalnızca bu tek atamayı etkiler.** Uygulama bunu kendisi de söyler: *Dağılım yalnızca bu atamanın günlük saatlerini değiştirir; görevin tarihleri ve bölmeleri olduğu gibi kalır.* Aynı görevdeki diğer kaynaklar kendi dağılımlarını korur.

**Dengeleme dağılımı izler.** Dengeleyici, histogramla aynı günlük saatleri sayar.

**Geri almak.** *Uygula* ve *Dağılımı kaldır* her biri, *Geri al* (Ctrl+Z) için ayrı bir adımdır.

## Ayrıca bakın

- [Kaynakları bir eğriyle atamak](docs://howto-resource-toewijzen): bir kaynağı bir göreve koymak ve bir eğri seçmek.
- [Aşırı atanmışlığı çözmek](docs://howto-overbezetting-oplossen): bir kaynağın bir günde çok işi olduğunda ne yapmanız gerektiği.
