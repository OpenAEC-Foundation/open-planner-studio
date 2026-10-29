# Kodlar ve özel alanlar

Doel: görevlerinize kendi sınıflandırmalarınızı (etkinlik kodları, örneğin *Lokasyon*) ve kendi alanlarınızı (örneğin *Yüklenici*) ekleyin.

## Bunu ne zaman kullanırsınız

Görevin sabit verilerine (ad, süre, ilişkiler, …) ek olarak kendi verilerinizi ekleyebilirsiniz. Görevleri kuzey kanadı ve güney kanadına, disipline göre sınıflandırmak veya bir görevi hangi yüklenicinin yaptığını izlemek istiyorsanız, bunu kendiniz kaydedersiniz. Bunun iki yolu vardır ve aradaki fark önemlidir.

Bir **etkinlik kodu**, sabit bir seçim listesi olan bir sınıflandırmadır. Bir **kod türü** (örneğin *Lokasyon*) ve **değerler** oluşturursunuz (*N* kuzey kanadı için, *Z* güney kanadı için). Bir görev, her kod türü için en fazla bir değer alır.

Bir **özel alan** (pencerede *Kullanıcı alanları* altında), türü belli serbest bir giriş alanıdır: *Metin*, *Sayı*, *Tam sayı*, *Maliyet*, *Tarih* veya *Evet/hayır*. Alan, her görevde farklı bir değer tutabilir.

## Adımlar

### Kod ve alanları tanımlama

1. *Planlama › Yapı › Kodlar ve alanlar* öğesini seçin.
2. **Kod türü oluşturma.** *Yeni kod türü (örn. Lokasyon)* altına adı yazın ve Enter tuşuna basın veya *Kod türü ekle* öğesini tıklayın.
3. **Değer ekleme.** Kod türünün altında *Değer ekle* öğesini tıklayın. Uygulama orada geçici bir kod koyar, örneğin *V1*. Bunu *Kod* kutusunda değiştirin (kısa, yazacağınız gibi: *N*), gerekirse bir *Açıklama* ekleyin (*Kuzey kanadı*) ve bir *Renk* seçin. Bir değişiklik, kutudan ayrıldığınızda veya Enter tuşuna bastığınızda geçerli olur.
4. **Özel alan oluşturma.** *Yeni alan (örn. Yüklenici)* altına adı yazın, türü seçin ve *Alan ekle* öğesini tıklayın (veya Enter tuşuna basın).

Pencerede Tamam düğmesi yoktur: her değişiklik hemen uygulanır. Bir alanın türünü sonradan değiştiremezsiniz, yalnızca adını değiştirebilirsiniz. Başka bir tür istiyorsanız, yeni bir alan oluşturun.

### Bir göreve kod veya alan girme

İki yer vardır.

- **_Özellikler_ bölmesinde** (veya F2 ile açtığınız pencerede). En altta *Kodlar ve alanlar* bloğu vardır: her kod türü için bir seçim listesi, her alan için bir giriş. Bu blok yalnızca en az bir kod türü veya alan olduğunda görünür.
- **Görev tablosunda bir sütun olarak.** Tablo başlığının sağındaki **+** öğesini tıklayın (*Sütun ekle*) ve *Özel* altında kod türünü veya alanı seçin. Kod türünün hücresine kodu yazarsınız, örneğin `N`, veya listeden seçersiniz. Var olmayan bir kod girerseniz, uygulama *Bu etkinlik kodundan bir değer seçin.* gösterir.

### Bunları kullanma

Bir kod türünü veya özel alanı filtrelemek, gruplamak ve sıralamak için kullanabilirsiniz. Bunu bir düzenle ayarlarsınız: *Görünüm › Düzen › Yeni düzen*. Pencerede, kaydetmek istediğiniz bölümleri işaretleyin. *Kaydet* ile *Görünüm › Düzen* içinde, daha sonra yeniden tıklayabileceğiniz bir düğme elde edersiniz. *Kaydetmeden uygula* ile düzeni yalnızca şimdi ekrana getirirsiniz. Gruplarken, değeri olmayan görevler *(yok)* altına gelir.

Çubuk rengi için *Görünüm › Temel plan ve ilerleme › Çubuk renkleri* öğesini seçin, ardından *Kategoriye göre* ve kod türünü seçin. Her çubuk, değerinin *Renk* ayarını alır.

## Dikkat edilecekler ve uygulamanın yaptıkları

**Silmek, görevlerdeki değerleri kaldırır.** Bir kod türünü, bir değeri veya bir alanı çöp kutusuyla silerseniz, uygulama onay istemez ve tüm görevlerdeki atamalar bununla birlikte kaybolur. Bu kod türü veya alan üzerindeki gruplama veya sıralama da sona erer. *Geri al* (Ctrl+Z, önce pencereyi kapatın) kod türünü, değeri veya alanı ve doldurulmuş değerleri geri getirir, ancak gruplamayı veya sıralamayı değil. Bunları yeniden ayarlarsınız.

**Aynı kodu taşıyan iki değer.** *Değer ekle* öğesi, mevcut değer sayısına göre sıradaki numarayı verir. Bir değeri silip bir tane eklerseniz, bir kod bu yüzden iki kez görünebilir. Bu kodu bir sütun hücresine yazarsanız, uygulama reddeder ve *Bu etkinlik kodu değeri birden çok kez geçiyor. Listeden seçin.* der. Her değere kendi kodunu verin.

**Şablonlar kodları ve alanları taşımaz.** Bkz. [WBS şablonlarını kaydetme ve ekleme](docs://howto-wbs-sjablonen). Görevleri başka bir belgeye yapıştırırsanız, uygulama orada olmayan kodları ve alanları temizler ve bunu size bildirir.

**Tarih alanı birlikte taşınmaz.** Tüm projeyi taşırsanız, *Tarih* türündeki doldurulmuş özel alanlar kendi tarihlerinde kalır. Uygulama bunu önizlemede uyarır.

## Ayrıca bakın

- [Yapıyı ayarlama](docs://howto-structuur-aanpassen): de WBS ağacı, görevleri düzenlemenin diğer yolu.
- [Bir projeyi taşıma](docs://howto-project-verplaatsen): projeyi taşıdığınızda tarihlere ne olduğu.
- [Düzen oluşturma ve kullanma](docs://howto-layouts-gebruiken): bir kod veya özel alan üzerinde gruplama ve filtreleme.
- [Tablo sütunlarını ayarlama](docs://howto-tabelkolommen-aanpassen): bir kodu veya özel alanı sütun olarak gösterme.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): etkinlik kodları *House* ve *Discipline*, özel alan *Cost estimate* ve notlar (açık ve tamamlanmış).
