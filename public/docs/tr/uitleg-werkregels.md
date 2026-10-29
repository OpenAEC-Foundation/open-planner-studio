# Görev türleri: süre, birim ve iş

Bir sıvacıyı sıva işine koyarsınız ve görev dört gün sürer. Bir ikinci sıvacı eklerseniz iş iki günde bitebilir. Süre dört gün de kalabilir, ama o zaman iki kat iş vardır. İkisi de mantıklıdır. Uygulamanın ikisinden hangisini seçeceği, görevin **görev türüne** bağlıdır. Bu makalede uygulamanın süreyi, birimi ve işi nasıl birbirine bağladığını okursunuz. Ayrıca her görev türünün neyi sabit tuttuğunu okursunuz.

## Kavram

Üç büyüklük birbirine bağlıdır:

- **Süre**: görevin ne kadar sürdüğü, iş günü veya saat cinsinden.
- **Birim**: bir kaynağın bir iş günü içinde göreve ne kadar çalıştığı. *Özellikler* panelinde buna *Birim* denir, diğer pencerelerde *Birim/gün*. Birim 1, bütün gün boyunca bir sıvacı demektir. 2, iki sıvacı demektir. 0,5 ise yarım gün demektir.
- **İş**: kaynağın göreve harcadığı toplam saat.

Formül şöyledir: iş = süre × birim × iş günü başına saat. İş günü başına saat, görevin takviminden gelir. Bir sıvacıyla dört iş günü süren sıva işi, 8 saatlik iş gününde 4 × 1 × 8 = 32 saat iştir.

Üçünden birini değiştirirseniz, diğer ikisinden en az biri de birlikte hareket etmelidir. Aksi halde toplam artık tutmaz. Hangisinin hareket edeceğini görev türü belirler. Bunu görev başına, *Özellikler* panelinde ayarlarsınız. Uygulama görev türünü ve işi, siz bunları açana kadar göstermez. Bunun nasıl çalıştığı [Görev türü seçmek](docs://howto-werkregel-kiezen) bölümünde yazar.

Bir görev türü yalnızca normal görevlerde çalışır. Kilometre taşları, fazlar (özet görevler), hamaklar ve *Süre türü* alanı *Geçen süre* olan görevlerde görev türü yoktur. Bu durumda *Görev türü* alanı görünmez. Malzeme, örneğin beton veya sıva harcı, de bir görev türüne sahip değildir. Malzeme miktarı hiçbir zaman süreyi belirlemez. Uygulama süreyi bir görev türü yüzünden hiçbir zaman ayarlamaz.

## Uygulama nasıl hesaplar

### Görev türü, değiştirdiğiniz şeye göre işler

Uygulama süreyi, birimi ve işi yeniden hesaplar, ama yalnızca siz bunlardan birini değiştirdiğinizde. Bunlar şunlardır: görevin süresi, bir atamanın birimleri, iş, bir kaynağın eklenmesi veya çıkarılması, ya da bir takvimdeki günlük saatler. **Hesapla** (F5) hiçbirini değiştirmez: F5 yalnızca tarihleri hesaplar. Bir görev türü seçmek de tek bir sayıyı değiştirmez. Görev türü, bir sonraki değişikliğinizde devreye girer.

Bir görev türü görevin süresini değiştirirse, planlama güncel olmaz. Durum çubuğu o zaman *Güncel değil — yeniden hesaplayın (F5)* yazar, *Otomatik hesapla* açık değilse.

### Dört görev türü

*Özellikler* panelinde *Görev türü* açılır listesinin yanında bir i simgesi vardır. Üzerine gelin, tıklayın veya dokunun. Uygulama o anda geçerli olan görev türünü açıklar. Açık açılır listede her seçeneğin yanında da böyle bir i simgesi vardır. Açıklama kalın bir cümleyle başlar. Dört görev türü, uygulamadan gelen bu cümlelerle:

- **Sabit süre ve birimler** (*Bu iş, süre ve birim ile hesaplanır.*). Bu varsayılandır. Uygulama süreyi hiçbir zaman kendisi değiştirmez ve iş, süre ve birimden çıkar. İşi kendiniz yazarsanız, uygulama birimleri ayarlar, çünkü süre sabittir.
- **Sabit süre ve iş** (*Birim, süre ve iş ile hesaplanır.*). Uygulama süreyi kendisi değiştirmez. Süreyi değiştirirseniz iş kalır ve birimler ayarlanır.
- **Sabit iş** (*Süre, iş ve birim ile hesaplanır.*). İş sabittir. Süre, iş ve birimden çıkar.
- **Sabit birimler** (*Süre, iş ve birim ile hesaplanır.*). Birimler sabittir. Süre, işten çıkar.

Yani iki görev türü süreyi olduğu gibi bırakır. Diğer ikisinde, birimleri, işi veya kaynak sayısını değiştirdiğinizde süre birlikte hareket eder. Tek kaynakla Sabit iş ve Sabit birimler tam olarak aynı şeyi yapar. Süreyi kendiniz değiştirdiğinizde ise farklılaşırlar: Sabit iş ile iş kalır ve birimler ayarlanır; Sabit birimler ile birimler kalır ve iş birlikte büyür. Görevde birden fazla kaynak olduğunda da farklılaşırlar.

Aşağıdaki işlenmiş örnekler, her görev türünün ne yaptığını gösterir.

### Yuvarlama

Uygulama toplamdan çıkan süreyi yukarı yuvarlar. Günlerdeki bir görev için bu tam iş günlerine yuvarlanır, saatlerdeki bir görev için tam dakikalara. İş ve birimler, sizin girdiğiniz değerler veya uygulamanın toplamdan aldığı değerler olarak kalır. Bu yüzden toplam bazen tam olarak tutmaz. Aşağıdaki örnek, o zaman ne olduğunu gösterir.

### Birden fazla kaynak

Bir görevin birden fazla kaynağı varsa, iki kural geçerlidir. Sabit süre ve iş, Sabit iş ve Sabit birimler görev türlerinde, bir kaynak eklediğinizde veya çıkardığınızda toplam iş aynı kalır. Uygulama onu birimlere orantılı böler. Sabit süre ve birimler görev türünde ise yeni bir kaynak bunun yerine kendi işini getirir. Sabit iş ve Sabit birimler görev türlerinde en yavaş kaynak süreyi belirler: kaynak başına iş birimlere bölünür ve en büyük sonuç sayılır.

Örnek: iki kaynağın her biri 32 saat işe ve 1 birime sahiptir. Birlikte 4 iş günü sürer. İlkinin birimini 0,5 yaparsınız. Süre o zaman 8 iş günü olur. Sabit iş görev türünde ikinci kaynak 32 saat işini tutar ve birimleri 0,5'e düşer. Sabit birimler görev türünde ikinci kaynak 1 birimini tutar ve işi 64 saate çıkar.

### İlerleme

Görevin zaten ilerlemesi varsa, görev türü kalan kısımla çalışır: kalan süre ve kalan iş. *Özellikler* panelinde bu iş, *İş (sa)* sütunundadır. Tamamlanmış olan kısım kalır.

### Saat görevleri

Bir saat görevi aynı şekilde hesaplanır, ama dakikalarla. Yalnızca vinç 5 saatlik bir görevdeyse, bu 5 saat iştir. Sabit iş görev türünde birim 2 için süre o zaman 2,5 saat olur. Uygulamadaki alıştırma projesinde boşluklu döşemede marangoz ekibi de vardır. Bu döşeme hâlâ 5 saat iş ister. Marangoz ekibi en yavaş olandır, bu yüzden süre 5 saat kalır. Saat ile gün arasındaki ilişki [Günler ve saatler](docs://uitleg-dagen-en-uren) bölümünde açıklanır.

## Örnek: sıva işi

Örnek, eğitimlerdeki alıştırma projesi *House extension* projesidir. Eğitim 5'te bunu kendiniz çözersiniz ve sayıları kontrol edersiniz. Burada her görev türünün ne yaptığını okursunuz.

Sıva işi 4 iş günü sürer. Göreve bir sıvacı atanmıştır, birim 1 ile. İş günü 8 saattir. Dolayısıyla iş 32 saattir.

### Sabit süre ve birimler

- Süreyi 6 iş gününe çıkarırsınız: iş 48 saate büyür, birimler 1 kalır.
- Birimleri 2 yaparsınız: süre 4 iş günü kalır, iş 64 saat olur.
- *İş (sa)* alanına 48 saat yazarsınız: süre 4 iş günü kalır, birimler 1,5 olur.
- Örneğin *Plasterer 2* adlı ikinci bir kaynağı birim 1 ile atarsınız: süre 4 iş günü kalır ve bu ikinci kaynak 32 saat iş getirir. Birlikte 64 saat.

### Sabit süre ve iş

- Süreyi 6 iş gününe çıkarırsınız: iş 32 saat kalır, birimler 0,67'ye düşer.
- Birimleri 2 yaparsınız: süre 4 iş günü kalır. Süre sabit olduğu için iş 64 saate büyür.
- *İş (sa)* alanına 16 saat yazarsınız: süre 4 iş günü kalır, birimler 0,5 olur.
- Örneğin *Plasterer 2* adlı ikinci bir kaynağı birim 1 ile atarsınız: 32 saat bölünür, her biri 16 saat. Birimler ikisi için de 0,5 olur. Süre 4 iş günü kalır.

### Sabit iş

- Süreyi 6 iş gününe çıkarırsınız: iş 32 saat kalır, birimler 0,67'ye düşer.
- Birimleri 2 yaparsınız: iş 32 saat kalır ve süre 2 iş gününe düşer. Bu, eğitim 5'te yaptığınız adımdır.
- *İş (sa)* alanına 48 saat yazarsınız: birimler 1 kalır ve süre 6 iş gününe çıkar.
- Örneğin *Plasterer 2* adlı ikinci bir kaynağı birim 1 ile atarsınız: 32 saat bölünür, her biri 16 saat ve süre 2 iş gününe düşer. Bu ikinci kaynağı tekrar çıkarırsanız, süre yeniden 4 iş günü olur.

### Sabit birimler

- Süreyi 6 iş gününe çıkarırsınız: birimler 1 kalır, iş 48 saate büyür.
- Birimleri 2 yaparsınız: iş 32 saat kalır ve süre 2 iş gününe düşer.
- *İş (sa)* alanına 48 saat yazarsınız: birimler 1 kalır ve süre 6 iş gününe çıkar.
- Örneğin *Plasterer 2* adlı ikinci bir kaynağı birim 1 ile atarsınız: 32 saat bölünür, her biri 16 saat. Süre 2 iş gününe düşer.

### Toplam tutmadığında

Sabit iş görev türünde birimleri 3 yaparsınız. İş 32 saattir, dolayısıyla süre 32 ÷ (3 × 8) = 1,33 iş günü olur. Uygulama bunu 2 iş gününe yukarı yuvarlar. İş (32 saat) ve birimler (3) kalır, ama 2 × 3 × 8 = 48 saattir. Histogram bu yüzden 32 saati 2 iş gününe yayar: günde 2 birim, 3 değil. *İş (sa)* alanında bunu göstermek için bir uyarı işareti çıkar: *Birim × süreden farklı*.

Farklı birimleri olan iki kaynakta da aynısı geçerlidir. Sabit iş görev türünde, birim 1 olan sıvacıya birim 2 ile örneğin *Plasterer 2* adlı ikinci bir kaynak eklerseniz, uygulama 32 saati 1 : 2 oranında böler: 10,7 ve 21,3 saat. Her ikisi de 1,33 iş günü ister. Süre 2 iş günü olur.

Bir P6 veya MS Project dosyası, birimler × kalan süreye eşit olmayan bir *İş (kalan)* da içerebilir. Aynı uyarı işareti o zaman çıkar. Uygulama bu işi kendiliğinden değiştirmez. Böyle bir görevin süresini değiştirirseniz, uygulama görev türünü izler; kalan iş dosyadan gelmiş olsa bile. *Sabit süre ve birimler* ve *Sabit birimler* görev türlerinde kalan iş, birimler × yeni kalan süre olur. *Sabit süre ve iş* ve *Sabit iş* görev türlerinde iş kalır ve birimler ayarlanır. Dosyadan gelen bir kalan iş bu şekilde kaybolursa, eski ve yeni saat sayısını gösteren bir bildirim alırsınız. Ctrl+Z eski değeri geri getirir. Uyarı işaretindeki açıklama, her görev için bunlardan hangisinin olduğunu size söyler.

### Farklı takvim

Sabit iş görev türünde takvimin iş günü 8 saatten 6 saate düşer. İş 32 saat kalır, dolayısıyla süre 32 ÷ 6 = 5,33 olur ve 6 iş gününe yukarı yuvarlanır. Uygulamanın iş günlerini ve çalışma saatlerini nasıl saydığı [Takvimler ve iş günleri](docs://uitleg-kalenders) bölümünde açıklanır. Uygulama şunu bildirir: *Takvim değişikliğinden sonra görev türü 1 görev için süreyi ayarladı (iş aynı kaldı, günlük saatler değişti).*

### Görev ilerlemesiyle

Boşluklu duvarın iç tabakası 5 iş günü sürer ve %40 tamamlanmıştır: 2 iş günü tamamlanmış, 3 iş günü (24 saat) kalmıştır. Sabit iş görev türünde birimleri 1'den 2'ye çıkarırsınız. Kalan iş 24 saat kalır. Kalan süre 1,5 olur ve 2 iş gününe yukarı yuvarlanır. Görev şimdi 2 + 2 = 4 iş günü sürer ve ilerleme %50'dir. Yüzde birlikte hareket eder, çünkü tamamlanmış kısım aynı kalır ve kalan kısım kısalır.

## Sonuçlar ve yanlış anlamalar

**“Sabit iş, süresinin sabit olduğu anlamına gelir.”** Hayır, tam tersi. *Sabit süre ve birimler* ve *Sabit süre ve iş* görev türlerinde süre sabittir. *Sabit iş* ve *Sabit birimler* görev türlerinde süre diğer ikisinden çıkar.

**“Bir görev türü seçersem, planlamam değişir.”** Hayır. Seçmek hiçbir sayıyı değiştirmez. Görev türü, neyin birlikte hareket edeceğine yalnızca bir sonraki değişikliğinizde karar verir. İşi koruyan bir görev türünde uygulama, seçtiğiniz anda işi sabitler; böylece korunacak bir sayı olur. Böyle bir görevde kayıtlı bir *İş (sa)* bulunur.

**“Ben dokunmadan süre değişti.”** Bu, *Sabit iş* veya *Sabit birimler* görev türünde birimleri, işi, kaynak sayısını veya günlük saatleri değiştirdikten sonra olabilir. Durum çubuğu o zaman planlamanın güncel olmadığını yazar. Yeni tarihleri görmek için **Hesapla** (F5) düğmesine basın.

**Atama olmadan görev türü hiçbir şey yapmaz.** O zaman süreye bağlanacak birim veya iş yoktur.

**MS Project veya Primavera P6 dosyaları her zaman görev türünü gösterir.** Bir MS Project görevinde uygulama bazen efor odaklı ayarını saklar. Bu kayıtlı ayar iki durumu değiştirir. *Sabit süre ve iş* ile efor odaklı olduğunda, süreyi değiştirdiğinizde birimler yerine iş birlikte hareket eder. *Sabit birimler* ile efor odaklı olmadığında, bir kaynak eklediğinizde veya çıkardığınızda iş birlikte hareket eder ve süre kalır. Uygulamada kendiniz oluşturduğunuz görevlerde bu ayar yoktur. Bilgi simgesinin arkasındaki açıklama bu ayarı hesaba katar.

## Ayrıca bakın

- [Görev türü seçmek](docs://howto-werkregel-kiezen): bir görevin görev türünü ayarlamanın adımları.
- [Eğriyle kaynak atamak](docs://howto-resource-toewijzen): bir kaynağı bir göreve birim ve dağılımla koymak.
- [Günler ve saatler](docs://uitleg-dagen-en-uren): uygulamanın günleri ve saatleri nasıl dönüştürdüğü.
- [Takvimler ve iş günleri](docs://uitleg-kalenders): uygulamanın iş günlerini ve çalışma saatlerini nasıl saydığı.
