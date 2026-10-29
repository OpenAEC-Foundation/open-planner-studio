# Kaynak paneli

Kaynak paneli, kaynakları yönettiğiniz yerdir: hangi kişinin ve neyin kullanılabilir olduğunu, hangi kapasiteyle ve hangi takvimde. Gantt'ın altındaki histogram ve aşırı atanmışlık da bu panele aittir. Bu makale her alan ve düğme için ne yaptığını, varsayılanın ne olduğunu ve bunu nerede fark ettiğinizi açıklar. Kaynak oluşturmayı ve atamayı [Kaynakları yönetmek](docs://howto-resources-beheren) ve [Kaynakları bir eğriyle atamak](docs://howto-resource-toewijzen) makalelerinde bulursunuz; aşırı atanmışlığı çözmek [Aşırı atanmışlığı çözmek](docs://howto-overbezetting-oplossen) makalesinde açıklanır.

## Nerede bulunur

- **Tam panel** — *Kaynaklar › Yönet › Kaynaklar* veya *Görünüm › Paneller › Kaynaklar*. Çalışma alanını kaplar. Sağ üstteki çarpı işareti onu kapatır.
- **Kaynak doku** — *Kaynaklar › Yönet › Kaynak doku* veya *Görünüm › Paneller › Kaynak doku*: Gantt'ın yanındaki sağ sütunda kompakt bir liste. Aşağıya bakın.
- **Histogram** — *Kaynaklar › Histogram › Histogram* veya *Görünüm › Paneller › Histogram*: Gantt'ın altında bir şerit. Aşağıya bakın.
- **Görünümler** — Projeniz bir kaynak kitaplığına aitse, panelin sağ üstünde *Kitaplık*, *Proje* ve *Doluluk* arasında bir seçim vardır. Kitaplık yoksa yalnızca proje tablosu vardır. Paneli her açtığınızda *Proje* ile başlar; böylece paylaşılan kitaplığa fark etmeden geçmezsiniz.

## Yeni kaynak

- **Projede yeni kaynak** (*Kitaplık* görünümünde *Kitaplıkta yeni kaynak*) — sağ üstteki düğme. Tablonun altında bir taslak satırı açar. Bir ad girip satırdan çıkana kadar (veya Enter'a basana kadar) hiçbir şey oluşturulmaz. Boş bırakıp tıklamanız veya Esc'ye basmanız hiçbir şey bırakmaz: ne kaynak ne de *Geri al* altında bir adım. Alanları istediğiniz sırayla doldurabilirsiniz; her şey bir kerede kaydedilir. Enter veya aşağı ok tuşu satırı kaydeder ve yeni bir taslak satırı açar. Shift+Enter veya yukarı ok tuşu satırı kaydeder ve tabloya geri döner. Taslak satırda kapasite genişleticisi, takvim kalemi ve çöp kutusu yoktur, çünkü bunlar henüz var olmayan bir kaynakla çalışır. *Kaynaklar › Yönet* üzerindeki *Yeni kaynak* düğmesi aynısını yapar.
- **Tablo gezinmesi** — Tabloda Enter, Shift+Enter, yukarı ok tuşu ve aşağı ok tuşu imleci satırlar arasında taşır. Son satırda Enter, yeni bir taslak satırı açar.

## Proje görünümü

Bu projenin kullandıklarını gösteren tablo. Her satır bir kaynaktır. Metin ve ücret değişiklikleri alandan çıktığınızda geçerli olur ve *Geri al* altında tek bir adım sayılır.

- **Renk** — bir renk seçici. Varsayılan: paletteki ilk boş renk. Etkisi: Gantt çubuklarının altındaki kaynak vurgusunun rengi (*Görünüm › Temel plan ve ilerleme › Kaynak vurgusu*) ve kaynak panelindeki renk örneği.
- **Ad** — kaynağın adı. Boş bir ad kaydedilmez; alan eski adına döner.
- **Tür** — *İşçilik*, *Ekipman*, *Malzeme*, *Taşeron* veya *Ekip*. Yeni bir kaynağın varsayılanı: *İşçilik*. Etkisi: *Malzeme* türündeki kaynağın bir *Birim* alanı vardır. Bu tür, histogramdaki *Tüm kaynaklar* toplamına girmez. Dengeleme malzemeyi atlar. *Ekip* türündeki bir kaynak, diğer kaynakların *Ekip* alanında seçilebilir. Diğer türler aynı şekilde hesaplanır.
- **Maks. birim** — kaynağın günde ne kadar kullanılabilir olduğu, 0'dan büyük bir sayı (kesirler mümkündür). Varsayılan: 1. Etkisi: günlük kapasite. Yük daha yüksekse kaynak aşırı atanmış olur. Yanındaki ok *Zamana bağlı kapasite* bölümünü açar; okun yanındaki sayı adım sayısıdır.
- **Zamana bağlı kapasite** — adımlar, *Başlangıç* (bir tarih) ve *Maks. birim* ile. *Adım ekle* bugünün tarihiyle ve 1 değeriyle bir adım ekler. Adım yoksa şunu yazar: *Adım yok — sabit maks. birim her zaman geçerlidir.* Etkisi: bir adımın tarihinden itibaren o adımın *Maks. birim* değeri, sabit değerin yerine geçer. Bir gün için, tarihi o güne eşit veya ondan önce olan son adım geçerlidir.
- **Takvim** — *Proje takvimi* (varsayılan), projenin takvimleri ve yeni bir takvim için *+ Kaynak takvimi* içeren bir liste. Kalem (*Düzenle…*) seçilen takvimi açar; *Proje takvimi* için devre dışıdır. Etkisi: kaynağın çalıştığı günler. Çalışılmayan bir günde kapasite 0 olur. O gün iş planlanmışsa kaynak, *Bu gün "…" takvimine göre çalışmıyor* nedeniyle aşırı atanmış olur. Kaynak takvimi, bir görevin tarihlerini değiştirmez. Bkz. [Takvim pencereleri](docs://ref-kalenders).
- **Ücret/saat** — saatlik maliyet. Boş = ücret yok; geçersiz bir sayı varsayılana döner. Etkisi: planlama ya da yük üzerinde etkisi yoktur. Ücret, *Toplam* sütununun değerini belirler; IFC-dosyasına kaydedilir ve MS Project'e (standart ücret) ve Primavera P6 XML'e (birim fiyat) dışa aktarılırken birlikte yazılır.
- **Toplam** — salt okunur: yüklenen saatler × ücret, iki ondalık basamakla; ücret ya da yük yoksa *—*. En altta, *Toplam* satırı tüm kaynakları toplar. Saatler son hesaplamadan gelir ve görevin takvimindeki gün başına birim × saat sayılır. Güncel değil mi? *Hesapla* düğmesine basın.
- **Birim** — malzemenin ölçü birimi, örneğin `m³`. Yalnızca *Malzeme* türü için doldurulabilir (ipucu: *Yalnızca Malzeme türündeki kaynaklar için doldurulur.*). Etkisi: bir etiket; hesaplama yapmaz.
- **Ekip** — kaynağın ait olduğu ekip; *Ekip* türündeki kaynaklardan seçilir. Varsayılan: *Yok*. Etkisi: yalnızca gruplama. Bir ekibin kapasitesi ve yükü, üyelerinin toplamı değildir.
- **Sil** (çöp kutusu) — kaynağı siler. Atamaları varsa uygulama önce *'…' için … atama var — silinsin mi?* diye sorar; onaylamak için bir onay işareti, iptal etmek için bir çarpı vardır.
- **Kitaplığa ekle** — yalnızca proje bir kaynak kitaplığına aitse ve kaynağın adı henüz kitaplıktan gelmiyorsa. Kaynağı kitaplığa ekler ya da aynı adlı mevcut bir öğeye bağlar ve ne olduğunu bildirir (*Eklendi.*, *Kitaplıkta zaten vardı — şimdi bağlandı.* veya *Kitaplıktaki mevcut öğeyle bağlandı — değerler farklı, işarete bakın.*).
- **Kitaplıktan ayır** — kitaplıktan gelen bir kaynaktaki ayırma simgesi. Kaynağın kökenini kaldırır; bundan sonra tüm alanlar yeniden serbesttir.

Kaynak yoksa şunu yazar: *Henüz kaynak yok. Başlamak için bir tane ekleyin.* Proje bir kitaplığa aitse şunu yazar: *Bu proje henüz kitaplık kaynağı kullanmıyor.* Bunun yanında bir ipucu gösterilir.

### Kitaplıktan gelen kaynaklar

Kitaplıktan gelen bir kaynağın küçük bir kitaplık simgesi vardır (*Kitaplıktan*). Bu kaynağın *Ad*, *Tür*, *Ücret/saat* ve *Birim* alanları düz metin olur (*Kitaplık değeri — Kitaplık görünümünde düzenleyin veya bu kaynağı kitaplıktan ayırın.*), çünkü kaynağın ne olduğuna kitaplık karar verir. *Renk*, *Maks. birim*, kapasite adımları, *Takvim* ve *Ekip* düzenlenebilir kalır, çünkü ne kadar ve ne zaman olduğuna proje karar verir. İki rozet görünebilir: *farklı — karar ver* (tıklayınca *Kaynak kitaplığını bağla* penceresi açılır) ve *artık kitaplıkta değil*, yanında *Projeden kaldır* düğmesiyle.

## Kitaplık görünümü

Bu görünüm yalnızca proje bir kaynak kitaplığına aitse görünür. Bkz. [Kaynak kitaplığını kullanmak](docs://howto-resourcebibliotheek-gebruiken) ve [Kaynak kitaplıklarını yönetmek ve paylaşmak](docs://howto-bibliotheken-beheren). En üstte renkli bir uyarı vardır: *Bu, kitaplığı düzenler ve tüm projeler için geçerlidir — geri almanın dışında.* Tablonun alanları *Proje* görünümüyle aynıdır, şu farklarla:

- *Toplam* sütunu yoktur: bu, tek bir proje için bir hesaplamadır.
- *Ekip* sütunu, kitaplıkta kaynak olduğu anda görünür.
- *Takvim* sütunu kitaplığın takvimlerini sunar. Varsayılan: *Takvim yok*.
- **Projeye ata** — kaynağı, takviminin bir kopyasıyla birlikte projeye koyar. Bildirir: *Eklendi.* veya *Zaten projede mevcut.*
- **Sil** — şunu sorar: *'…' kitaplıktan kaldırılsın mı? Bu, tüm projeler için geçerlidir ve geri alınamaz.*
- Kaynak yoksa şunu yazar: *Havuzda henüz kaynak yok.*

## Doluluk görünümü

Açık tüm belgelerde kitaplık kaynaklarının nerede ayrıldığını gösteren salt okunur bir görünüm. Yeni kaynak için bir düğme yoktur. Bkz. [Doluluk genel bakışını kullanmak](docs://howto-bezettingsoverzicht-gebruiken).

- **Tablo** — kitaplık kaynağı başına: *Ad*, *Belgeler* (kaynağın yer aldığı belge sayısı), *Dönem* ve Zirve / Kapasite (o gündeki toplam yükün kapasiteye karşı en yüksek değeri). Kırmızı *N gün aşırı atanmış* ifadesi, kaynağın birkaç belgede birlikte kapasitesinden fazla olduğu anlamına gelir. Bir adın yanındaki ok, belgeleri dönem ve zirveleriyle birlikte açar. Bir satıra tıklamak o kaynağın histogramını gösterir (*Histogramı görmek için bir kaynak seçin.*).
- **Neyin sayıldığı** — yalnızca bu uygulamada açık olan belgeler (*Bu genel bakış yalnızca bu uygulamada açılan belgeleri görür.*). Hesaplanmamış bir belge, satırında bir mesaj alır. Etkin belge, son hesaplanan değerleriyle sayılır (*Güncel değil: bunlar son hesaplanan değerlerdir — bu belgede F5'e basın.*). Başka bir belge genel bakış tarafından önceden hesaplanır (*Bu genel bakış için önceden hesaplandı — belge kendisi orada F5'e basana veya “Otomatik hesapla” seçeneğini açana kadar hâlâ eski tarihleri gösterir.*). *Otomatik hesapla* açıksa genel bakış bu belgeleri gerçekten hesaplar. Hesaplama başarısız olursa belge sayılmaz (*Sayılmaz: plan hesaplanmadı — bu belgeyi etkinleştirin ve F5'e basın.*). Ayrılmış kaynak yoksa şunu yazar: *Açık belgelerde kitaplıktan ayrılmış kaynak yok.*
- **Sıra** — aşırı atanmış kaynaklar en üsttedir; önce en çok çakışan gün, sonra alfabetik sıra.

## Kaynak doku

Sağ sütunda, *Özellikler* paneli yanında kompakt bir liste. Kaynak başına: bir renk örneği, ad (salt okunur), kaynağın en az bir aşırı atanmış günü olur olmaz kırmızı bir üçgen *Aşırı yüklü* ve düzenlenecek *Maks. birim*. Bir görev seçimi varsa yalnızca o görevlerin kaynakları listelenir. Üstbilgide *Tam panel* (tam paneli açar) ve *Sabitlemeyi kapat* bulunur. Kaynak yoksa şunu yazar: *Henüz kaynak yok. Başlamak için bir tane ekleyin.*

## Histogram

Gantt'ın altında, bir kaynağın günlük yükünü gösteren bir şerit. Bunu *Kaynaklar › Histogram › Histogram* veya *Görünüm › Paneller › Histogram* ile açıp kapatın. Varsayılan: kapalı; seçiminiz hatırlanır. Yükseklik varsayılan olarak 160 piksel'dir ve Gantt ile histogram arasındaki kenardan sürüklenerek değiştirilebilir.

- **Seçici** — solda, görev tablosunun altında bir liste vardır: en üstte sabitlenmiş *Tüm kaynaklar*, altında her kaynak için bir satır. Bir tıklama satırı seçer, ok tuşları satırlar arasında gezer; *Kaynaklar › Histogram › Önceki* ve *Sonraki* aynısını yapar. Bir satırın yanındaki kırmızı nokta, o kaynağın en az bir aşırı atanmış günü olduğunu gösterir; *Tüm kaynaklar* için nokta yalnızca malzeme olmayan kaynaklara bakar. Bir görev seçimi varsa liste yalnızca o görevlerin kaynaklarını içerir. Seçtiğiniz kaynak bu kapsamın dışında kalırsa şerit, geçici olarak seçimin *Tüm kaynaklar* görünümünü gösterir.
- **Çubuklar** — gün başına bir çubuk: yük birim cinsinden. Bir çizgi kapasiteyi gösterir; çubuğun kapasitenin üstünde kalan kısmı kırmızıdır. Sol üstte *birim* ile birlikte en yüksek değer yer alır. *Tüm kaynaklar*, malzeme hariç, tüm kaynakların yükünü ve kapasitesini toplar.
- **İpucu** — fareyi bir günün üzerinde bir an hareketsiz tutun: *{date} tarihinde N görev katkıda bulunuyor* ile birlikte en fazla sekiz görevin adı. Seçilen bir kaynak için ve takvimi o gün çalışmıyorsa, ayrıca şunu yazar: *Bu gün "…" takvimine göre çalışmıyor*.
- **Şeritteki mesajlar** — yük yokken *Yükü göstermek için yeniden hesaplayın (F5)*, kaynak yokken *Henüz kaynak yok* ve planlama güncel değilken sağ üstte *⚠ Planlama güncel değil — yeniden hesaplayın (F5)*.
- **Neyin sayıldığı** — her atamanın gün başına birimleri, görevin iş günlerine *Eğri* (veya *Saat dağılımı*) seçeneğine göre yayılır; yalnızca uç görevler, kilometre taşı değil. Yük, *Hesapla* işleminden sonra ve kaynaklardaki ve atamalardaki değişikliklerden sonra yenilenir. Görevlerin tarihlerini değiştirirseniz bu yalnızca *Hesapla* işleminden sonra sayılır.

## Aşırı atanmışlık

Bir kaynak, bir günde yükü kapasitesinden yüksekse aşırı atanmış olur. Kapasite, takviminin bir iş gününde *Maks. birim* (kapasite adımlarıyla birlikte), çalışılmayan bir günde ise 0'dır. Burada malzeme de sayılır. Nedeni, ya yetersiz kapasite ya da kaynağın takvimine göre çalışmadığı bir gündür.

Nerede görürsünüz:

- **Kaynaklar › Aşırı atanmışlık** — aşırı atanmış kaynakların sayısı veya *Yok*.
- **Durum çubuğu** — *N kaynak aşırı atanmış*; tıklayınca *Uyarılar* paneli açılır.
- **Uyarılar** — her kaynak için bir satır: *N gün aşırı atanmış (ilk – son)*. Tüm günler çalışılmayan günse *kaynak bu günlerde takvimine göre çalışmaz* eklenir; karışık ise *bunların N günü kaynağın takvimine göre çalışmadığı günler* ifadesi kullanılır. Bkz. [Bildirimler ve uyarılar](docs://ref-meldingen).
- **Histogram** — çubukların kırmızı kısımları ve seçicideki kırmızı nokta.
- **Kaynak paneli** — *Aşırı yüklü* üçgeni.

Dengeleme, görevleri daha geç başlatarak aşırı atanmışlığı çözebilir. Varsayılan olarak proje bitişi değişebilir; *yumuşatma* seçildiğinde bu tarih bolluk içinde kalır. Çalışılmayan bir günde çalışması gereken bir kaynağı ise dengeleme çözmez. Bkz. [Dengeleme](docs://uitleg-nivelleren).
