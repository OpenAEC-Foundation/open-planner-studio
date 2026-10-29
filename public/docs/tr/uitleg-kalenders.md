# Takvimler ve iş günleri

Bir görev kaç iş günü sürer ve hangi tarihte biter? Bu, uygulamanın saydığı takvime bağlıdır. Bu makalede takvimin ne olduğunu, uygulamanın onunla iş günlerini nasıl saydığını ve birden fazla takvim söz konusu olduğunda hangisinin geçerli olduğunu okursunuz. Çalışma örneği sayıları izlemenize yardımcı olur.

## Kavram

Bir planlama **iş günü** cinsinden sayar, takvim günü cinsinden değil. "Beş günlük tuğla örme" demek, işin yapıldığı beş gün demektir. Hafta sonu veya resmî tatil sayılmaz. Bu yüzden böyle bir görev takvimde beşten fazla gün sürer.

Hangi günlerin iş günü olduğu bir **takvimde** kayıtlıdır. Bir takvim üç şeyi belirler:

- **çalışma haftası**: işin yapıldığı hafta günleri. Varsayılan olarak Pazartesi'den Cuma'ya kadardır.
- **çalışma saatleri**: başlangıç, bitiş ve mola. Bunlar **günlük net saati** verir. Varsayılan olarak 07:00 ile 16:00 arasıdır, bir saat molayla; yani 8 saat.
- **tatiller**: işin yapılmadığı tek günler veya tüm dönemler, örneğin Kral Günü, Noel veya inşaat tatili.

Bir projede takvimlerden oluşan bir kitaplık vardır. Bunlardan biri **proje takvimidir**. Kendi takvimi olmayan her göreve bu takvim uygulanır. Bir göreve başka bir takvim verebilirsiniz; örneğin cumartesi de çalışan bir taşeron için altı günlük bir çalışma haftası. Bir kaynağın da kendi takvimi olabilir; ama bu farklı bir işe yarar (aşağıya bakın).

## Uygulama nasıl hesaplar

Bu makale standart hesaplamayı açıklar: yeni bir projenin hesaplandığı *Open Planner Studio* hesaplama profilini.

### İş günlerini saymak

Bir görevin ilk iş günü 1. gün sayılır. Dolayısıyla 5 günlük bir görev beşinci iş gününde biter. Başlangıç bir çalışılmayan güne denk gelirse, görev bir sonraki iş gününde başlar. Bir görevin ortasındaki bir tatil veya inşaat tatili sayılmaz: görev o tatilin üzerinden geçer ve takvimde daha uzun sürer.

Günlük saatler, gün görevinin tarihlerinde rol oynamaz. Yalnızca çalışma haftası ve tatiller sayılır. Çalışma saatleri yalnızca saat cinsinden bir görev için geçerli olur; bu, [Günler ve saatler](docs://uitleg-dagen-en-uren) makalesinde anlatılır.

### Hangi takvim geçerlidir

Uygulama her görev için bir takvim seçer:

1. Görevin kendi takvimi varsa, uygulama görevi tamamen o takvimde hesaplar: süre, bitiş tarihi ve bolluk.
2. Yoksa proje takvimi geçerlidir. Bir görev artık var olmayan bir takvime işaret ediyorsa, o da proje takvimine döner.

Bir **özet görev** (bir aşama) kendi işi olmadığı için kendi takvimi de yoktur. Süresi, görevlerinin tarihlerinden çıkar; uygulama bunu proje takvimine göre sayar.

Bir kaynağın takvimi tarihlerde rol oynamaz. Kendi kurduğunuz bir planlamada yalnızca kaynağın ne zaman müsait olduğunu belirler: histogramda, aşırı atanmışlıkta ve dengelemede.

### Farklı takvimlerdeki görevler

Farklı takvimleri olan iki görev arasında ilişki oluşturulduğunda şu geçerlidir:

- Bitiş-başlangıç ilişkisinde ardıl, öncülün bitişinden sonraki ilk iş gününde başlar; bu, **ardılın** takviminde sayılır. Bir görev cuma günü biterse, altı günlük çalışma haftası olan bir ardıl cumartesi günü başlar.
- Bir **gecikme** varsayılan olarak **öncülün** takviminde sayılır. Bunu *Ayarlar › Proje › Proje ayarları* yolunda değiştirebilirsiniz: *Hesaplama profili ve seçenekleri* bloğunda, *Bu projenin hesaplama seçenekleri* altında, *Gecikme takvimi* seçeneğiyle: *Öncül* (varsayılan), *Ardıl*, *24 saat* veya *Proje takvimi*.
- **Toplam bolluk**, görevin kendi takvimindeki iş günleri olarak sayılır. Bu profilde **serbest bolluk** ardılın takviminde sayılır.

Gecikmenin tam anlamı [İlişki ekleme](docs://howto-relaties-leggen) makalesinde anlatılır; bolluğun ne olduğu [Kritik yol ve bolluk](docs://uitleg-kritiek-pad) makalesinde.

### Gantt'ta

Gantt'taki gri arka plan her zaman **proje takviminin** çalışılmayan günlerini gösterir. Kendi takvimi olan bir görev bu yüzden gri bir güne denk gelebilir; örneğin altı günlük bir görev cumartesi üzerinden geçer. Genişliği üç gün veya daha fazla olan bir tatil bloğunun adı gösterilir, örneğin *İnşaat tatili (Kuzey)*. *Yalnızca iş günlerini göster* açıkken bu olmaz. Gri günleri hiç görmek istemiyorsanız, *Ayarlar › Proje › Uygulama ayarları* altında, sekme *Görünüm*, başlık *Zaman ekseni* içinde *Yalnızca iş günlerini göster* seçeneğini açın.

## Uygulamalı örnek: inşaat planlaması

Örnekte standart takvim *Bouwkalender NL* kullanılır: Pazartesi'den Cuma'ya, Hollanda resmî tatilleriyle birlikte. Tüm görevler tam sayıda gün sürer. Takvimlerle ilgili eğitimde (eğitim 3) böyle bir takvimi kendiniz oluşturursunuz.

### Hafta sonu, tatil ve inşaat tatili

*Brickwork* 5 iş günü sürer ve Perşembe 13 Mayıs 2027'de başlar. Perşembe 13 ve Cuma 14 Mayıs 1. ve 2. gündür. Hafta sonu ve Pentekost Pazartesi, 17 Mayıs sayılmaz. Salı 18, Çarşamba 19 ve Perşembe 20 Mayıs 3., 4. ve 5. gündür. Görev **Perşembe 20 Mayıs**'ta biter: beş iş günü için sekiz takvim günü.

Bir inşaat tatili farkı daha da büyütür. Örnek olarak *İnşaat tatili (Kuzey)* alın: 26 Temmuz'dan 13 Ağustos 2027'ye kadar, bu günler dahil. Aynı 5 iş günlük görev Cuma 23 Temmuz'da başlar. Cuma 23 Temmuz 1. gündür. Bundan sonra takvim üç hafta boyunca durur. Pazartesi 16 ile Perşembe 19 Ağustos 2. ile 5. gündür. Bitiş **Perşembe 19 Ağustos**'tur; başlangıçtan 28 takvim günü sonra. İnşaat tatili olmasaydı bitiş Perşembe 29 Temmuz olurdu.

### Cumartesi günü bir görev

Üç görev arka arkaya gelir; hepsinde gecikmesiz bir bitiş-başlangıç ilişkisi vardır: *Groundwork* (4 gün), *Pour foundation* (3 gün) ve *Brickwork* (5 gün). Proje Pazartesi 24 Mayıs 2027'de başlar.

Üçü de proje takvimindeyse, *Groundwork* Pazartesi 24 ile Perşembe 27 Mayıs arasında sürer. *Pour foundation* Cuma 28 Mayıs'tan Salı 1 Haziran'a kadar sürer (Cuma, Pazartesi, Salı). *Brickwork* Çarşamba 2 Haziran'dan Salı 8 Haziran'a kadar sürer. Proje **Salı 8 Haziran**'da biter.

*Pour foundation* görevine *Six-day week* takvimini (Pazartesi'den Cumartesi'ye) verin; cumartesi de sayılır. Görev Cuma 28 Mayıs'tan **Pazartesi 31 Mayıs**'a kadar sürer (Cuma, Cumartesi, Pazartesi). *Brickwork* proje takviminde kalır, Salı 1 Haziran'da başlar ve **Pazartesi 7 Haziran**'da biter. Tüm proje bir gün kısalır, çünkü bir görev cumartesi de çalışır.

### İki takvim üzerinde gecikme

*Pour floor* (altı günlük çalışma haftası, 4 gün) Pazartesi 31 Mayıs'ta başlar ve Perşembe 3 Haziran'da biter. *Pointing* (proje takvimi, 3 gün) bunu 2 iş günü gecikmeyle izler. Gecikme olmasaydı *Pointing* Cuma 4 Haziran'da başlardı.

- Varsayılan olarak gecikme öncülün takviminde, yani altı günlük çalışma haftasında sayılır. Cuma 4 Haziran'dan sonra Cumartesi 5 Haziran ilk iş günüdür ve Pazartesi 7 Haziran ikincisi. *Pointing* Pazartesi **7 Haziran**'da başlar ve Çarşamba 9 Haziran'da biter.
- *Gecikme takvimi* seçeneğini *Ardıl* olarak ayarlarsanız proje takvimi sayılır. Cumartesi o zaman sayılmaz: Pazartesi 7 Haziran ilk iş günüdür ve Salı 8 Haziran ikincisi. *Pointing* Salı **8 Haziran**'da başlar ve Perşembe 10 Haziran'da biter.

### Kendi takvimindeki bolluk

*Brickwork* (5 gün, proje takvimi) ve *Crane hire* (3 gün, altı günlük çalışma haftası) ikisi de Pazartesi 24 Mayıs'ta başlar. İkisi de *Fit window frames* (2 gün, proje takvimi) görevinin öncülüdür.

*Brickwork* Cuma 28 Mayıs'ta biter; bu yüzden *Fit window frames* Pazartesi 31 Mayıs'ta başlar. *Crane hire* Çarşamba 26 Mayıs'ta zaten bitmiştir. *Crane hire* görevinin **toplam bolluğu** kendi takviminde sayılır: Perşembe 27, Cuma 28 ve Cumartesi 29 Mayıs, yani **3 iş günü**. *Crane hire* proje takvimindeyse, 2 iş günü olurdu. **Serbest bolluk** 2 iş günüdür (Perşembe ve Cuma), çünkü uygulama bunu ardılın takviminde sayar.

### Bir kaynağın takvimi

Başka bir örnek projede *Bricklaying crew* kaynağının *Crew Mon–Thu* takvimi vardır (Pazartesi'den Perşembe'ye). Kaynak, *Brickwork* görevine günde 1 birim olarak atanmıştır (5 gün, proje takvimi, Pazartesi 31 Mayıs'tan Cuma 4 Haziran'a kadar).

*Brickwork* görevinin tarihleri değişmez. Ama Cuma 4 Haziran histogramda kırmızı görünür; mesaj şudur: *Bu gün "Crew Mon–Thu" takvimine göre çalışmıyor*; şerit ise *Aşırı atama* altında bir kaynak bildirir. Dengeleme bunu çözmez. Kaydırma da yardımcı olmaz, çünkü beş iş günü art arda her zaman bir cuma içerir. *Kaynakları dengele* penceresinde görev bu yüzden *Kalan çakışmalar* altında listelenir; neden: *Kaynak bu görevin ihtiyaç duyduğu tüm günlerde çalışmıyor — kaydırma bunu çözmez.*

## Sonuçlar ve yanlış anlamalar

**“Kaynağın takvimi görevlerimi kaydırır.”** Hayır. Bir kaynak takvimi hiçbir tarihi değiştirmez; yalnızca aşırı atanmışlığı görünür yapar. Görevin kendisinin başka günlerde çalışmasını istiyorsanız, göreve kendi takvimini verin.

**“Proje takvimini değiştirirsem her şey kayar.”** Yalnızca kendi takvimi olmayan görevler birlikte kayar. Kendiniz listeden bir takvim verdiğiniz bir görev, eski proje takvimi bile olsa, onu korur. Bir takvimi silerseniz, onu kullanan görevler ve kaynaklar proje takvimine döner.

**“Tatiller de orada, değil mi?”** Tatiller yalnızca oluşturuldukları yıllar için vardır. Bu yıllar dışındaki bir gün sadece bir iş günüdür. Takvim penceresinde uygulama bunu şöyle belirtir: *Tatiller 2025–2028 aralığını kapsıyor. 2030 yılına kadar yeniden oluşturulsun mu?*

**“Günde daha fazla saat, görevimi kısaltır.”** Gün görevi için değil: uygulama tam iş günlerini sayar; gün 6 saat de olsa 8 saat de olsa. Yalnızca kaynakları olan ve görev türü *Sabit iş* veya *Sabit birimler* olan bir görevde süre bununla değişir.

**Bir takvim iş günü olmadan** uygulama onu hesaplayamaz. Hesaplama şunu bildirir: *Takvimde tanımlı iş günü yok*.

## Ayrıca bakın

- [Günler ve saatler](docs://uitleg-dagen-en-uren): uygulamanın çalışma saatlerini nasıl saydığı ve gün görevleri ile saat görevleri bir araya geldiğinde ne olduğu.
- [Takvim oluşturmak ve atamak](docs://howto-kalender-maken-en-toewijzen): kendi takvimini oluşturmak ve bunu görevlere vermek için adımlar.
- [Tatilleri ve inşaat tatilini oluşturmak](docs://howto-feestdagen-genereren): bir ülkenin tatillerini ve inşaat tatilini doldurmak.
- [Bir kaynak takvimi kurmak](docs://howto-resourcekalender-instellen): bir kaynağın müsaitliğini kaydetmek.
- [Takvim pencereleri](docs://ref-kalenders): takvim pencerelerinin tüm alanları.
