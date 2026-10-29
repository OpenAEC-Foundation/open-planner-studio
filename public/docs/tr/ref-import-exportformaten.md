# İçe ve dışa aktarma biçimleri

Her dosya biçimi için: dosyayı açıp açamayacağınız, kaydedip dışa aktarıp aktaramayacağınız, neyin birlikte gelip neyin gelmediği ve hangi hesaplama profiliyle açıldığı. Bunun arkasındaki neden ve sayılarla bir örnek, [Dosyalar ve biçimler](docs://uitleg-bestanden) sayfasında.

## Bir bakışta

**Açma** IFC, CSV, MS Project XML, Primavera P6 XML, `.mpp` ve `.xer` ile çalışır. Uygulama, başka bir uzantıya sahip dosyayı IFC olarak işler.

**Kaydetme** her zaman IFC yazar. Yalnızca açılmış bir IFC dosyası kayıt hedefi olur. Başka bir biçimden gelen proje, açıldıktan sonra dosyaya sahip değildir. *Kaydet* o zaman IFC dosyasının nereye gideceğini sorar.

**Dışa aktarma** şu biçimler için kullanılabilir: IFC, MS Project XML, Primavera P6 XML, CSV ve iki ilerleme sayfası (Excel ve CSV). Dışa aktarma projenizi değiştirmez.

**Salt okunur** olanlar `.mpp` ve `.xer` dosyalarıdır. Uygulama bunları açabilir, ama yazamaz.

**PDF** yalnızca bir rapordan çıkar (bkz. [Rapor türleri](docs://ref-rapporttypes)). Uygulama PDF okumaz.

**Nerede.** Açmak için: *Ana sayfa › Dosya › Aç*, *Dosya › Aç* veya Ctrl+O. Dışa aktarmak için: *Ana sayfa › Dosya › Dışa aktar* veya *Dosya › Dışa aktar*. Doldurulmuş bir ilerleme sayfasını *Dosya › İçe aktar* ile içe aktarırsınız. Ayrıca şeritteki *İlerleme* grubunda, *Planlama*, *Tablo* ve *Rapor* sekmelerinde *Bir tablodan ilerlemeyi güncelle* düğmesini kullanabilirsiniz.

**Açılışta hesaplama profili.** Her biçim bir hesaplama profiliyle açılır. Bunun ne olduğu [Hesaplama seçenekleri ve kurallar](docs://ref-rekenopties-en-conventies) sayfasında. `.xer` dosyası *Primavera P6* ile, `.mpp` dosyası *Microsoft Project* ile açılır. CSV, MS Project XML ve P6 XML dosyaları *Open Planner Studio* ile açılır. IFC, dosyada kayıtlı profili kullanır. `.xer` ve `.mpp` için uygulama, projenin bu şekilde hesaplandığını bildirir. Yalnızca IFC hesaplama profilini ve hesaplama seçeneklerini taşır. Hesaplama seçeneklerinden MS Project XML en fazla kritik eşiği yazar. Başka bir biçimin dışa aktarması yeniden açılırsa, *Open Planner Studio* olarak hesaplanır.

## IFC

**Açma** — evet, `.ifc`. Uygulama IFC4 ve IFC 4.3 (ayrıca ADD2) okur. IFC2X3 gibi başka bir şemadaki dosya da açılır. Dosyayı ilk kaydettiğinizde, uygulamanın yazabildiği bir şemayı seçersiniz (bkz. [IFC şemasını seçme](docs://howto-ifc-schema-kiezen)). Hesaplama profili: dosyada kayıtlı olan.

**Kaydetme** — evet. Kaydedebilen tek biçim budur. *Kaydet* projenizin tamamını, projenin IFC şemasında (varsayılan IFC 4.3 ADD2), bir IFC dosyası olarak yazar. Bu dosya kayıt hedefi olur.

**Dışa aktarma** — evet, *IFC* olarak, projenin IFC şemasında (varsayılan IFC 4.3 ADD2). Varsayılan ad: proje adı, uzantısı `.ifc`. Projeniz bir kaynak kitaplığına bağlıysa, *Kitaplık dosyasını da kaydet* onay kutusu *Dosya › Dışa aktar* ekranında kartların altındadır. İşaretlenirse uygulama önce projenin yerini sorar, sonra *projectname-bibliotheek.ifc* için ayrıca bir yer sorar. Onay kutusu, *Ana sayfa* sekmesindeki listede yer almaz.

**Birlikte gelenler** — projeye ait her şey: yapısı, süresi, tarihleri ve ilerlemesi olan görevler; gecikmeli ilişkiler; kısıtlamalar ve son tarihler; takvimler; saat dağılımı dahil kaynaklar ve atamalar; temel planlar; etkinlik kodları ve özel alanlar; notlar; diğer projelere dış ilişkiler; kesintiler; görev türleri ve özel iş kategorileri; durum tarihi, ilerleme modu, hesaplama profili ve hesaplama seçenekleri gibi proje ayarları; bir kaynak kitaplığına bağlantı. `.xer` dosyasından gelen bir projede özgün kaynak dosyası da birlikte gelir. Özel bir iş kategorisi, IFC türü `USERDEFINED` olarak ve adı ObjectType alanında saklanır. Böylece diğer IFC programları görevi normal okur. Uygulama ayrıca iş kategorisinin sabit kimliğini saklar, bu yüzden yeniden adlandırma bağlantıyı bozmaz. Dosyayı başka bir bilgisayarda açan biri için iş kategorisi orada *Bu projeden* altında görünür, kendi *İş kategorilerim* listesinde değil.

**Birlikte gelmeyenler** — ekranı nasıl ayarladığınız (yakınlaştırma, kaydırma konumu, seçili görev, daraltılmış fazlar, seçilen filtre ve gruplama) ve uygulama ayarları ([Uygulama ayarları](docs://ref-instellingen)). *IFC* sekmesi, projenizin IFC metnini gösterir. *IFC Oluştur* bu metni yeniler, *Kopyala* metni panoya koyar. *Uygula* metni proje olarak yükler; o sekmedeki proje bu metinle değişir.

## MS Project XML (MSPDI)

**Açma** — evet. Uygulama bir `.xml` dosyasını, MS Project ad alanındaki kök öğe `Project` ile (veya ad alanı olmadan) MS Project XML olarak tanır. Hesaplama profili: *Open Planner Studio*. Açtıktan sonra uygulama, almadığı şeyleri tek bir iletide bildirir; bkz. [MS Project dosyasını (.mpp) açma](docs://howto-mpp-openen).

**Kaydetme** — hayır. Böyle bir proje için kayıt hedefi oluşmaz.

**Dışa aktarma** — evet, *MS Project XML* olarak (*Microsoft Project'te açılır. Tam WBS yapısı.*). Varsayılan ad: proje adı, uzantısı `.xml`.

**Birlikte gelenler** — yapısı (düzey ve WBS), süresi, tarihleri ve ilerlemesi olan görevler; gecikmeli ilişkiler, saat cinsinden veya yüzde olarak da; kısıtlamalar, son tarih dahil; takvimler, görev ve kaynak takvimleri dahil; kaynaklar ve atamalar, eğri veya saat dağılımı dahil; durum tarihi; kritik eşik, tam sayı olarak 0 veya daha fazla iş günü ile birlikte *Toplam bolluk ≤ eşik*; bir görevin açıklaması (not olarak); bir görevin görev türü (MS Project görev türü olarak); özel bir iş kategorisi, MS Project'in yok sayabileceği serbest bir alanda (`ExtendedAttribute`), uygulama bunu geri okur. Temel planlarınızdan yalnızca etkin olan gelir, temel 0 olarak. Saat cinsindeki bir görev birimini korur. Bir kilometre taşı da türünü korur: başlangıç, bitiş veya otomatik.

**Birlikte gelmeyenler** — notlar (bir görevdeki denetim listesi), diğer projelere dış ilişkiler, etkinlik kodları ve özel alanlar, ikinci bir kısıtlama, *Elle planlandı* işaretlemesi, dengeleme gecikmesi, sıra dışı ilerlemesi olan bir görevin devam ve durdurma noktası, bir MS Project profilinin kuralları *Kalan iş geçen süreden sonra devam eder* ve *Başlamamış görevleri durum tarihine taşıma*, ve diğer hesaplama seçenekleri. Saat dağılımı olmayan kesintili görevler, kesintileri olmadan gelir.

**Tatiller açılırken.** Türetilmiş bir takvim, temel takvimin istisnalarını devralır. Kendi çalışma haftası olan ve istisnası olmayan bir takvim tatil almaz. Yalnızca temel takvimi, çalışma haftası veya istisnası olmayan sade bir takvim, standart Hollanda tatillerini korur. Tatiller eksikse bitiş tarihiniz farklı olabilir: bkz. [Tatil ve inşaat tatili oluşturma](docs://howto-feestdagen-genereren).

**Yol boyunca değişenler** — *Şu tarihte başlamalı (MSO)* veya *Şu tarihte bitmeli (MFO)* kısıtlaması, *Zorunlu (sabitleme mantığı)* seçeneği olmadan, *Şu tarihten önce başlamaz (SNET)* veya *Şu tarihten önce bitmez (FNET)* olur. Bir hamak, hesaplanan tarihleri olan sıradan bir görev olur. MS Project XML, gün başına saat sayısını yalnızca proje takvimi için saklar. Kendi gün başına saat sayısı olan başka bir takvim, dosya açıldığında çalışma süresini gün başına saat olarak alır: gün başına 8 saat ve çalışma saatleri 10 saat olan bir takvim, gün başına 10 saat olur. Böyle bir takvimde gün cinsinden bir görev bu yüzden kısalır; örneğin 5 gün yerine 4 gün.

## MS Project dosyası (`.mpp`)

**Açma** — evet, MS Project 2010 ile 2021 arasındaki sürümlerden. Hesaplama profili: *Microsoft Project*. Uygulama dosyayı yalnızca okur. `.mpp` dosyanızı asla değiştirmez. MS Project 2007 veya daha eski bir dosyayı ve parola korumalı bir dosyayı reddeder. Bu durumda MS Project'in XML dışa aktarmasını gösteren bir ileti verir. Açtıktan sonra uygulama, almadığı şeyleri tek bir iletide bildirir.

**Kaydetme** — hayır, kayıt hedefi de yoktur. *Kaydet* yeni bir IFC dosyası yazar.

**Dışa aktarma** — hayır.

**Birlikte gelenler** — yapısı, süresi ve kısıtlamaları olan görevler; gecikmeli ilişkiler; takvimler; kaynaklar ve atamalar; ilerleme; MS Project'te kendiniz doldurduğunuz bir WBS kodu. MS Project'in kendi hesapladığı tarihler ve bolluk da okunur, *Kaydedildiği gibi tarihler* görünümü için.

**Birlikte gelmeyenler** — temel planlar, maliyetler ve ücretler, notlar, köprüler, MS Project'in özel alanları, alt projelerin ve dış görevlerin bağlantıları ve kritik eşik. Bkz. [MS Project dosyasını (.mpp) açma](docs://howto-mpp-openen).

**Köken ve lisans** — `.mpp` okuyucusu Open Planner Studio için yazıldı. MPXJ'in (`github.com/joniles/mpxj`, Jon Iles ve diğerleri) kaynak kodundan ve yapısal bilgisinden türetildi. MPXJ, LGPL-2.1 altında bir Java kütüphanesidir. Yapı ve alan sabitleri TypeScript'e aktarıldı. Open Planner Studio'nun kendisi LGPL-3.0 altında açık kaynaktır. `.xer` okuyucusu bir türev değildir: orada MPXJ yalnızca bir başvuru kaynağı olarak incelendi.

## Primavera P6 XML

**Açma** — evet. Uygulama bir `.xml` dosyasını, kök öğe `APIBusinessObjects` ile P6 XML olarak tanır. Hesaplama profili: *Open Planner Studio*.

**Birden çok proje tek dosyada.** Görevi olan her proje kendi sekmesinde açılır; sekmenin adı *Proje adı (Proje ID)*. Görevi olmayan bir proje atlanır. Etkin sekme, en çok görevi olan projedir. Uygulama, başka bir projeye giden bir ilişkiyi ve hiçbir projeye ait olmayan bir görevi aktarmaz. Açtıktan sonra uygulama, kaç proje açtığını bildirir.

**Tatiller açılırken.** MS Project XML ile aynı kurallar geçerlidir: kendi çalışma haftası olan ve istisnası olmayan bir takvim tatil almaz.

**Temel planlar.** Dosyadaki bir `<BaselineProject>`, kendi projesinin temel planı olur. P6'nın etkin olarak işaretlediği temel plan, uygulamada da etkindir.

**Bir atamanın oranı.** Kalan iş varsa, kalan oran (`RemainingUnitsPerTime`) *Birim/gün* olur. Yoksa planlanan oran (`PlannedUnitsPerTime`) olur. Malzeme için planlanan oran aynı kalır. Uygulama dosyayı açarken hiçbir şeyi yeniden hesaplamaz. P6 XML dışa aktarmasında planlanan oranı `PlannedUnitsPerTime` olarak yazar. Kalan oranı `RemainingUnitsPerTime` olarak yalnızca atamanın ayrı bir planlanan oranı olduğunda yazar.

**Okunabilir görev yok.** Uygulama okuyabileceği hiçbir görev bulmazsa, sekme açmaz. Bunu bildirir; nedeni biliniyorsa onu da ekler. Örnekler: `ObjectId` olmayan görevler veya bir XML dosyasındaki XER sütun adları. O zaman projeyi P6'dan yeniden P6 XML olarak dışa aktarın ya da `.xer` olarak açın.

**Kaydetme** — hayır.

**Dışa aktarma** — evet, *Primavera P6 XML* olarak (*Oracle Primavera P6 için.*). Varsayılan ad: proje adı, uzantısı `.xml`; projenin bir ID'si varsa ID parantez içinde eklenir. Bir MS Project XML dışa aktarması da aynı adı alır: adları kendiniz farklı verin.

**Proje adı ve proje ID'si.** Uygulama, P6'daki proje ID'sini bir `.xer` dosyasındaki gibi proje adından ayrı tutar. *Proje ayarları* yalnızca adı gösterir, örneğin *Bid for Facility Extension*. Sekmenin adı *Bid for Facility Extension (OZB-05)* olur. Projeyi *Hall extension* olarak yeniden adlandırırsanız sekmenin adı *Hall extension (OZB-05)* olur. P6 XML dışa aktarması *OZB-05* değerini proje ID'si, *Hall extension* değerini ad olarak geri yazar. Böylece P6 projeyi tanır. Bir `.xer` dosyasındaki proje de proje ID'sini birlikte taşır. Proje ID'si, projeyi IFC olarak kaydettiğinizde de kalır. Adın içindeki parantezler, örneğin *New build (phase 2)*, adın içinde kalır. Proje ID'si olmayan bir proje, dışa aktarırken uygulamadan *OPS:* ile başlayan kendi benzersiz ID'sini alır.

**Birlikte gelenler** — WBS yapısı ve görevler, süre, tarihler ve ilerleme ile; gecikmeli ilişkiler; kısıtlamalar (ikinci bir kısıtlama da, yumuşak kısıtlama olarak); takvimler; kaynaklar ve atamalar; durum tarihi (`DataDate` olarak); kendi alanında özel bir iş kategorisi, `OPS Custom Task Type`. Uygulama bunu geri okur, P6 ise yok sayabilir.

**Birlikte gelmeyenler** — temel planlar ve son tarihler; etkinlik kodları, özel alanlar, notlar ve dış ilişkiler; hesaplama seçenekleri; tatillerin adları. P6'da her tatil gününün ayrı bir adı yoktur: yeniden açıldığında bir tatil *Tatil*, bir çalışma istisnası *Çalışma istisnası* adını alır. Art arda gelen tatil günleri tek bir aralık olarak geri gelir. Uygulama, P6'nın izin verdiğinden uzun bir adı veya kodu kısaltır: bir görev adını 120 karaktere, bir görev ID'sini veya WBS kodunu 40 karaktere, bir WBS veya proje adını 100 karaktere. Kaç ad ve kod kısalttığını bildirir. P6'da yüzde cinsinden gecikme yoktur: uygulama bunu sabit bir gün sayısına çevirir. Takvim günü cinsinden bir gecikme, çalışma saatlerinde bir gecikme olur: 3 takvim günü, 3 iş günü olur. Bir hamak sıradan bir görev olur, elle planlanan bir görev hesaplanan tarihleri olan sıradan bir görev olur ve bir günden kısa bir dengeleme gecikmesi düşer.

## Primavera dosyası (`.xer`)

**Açma** — evet. Hesaplama profili: *Primavera P6*. Uygulama dosyayı yalnızca okur. `.xer` yazmaz ve dosyanızı asla değiştirmez. Görevleri olan her proje için bir sekme açar. Görevi olmayan veya bozuk tablolar içeren bir dosyayı bir iletiyle reddeder.

**Kaydetme** — hayır, kayıt hedefi de yoktur. *Kaydet* yeni bir IFC dosyası yazar. Bu dosyanın içinde özgün `.xer` bulunur.

**Dışa aktarma** — hayır. Bir `.xer` projesini CSV, MS Project XML veya P6 XML olarak dışa aktarırsanız, uygulama XER kaynak bilgisinin kaybolduğunu bildirir. Bu, projeyi arada IFC olarak kaydetmiş olsanız bile geçerlidir. IFC'ye hiçbir şey kaybolmaz.

**Birlikte gelenler** — WBS yapısı ve görevler, süre, tarihler, kısıtlamalar ve ilerleme ile; gecikmeli ilişkiler; takvimler; atamalı kaynaklar; etkinlik kodları; özel alanlar (UDF); notlar; P6'nın planlama ayarları. *Çaba düzeyi* türündeki bir görev bir hamak olur. Bir temel plan projesi, ona başvuran projenin etkin temel planı olur. Uygulama, iki proje arasındaki bir ilişkiyi kaynak verisi olarak tutar.

**Bir atamanın oranı.** Kalan iş varsa, kalan oran (`remain_qty_per_hr`) *Birim/gün* olur. Yoksa planlanmış oran (`target_qty_per_hr`) olur. Planlanmış, gerçek ve kalan iş dosyadaki gibi kalır. Malzeme için planlanmış oran kalır.

**Dosyada olmayan boş bir cumartesi veya pazar.** Bazı P6 dışa aktarımları, birkaç boş günden oluşan bir blok içindeki boş bir hafta sonu gününü önceki cumaya veya sonraki pazartesiye taşır. Takvim cumartesi veya pazar günü çalışıyorsa, o gün yanlışlıkla bir iş gününe dönüşürdü. Uygulama bu örüntüyü en az üç boş günlük bir blokta görürse, o hafta sonu gününü yine de boş yapar. Takvimde bu gün *Takvim istisnası (hafta sonu yeniden oluşturma)* olarak adlandırılır ve mesajın *N takvim bulgusu.* satırında sayılır. Hafta sonu çalışmayan bir takvimde hiçbir şey değişmez.

**Proje bitişine kadar bolluk, bitiş tarihi olmadan.** P6 seçeneği proje bitişine kadar bolluk hesaplamak için açık, ama dosyada projenin bitiş tarihi ve hiçbir görevin planlanmış bitiş tarihi yok mu? O zaman uygulama *Bolluğu proje bitiş tarihine kadar hesapla* seçeneğini kapatır. Ardından geç tarihleri en geç erken bitişten geriye doğru hesaplar. Bu, *N P6 planlama ayarı güvenli geri dönüş kullandı.* satırında sayılır.

**Durum tarihindeki tamamlanmış görevler.** Bazı dosyalar, tamamlanmış bir görevin gerçek tarihlerini değil, durum tarihindeki bir pencereyi kaydeder. *Kaydedildiği gibi tarihler* görünümünde böyle bir görev, durum tarihinde dar bir çubuktur. Yeniden hesaplama onu başka bir yere koyarsa, şeridin verdiği görev sayısına dahil edilir. *Durum tarihi penceresinde tamamlanan görev* kuralı böyle bir pencereyi hesaplar. Yalnızca bu kuralla tamamlanmış bir görev, *Tamamlanan görev: durum tarihinden itibaren geç tarihler* hesaplama seçeneğiyle gerçek bir bolluk alır. Bu kural bir yaklaşımdır: uygulama bu davranışı yalnızca P3 çıktısında gördü ve Primavera bunu hiçbir yerde doğrulamaz. Bu yüzden her yerleşik profilde, *Primavera P6* altında da kapalıdır. Bunu *Hesaplama profili ve seçenekleri* bölümünde açarsınız; proje o zaman özel bir profil alır. Bkz. [Hesaplama seçenekleri ve kuralları](docs://ref-rekenopties-en-conventies).

**Ondalık ayırıcı olarak virgül içeren sayılar.** P6, ondalık ayırıcıyı ve binlik ayırıcıyı `CURRTYPE` tablosunda kaydeder. Uygulama, süreleri, işi ve bolluğu dönüştürmeden önce bu karakterleri okur. Bu bilgi yoksa uygulama ondalık ayırıcı olarak nokta kullanır. Dosyada hâlâ ondalık virgül içeren sayılar varsa, uygulama hiçbir şey açmaz. Böylece yanlış okunmuş sayılarla bir planlama hiçbir zaman açılmaz.

**Birlikte gelmeyenler** — görevi olmayan bir proje ve planınızda gerçek bir ilişki olarak iki proje arasındaki bir ilişki. Bkz. [Primavera P6 dosyasını (.xer) açma](docs://howto-xer-openen).

## CSV

**Açma** — evet. Uygulama `;` ve `,` ayırıcı olarak okur. İngilizce ve Hollandaca sütun başlıklarını tanır (örneğin `Name` veya `Naam`, `Duration` veya `Duur`, `Predecessors` veya `Voorgangers`). Tarihler *yyyy-aa-gg*, *gg-aa-yyyy* veya *gg/aa/yyyy* biçiminde olabilir. Bir öncülü WBS kodu, ilişki türü ve gecikme olarak yazarsınız, örneğin `1.2FS+2d`. Hesaplama profili: *Open Planner Studio*. Proje adı *CSV Import* olur. `Task Type`-sütunu görev türünü değil, iş kategorisini tutar; uygulama ayrıca `Werksoort` ve `Work category` başlıklarını da okur. Sabit kodlardan hiçbiri olmayan bir `Task Type` (uygulamanın kendisinin yazdığı `CONSTRUCTION` veya `INSTALLATION` gibi), *Bu projeden* altında özel bir iş kategorisi olur, *İş kategorilerim* içinde değil. `OPS Custom Task Type ID` ile özel bir iş kategorisinin kimliği korunur.

**Kaydetme** — hayır.

**Dışa aktarma** — evet, *CSV (;)* olarak (*Evrensel tablo dışa aktarımı. Tarihler ve sürelerle birlikte tüm görevler*.), *CSV (noktalı virgülle ayrılmış)* kartında. Dosya ayırıcı olarak noktalı virgül kullanır, UTF-8 biçiminde ve BOM işaretiyle yazılır ve İngilizce sütun başlıkları vardır.

**Birlikte gelenler** — görev başına şu sütunlar: `OPS Task ID`, `WBS`, `Outline Level`, `Name`, `Duration (days)`, `Start`, `Finish`, `Predecessors`, `Task Type`, `OPS Custom Task Type ID`, `Status`, `Completion (%)`, `Actual Start`, `Actual Finish`, `Critical`, `Total Float` ve `Description`. `Task Type`-sütunu iş kategorisini tutar. Tamamlanma tam yüzde olarak yazılır. Saat cinsinden gecikme, uygulama dilinin saat işaretini alır: İngilizcede `1.2FS+2h`, Hollandacada `1.2FS+2u`. Açma ikisini de okur.

**Birlikte gelmeyenler** — kaynaklar, atamalar, takvimler, kısıtlamalar, son tarihler, temel planlar ve durum tarihi. Tarihler *Kaydedildiği gibi tarihler* görünümündeyse, dışa aktarma, kaynak dosyasında bunun kaydedilmediği görevler için `Critical` ve `Total Float` alanlarını boş bırakır.

## İlerleme sayfası (Excel ve CSV)

**Açma** — evet, *Dosya › İçe aktar* (*Bir tablodan ilerlemeyi güncelle*) üzerinden. Ayrıca şeritteki *İlerleme* grubunda, *Planlama*, *Tablo* ve *Rapor* sekmelerinde aynı adı taşıyan düğme ile. Uygulama `.xlsx` ve `.csv` dosyalarını okur, 16 MB'a ve 50.000 satıra kadar. Bu bir projeyi açmaz. Açık projenizin ilerlemesini günceller. Bkz. [Bir elektronik tablodan ilerleme içe aktarma](docs://howto-voortgang-importeren).

**Kaydetme** — hayır.

**Dışa aktarma** — evet, *İlerleme sayfası (Excel)* olarak (listede *İlerleme (Excel)*) ve *İlerleme sayfası (CSV)* olarak (*İlerleme (CSV)*). Varsayılan ad: *projectname-voortgang*. Aynı şerit grubundaki *İlerleme sayfasını dışa aktar* düğmesi, Excel sayfasını tek tıkla oluşturur. Excel sayfasında sabit sütun genişlikleri, kilitli alanlar ve tarih kontrolü vardır. CSV sayfası aynı içeriği düz metin olarak taşır.

**Birlikte gelenler** — `OPS Task ID`, `WBS`, `Name`, `Start`, `Finish`, `Completion (%)`, `Actual Start` ve `Actual Finish` sütunları. Okurken uygulama `Completion (%)`, `Actual Start` ve `Actual Finish` sütunlarını kullanır. `Start` ve `Finish` yalnızca tarih gösterimini tanımak için kullanılır ve planlamanızı değiştirmez. Uygulama satırları `OPS Task ID` ile görevlere bağlar. Bu yoksa, benzersiz bir WBS kodu ile bağlar.

**Birlikte gelmeyenler** — bu sütunların dışında kalan her şey: süre, ilişkiler, kaynaklar ve planlamanızın geri kalanı. Bir özet görev, sayfadan ilerleme almaz.

## PDF

**Açma** — hayır.

**Kaydetme** — hayır.

**Dışa aktarma** — evet, bir rapordan: *Rapor* sekmesinde *PDF dışa aktar* düğmesi. Uygulama bir raporu kendisi yazıcıya göndermez. Kağıda çıkarmanın yolu PDF'dir. İçerik rapor türüne bağlıdır: bkz. [Rapor türleri](docs://ref-rapporttypes) ve [Bir rapor oluşturma ve yazdırma](docs://howto-rapport-maken-en-afdrukken).

## Ayrıca bakınız

- [Dosyalar ve biçimler](docs://uitleg-bestanden): neden IFC kendi biçimdir ve bir dışa aktarmanın neyi kaybettiği, bir örnekle.
- [Dosya açma ve kaydetme](docs://howto-bestand-openen-en-opslaan): adımlar.
- [Dışa aktarma](docs://howto-exporteren): bir biçim seçmek ve dışa aktarmadan sonraki iletiler.
- [Kaydedildiği gibi tarihler](docs://uitleg-datums-zoals-opgeslagen): açılan bir dosyanın neden başka tarihler gösterebildiği.
- [Hesaplama seçenekleri ve kurallar](docs://ref-rekenopties-en-conventies): hesaplama profilleri.
