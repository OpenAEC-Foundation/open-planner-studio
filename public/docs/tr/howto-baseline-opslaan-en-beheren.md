# Bir temel planı kaydetmek ve yönetmek

Amaç: planlamayı bir anlaşma olarak kaydetmek (bir temel plan). Böylece gerçekleşmenin ne kadar saptığını sonra görebilirsiniz. Ayrıca birden çok temel planı tutabilir, yeniden adlandırabilir, seçebilir ve silebilirsiniz.

## Ne zaman ihtiyacınız olur

Planlama onaylandığında ve iş henüz başlamadığında bir temel plan kaydedersiniz. Planlama sonradan resmen gözden geçirilirse, örneğin bir değişiklik emrinden sonra, ikinci bir temel plan kaydedersiniz ve ilkini saklarsınız. Bu sayede gerçekleşmeyi hem ilk anlaşmaya hem de gözden geçirilmiş anlaşmaya göre ölçersiniz. Bir temel planın tam olarak neyi kaydettiği ve uygulamanın sapmayı nasıl hesapladığı, [İlerleme, durum tarihi ve temel plan](docs://uitleg-voortgang) bölümünde açıklanır.

## Adımlar

### Temel plan kaydetmek

1. **Hesapla** (F5) düğmesine basın, örneğin *Planlama › Zamanlama › Hesapla* üzerinden. Temel plan, o anda hesaplanan tarihleri kaydeder.
2. *Planlama › Temel plan ve ilerleme › Temel planları yönet…* öğesini seçin. *Temel planlar* penceresi açılır.
3. *Yeni temel plan kaydet* bölümünde önerilen bir ad vardır, örneğin *Temel plan 1 — (bugünün tarihi)*. Sonra tanıyacağınız kendi adınızı yazın, örneğin *Temel plan*.
4. *Kaydet* düğmesini tıklayın. Temel plan artık listededir ve hemen etkin temel plan olur.
5. *Kapat* düğmesini tıklayın.

Gantt grafiğinde her görev çubuğunun altında artık temel plan tarihlerini gösteren ince bir çubuk vardır. Kilometre taşı küçük bir elmas alır. Bu bindirmeyi *Görünüm › Temel plan ve ilerleme › Temel plan bindirmesi* ile açarsınız veya kapatırsınız.

### Etkin temel planı seçmek

*Temel planları yönet…* öğesini açın ve *Etkin* sütununda karşılaştırmak istediğiniz temel planı seçin. Temel plan varken tam olarak biri etkindir. Gantt bindirmesi, *Variance* rapor türü ve *İlerleme raporu* bunu kullanır.

### Temel planı yeniden adlandırmak

Listede adı değiştirin. Değişiklik hemen uygulanır; *Kaydet* düğmesini tıklamanız gerekmez.

### Temel planı silmek

Listede temel planın yanındaki küçük çöp kutusuna tıklayın. Etkin temel planı silerseniz uygulama *Etkin temel plan silinsin mi?* diye sorar. Ardından kalan en yeni temel plan etkin olur. Başka temel plan yoksa artık etkin temel plan kalmaz ve bindirme kaybolur. Silinen temel planı Ctrl+Z ile geri getirirsiniz. Önce pencereyi kapatın; Ctrl+Z pencerenin içinde çalışmaz.

### Görev tablosundaki sapmalar

Her temel planın görev tablosunda altı sütunu vardır. Görev tablosu başlığının sağındaki **+** öğesine tıklayın (*Sütun ekle*) ve *Temel plan* kategorisini açın. Her temel plan için *Planlanan başlangıç*, *Planlanan bitiş*, *Süre*, *Başlangıç sapması*, *Bitiş sapması* ve *Süre sapması* vardır. Başında temel planın adı bulunur, örneğin *Temel plan — Bitiş sapması*. Sapmalar iş günü cinsindendir. Artı işareti daha geç, eksi işareti daha erken anlamına gelir. Temel planda olmayan bir görev bu sütunlarda kısa çizgi (—) gösterir.

## Dikkat edilecek noktalar ve uygulamanın davranışı

**Güncel olmayan bir planlama.** Planlama güncel değilse pencere *Plan güncel değil — önce yeniden hesaplayın (F5)* yazar. Bu bir uyarıdır; kaydetmek yine mümkündür. Ama bu durumda eski tarihleri kaydedersiniz. Pencereyi kapatın, **Hesapla** düğmesine basın ve ancak ondan sonra kaydedin.

**İlerleme içeren bir temel plan.** İlerlemeyi girdikten sonra temel planı kaydederseniz, temel plan o gerçek tarihlerle birlikte durumu kaydeder. Sapma o zaman sıfır olur ve artık gerçekleşme hakkında bir şey söylemez. Temel planı işe başlamadan önce kaydedin.

**Bir temel plan güncellenemez.** Anlaşmayı gözden geçirmek istiyorsanız yeni bir temel plan kaydedin. Gerekirse eski temel planı silin.

**Süre veya Süre sapması sütunundaki ⚠.** Saat cinsindeki bir görevde bir gün, takvimin çalışma saatleridir. Takvimin kendi günlük saatleri varsa (Primavera P6 kaynaklı, örneğin 10 saatlik bantlarla 8 gibi), uygulamanın eski bir sürümü günleri farklı sayıyordu. O sürümden bir temel plan eski sayıyı tutar: 1870 saatlik bir görev temel planda 233,75 gündür, şimdi ise 187 gündür. Uygulama böyle bir temel planı dönüştürmez. Bu temel planın *Süre* ve *Süre sapması* sütunları ⚠ gösterir; açıklama için bu işaretin üzerine gelin. Temel planın tarihleri doğrudur. Yeni bir temel plan kaydedin; gerekirse eski temel planı silin.

**Yalnızca alt görevi olmayan görevler.** Bir faz temel planda yer almaz: temel plan çubuğu ve sapması yoktur. Faz, altındaki görevlerden belirlenir.

**Yeni ve silinen görevler.** Kaydetmeden sonra eklediğiniz bir görevin temel plan çubuğu yoktur. Variance raporunda *Yeni* olarak görünür. Sildiğiniz bir görev *Kaldırıldı* olarak görünür.

**Projeyi taşı.** *Projeyi taşı…* penceresinde, temel plan olduğunda, *Referans planları da kaydır* onay kutusu vardır. Varsayılan olarak kapalıdır: temel planlar yerinde kalır, dolayısıyla kayma sapma olarak görünür. Bkz. [Projeyi taşımak](docs://howto-project-verplaatsen).

**Proje dosyasında saklanır.** Temel planlar ve etkin seçim projeyle birlikte kaydedilir ve dosyayı açtığınızda geri gelir.

## Ayrıca bakın

- [İlerleme, durum tarihi ve temel plan](docs://uitleg-voortgang): temel planın neyi kaydettiği ve sapmanın nasıl hesaplandığı.
- [Projeyi taşımak](docs://howto-project-verplaatsen): *Referans planları da kaydır* onay kutusu.
- [İlerlemeyi güncellemek](docs://howto-voortgang-bijwerken): temel planla karşılaştırdığınız gerçek durumu girmek.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): başlangıçtan önce bir temel plan (*Baseline at start*), ilerleme ve 20 Mayıs 2027 durum tarihi ile.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): iki temel plan, *Contract* ve *Re-baseline (variation order)*, ilerleme ve 5 Temmuz 2027 durum tarihi ile.
