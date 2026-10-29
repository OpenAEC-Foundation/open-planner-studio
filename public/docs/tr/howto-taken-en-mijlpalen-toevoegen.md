# Görev ve kilometre taşı eklemek

Amaç: planlamanıza, ait olduğu yere yeni bir görev veya kilometre taşı ekleyin.

## Bunu ne zaman kullanırsınız

Bir planlama oluşturuyorsunuz, yeni iş eklenir ya da teslim veya denetim gibi bir anı kaydetmek istersiniz.

Bir **görev**, zaman alan iştir. Yeni bir görev varsayılan olarak 5 iş günü sürer (saat planlaması ile proje varsayılanı saat olabilir). Bir **kilometre taşı**, süresi olmayan bir andır: 0 gün. Alt görevleri olan bir göreve **özet görev** denir; inşaatta çoğu zaman bir aşamadır. **Hesapla** (F5) komutunu kullandığınız anda, süresi ve tarihleri alt görevlerinden çıkar.

## Adımlar

### Görev eklemek

1. *Ana sayfa › Görevler › Görev* öğesini seçin. Aynı düğme *Tablo* sekmesinde de vardır.
2. *Özellikler* paneli açılır. *Ad* alanı seçili olur. Adı yazın ve Enter tuşuna basın.

Yeni görevin ilk adı *Yeni görev* olur. Görev proje başlangıcında başlar.

Bir görev seçiliyse, yeni görev hemen altına, aynı düzeyde gelir. Seçili görev bir özet görevse, yeni görev bu tüm aşamanın altına gelir; yani alt görevlerinin sonrasına. Hiçbir şey seçili değilse, liste sonuna gelir. Düğmenin ipucu iki durumdan hangisinin olacağını söyler: *Yeni görev, seçimin hemen altına eklenir* veya *Yeni görev listenin sonuna eklenir*. Birden çok görev seçerseniz, tek bir yeni görev oluşur. Bu görev, ekranda gördüğünüz biçimiyle seçimin en alttaki görevinin altına gelir.

### Görev tablosunda art arda hızlıca ekleme

Görev tablosunda son görevin altında her zaman gri bir *Yeni görev* satırı bulunur. Bu satır henüz bir görev değildir. Gantt'ta da dosyada da yer almaz.

1. Bu satırda bir hücreye tıklayın veya aşağı ok tuşuyla oraya gidin.
2. Adı yazın ve Enter tuşuna basın. Artık gerçek bir görevdir ve üstteki görevle aynı düzeydedir. İmleç hemen altındaki yeni gri satırdadır.
3. Sonraki adı yazın ve bu şekilde devam edin.

Gri satıra yalnız bir süre veya bir tarih yazarsanız, görevin adı *Yeni görev* olur. Hiçbir şey yazmadan çıkarsanız, hiçbir şey olmaz: görev oluşmaz ve *Geri al* içinde bir adım yoktur. Görevi oluşturmak ile ilk değerini girmek, *Geri al* içinde birlikte tek adımdır. Gri satır yalnız görev tablosu filtrelenmemiş, gruplanmamış ve sıralanmamışsa görünür.

### Boş alanda sağ fare düğmesiyle

Boş alanda sağ tıklayın: görev tablosunda son görevin altında veya Gantt'ta çubukların yanında ya da altında. *Yeni görev* veya *Kilometre taşı ekle* seçeneğini seçin. Görev listenin sonuna gelir. Gantt'ta görev, tıkladığınız tarihte başlar. Görev tablosunda ad hücresi hemen açılır, böylece yazabilirsiniz.

### Belirli bir görevin üstüne veya altına

Göreve sağ tıklayın ve *Üste ekle* veya *Alta ekle* öğesini seçin. Klavye de çalışır: Insert seçili görevin üstüne ekler, Ctrl+I (Mac'te ⌘+I) ise altına. Görev tablosunda Insert tuşundan sonra ad hücresi hemen açılır ve yazmaya hazır olur.

Birden çok görev seçiliyse tek bir yeni görev oluşur: *Üste ekle* onu seçili en üstteki görevin üstüne koyar, *Alta ekle* ise en alttakinin altına.

### Alt görev eklemek

Göreve sağ tıklayın ve *Alt görev ekle* öğesini seçin. Yeni görev, o görevin alt görevlerinin en altına gelir. Gantt'ın yanındaki görev tablosunda bir özet görevin adının sonunda da küçük bir **+** bulunur. Bu işaret aynısını yapar.

### Kilometre taşı eklemek

1. *Ana sayfa › Görevler › Kilometre taşı ▾* öğesini seçin. Ardından *Başlangıç kilometre taşı*, *Bitiş kilometre taşı* veya *Denetim noktası (zorunlu)* öğesini seçin.
2. Adı yazın ve Enter tuşuna basın. Yerleştirme, *Görev* için geçerli olan kuralla aynıdır.

Üç tür şöyle farklıdır:

- Bir *Başlangıç kilometre taşı* günün başına, bir *Bitiş kilometre taşı* ise günün sonuna ait olur. Gantt'ta elmas, sırasıyla gün sütununun sol veya sağ tarafında durur. Bu, ardıl görev için de önemlidir. Diyelim ki bir kilometre taşı 29 Eylül 2026 Salı gününe denk gelir ve ona bağlı bir görev bitiş-başlangıç ilişkisiyle bağlıdır. Başlangıç kilometre taşından sonra o görev aynı Salı günü başlar. Bitiş kilometre taşından sonra ise 30 Eylül Çarşamba günü başlar.
- Bir *Denetim noktası (zorunlu)*, iş kategorisi *Denetim* ve *Zorunlu (sözleşmesel)* onay kutusu işaretli bir bitiş kilometre taşıdır.

### Mevcut bir görevi kilometre taşına çevirmek

Göreve sağ tıklayın ve *Kilometre taşını değiştir* öğesini seçin. Ya da *Özellikler* panelinde *Kilometre taşı* onay kutusunu işaretleyin. Menü öğesi tüm seçim için çalışır. Süre 0 olur.

Bunu yeniden kapatırsanız, süresi 0 olan sıradan bir görev olarak kalır. Süreyi kendiniz girin.

### Diğer yollar

- Ctrl+M (Mac'te ⌘+M) seçili bir görev olsa bile, listenin sonuna yeni bir kilometre taşı ekler. *Özellikler* paneli açılmaz.
- Ctrl+M ile veya sağ tık menüsünden yaptığınız bir kilometre taşı, iş kategorisi *Denetim* alır. *Kilometre taşı ▾* menüsünden gelen bir *Başlangıç kilometre taşı* veya *Bitiş kilometre taşı* iş kategorisi *Diğer* alır. Gerekirse iş kategorisini *Özellikler* panelinde değiştirin.
- Bir görevin sağ tık menüsündeki *Kilometre taşı ekle*, kilometre taşını o görevin alt görevi yapar, kardeşi değil.

### Bir görevi veya tüm bir dalı kopyalamak

1. Gantt'ta görevin çubuğuna tıklayın. Ctrl+tıklama ile daha fazla görev seçin.
2. Ctrl+C (Mac'te ⌘+C) tuşlarına basın. Uygulama görevi tüm alt görevleriyle, kopyalanan görevler arasındaki ilişkilerle ve kaynak atamalarıyla birlikte kopyalar.
3. İsterseniz, kopyanın yanına gelmesini istediğiniz görevin çubuğuna tıklayın ve Ctrl+V (Mac'te ⌘+V) tuşlarına basın.

Kopyanın adı, tarihleri ve ilerlemesi aynıdır. Kopya, seçili görevin kardeşi olarak yerleşir (birden çok seçimde: önce tıkladığınız görevin). Bu kardeşlerin en altına gelir. Hiçbir şey seçili değilse, listenin sonuna gelir. Kopya oluşturulduktan sonra kopyalanan görevler seçili olur. WBS kodları (her görevin ağaçtaki numarası, örneğin 1.2; bkz. [Yapıyı ayarlamak](docs://howto-structuur-aanpassen)) yeniden belirlenir ve planlama güncel değildir.

Pano tüm uygulama için ortaktır, bu yüzden başka bir belgeye de yapıştırabilirsiniz. Orada bulunmayan öğeleri, örneğin görev takvimi, özel iş kategorisi, etkinlik kodu veya özel alan, uygulama temizler ve bunu bildirir.

### Daha sonra

Yeni bir görev, diğer tarihleri henüz değiştirmez. Durum çubuğunda *Güncel değil — yeniden hesaplayın (F5)* yazar. **Hesapla** (F5) tuşuna basın; örneğin *Ana sayfa › Zamanlama › Hesapla* yolunu kullanarak.

## Dikkat edilmesi gerekenler ve uygulamanın yaptıkları

**Her yeni görev proje başlangıcında başlar.** İlişki olmadan bir görev hiçbir şey beklemez. İlişki ekleyin; bkz. [İlişki eklemek](docs://howto-relaties-leggen).

**Filtreleme, gruplama veya sıralama açıktır.** Gördüğünüz sıra o zaman planlamanın sırası değildir. Bir görev seçiliyken *Görev* ve *Kilometre taşı ▾* yeni görevi en alta ekler. Bu durumda kırmızı bir bildirim şunu söyler: *Yeni görev en sona eklendi. Filtreleme, gruplama veya sıralama sırasında uygulama onu seçiminizin altına yerleştiremez.* *Üste ekle* ve *Alta ekle* reddedilir; bunun için *Filtreleme/gruplama/sıralama sırasında kullanılamaz* şeridi görünür. Bildirimdeki veya şeritteki *Temizle* düğmesi filtreyi, gruplamayı ve sıralamayı tek seferde kaldırır. Bu işlem *Geri al* kapsamında değildir: Ctrl+Z bunları geri getirmez.

**Kaynak atamaları olan bir göreve alt görev eklemek.** Görev bir özet görev olur. Özet görevin kendisi atama taşımaz. Uygulama atamaları yeni alt göreve taşır ve bunu bildirir. Bu mümkün değilse, örneğin *Kilometre taşı ekle* seçtiğiniz ve bir kilometre taşı atama taşıyamadığı için, uygulama hiçbir şey eklemez ve nedenini söyler.

**Bir kilometre taşının altına alt görev.** Kilometre taşı bir özet görev olur ve uygulama kilometre taşı işaretini bir mesajla birlikte kaldırır.

**Özet görev veya atamaları olan bir görevi kilometre taşı yapamazsınız.** Uygulama reddeder ve nedenini söyler. Atamalar varsa: önce bunları kaldırın.

**Görev tablosunda kopyalama.** Görev tablosunda (ve *Tablo* sekmesinde) Ctrl+C, bir hesap tablosunda olduğu gibi yalnız seçili hücrelerin değerlerini kopyalar. Ctrl+V değerleri hücrelere yapıştırır. Görev kopyalamak bu yüzden yalnız Gantt kullanıldığında çalışır: önce bir çubuğa tıklayın.

## Ayrıca bakın

- [Yapıyı ayarlamak](docs://howto-structuur-aanpassen): görevleri girintilemek ve taşımak; WBS numaralarını güncel tutmak.
- [İlişki eklemek](docs://howto-relaties-leggen): görevler arasında ilişki oluşturmak.
- [Görevleri seçmek, silmek ve geri almak](docs://howto-taken-selecteren-verwijderen): bir görevi yeniden kaldırın.
- [Kritik yol ve bolluk](docs://uitleg-kritiek-pad): uygulamanın, ilişkiler olduğunda hesapladıklarını.
- [Görev iletişim kutusu ve özellikler paneli](docs://ref-taak-eigenschappen): bir görevin tüm alanları.
- [Yeni proje ve proje bilgisi](docs://ref-projectinfo): bir aşama şablonuyla başlamak.
- [Sağ tık menüleri](docs://ref-contextmenus): bir görevin menüsündeki tüm öğeler.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): dört aşamalı, bir başlangıç kilometre taşı ve zorunlu bir teslim kilometre taşı içeren küçük bir örnek proje (*Dosya › Örnekler*).
