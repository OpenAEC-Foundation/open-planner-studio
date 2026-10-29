# Aşırı atanmışlığı çözme

Hedef: Bir kaynağın bir günde çok fazla işi olduğu yeri görmek ve bunu genellikle görevleri dengeleyerek çözmek.

## Ne zaman ihtiyacınız olur

Kağıt üzerinde planlamanız işe yarar, ama duvarcı aynı günlerde süren iki duvarda çalışıyor. Uygulama buna **aşırı atanmışlık** der. Bir kaynak, bir iş gününde şu durumlarda aşırı atanmıştır: plan o gün ondan kapasitesinden (*Maks. birim*) fazlasını istiyorsa, ya da kaynak o gün takvimine göre çalışmıyorsa.

Önce aşırı atanmışlığı bulursunuz. Sonra bir çözüm seçersiniz. **Dengeleme**, uygulamanın sizin için hesapladığı çözümdür: kaynak başa çıkabilene kadar görevlerin daha geç başlamasını sağlar. Bunun nasıl hesaplandığını [Kaynak dengeleme](docs://uitleg-nivelleren) sayfasında okuyun.

## Adımlar

### 1. Aşırı atanmışlığı bulun

1. Şeritte *Kaynaklar › Aşırı atama* öğesine bakın. Orada *Yok* yazar ya da kırmızı renkte aşırı atanmış kaynak sayısı, örneğin *1 kaynak*. Bir hesaplamadan sonra durum çubuğunda da *⚠ 1 kaynak aşırı atanmış* yazar.
2. Durum çubuğundaki bu iletiye tıklayın. Sağda *Uyarılar* paneli açılır. Her kaynak için bir satır vardır, örneğin *Bricklayer* için *5 gün aşırı atanmış (29-06-2027 – 05-07-2027)*.
3. Bu satıra tıklayın. Uygulama *Histogram* öğesini açar, kaynağı seçer ve kaynağın atandığı tüm görevleri seçer.
4. Gantt'ın altındaki histograma bakın. Kırmızı çubuklar aşırı atanmış günlerdir. Bir güne fareyi getirirseniz, hangi görevlerin katkıda bulunduğunu görürsünüz, örneğin *2027-06-30 tarihinde 2 görev katkıda bulunuyor*, altında da görevlerin adları.

Histogramı kendiniz de açabilirsiniz: *Kaynaklar › Histogram › Histogram*. Soldaki listeden bir kaynak seçin, ya da *Önceki* ve *Sonraki* ile kaynaklar arasında gezin. Listede kırmızı bir nokta, o kaynağın aşırı atanmış olduğunu gösterir. *Tüm kaynaklar* satırı kaynakları birlikte toplar, malzeme hariç.

Bir görev seçiliyse, histogram yalnızca o görevin yükünü ve yalnızca o görevdeki kaynakları gösterir. Seçimi kaldırmak ve tüm projeyi yeniden görmek için Esc tuşuna basın.

### 2. Bir çözüm seçin

- **Daha fazla kapasite.** Gerçekten ikinci bir duvarcı geliyorsa, *Maks. birim* değerini 2 yapın (bkz. [Kaynakları yönetme](docs://howto-resources-beheren)). Bu durumda aşırı atanmışlık ortadan kalkar.
- **Günde daha az birim.** *Birim* değerini düşürün veya atama için başka bir eğri seçin (bkz. [Kaynakları bir eğriyle atama](docs://howto-resource-toewijzen)).
- **Görevleri art arda koyun.** İki görev arasına bir ilişki ekleyin, böylece ikinci görev ancak birinci bittikten sonra başlar (bkz. [İlişki ekleme](docs://howto-relaties-leggen)).
- **Dengeleme.** Uygulama bir görevin daha geç başlamasını sağlar.

### 3. Dengeleme

1. Planlamanın **Hesapla** (F5) ile hesaplanmış olduğundan emin olun, örneğin *Ana sayfa › Zamanlama › Hesapla* yoluyla.
2. *Kaynaklar › Kaynak Dengeleme › Dengele…* öğesini seçin. *Kaynakları dengele* penceresi açılır.
3. Projenin bitiş tarihinin değişip değişemeyeceğine karar verin. *Yalnızca bolluk içinde dengele (yumuşatma) — proje bitiş tarihi sabit kalır* kutusunu kapalı bırakırsanız, bitiş tarihi kayabilir. Kutuyu açarsanız, uygulama görevleri yalnızca bolluklarının içinde taşır.
4. *Kaynaklar* altında, dengelenecek kaynaklar bulunur. Varsayılan olarak tüm kaynaklar işaretlidir, malzeme hariç. Dokunulmasını istemediğiniz kaynağın işaretini kaldırın.
5. *Hesapla* düğmesine tıklayın. Hesaplarken *Hesaplanıyor…* yazar ve *Durdur* ile durdurabilirsiniz. Planlama henüz değişmez: bu bir öneridir.
6. Öneriyi okuyun. En üstte bitiş tarihi yer alır, örneğin *Proje bitiş tarihi: değişmedi (30-08-2027)* veya *Proje bitiş tarihi: 25-08-2027 → 30-08-2027*. Bunun altında, her görev için *Eski başlangıç*, *Yeni başlangıç* ve *Kaydırılan gün* değerlerini gösteren bir tablo bulunur, örneğin *Build outer cavity leaf*, 29-06-2027, 06-07-2027 ve *5 g*.
7. *Uygula* öğesini seçin. Uygulama bu kaydırmaları görevlere yazar ve planlama hemen yeniden hesaplanır. F5 tuşuna basmanız gerekmez. *İptal* pencereyi değişiklik yapmadan kapatır.
8. *Kaynaklar › Aşırı atama* öğesini kontrol edin. Artık *Yok* yazar.

Pencerede *Hesapla* düğmesine tıkladıktan sonra bir seçeneği değiştirirseniz, öneri kaybolur. Bu durumda yeniden *Hesapla* düğmesine tıklayın. Uygulama hesaplarken plan değişirse, *Hesaplama sırasında plan değişti. Hesapla'ya yeniden tıklayın.* yazar.

### Hangi görevin yerinde kalacağına karar verme

Uygulama görevleri teker teker yerleştirir. Önce işlenen görevler yerlerinde kalır. En yüksek önceliğe sahip görevler önce gelir. Öncelik eşitse, en az bolluğa sahip görev önce gelir.

Hangi görevin yerinde kalacağına kendiniz karar vermek istiyorsanız, o göreve daha yüksek öncelik verin. Gantt'taki görev çubuğuna sağ tıklayın, *Öncelik* öğesini seçin, ardından *Düşük* (100), *Normal* (500) veya *Yüksek* (900) seçin. *Normal* varsayılandır. Ayrıca *Dengeleme önceliği* sütununa 0 ile 1000 arasında bir sayıyı kendiniz de yazabilirsiniz: görev tablosu başlığının sağındaki **+** öğesine tıklayın (*Sütun ekle*) ve *Planlama* altında bu sütunu seçin. Daha yüksek bir sayı, görevin yerinde kalma olasılığının daha yüksek olduğu anlamına gelir. Uygulama 1000'den büyük bir sayıyı kabul etmez. Öncelik 1000 olan bir görev kapasite için asla taşınmaz.

### Geri alma ve yineleme

- *Geri al* (Ctrl+Z) bir *Uygula* işlemini tek adımda geri alır.
- *Kaynaklar › Kaynak Dengeleme › Dengelemeyi temizle* tüm dengelemeyi görevlerden kaldırır. Dengeleme yoksa düğme gri görünür. Bu yolla geri gelen aşırı atanmışlık yeniden ortaya çıkar.
- Dengelemeden sonra planlamayı değiştirdiyseniz, yalnızca *Dengele…* öğesini yeniden seçin. Uygulama o zaman sıfırdan başlar: eski kaydırmalar sayılmaz.

## Dikkat noktaları ve uygulamanın o durumda yaptıkları

**Henüz hesaplanmadı.** Planlama hesaplanmamışsa, pencere *Dengelemeden önce planı hesaplayın (F5).* yazar ve *Hesapla* kullanılamaz.

**Kalan çakışmalar.** Bazı aşırı atanmışlıklar kaydırmayla çözülemez. Kalan görevler, gün sayısı ve nedeniyle birlikte *Kalan çakışmalar* altında listelenir:

- *Bu çakışmayı çözmek için bolluk içinde yeterli boş kapasite yok.* Bunu *yumuşatma* ile görürsünüz: görevin bolluğu içinde boş bir an yoktur. Kutunun işaretini kaldırın, bitiş tarihi kayabilir.
- *Kaynak bu görevin ihtiyaç duyduğu tüm günlerde çalışmıyor — kaydırma bunu çözmez.* Kaynağın kendi takviminde, görevin ortasında çalışmadığı günler vardır. Takvimi veya görevi değiştirin.
- *Bricklayer zirvede 2 birim/gün istiyor, kapasite 1 — kaydırarak çözülemez.* Görevin eğrisi yüzünden tek başına, bir günde kaynağın sağlayabileceğinden fazlasını ister. Başka bir eğri seçin veya birimleri düşürün.

**Şunu yazar** *Hiçbir görevin taşınması gerekmiyor — plan zaten çakışmasız.* Bu satır, öneride *Kalan çakışmalar* listesiyle birlikte görünürse, listeye güvenin. Satır yalnızca kaydırılacak bir şey olmadığını söyler. Satır listesiz görünür ve *Kaynaklar › Aşırı atama* hâlâ bir kaynak bildiriyorsa, çakışan tüm görevler öncelik 1000 ile sabitlenmiştir ya da zaten başlamıştır. Bunlar taşınmaz ve pencere bunları çakışma olarak bildirmez. Bu yüzden uyguladıktan sonra her zaman *Aşırı atama* öğesine bakın.

**Kaydırılmayan görevler.** Zaten başlamış veya bitmiş bir görev asla kaydırılmaz. Yükü yine de sayılır. Kilometre taşları ve fazlar da kaydırılmaz.

**Malzeme dengelenmez.** Malzeme kaynağı bir günde *Maks. birim* değerinden fazlasını istiyorsa, *Aşırı atama* öğesinde yine aşırı atanmış sayılır, ama dengeleme penceresinde yer almaz.

**Dengeleme kendini uyarlamaz.** Ertelemeler hesaplandığı gibi kalır. Bir görevin süresini sonradan değiştirirseniz, dengelenmiş görev artık gerekmese bile olduğu yerde kalır. O zaman yeniden dengeleyin.

**Takvim yüzünden aşırı atanmış.** Kaynak bir günde takvimine göre çalışmıyorsa, *Uyarılar* paneli örneğin şunu yazar: *5 gün aşırı atanmış (29-06-2027 – 05-07-2027), bunlardan 1 günde kaynak takvimine göre çalışmıyor*. Bir görev her zaman böyle bir günü kapsıyorsa, yani yukarıdaki ikinci neden geçerliyse, dengeleme bunu çözmez.

## Ayrıca bakın

- [Kaynak dengeleme](docs://uitleg-nivelleren): dengelemenin bolluk içinde ve dışında neyi kaydırdığı ve neyi yapmadığı.
- [Kaynakları yönetme](docs://howto-resources-beheren): bir kaynağın kapasitesini ve takvimini ayarlama.
- [İlişki ekleme](docs://howto-relaties-leggen): görevleri art arda koyma.
- [Bildirimler ve uyarılar](docs://ref-meldingen): Uyarılar panelindeki aşırı atanmışlık uyarısı.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): sıvacılar 5 günde aşırı atanmış. *Yalnızca bolluk içinde dengele (yumuşatma) — proje bitiş tarihi sabit kalır* açıkken bitiş 17 Ağustos 2027'de kalır ve bir kalan çakışma kalır. Kutu kapalıyken (varsayılan) her şey çözülür ve bitiş 24 Ağustos 2027'ye kayar.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): kule vinç 65 günde, sıvacılar 15 günde aşırı atanmış. *Yalnızca bolluk içinde dengele (yumuşatma) — proje bitiş tarihi sabit kalır* kutusu kapalıyken dengeleme bitişi 9 Mayıs'tan 12 Ekim 2028'e iter.
