# Dışa aktarma

Amaç: planlamanızı başka bir biçimde dosya olarak teslim etmek, IFC okumayan biri veya başka bir paket için.

## Ne zaman gerekir

Danışman MS Project ile çalışır, müşteri Primavera ile, taşeron görevleri Excel'de ister ya da IFC'yi işleyemeyen bir pakete planlama gönderirsiniz. Dışa aktarma, başka bir biçimde bir kopyadır. Projenizin kendisini tutmak istiyorsanız kaydedin. Bu, IFC olarak yazar ve her şeyi birlikte taşır. Her biçimin ne taşıyıp ne taşımadığı [Dosyalar ve biçimler](docs://uitleg-bestanden) bölümünde yazar.

## Adımlar

1. *Ana sayfa › Dosya › Dışa aktar* öğesini seçin ve listeden bir biçim seçin. Ya da *Dosya › Dışa aktar* öğesini seçin. Orada her biçim, kısa bir açıklamayla birlikte bir karttır.
2. Pencerede bir ad ve bir konum seçin. Uygulama, biçimin dosya uzantısıyla birlikte proje adını önerir. İlerleme sayfalarının adı *proje-adı-ilerleme* olur ve mümkünse indirmeler klasörünüzde açılır.
3. Onaylayın. Dışa aktarma başarılı olursa, aşağıdaki mesajlar dışında hiçbir mesaj görünmez. *Dosya › Dışa aktar* kullanıyorsanız, pencereyi iptal etseniz bile daha sonra *Ana sayfa* sekmesine dönersiniz. *Ana sayfa* sekmesindeki listeden bir dışa aktarma için pencereyi iptal ederseniz, hiçbir şey olmaz.

Tarayıcınız yalnızca indirme yoluyla kaydediyorsa (Firefox gibi), dosya 1. adımdan hemen sonra indirmeler klasörünüzdedir. Şu mesajı görürsünüz: *İndirme olarak kaydedildi: 'name.xml' artık indirmeler klasörünüzde. Bu ortam uygulamanın seçtiğiniz konuma doğrudan yazmasına izin vermiyor.*

### Hangi biçimi seçersiniz?

*Ana sayfa* sekmesindeki liste ve *Dosya › Dışa aktar* ekranındaki kartlar aynı biçimleri sunar:

- *İlerleme (Excel)* ve *İlerleme (CSV)*, kartlarda *İlerleme sayfası (Excel)* ve *İlerleme sayfası (CSV)*: kimlik, WBS, ad, tarihler ve tamamlanma bilgisi içeren ince bir sayfa. Bunu ilerlemeyi dolduracak kişilere gönderin.
- *CSV (;)*, kartta *CSV (noktalı virgülle ayrılmış)*: hesap tablosunda açtığınız bir görev tablosu.
- *MS Project XML*: Microsoft Project'te açılabilir.
- *Primavera P6 XML*: Oracle Primavera P6 içindir.
- *IFC*: uygulamanın kendi biçimi. Her şeyi içerir, projenin IFC şemasında (varsayılan IFC 4.3 ADD2).

### Kitaplık dosyasıyla bir IFC dışa aktarma

Projeniz bir kaynak kitaplığına bağlıysa, *Kitaplık dosyasını da kaydet* onay kutusu *Dosya › Dışa aktar* ekranındaki kartların altındadır. Bu onay kutusunu işaretleyip *IFC* seçerseniz, uygulama iki kez yer sorar: önce proje için, sonra *proje-adı-kitaplık.ifc* için. Bu onay kutusu yalnızca *Dosya › Dışa aktar* ekranında bulunur, *Ana sayfa* sekmesindeki listede değil.

### Bir ilerleme sayfasını geri okumak

Doldurulmuş bir ilerleme sayfasını *Dosya › İçe aktar* üzerinden geri okursunuz. Bkz. [Bir hesap tablosundan ilerleme içe aktarma](docs://howto-voortgang-importeren).

## Tuzaklar ve uygulamanın o durumda ne yaptığı

**Projeniz değişmez.** Projenizin dosyası aynı kalır. *Kaydedilmedi* işareti varsa, o da kalır.

**Güncel olmayan bir planlama önce yeniden hesaplanır.** Böylece güncel tarihleri alırsınız, *Hesapla* düğmesine basmayı unutsanız bile.

**Bir dışa aktarma ayrıca Son kullanılanlarda da bulunur.** Bu, ilerleme sayfaları için geçerli değildir. Bunu orada açarsanız, o biçimin içe aktarması olarak açılır.

**Bir dışa aktarma her şeyi taşımaz.** Bir CSV dosyasında kaynak ve kısıtlama yoktur. P6 XML'de temel plan ve son tarih yoktur. Hesaplama profili de aktarılmaz: yeniden açılan bir dışa aktarma *Open Planner Studio* olarak hesaplanır. Yalnızca IFC her şeyi taşır. Sayılarla bir örneği [Dosyalar ve biçimler](docs://uitleg-bestanden) bölümünde bulursunuz.

**İki biçim aynı uzantıyı kullanır.** MS Project XML ve Primavera P6 XML, ikisi de *proje-adı.xml* adını alır. Adları kendiniz farklı verin. Yoksa sonradan hangi dosyanın hangi biçim olduğunu bilemezsiniz.

**Döngüsel ilişkisi olan bir planlama dışa aktarılmaz.** Uygulama önce hesaplar ve bir döngü varsa durur. *Ana sayfa* sekmesinde *Planlama hesaplanamadı* mesajını görürsünüz. Altında, örneğin, *Görevler arasında döngüsel ilişki: Set up site → Demolish existing extension → Set up site* yazar. *Dosya › Dışa aktar* ekranında yalnızca bu ikinci metin görünür. Döngüyü çözün ve yeniden dışa aktarın.

**Primavera'dan gelen bir proje kaynak bilgilerini kaybeder.** Bu tür bir projeyi CSV, MS Project XML veya P6 XML olarak dışa aktarırsanız, uygulama şunu bildirir: *CSV biçimine dışa aktarma XER kaynak bilgilerini kaybeder.* MS Project XML için *MSPDI*, P6 XML için *P6* yazar. Bkz. [Bir Primavera P6 dosyasını (.xer) açma](docs://howto-xer-openen).

**Bölünmüş görevler bölünmelerini kaybeder.** MS Project ve Primavera bir bölmeyi yalnızca bir saat dağılımı olarak bilir. Projenizde saat dağılımı olmayan bölünmüş görevler varsa, uygulama MS Project XML veya P6 XML'e dışa aktardıktan sonra şunu bildirir: *Kesintili 2 görev kesintileri olmadan dışa aktarıldı: MS Project/P6 bunları yalnızca iş dağılımı olarak tanır.* Tek bir görev için şunu yazar: *Kesintili 1 görev kesintileri olmadan dışa aktarıldı: MS Project/P6 bunları yalnızca iş dağılımı olarak tanır.* Bkz. [Görevi bölme](docs://howto-taak-splitsen).

**Planlama, *Kaydedildiği gibi tarihler* görünümündeyken.** Kaynak dosyadaki tarihleri görürken CSV'ye dışa aktarırsanız, uygulama kaynak dosyanın kaydetmediği görevler için `Critical` ve `Total Float` alanlarını boş bırakır. Bkz. [Kaydedildiği gibi tarihler](docs://uitleg-datums-zoals-opgeslagen).

## Ayrıca bakın

- [Dosyalar ve biçimler](docs://uitleg-bestanden): her biçimin ne taşıyıp ne taşımadığı.
- [Bir dosyayı açma ve kaydetme](docs://howto-bestand-openen-en-opslaan): projenizi IFC olarak tutmak.
- [Bir hesap tablosundan ilerleme içe aktarma](docs://howto-voortgang-importeren): doldurulmuş bir ilerleme sayfasını okumak.
- [İçe ve dışa aktarma biçimleri](docs://ref-import-exportformaten): her biçimde neyin aktarılıp neyin aktarılmadığı.
