# Yeni proje ve Proje ayarları

*Yeni proje* penceresinin ve *Proje ayarları* penceresinin alanları: her alanın ne yaptığı, varsayılan değerinin ne olduğu ve nerede etkili olduğu. Bunlar aynı formun iki yüzüdür. *Yeni proje* yeni bir proje oluşturur ve birkaç ek alanı vardır. *Proje ayarları* açık olan projeyi değiştirir.

## Açılış

**Yeni proje** — *Dosya › Yeni*, Ctrl+N veya belge sekmelerinin sağındaki artı işareti (önce *Proje başlat*, sonra *Yeni proje*). Pencere açılır ve imleç *Proje adı* alanında durur.

**Proje ayarları** — *Ayarlar › Proje › Proje ayarları* formu, başlığı *Proje ayarları* olan bir pencere olarak açılır. *Dosya › Proje ayarları* aynı formu *Dosya* ekranında gösterir. Blok *Hesaplama profili ve seçenekleri* iki yerde de en altta yer alır; içeriği için bkz. [Hesaplama seçenekleri ve kurallar](docs://ref-rekenopties-en-conventies).

## Oluşturma, uygulama ve iptal etme

**Oluştur** (*Yeni proje* penceresinde) projeyi oluşturur. Geçerli sekmeniz boş ve değişmemişse uygulama bu sekmeyi kullanır; aksi halde proje yeni bir sekmede açılır. **Uygula** (*Proje ayarları* penceresinde) değişikliklerinizi projeye yazar.

- **Yalnızca Uygula'da.** Taslağa yazarsınız. Proje ancak *Uygula* düğmesine tıklarsanız değişir. *Uygula* yalnızca gerçekten değiştirdiğiniz şeyleri yazar ve bunu tek bir *Geri al* adımında yapar. Hiçbir şeyi değiştirmeden *Uygula* düğmesine tıklarsanız bir şey olmaz ve hiçbir adım eklenmez.
- **İptal, çarpı ve Esc** pencereyi hiçbir şeyi kaydetmeden kapatır. Pencerenin yanına tıklamak onu kapatmaz: yazdıklarınız kalır.
- **Enter** tuşu *Oluştur* veya *Uygula* ile aynı işi yapar. Bu, *Açıklama* alanında ve açık bir açılır listede geçerli değildir.
- **Dosya ekranında** *Proje ayarları* alt kısımda, taslağınız farklı olduğu sürece şunu gösterir: *Değişiklikler uygulanmadı — korumak için Uygula'ya tıklayın.* Ekrandan çıkarsanız uygulama, değişiklikleri uygulamak, atmak veya iptal etmek isteyip istemediğinizi sorar. Bkz. [Şerit, sekme sekme](docs://ref-lint).
- **Adı olmayan özel bir hesaplama profili** *Uygula* ve *Oluştur* düğmelerini engeller. Ona bir ad verin veya değişikliği atın.

## Her iki penceredeki alanlar

**Proje adı** — projenin adı başlık çubuğunda, sekmede ve kaydederken dosya adında görünür. Varsayılan: boş. Boş bırakmak mümkündür: proje *Yeni planlama* adını alır ve alanda gri yazıyla gösterilir. Nerede: tüm ekran.

**Açıklama** — serbest metin. Varsayılan: boş. Etki: proje ile birlikte saklanır, IFC dosyasında ve Primavera P6 XML dışa aktarımında da yer alır. Planlamayı etkilemez.

**Yazar** — serbest metin. Varsayılan: boş. Etki: IFC dosyasına gider ve bir raporun başlığında *Yazar:* olarak görünür. Orada yeniden yazamazsınız.

**Kaynak kitaplığı** — projenin bağlı olduğu kaynak kitaplığı. Seçin: *yok (bağımsız proje)*, mevcut kitaplıklarınız veya *+ Yeni kaynak kitaplığı…*. Varsayılan: *Yeni proje* penceresinde varsayılan kitaplık, *Proje ayarları* penceresinde mevcut bağlantı. Etki: bkz. [Kaynak kitaplığını kullanma](docs://howto-resourcebibliotheek-gebruiken). *+ Yeni kaynak kitaplığı…* seçerseniz aşağıdaki alana bir ad yazarsınız. Kitaplık yalnızca *Oluştur* veya *Uygula* ile oluşturulur; iptal ederseniz geride bir şey kalmaz. *Proje ayarları* penceresindeki bağlantı yalnızca bu alana kendiniz dokunursanız değişir.

**Müşteri/kuruluş** — serbest metin. Varsayılan: boş. Etki: IFC dosyasına gider ve bir raporun başlığında *Şirket:* olarak görünür.

**Başlangıç tarihi** — projenin başlangıcı. Varsayılan: *Yeni proje* penceresinde bugün. Bu alanın ne yaptığı aşağıda, *Başlangıç tarihinin etkisi* altında yazar.

**Bitiş tarihi** — projenin planlanan bitişi. Varsayılan: boş. Etki: bu bir bilgidir, bir gereklilik değil: uygulama bu tarihe göre planlama yapmaz. Rapor başlığında ve dışa aktarımlarda görünür ve tatillerin hangi yıla kadar üretileceğini belirler. Yalnızca *Bolluğu proje bitiş tarihine kadar hesapla* ayarı açık olan bir Primavera dosyasında bolluk hesabı bu tarihe kadar çalışır (bkz. [Hesaplama seçenekleri ve kurallar](docs://ref-rekenopties-en-conventies)).

**Yeni görevler için varsayılan birim** — yalnızca *Saat planlamasını etkinleştir* açıkken görünür. Seçin: *Gün* veya *Saat*. Varsayılan: *Gün*. Etki ve koşullar: bkz. [Saat planlamasını açma](docs://howto-urenplanning-aanzetten).

**Hesaplama profili ve seçenekleri** — *Proje ayarları* penceresinde tüm blok; *Yeni proje* penceresinde yalnızca açılır liste *Hesaplama profili*, seçenekleri *Primavera P6*, *Microsoft Project* ve *Open Planner Studio*. Varsayılan: *Open Planner Studio*. Bir profil seçmek, o profilin varsayılan seçeneklerini de ayarlar. Bkz. [Hesaplama seçenekleri ve kurallar](docs://ref-rekenopties-en-conventies).

## Yalnızca Proje ayarları penceresinde

**IFC şeması kaydederken** — kaydedilen dosyanın başlığında hangi IFC şemasının yer alacağı. Seçenekler: *IFC 4.3 ADD2 (varsayılan)*, *IFC 4.3* ve *IFC4*. Varsayılan: *IFC 4.3 ADD2 (varsayılan)*; açılmış bir IFC dosyasında o dosyanın şeması. Etki: yalnızca dosyanın başlığı değişir, içeriği değil. Planlamayı aynı şemadaki bir yapı modeliyle birleştirmek için kullanın. Açılan dosyanın şeması varsayılandan farklıysa, uygulama ilk kayıtta bu şemayı koruyup korumak istemediğinizi sorar; buradaki bir seçim cevap sayılır. Buradaki başka bir seçim *Geri al* içinde bir adım değildir: şema dosyaya aittir. Bkz. [IFC-şemasını seçme](docs://howto-ifc-schema-kiezen).

## Yalnızca Yeni proje penceresinde

**Aşama şablonu** — projenin hangi aşamalarla başlayacağı. Seçin: *Boş*, *Konut inşaatı* veya *Ticari yapı / yenileme*. Varsayılan: *Boş*. Etki: *Boş* görevsiz bir proje verir. Diğer ikisi sekiz aşama görevini hazır koyar. Her görevin süresi, projenin varsayılan biriminde 5'tir (5 iş günü, veya *Yeni görevler için varsayılan birim* altında *Saat* seçtiyseniz 5 saat). Bu görevlerin ilişkisi yoktur. Adlarını, taşımayı ve uzatmayı kendiniz yaparsınız. *Konut inşaatı* için bu adlar şunlardır: Bouwplaats & grondwerk, Fundering, Ruwbouw / casco, Dak, Gevel & afbouw, Installaties (W/E), Afwerking ve Oplevering. *Ticari yapı / yenileme* için: Sloop & strip-out, Grondwerk & fundering, Hoofddraagconstructie, Gevel & dak, Installaties (W/E), Afbouw, Inregelen & testen ve Oplevering. Bu adlar projenizin verisidir ve arayüz dili başka olsa da Hollandaca kalır. *İnşaat modunu etkinleştir* kapalıysa yalnızca *Boş* vardır. Bkz. [Uygulama ayarları](docs://ref-instellingen).

**Vardiya** — yalnızca *Saat planlamasını etkinleştir* açıkken görünür. Seçin: *Gündüz vardiyası*, *2 vardiya*, *3 vardiya* veya *24/7*. Varsayılan: *Gündüz vardiyası*. Etki: *Gündüz vardiyası* standart takvimi olduğu gibi bırakır; yani pazartesiden cumaya sıradan bir gün takvimi. Diğer üçü, *Takvimler* penceresindeki aynı adlı düğmeler gibi, projenin takvimine çalışma saati bantları koyar. Hangi saatler olduğu için bkz. [Çalışma saatlerini ayarlama](docs://howto-werktijden-instellen). *Gündüz vardiyası* ile *Yeni görevler için varsayılan birim* altında *Saat* seçilemez, çünkü bir gün takvimi çalışma saati bantlarına sahip değildir.

**Tatil seti** — projenin takvimi hangi tatil günlerini alacak. Bir *Ülke* için seçin: *Hollanda* (varsayılan), *Almanya*, *Belçika*, *Fransa*, *Birleşik Krallık*, *Avusturya*, *İsviçre*, *Tatil yok* veya *Özel…*. Ülkenin bölgeleri varsa, bir *Bölge* açılır listesi eklenir. Hollanda için ve *İnşaat modunu etkinleştir* açıksa, *İnşaat tatili* de seçersiniz: *Yok* (varsayılan), *Kuzey*, *Orta* veya *Güney*. Bunun altında *36 tatil, 2025–2029* gibi bir satır vardır; listesini görmek için açarsınız. Yıllar, başlangıç tarihinden önceki yıldan bitiş tarihinden sonraki yıla kadar gider. Bitiş tarihi yoksa başlangıç yılından üç yıl sonrasına kadar gider. *Özel…* tatil içermeyen bir takvim verir ve oluşturduktan hemen sonra *Takvimler* penceresini açar; böylece onları kendiniz doldurursunuz. Projenin takvimi *Bouwkalender NL* adını alır; *İnşaat modunu etkinleştir* kapalıysa *Standaardkalender* olur ve seçenek olarak *Tatil yok* da bulunur. Üretecin nasıl çalıştığı için bkz. [Tatilleri ve inşaat tatilini üretme](docs://howto-feestdagen-genereren).

## Başlangıç tarihinin etkisi

Başlangıç tarihi projenin çıpasıdır. Üç kural geçerlidir:

- **Yeni görevler başlangıç tarihinde başlar.** Eklediğiniz bir görev, planlanmış başlangıç olarak proje başlangıcını alır.
- **Öncülü olan bir görev asla başlangıç tarihinden önce başlamaz.** Öncülün bitişi daha erkense görev başlangıç tarihine kadar bekler. *Öncülü olmayan* bir görev kendi tarihini korur, bu tarih başlangıç tarihinden önce olsa bile. Bu gereklidir; bir MS Project veya Primavera planlamasını, kaynak programın gösterdiği gibi göstermek için. Bir *Şu tarihte başlamalı (MSO)* veya *Şu tarihte bitmeli (MFO)* kısıtlaması iki kuralı da bozar: böyle bir görev, tarihi başlangıç tarihinden önce bile olsa o tarihte durur.
- **Daha sonraki bir başlangıç tarihi serbest görevleri birlikte kaydırır.** Başlangıç tarihini *Proje ayarları* penceresinde daha sonraya alıp *Uygula* düğmesine tıklarsanız, öncülü olmayan ve alt sınır koyan bir kısıtlaması olmayan görevler yeni tarihten önce kalıyorsa o tarihe kayar. Alt sınır koyan kısıtlamalar şunlardır: *şu tarihten önce başlamaz (SNET)*, *şu tarihte başlamalı*, *şu tarihten önce bitmez* ve *şu tarihte bitmeli*. Bu kayma, aynı tek adımda *Geri al* içinde yer alır. Uygulama kaç görevin kaydığını söyler. Bu yalnızca başlangıç tarihini kendiniz değiştirdiğinizde olur; bir dosya açtığınızda hiçbir zaman olmaz. Başlangıç tarihini daha sonraya almak planlamanın geri kalanını taşımaz. Bunu *Projeyi taşı* yapar; bkz. [Proje taşıma](docs://howto-project-verplaatsen).

## Ayrıca bakın

- [Hesaplama seçenekleri ve kurallar](docs://ref-rekenopties-en-conventies): *Hesaplama profili ve seçenekleri* bloğu.
- [Hesaplama profilleri ve kurallar](docs://uitleg-rekenprofielen): neden bir profilin sonucu değiştirdiği.
- [Proje taşıma](docs://howto-project-verplaatsen): tüm planlamayı başka bir başlangıca taşıma.
- [Görev ve kilometre taşı ekleme](docs://howto-taken-en-mijlpalen-toevoegen): ilk görevlerle başlama.
- [Tatilleri ve inşaat tatilini üretme](docs://howto-feestdagen-genereren): tatil setini ayrıntılı olarak.
- [IFC-şemasını seçme](docs://howto-ifc-schema-kiezen): bir yapı modeli için IFC4 ile kaydetme.
