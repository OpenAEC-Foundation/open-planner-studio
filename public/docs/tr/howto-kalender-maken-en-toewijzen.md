# Takvim oluşturma ve atama

Amaç: kendi takviminizi oluşturmak, örneğin altı günlük bir çalışma haftası için, ve bunu içinde hesaplanması gereken görevlere vermek.

## Ne zaman gerekir

Bir taşeron cumartesileri de çalışır. Bir ekip yalnızca pazartesiden perşembeye çalışır. Bir görev, yalnızca o görevin durduğu bir zaman aralığında yer alır. Proje takvimi o zaman yanlış iş günlerine sahiptir. Kendi takviminizle uygulama bu görevleri doğru günlerde hesaplar; kalanlar proje takviminde kalır. Uygulamanın bir takvimle tam olarak ne yaptığını [Takvimler ve çalışma günleri](docs://uitleg-kalenders) sayfasında okuyabilirsiniz.

## Adımlar

### Takvim oluşturma

1. *Planlama › Takvim › Takvim* öğesini seçin. Aynı düğme *Ayarlar › Takvim › Takvim* üzerinde de bulunur. *Takvimler* penceresi açılır. Solda projenin takvimleri vardır; proje takvimi bir yıldız taşır.
2. Listenin altındaki artı işaretli düğmeye (*Yeni takvim*) tıklayın. Yeni takvim, standart takvimin bir kopyasıdır: pazartesiden cumaya, 07:00 ile 16:00 arasında, bir saatlik molalı ve *İnşaat modu* açıksa Hollanda resmi tatilleriyle birlikte. Temel olarak mevcut bir takvimi kullanmak istiyorsanız, onu listeden seçin ve listenin altındaki iki sayfalı düğmeye (*Çoğalt*) tıklayın.
3. *Ad* alanına, takvimi kimin kullandığını gösteren bir ad verin, örneğin *Six-day week*.
4. *Çalışma günleri* altında hafta günlerine tıklayarak bunları açın veya kapatın. *Pzt–Cum* standart haftayı, 07:00 ile 16:00 arasında olacak şekilde geri yükler. Takvimde çalışma saati bantları varsa, *Pzt–Cum* yalnızca pazartesiden cumaya kadar olan günleri açar ve her gün kendi bantlarını korur. *Sürekli (24/7)* yedi günün hepsini açar; 00:00'dan 24:00'a kadar.
5. Gerekirse çalışma saatlerini ayarlayın: *Başlangıç (saat)*, *Bitiş (saat)*, *Mola başlangıcı* ve *Mola süresi (dakika)*. Saatleri SS:DD biçiminde yazarsınız; oklarla saatleri çeyrek saat artırır veya azaltırsınız. Mola süresini 0 yaparsanız takvim molasız çalışır. Uygulama *Standart iş günü* değerini kendisi hesaplar. Takvimde haftanın her günü için çalışma saati bantları varsa (örneğin MS Project'ten), bu alanları görmezsiniz; bunun yerine *Çalışma saatleri* bloğunu görürsünüz. Bu, saat planlaması kapalıyken de geçerlidir. Bkz. [Çalışma saatlerini ayarlama](docs://howto-werktijden-instellen).
6. Gerekirse tatilleri ayarlayın. Bunun nasıl çalıştığı şurada anlatılır: [Tatilleri ve inşaat tatilini oluşturma](docs://howto-feestdagen-genereren).
7. *Uygula* düğmesine tıklayın. Uygulama planlamayı hemen yeniden hesaplar ve pencereyi kapatır. *İptal* ile değişiklikleri atarsınız. Bir giriş alanında Enter tuşuna basarsanız ara kayıt yapılır ve planlama da yeniden hesaplanır; pencere açık kalır. *İptal* o zaman yalnızca bundan sonra değiştirdiklerinizi geri alır.

### Takvimi görevlere verme

Yeni bir takvim, bir görev onu kullanmadıkça bir şey yapmaz. İki yol vardır.

**Özellikler paneli üzerinden**

1. Görevi seçin. *Özellikler* panelini görmüyorsanız, bunu *Görünüm › Paneller › Özellikler* ile açın.
2. *Görev* altında, *Takvim* listesinden takvimi seçin. En üstteki seçenek, yanında adıyla birlikte *Proje takvimi*, görevin kendi takvimi olmadığı anlamına gelir.

**Sağ tık menüsü üzerinden**

1. Görev tablosunda veya Gantt'taki çubuk üzerinde görevin üzerine sağ tıklayın.
2. *Takvim ata* öğesini ve ardından takvimi seçin; ya da kendi takvimini yeniden kaldırmak için *Proje takvimi* öğesini seçin. Şu anda geçerli olan takvimde bir onay işareti bulunur.
3. Bir takvimi aynı anda birkaç göreve vermek istiyorsanız, önce bunları Ctrl (Mac'te ⌘) ile seçin ve seçili görevlerden birine sağ tıklayın. Seçim, seçili tüm görevler için geçerlidir. Seçili olmayan bir göreve sağ tıklarsanız, seçim yalnızca o göreve uygulanır.

Yeni bir takvim seçimi planlamayı henüz güncel yapmaz: durum çubuğu *Güncel değil — yeniden hesaplayın (F5)* uyarısını gösterir. **Hesapla** (F5) tuşuna basın, örneğin *Ana sayfa › Zamanlama › Hesapla* üzerinden. *Otomatik hesapla* açıksa (*Ayarlar › Proje › Uygulama ayarları*, *Planlama* sekmesi, başlık *Hesaplama*), uygulama bunu kendisi yapar.

### Proje takvimini değiştirme

1. *Planlama › Takvim › Takvim* öğesini açın ve listeden takvimi seçin.
2. Formun üstünde *Proje varsayılanı olarak ayarla* öğesine tıklayın. Yıldız o takvime geçer.
3. *Uygula* düğmesine tıklayın.

Yalnızca kendi takvimi olmayan görevler bu değişikliği izler.

### Takvimi silme

1. *Takvimler* penceresini açın ve listeden takvimi seçin.
2. Listenin altındaki çöp kutusu düğmesine (*Sil*) tıklayın. Bu düğme, yalnızca bir takvim olduğu sürece devre dışıdır.
3. *Uygula* düğmesine tıklayın. Bu takvimi kullanan görevler ve kaynaklar proje takvimine geri döner. Proje takviminin kendisini silerseniz, listedeki ilk takvim proje takvimi olur.

## Dikkat edilecekler ve uygulamanın o durumda yaptıkları

**İş günü yok.** Tüm hafta günlerini kapatırsanız, uygulama hesaplayamaz. Hesaplarken *Takvimde tanımlı iş günü yok* uyarısını bildirir.

**Geçersiz giriş.** Çalışma saatlerinin dışındaki bir mola, bitiş saatinden sonraki bir başlangıç saati veya yanlış tarihli bir tatil, alanda kırmızı bir mesaj alır ve düzeltene kadar *Uygula* devre dışıdır. Geçersiz bir mola veya tatil için listede takvimin yanında bir uyarı işareti de görünür (*Bu takvim geçersiz giriş içeriyor*).

**Bir fazda takvim.** Bir faz her zaman proje takvimine göre hesaplanır, çünkü süresi görevlerinden çıkar. Takvimi görevlerin kendisine verin.

**Aynı takvim, iki seçenek.** Listede proje takvimi iki kez görünür: *Proje takvimi: ad* olarak ve aynı adla sıradan bir takvim olarak. İkincisini seçerseniz, bu görev için ayrı bir seçim yapmış olursunuz. Daha sonra farklı bir proje takvimi seçerseniz, görev bu değişikliği izlemez.

**Günde farklı saatler.** Çalışma saatlerini veya molayı değiştirir ve takvimin *Standart iş günü* değeri değişirse, günlerle planlanan bir görev yine aynı sayıda gün sayılır. Kaynakları olan ve görev türü *Sabit iş* veya *Sabit birimler* olan bir görevde süre bununla birlikte değişir, çünkü iş aynı kalır. Kırk saatlik iş; günde 8 saatle 5 gün, günde 6 saatle 7 gün eder. Uygulama, kaç görevin farklı bir süre aldığını bildirir.

## Ayrıca bakınız

- [Takvimler ve iş günleri](docs://uitleg-kalenders): uygulama iş günlerini nasıl sayar ve hangi takvimin geçerli olduğu.
- [Günler ve saatler](docs://uitleg-dagen-en-uren): standart iş gününün ne yaptığı.
- [Kaynak takvimi ayarlama](docs://howto-resourcekalender-instellen): bir görev yerine bir kaynak için takvim.
- [Takvim pencereleri](docs://ref-kalenders): takvim pencerelerinin tüm alanları.
