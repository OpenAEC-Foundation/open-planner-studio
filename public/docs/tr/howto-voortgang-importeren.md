# Bir e-tablodan ilerleme içe aktarma

Hedef: saha personelinin bir e-tabloda doldurduğu ilerlemeyi tek seferde planlamaya aktarmak. Her görevi kendiniz tek tek tıklamanız gerekmez.

## Bunu ne zaman gerekir

Bir taşeron veya saha yöneticisinin uygulaması yoktur, ama durumunu her hafta bildirir: yüzde kaç tamamlandı, ne zaman başladı, ne zaman bitti. Ona görevlerinizin olduğu bir sayfa gönderirsiniz. Üç sütunu doldurup geri gönderir. Uygulama bu sayfadan görev başına yalnızca üç değer okur: tamamlanma, gerçek başlangıç ve gerçek bitiş. Planlamanızın geri kalanı olduğu gibi kalır. Uygulamanın bu ilerlemeyle ne yaptığı [İlerleme, durum tarihi ve temel plan](docs://uitleg-voortgang) bölümünde açıklanır.

## Adımlar

### 1. Durum tarihini ayarlayın ve hesaplayın

Durum tarihini, [İlerlemeyi güncelleme](docs://howto-voortgang-bijwerken) bölümünde açıklandığı gibi ayarlayın. Saha yöneticisi gerçek tarihleri bu güne kadar, bu gün dahil doldurur. Planlama güncel değilse uygulama, sayfayı oluşturmadan önce onu yeniden hesaplar.

### 2. Sayfayı oluşturun

*Planlama › İlerleme › İlerleme sayfasını dışa aktar* öğesini seçin. Aynı düğme *Tablo* ve *Rapor* sekmelerinde de bulunur. Uygulama bir Excel dosyası oluşturur ve adı olarak *(proje adı)-voortgang.xlsx* önerir. Tarayıcıda dosya indirilenler klasörünüze kaydedilir. CSV tercih ediyorsanız *Dosya › Dışa aktar › İlerleme sayfası (CSV)* öğesini seçin. Excel sayfası da var: *İlerleme sayfası (Excel)*.

Sayfada sekiz sütun var. Sütun adları İngilizce kalır. Her adın ardına uygulamanın dilinde kısa bir açıklama gelir:

- `OPS Task ID`, `WBS` ve `Name` yalnızca görevi tanımak için vardır. Bunlara dokunmayın.
- `Start` ve `Finish` planlanmış tarihlerdir, bilgi amaçlıdır. Uygulama bunları asla geri yazmaz.
- `Completion (%)`, `Actual Start` ve `Actual Finish` doldurmanız gereken sütunlardır.

Excel sayfası parolasız korumalıdır: yalnızca üç doldurulacak sütun düzenlenebilir. Excel, yüzdenin 0 ile 100 arasında olduğunu ve gerçek tarihin bir tarih olduğunu denetler. Bir faz (özet görev) gri işaretlenir ve *— özet görev: doldurmayın* yazısı alır.

### 3. Sayfanın doldurulmasını sağlayın

Her görev için saha yöneticisi şunları doldurur:

- `Completion (%)`: 0 ile 100 arasında, bu değerler dahil. Uygulama ondalık sayıları da okur, virgül veya nokta ile (örneğin 33,3 veya 33.3). CSV'deki açıklama yine tam sayı ister: farklı bölge ayarına sahip bir hesap tablosu 8,38 değerini 838 olarak okuyabilir.
- `Actual Start` ve `Actual Finish`: Excel'de kendi bölge ayarınıza uygun bir tarih olarak; CSV'de gg-aa-yyyy veya yyyy-aa-gg biçiminde.

Boş kalan her şey hiçbir şeyi değiştirmez. Dolayısıyla boş bir hücre mevcut ilerlemeyi de silmez. Mevcut ilerlemeyi silmek yalnızca uygulamada yapılabilir. Henüz başlamamış bir görevi ise saha yöneticisi tamamen boş bırakır.

### 4. Sayfayı içe aktarın

1. *Planlama › İlerleme › Bir tablodan ilerlemeyi güncelle* öğesini seçin (ayrıca *Tablo* ve *Rapor* sekmelerinde), veya *Dosya › İçe aktar › Bir tablodan ilerlemeyi güncelle* öğesini seçin. *Bir tablodan ilerlemeyi güncelle* penceresi açılır.
2. *Dosya seç…* düğmesini tıklayın ve doldurulmuş `.xlsx` veya `.csv` dosyasını seçin.
3. CSV'deki tarihler belirsizse uygulama *Önce gün mü, önce ay mı?* diye sorar. Dosyanızdaki tarih iki şekilde okunmuş olarak gösterilir. Doğru olan tarihe tıklayın.
4. Şimdi bir önizleme görürsünüz. Üstte dört sayaç vardır: *Uygulandı*, *Değişmedi*, *Eşleştirme bekliyor* ve *Reddedildi*. Bunun altında her görev için neyin değiştiği görünür, örneğin *Completion: %0 → %100*.
5. Önizlemeyi kontrol edin ve *Uygula* düğmesini tıklayın. Pencerede *Sonuç* gösterilir. Sayaçlar ile reddedilen satırlar ve nedenleri de burada yer alır. Bitirmek için *Kapat* düğmesini tıklayın.

Önizlemeyi atlayamazsınız. *Uygula* düğmesi, uygulanacak bir şey olmadığı sürece devre dışıdır.

### 5. Planlamayı yeniden hesaplayın

İçe aktarma planlamayı kendiliğinden yeniden hesaplamaz. **Hesapla** (F5) tuşuna basın, örneğin *Planlama › Zamanlama › Hesapla* üzerinden. Bunu, *Otomatik hesapla* açık değilse yapın.

## Tam olarak uymayan satırlar

Uygulama her satırı bir göreve eşleştirir: önce `OPS Task ID` ile, yoksa WBS numarasına göre.

**Eşleştirme şüpheli.** Uygulama görevi yalnızca WBS numarasıyla bulduysa satır *Eşleştirme şüpheli* bölümünde yer alır. *Onayla* ve *Değiştir* düğmeleri de burada görünür. Hiçbir şey yapmazsanız satır yine de uygulanır. Bu yüzden görevin doğru olduğunu kontrol edin. *Onayla* satırı bu listeden çıkarır, ama uygulanacak şeyi değiştirmez. *Değiştir* ile başka bir görev seçebilirsiniz. *Eşleştirmeyi kaldır* ile kendi yaptığınız eşleştirmeyi kaldırırsınız. Not: aynı WBS numaralarına sahip başka bir projeden gelen bir sayfa yine de eşleştirilir. Satır *Eşleştirme şüpheli* altında görünür ve *Uygula* tıklandığında uygulanır.

**Eşleştirme bekliyor.** Uygulama hiç görev bulamazsa veya aynı WBS numarasına sahip birden fazla görev bulursa satır *Eşleştirme bekliyor* bölümünde yer alır. *Bir görev seçin…* alanında doğru görevi seçin. WBS numarasına veya ada göre arama yapabilirsiniz. Satırı eşleştirmezseniz satır reddedilir.

## Tuzaklar ve uygulamanın yaptıkları

Uymayan bir satır bir nedenle reddedilir. Sayfanın geri kalanı normal devam eder. Başlıca iletiler şunlardır:

- *Gerçek tarih, durum tarihinden sonra.* Durum tarihini daha sonraki bir tarihe ayarlayın veya sayfayı düzeltin.
- *Bu görev plana göre durum tarihinden sonra başlıyor: önce sayfaya gerçek başlangıcını girin.* Uygulama başlangıç tarihi uydurmaz. Bunu sayfada siz sağlayın.
- *Yüzde 0–100 aralığının dışında. Ondalık ayırıcıyı kontrol edin: farklı bölge ayarlarına sahip bir e-tablo "8,38" değerini 838 olarak okuyabilir.*
- *Özet görevler bir tablodan ilerleme alamaz.* Bir fazın ilerlemesi, altındaki görevlerden hesaplanır.
- *Gerçek bitiş, gerçek başlangıçtan önce.*
- *Okunamayan tarih.* ve *Okunamayan yüzde.*
- *Girilen değerler birbiriyle çelişiyor.* Örneğin yüzde 100'den küçükken bir gerçek bitiş girilmesi.
- *Bu satır için görev bulunamadı.* Sayfa, bu projede geçmeyen bir görev kimliği ve WBS numarası içeriyor.
- *Bu WBS kodu birden fazla görevde geçiyor — satırı elle eşleştirin.*
- *Bu görevi başka bir satır zaten aldı.* İki satır aynı göreve işaret ediyor.
- *Planlayıcı tarafından reddedildi.* Planlamanın kendisinin verdiği, kendi iletisi olmayan başka bir red.

Tüm dosya reddedilirse pencerede şu iletilerden biri görünür: *Bu dosyada satırları görevlerle eşleştirecek “OPS Task ID” veya “WBS” sütunu yok.*, *Bu dosyada Tamamlanma, Gerçek Başlangıç veya Gerçek Bitiş sütunlarından hiçbiri yok.*, *Bu dosya ilerleme tablosu olarak okunamayacak kadar büyük.* (16 MB'tan fazla), *Bu dosya ilerleme tablosu olarak okunamayacak kadar çok satıra sahip.* (50.000 satırdan fazla), *Bu dosya parola korumalı ve okunamıyor.* veya *Bu dosya ilerleme tablosu olarak okunamadı.*

**Durum tarihi yok.** Henüz bir durum tarihi yoksa ve içe aktarma ilerlemeyi uygular, uygulama durum tarihini bugüne ayarlar ve bunu size bildirir. Bu yüzden önce kendiniz ayarlayın.

**Tek adımda geri alınır.** Tüm sayfa, Ctrl+Z için tek bir adımdır.

**Yalnızca doldurduklarınız.** Planlamadan farkı olmayan bir satır *Değişmedi* sayılır. Sayfada satırı olmayan bir görev olduğu gibi kalır.

## Ayrıca bakın

- [İlerleme, durum tarihi ve temel plan](docs://uitleg-voortgang): uygulamanın gerçek tarihler ve yüzdelerle ne hesapladığı.
- [İlerlemeyi güncelleme](docs://howto-voortgang-bijwerken): ilerlemeyi uygulamanın içinde girmek.
