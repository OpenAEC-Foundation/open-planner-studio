# Yapay zeka araçları (planner_*)

Bu sayfada, yapay zeka asistanının köprü üzerinden çağırabildiği tüm araçlar vardır. Araçlar gruplara göre sıralanmıştır; her aracın ne yaptığı ve neyi reddettiği de yazılır. Her aracın adı `planner_` ile başlar. *Bağlantı bilgileri* penceresindeki bağlantı istemi geçerli port numarasını gösterir. Yapay zeka asistanı tam listeyi, açıklamalarıyla birlikte, köprünün kendisinden alır (`tools/list`). Bağlantının neden böyle çalıştığını [Yapay zeka bağlantısı nasıl çalışır](docs://uitleg-ai-koppeling) bölümü açıklar. Bağlantıyı nasıl açacağınız [Yapay zeka asistanını bağlamak (MCP)](docs://howto-ai-assistent-koppelen) bölümünde yazar.

## Bu listeyi nasıl okursunuz

**Okuma** demek: araç hiçbir şeyi değiştirmez. Bu, *Duraklat* ve *Salt okunur* modlarında da geçerlidir. Açık bir iletişim kutusu okumayı engeller (bkz. aşağıda *Bir araç reddedildiğinde*). Bir okuma aracı her zaman güncel tarihleri verir. Planlama güncel değilse, araç önce yeniden hesaplar. Bu, *Duraklat* ve *Salt okunur* modlarında da olur. Bu modlar değişiklikleri durdurur, okurken yapılan yeniden hesaplamayı değil. Bir düzenleme ortasındaysanız (bir çubuğu sürüklüyorsanız, bir alana yazıyorsanız), araç yeniden hesaplamaz. Yapay zeka asistanı o zaman düzenlemenizden önceki tarihleri alır. Ayrıca bir uyarı alır: tarihler güncel değildir. Proje *Kaydedildiği gibi tarihler* görünümündeyse, araç yeniden hesaplamaz. Yapay zeka asistanı o zaman kaydedilmiş tarihleri alır. Ayrıca bir uyarı alır: tarihler yeniden hesaplanmamıştır.

**Değiştirme** demek: araç projenizi değiştirir. Bu araçlar *Duraklat* ve *Salt okunur* modlarında reddedilir. Bir iletişim kutusu açıksa da reddedilirler. Etiketi olmayan araçlar da geçerlidir: `planner_undo`, `planner_redo`, dosya araçları ve belge araçları. Bunun istisnası `planner_list_documents` aracıdır. Her değişiklik, geri alma geçmişinizde bir adımdır. Proje verisi değişirse, uygulama planlamayı daha sonra kendisi yeniden hesaplar. *Hesapla* komutuna basmanız gerekmez. Her belgede ilk değişiklikten önce, *Otomatik yedekleme* açıksa, uygulama bir yedek yazar.

**Toplu** demek: tek bir çağrı birkaç öğe içerebilir. Geçersiz bir öğe bir nedenle reddedilir. Geçerli öğeler kalır. Yanıt, reddedilen öğeleri belirtir.

## Okuma: planlama

- `planner_get_project_info` (okuma) — proje ayrıntıları ve temel rakamlar: görev, ilişki, kaynak ve kilometre taşı sayısı, durum tarihi, projenin bitiş tarihi ve süresi, planlamanın güncel olup olmadığı, hesaplama profili ve takvimlerin özeti. İlk çağrı için iyidir.
- `planner_get_project_overview` (okuma) — tüm WBS ağacı tek bir yanıtta: her görev kimliği için WBS, ad, süre, erken tarihler, ilerleme, kritik olup olmadığı ve çıkan ilişkiler ile ilişki kimlikleri.
- `planner_list_tasks` (okuma) — görevleri filtrelerle (kritik, durum, tarih aralığı, ilişkisiz görevler) ve sayfalama ile listeler.
- `planner_get_task` (okuma) — tek bir görevi ayrıntılı gösterir: tarihler, bolluk, ilerleme, kısıtlamalar, son tarih, takvim, atamalar, öncüller ve ardıllar, kesintiler.
- `planner_get_critical_path` (okuma) — kritik görevleri toplam bollukla birlikte ve kritik yolu yönlendiren ilişkileri gösterir.
- `planner_list_resources` (okuma) — kaynakları kapasite, ücret, takvim, ekip, uygunluk ve atamalarının özetiyle gösterir. Bir kaynak bir kaynak kitaplığından geliyorsa, hangi alanların sabit olduğunu da gösterir.
- `planner_get_resource_histogram` (okuma) — kaynak başına yük ile kapasiteyi, gün, hafta veya ay bazında gösterir. Varsayılan hafta. Pencere ve kaynak verilmezse, her kaynak için bir özet verir. Pencere veya kaynak verilirse, tam seriyi ve aşırı atanmışlığa neden olan görevleri verir.
- `planner_get_calendars` (okuma) — tüm takvimleri tam tanımlarıyla gösterir. Ayrıca her takvimi kaç görevin ve kaynağın kullandığını gösterir.

## Okuma: temel planlar ve sapma

- `planner_list_baselines` (okuma) — kayıtlı temel planları ve hangisinin etkin olduğunu gösterir.
- `planner_compare_baseline` (okuma) — geçerli planı etkin temel planla karşılaştırır. Yalnızca farklı olan görevleri gösterir. Proje bitişindeki farkı da gösterir, geçerli proje takvimindeki iş günü olarak. Etkin temel plan yoksa reddeder.
- `planner_analyze_delay` (okuma) — etkin temel plana göre geç kalma analizi: teslimdeki fark ve yer değiştiren kritik görevler. Etkin temel plan yoksa reddeder.

## Görevler ve yapı

- `planner_add_tasks` (değiştirme, toplu) — görev oluşturur. Tek bir çağrıda iç içe bir WBS de oluşturabilir. Her göreve kendi geçici adı (`tmp-…`) verilir, böylece bir alt görev üst görevine başvurabilir. Süre verilmezse görev 5 iş günü alır. Bir kilometre taşının süresi 0'dır. Bir çağrının tüm görevleri birlikte başarılı olur veya birlikte başarısız olur.
- `planner_update_tasks` (değiştirme, toplu) — mevcut görevlerin alanlarını değiştirir: ad, açıklama, süre ve birim (gün veya saat), süre türü, iş kategorisi, kilometre taşı, zorunlu, öncelik, kısıtlama, son tarih, takvim ve görev türü. Ayrıca bir ilerleme yolu vardır: tamamlanma yüzdesi, gerçek başlangıç ve gerçek bitiş. Başka her anahtar bir nedenle reddedilir.
- `planner_delete_tasks` (değiştirme) — görevleri siler, alt ağaçlarıyla, ilişkileri ve atamalarıyla birlikte. Yanıt, onlarla birlikte neyin gittiğini tam olarak belirtir.
- `planner_move_task` (değiştirme) — bir görevi bir konumla birlikte başka bir üst göreve taşır. Döngüsel bir başvuru oluşturan taşıma veya bir görevi kendi altına koymak reddedilir.
- `planner_set_task_splits` (değiştirme) — bir görevin kesintilerini ayarlar: kaç iş günü (veya çalışma saati) çalıştıktan sonra ve kaç iş günü (veya çalışma saati) duraklama. Boş bir liste tüm kesintileri kaldırır. Bkz. [Görev bölme](docs://howto-taak-splitsen).

## İlişkiler

- `planner_add_dependencies` (değiştirme, toplu) — bir tür (`FS`, `SS`, `FF`, `SF` veya uzun biçim) ve bir gecikmeyle ilişkiler oluşturur, örneğin `+2d`.
- `planner_update_dependencies` (değiştirme, toplu) — mevcut bir ilişkinin türünü, gecikmesini, öncülünü veya ardılını ilişki kimliğiyle değiştirir. Bu tek bir adımdır. İlişkiyi silip yeniden oluşturmanın yerine geçer.
- `planner_remove_dependencies` (değiştirme, toplu) — ilişkileri ilişki kimliğiyle siler.

## Proje ve takvimler

- `planner_update_project` (değiştirme) — ad, açıklama, yazar, şirket, başlangıç tarihi, bitiş tarihi, durum tarihi, ilerleme modu ve projenin görev türü için varsayılanı. Proje başlangıcı, yeni görevler için bir çapadır. Yapay zeka asistanı bunu daha sonra ayarlarsa, yalnızca serbest görevler taşınır. Serbest görevler, öncülü olmayan ve *şu tarihten önce başlamaz (SNET)* gibi bir alt sınır koyan bir kısıtlaması olmayan görevlerdir. Yanıt taşınan görev sayısını `anchorsClamped` olarak bildirir. Planlamanın geri kalanı yerinde kalır. Bkz. [Yeni proje ve Proje bilgisi](docs://ref-projectinfo). Durum tarihi bir etiket değildir. Hesaplamanın referans tarihidir. İlerlemesi olmayan bir planlamada her şey birlikte hareket eder. Bitiş tarihi yalnızca metadatadır.
- `planner_move_project` (değiştirme) — tüm mevcut planlamayı yeni bir başlangıç tarihine taşır. Takvimler birlikte taşınmaz. Bu yüzden bitiş, başlangıçtan farklı sayıda gün kayabilir. Temel planlar yerinde kalır, yapay zeka asistanı açıkça bunların da taşınmasını istemedikçe. Bkz. [Projeyi taşıma](docs://howto-project-verplaatsen).
- `planner_update_calendar` (değiştirme, toplu) — takvimleri değiştirir veya oluşturur: iş günleri, çalışma saatleri, mola, saat bantları, tatiller (bir ülke ve bölge için oluşturulan veya olduğu gibi verilen) ve çalışma istisnaları. Hangi takvimin proje takvimi olduğunu değiştiremez.

## Kaynaklar ve birimler

- `planner_manage_resources` (değiştirme, toplu) — kaynakları oluşturur, değiştirir veya siler: ad, tür (işçilik, ekipman, malzeme, taşeron veya ekip), açıklama, maks. birim, saat başına maliyet, birim, takvim, ekip ve zamana bağlı uygunluk. Atamaları olan bir kaynağı, yapay zeka asistanı açıkça onaylayana kadar silmeyi reddeder. Bir kaynak kitaplığından gelen bir kaynak için ad, tür, açıklama, saatlik ücret ve birim sabittir.
- `planner_manage_assignments` (değiştirme, toplu) — atamaları ekler, değiştirir, taşır veya kaldırır: iş günü başına birim, eğri ve kalan iş. Atama yalnızca alt görevi olmayan bir görevde yapılabilir; aynı kaynak bir görevde yalnızca bir kez atanabilir. Birim değişikliğinin süreye ne yaptığı, görevin görev türüne bağlıdır. Bkz. [Görev türleri: süre, birim ve iş](docs://uitleg-werkregels).
- `planner_level_resources` (değiştirme) — aşırı atanmayı dengeler. Varsayılan olarak bolluk içinde kalır, bu yüzden bitiş tarihi değişmez. `constrainToFloat: false` ile bitiş tarihi kayabilir. Deneme çalıştırmasıyla yapay zeka asistanı önce, hiçbir şeyi değiştirmeden, bir önizleme alır. Malzemeyi atlar. Bkz. [Kaynak dengeleme](docs://uitleg-nivelleren).
- `planner_clear_leveling` (değiştirme) — tüm dengeleme gecikmelerini temizler.

## Temel planları yönetme

- `planner_save_baseline` (değiştirme) — geçerli planlamayı temel plan olarak kaydeder ve onu hemen etkin yapar. Önce güncel olmayan tarihleri yeniden hesaplar. Bir betikte kullanılamaz.
- `planner_activate_baseline` (değiştirme) — bir temel planı etkin yapar veya hiçbirini etkin yapmaz.
- `planner_rename_baseline` (değiştirme) — bir temel planın adını değiştirir.
- `planner_delete_baseline` (değiştirme) — bir temel planı siler. Silinen etkin olansa, kalan son temel plan etkin olur. Hiç kalmadıysa hiçbiri etkin olmaz.

## Geri alma

- `planner_undo` ve `planner_redo` — etkin belgede bir adımı geri alır veya yineler. Geçmiş sizinkiyle aynıdır. Yanıt, gerçekten bir şeyin geri alınıp alınmadığını söyler.

## Belgeler ve dosyalar

- `planner_list_documents` (okuma) — açık tüm belgeleri gösterir: başlık, etkin olup olmadığı, değiştirilip değiştirilmediği, görev sayısı, proje başlangıcı ve hesaplanan bitiş.
- `planner_new_document` — kendi sekmesinde yeni, boş bir belge oluşturur. *Yeni proje* penceresi açılmaz.
- `planner_duplicate_document` — etkin belgeyi yeni bir sekmeye kopyalar, bir ne-olur analizi veya bir ihale varyantı için. Kopya bağımsızdır ve bir dosya yolu yoktur.
- `planner_switch_document` — başka bir belgeyi etkin yapar. Sekme değiştirdikten sonra, yapay zeka asistanının hangi belgeyle çalıştığını onaylamanın yolu da budur.
- `planner_import_schedule` — diskteki bir planlama dosyasını belge olarak açar: `.ifc`, `.xml` (Primavera P6 veya MS Project, içeriğinden tanınır), `.csv`, `.xer` ve `.mpp` (MS Project 2010 ile 2021 arası). Hiçbir şey mevcut planla birleştirilmez. Bir CSV'nin takvimi yoktur, bu yüzden tarihler kayabilir. Yalnızca kullanıcı klasörünüzde çalışır. Bir CSV, XML veya `.mpp` içe aktarımından sonra belgenin kayıt hedefi yoktur. Yalnızca bir IFC kendi yolunu devralır.
- `planner_export_ifc` — etkin belgeyi bir IFC dosyası olarak yazar, projenin IFC şemasında (varsayılan IFC 4.3 ADD2). Yalnızca kullanıcı klasörünüzde. Mevcut bir dosyanın üzerine yalnızca açık isteğiniz üzerine yazılır. Belge, uygulamanın yazamadığı bir şemada açıldıysa (IFC2X3 gibi), araç o dosyanın üzerine kendisi yazmayı reddeder. Proje kaydedilmemiş kalır.

## Kılavuz ve kaynak kökeni

- `planner_get_planning_guide` (okuma) — yapay zeka asistanları için İngilizce kılavuzu verir: [İyi planlama](docs://gids-goed-plannen) ilkeleri, her ilke için araçlarla birlikte. Ayrıca iki beceriyi verir: *goed-plannen* (bir planlama kurmak) ve *progress-update* (ilerlemeyi güncellemek). Ya da hepsini. `part` ile seçin: `guide`, `skill` (iki beceri) veya `both`. Varsayılan `both`. Her beceri için ait olduğu yerleri ve indirme adreslerini döndürür. `language` parametresi eski asistanlar için hâlâ kabul edilir, ama metin her zaman İngilizcedir. Planlamaya dokunmaz.
- `planner_inspect_xer_provenance` (okuma) — açık bir Primavera P6 dosyasının (`.xer`) saklanan kaynak anlamını inceler: dosyada ne vardı, içe aktarım ve tanılama sayılarıyla. Dosyadaki serbest metin alanları varsayılan olarak görünmez. Yapay zeka asistanının bunları açıkça istemesi gerekir. Kaynak adları da varsayılan olarak gizlidir, çünkü bir P6 kaynağı genellikle bir kişidir. Kaynak kodları görünür kalır. Yapay zeka asistanı adları istemeden önce sizden izin istemelidir, çünkü adlar o zaman yapay zeka sağlayıcısına gider. Bir betikte kullanılamaz.

## Betik

- `planner_batch` — en fazla 100 adımlık bir betiği tek bir değişiklik olarak çalıştırır: tek bir geri alma adımı, tek bir yeniden hesaplama, tek bir yedek. Bir adım yapısal olarak başarısız olursa, tüm betik geri alınır. Yanıt, her adımın yapılıp yapılmadığını, başarısız olup olmadığını veya hiç ulaşılmayıp ulaşılmadığını belirtir. Geçici adlar (`tmp-…`) `planner_add_tasks` aracından sonraki adımlarda geçerlidir. Bir adım olarak izin verilmeyenler: `planner_batch` aracının kendisi, geri alma ve yineleme, belge ve dosya araçları, `planner_save_baseline`, `planner_get_planning_guide` ve `planner_inspect_xer_provenance`. Bir betik bir programlama dili değildir. Değişken, koşul veya döngü yoktur.

## Bir araç reddedildiğinde

Yapay zeka asistanı o zaman bir hata kodu ve bir açıklama içeren bir yanıt alır.

- `PAUSED` — *Duraklat* açıktır.
- `READ_ONLY` — *Salt okunur* açıktır.
- `DIALOG_OPEN` — bir iletişim kutusu açıktır. Bu, okuma için de geçerlidir. Yalnızca `planner_get_planning_guide` hariçtir. Yanıt, açık olanı iç adıyla belirtir, örneğin `showTaskDialog`.
- `DOC_DRIFT` — Yapay zeka asistanı çalışırken siz sekme değiştirdiniz. Asistan, hangi belgeyle çalıştığını `planner_switch_document` ile onaylamak zorundadır.
- `VALIDATION` — argümanlar şemaya uymuyor veya istenen değişikliğe izin verilmiyor. Yanıt alanı belirtir.
- `NOT_FOUND` — bir kimlik veya belge yoktur.
- `CYCLE` — değişiklik bir döngü oluşturur. Bu çağrıdaki her şey geri alınır.
- `SCOPE` — dosya yolu kullanıcı klasörünüzün dışındadır.
- `BACKUP_FAILED` — değişiklikten önceki yedek başarısız oldu. Değişiklik yapılmadı.
- `INTERNAL` — bir aracı çalıştırırken beklenmeyen bir hata oluştu, örneğin başarısız bir dosya işlemi. Yanıt özgün hata iletisini verir.
- `STALE_PRECONDITION` — bu kod köprünün sözleşmesinin bir parçasıdır. Ama mevcut araçların hiçbiri bu kodu döndürmez.

Kuyrukta 110 saniyeden uzun bekleyen bir istek artık uygulama tarafından yürütülmez. İstemci zaman aşımını zaten almıştır. Yürütmek, yeniden denemede bir şeyi iki kez değiştirirdi. 120 saniyeden uzun süren bir çağrı, köprüden bir zaman aşımı alır.

## Asistanın ayarlayamadıkları

Görev başına yapay zeka asistanı şunları ayarlayamaz: hamak, elle planlama, ikinci bir kısıtlama, notlar, renk, etkinlik kodları, özel alanlar, dış ilişkiler ve elle bir dengeleme gecikmesi. Uygulama WBS kodunu kendisi hesaplar. Proje düzeyinde hesaplama profilini ve hesaplama seçeneklerini değiştiremez. Ayarlar, tema, dil, uzantılar ve güncellemeler erişim dışıdır. Kaynak kitaplığı da öyle. Ayrıca raporları, düzenleri, filtreleri ve görünümü de yoktur. Nedeni için bkz. [Yapay zeka bağlantısı nasıl çalışır](docs://uitleg-ai-koppeling).

## Uygulamanın sakladıkları

- **Token** bu bilgisayarda, uygulamanın kayıtlı ayarlarında bulunur. 64 karakter uzunluğundadır ve rastgeledir. *Yeni token* onu değiştirir.
- **Port** varsayılan olarak 3877'dir. Yalnızca köprü durdurulmuşken değiştirilebilir.
- **Etkinlik paneli** son 500 çağrıyı tutar, yalnızca uygulama açıkken. Argümanlar ve yanıtlar her alan için 20 kB'den sonra kesilir. *Temizle* listeyi boşaltır.
- **Yedekler** uygulamanın veri klasöründeki `ai-backups` klasöründedir. *Yedekleme klasörünü aç* sizi oraya götürür. Adları `<project name>-<timestamp>.ifc` biçimindedir. Kaydedilmiş bir proje dosyasının tüm oturumlar boyunca tek bir klasörü vardır. Hiç kaydetmediğiniz bir belge, oturum başına kendi klasörünü alır. Köprüyü her başlattığınızda belge başına bir yedek oluşturulur. Buna kendiniz *Şimdi yedekle* ile yaptığınız yedekler eklenir.
- **Seyreltme** kendiliğinden gerçekleşir, klasör başına. Son 7 gün içindeki yedekler, en fazla 20 tane olmak üzere, kalır. Çalışan oturumun oluşturduğu yedekler her zaman kalır. Bundan sonra 30 güne kadar eski olanlardan haftada bir kalır. Bir yıla kadar olanlardan ayda bir kalır. Sonra yılda bir kalır. Hiç kaydetmediğiniz bir belgenin yedekleri bir yıl sonra tamamen kaybolur. Klasördeki, uygulamaya ait olmayan dosyalara dokunulmaz.

## Ayrıca bakın

- [Yapay zeka bağlantısı nasıl çalışır](docs://uitleg-ai-koppeling): bu köprünün neden böyle kurulduğu ve yapay zeka asistanının neyi yapabileceği ve neyi yapamayacağı.
- [Yapay zeka asistanını bağlamak (MCP)](docs://howto-ai-assistent-koppelen): köprüyü başlatın, bağlanın ve beceriyi kurun.
- [Ayarlar](docs://ref-instellingen): iki yapay zeka anahtarı.
- [Bildirimler ve uyarılar](docs://ref-meldingen): durum çubuğundaki yapay zeka noktası.
