# Çalışma saatlerini ayarlamak

Amaç: bir takvimin hangi saatlerde çalıştığını haftanın günü bazında kaydetmek. Böylece saatlerle ifade edilen görevler doğru zamanda ilerler.

## Ne zaman gerekir

Cuma öğleden sonra çalışılmaz. Ekip 06:00 ile 22:00 arasında iki vardiyada çalışır. Bir gece ekibi vardır. Mola bir saatten kısadır. Yalnızca günlerle planlıyorsanız *Başlangıç (saat)*, *Bitiş (saat)* ve mola yeterlidir ([Takvim oluşturma ve atama](docs://howto-kalender-maken-en-toewijzen)). Saatlerle görev planlıyorsanız uygulama, takvimin **bantları** içinde çalışma dakikalarını sayar. Uygulamada bu bantlara *bant* denir: bant, bir hafta gününde kesintisiz bir çalışma süresidir; iki bant arasındaki boşluk bir moladır. Bunun planlamanız için ne anlama geldiği, [Günler ve saatler](docs://uitleg-dagen-en-uren) bölümünde açıklanır.

Sıradan bir takvime çalışma saati bantları vermek için *Saat planlamasını etkinleştir* seçeneği gerekir ([Saat planlamasını açma](docs://howto-urenplanning-aanzetten)). Takvimde zaten bantlar varsa, örneğin bir MS Project dosyasından geldiyse, *Çalışma saatleri* bölümü her zaman görünür ve bantları saat planlaması kapalıyken de değiştirirsiniz.

## Adımlar

### Vardiya ön ayarı seçmek

1. *Planlama › Takvim › Takvim* öğesini seçin ve soldan takvimi seçin.
2. *Çalışma saatleri* bölümünde bir ön ayara tıklayın. Ön ayar, takvimin iş günlerini ve çalışma saatlerini değiştirir.
3. *Uygula* öğesine tıklayın.

Her ön ayar şunu yapar:

- *Gündüz vardiyası*: Pazartesi’den Cumaya 08:00 ile 16:00 arasında, mola olmadan. Bu, takvimi bant olmayan normal bir takvime geri çevirir.
- *2 vardiya*: Pazartesi’den Cumaya 06:00 ile 14:00 arasında ve 14:00 ile 22:00 arasında, toplam 16 saat.
- *3 vardiya*: Pazartesi’den Cumaya üç vardiya: 06:00 ile 14:00 arası, 14:00 ile 22:00 arası ve 22:00 ile ertesi gün 06:00 arası, toplam 24 saat.
- *Gece vardiyası*: Pazartesi’den Cumaya 22:00 ile ertesi gün 06:00 arası, 8 saat.
- *24/7*: yedi günün tamamında 00:00 ile 24:00 arası.

### Haftanın gününe göre çalışma saatlerini ayarlamak

1. *Çalışma saatleri* bölümünde *Haftanın gününe göre ayarla…* öğesine tıklayın. Düğmelerin altında her hafta günü için bir satır belirir. Bu satırda o günün çalışma saatleri yer alır. Takvimde artık haftanın günü başına bantlar vardır. Takvimde bu bantlar zaten varsa bu genel bakış hemen açılır. Düğme o zaman *Çalışma saatlerini gizle* adını taşır ve genel bakışı kapatır.
2. Her bandın başlangıç ve bitiş saatini iki saat alanında ayarlayın. Saati yazın ve Enter tuşuna basın veya okları kullanın (adım başına 15 dakika). Alanlar ayarlardaki *Saat biçimi* öğesini izler; *13:00* ve *1:00 PM* ikisi de çalışır.
3. Bir mola eklemek istiyorsanız o gün için **+** (*Bant ekle*) öğesine tıklayın. Bantların saatlerini ayarlayın, böylece aralarında boşluk olsun. Yeni bant 08:00’de başlar ve 16:00’da biter.
4. Gece yarısını geçen bir bant için *sonraki gün* kutusunu işaretleyin. Bant, başladığı günde sayılır.
5. Bir bantın arkasındaki çöp kutusuna tıklayarak bandı silin. Bandı olmayan bir gün *Çalışılmayan* olarak görünür.
6. Pazartesi ile Cuma arasındaki bir gün için kopyalama simgesine (*Tüm iş günlerine kopyala*) tıklayın. Böylece o günün bantları Pazartesi’den Cumaya uygulanır.
7. *Çalışma saatleri* bölümünün üstünde *Standart iş günü* yer alır. Bu, uygulamanın bantlardan türettiği ve hesapta kullandığı gün başına çalışma saatidir. Bantları değiştirdiğinizde sayı hemen güncellenir. Takvimin kendi gün başına saatleri varsa (örneğin Primavera P6’dan), bu özel değer korunur ve dışa aktarımla birlikte gider; bir ön ayar onu değiştirene kadar. Bu özel değer *Standart iş günü* ile farklıysa, sayının hemen altında turuncu bir kutu belirir, örneğin: *Dosyada iş günü 8 sa olarak ayarlı. Bu, MS Project ve P6'ya dışa aktarımda korunur. Orada bir gün 8 sa, burada 10 sa sayılır.* Kutu, bantlar aynı günlük toplamı verdiği anda veya bir ön ayar özel değeri değiştirdiğinde kaybolur. Kutu hesaplamayı değiştirmez. *Uygula* öğesine tıklayın.

**Örnek: Cuma öğleden sonrası boş.** *Haftanın gününe göre ayarla…* öğesine tıklayın. *Cum* için ikinci bandı (13:00 ile 16:00 arası) silin. Cuma artık 5 saat, diğer günler 8 saat var. *Standart iş günü* 8 saat olarak kalır.

### Kendi ön ayarınızı kaydetmek

1. *Ön ayar olarak kaydet…* öğesine tıklayın ve *Ön ayar adı* alanına bir ad yazın.
2. *Kaydet* öğesine tıklayın. Ön ayar artık diğer ön ayarların arasında yer alır ve her projede kullanabilirsiniz. Yanındaki çarpı işaretiyle onu yeniden silersiniz.

Kendi ön ayarınız bu cihazda saklanır, proje dosyasında değil.

## Dikkat edilecek noktalar ve uygulamanın o zaman yaptığı

**Ön ayar her şeyin yerini alır.** Bir ön ayar seçerseniz daha önce ayarladığınız iş günleri ve çalışma saatleri kaybolur. Tatiller kalır.

**Gün düğmeleri bantları değiştirir.** *Çalışma günleri* altında bir günü kapatırsanız, o günün bantları kaybolur. Onu yeniden açarsanız, pencereyi açtığınızdaki bantlarını geri alır (ya da son ön ayardan sonraki bantlarını). Aksi halde ilk iş gününün bantlarını alır. *Pzt–Cum* bunu Pazartesi’den Cumaya yapar ve Cumartesi ile Pazar’ın bantlarını siler. *Sürekli (24/7)* tüm bantların yerini alır: her gün 00:00 ile 24:00 arası.

**Saat planlaması kapalıyken çalışma saatlerini ayarlamak.** Bant içeren bir takvim, saat planlaması kapalı olsa bile *Çalışma saatleri* bölümünü tutar. Bantları orada basitçe değiştirirsiniz. *Gündüz vardiyası* seçerseniz takvim yeniden sıradan bir takvim olur, *Başlangıç (saat)*, *Bitiş (saat)* alanları ve mola ile birlikte. Bantları geri koymak o zaman yalnızca saat planlaması açıkken mümkündür.

**Kullanılabilir çalışma saati yok.** Bandı veya iş günü olmayan bir takvim, saatlerle ifade edilen bir görevi taşıyamaz. Uygulama o zaman şunu bildirir: *Bu takvimde geçerli çalışma saatleri yok. Çalışma günlerini ve saatlerini kontrol edin.*

## Ayrıca bakınız

- [Günler ve saatler](docs://uitleg-dagen-en-uren): uygulamanın çalışma saatlerini nasıl saydığı ve standart iş gününü nasıl türettiği.
- [Saat planlamasını açma](docs://howto-urenplanning-aanzetten): bir görevi saat cinsinden planlamak.
- [Takvimler ve iş günleri](docs://uitleg-kalenders): hangi takvimin hangi göreve uygulandığı.
- [Takvim pencereleri](docs://ref-kalenders): takvim pencerelerinin tüm alanları.
