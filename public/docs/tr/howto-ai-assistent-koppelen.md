# Yapay zeka asistanını bağlamak (MCP)

Hedef: Bir yapay zeka asistanının planlamanızı takip etmesine ve üzerinde çalışmasına izin vermek. Asistanın ne yaptığını görürsünüz. Sınırları kendiniz belirlersiniz.

## Bunu ne zaman kullanırsınız

Bir yapay zeka asistanının planlamanızı okumasını, analiz etmesini veya değiştirmesini istersiniz. Örneğin ilk WBS taslağını hazırlamasını, görevleri düzeltmesini ya da kritik yolu açıklamasını istersiniz. Bu, **Model Context Protocol** (MCP) üzerinden çalışır: bir yapay zeka asistanının bir programın araçlarını kullanmasını sağlayan bir standarttır. Bunun için Open Planner Studio, kendi bilgisayarınızda küçük bir sunucu çalıştırır: **köprü**. Köprü bir araç kümesi sunar. Hepsinin adı `planner_` ile başlar. Görevleri ve ilişkileri, kaynakları, takvimleri, temel planları, belgeleri ve dosyaları okuyabilir ve değiştirebilirsiniz. Hangi araçların olduğu ve neleri reddettikleri [AI araçları](docs://ref-ai-tools) sayfasında yazılıdır. Bağlantının neden bu şekilde çalıştığı ise [Yapay zeka bağlantısı nasıl çalışır](docs://uitleg-ai-koppeling) sayfasında yazılıdır.

Köprü yalnızca masaüstü uygulamasında çalışır. Tarayıcıda yapay zeka modunu açarsanız *Yapay Zeka* sekmesini görürsünüz. Ama *Köprüyü başlat* düğmesi gri görünür ve üzerinde şu metin yazar: *Köprü yalnızca masaüstü uygulamasında çalışır*. Bu makalenin geri kalanı masaüstü uygulamasıyla ilgilidir. Tarayıcıda *Şimdi yedekle* ve *Yedekleme klasörünü aç* düğmeleri de gri görünür.

## Adımlar

### 1. Yapay zeka modunu açın

1. *Ayarlar › Proje › Uygulama ayarları* öğesini seçin. Ayrıca *Dosya › Uygulama ayarları* öğesini seçebilir veya en üstteki dişli simgeye tıklayabilirsiniz.
2. *Gelişmiş* sekmesini seçin ve *Yapay zeka modunu etkinleştir* seçeneğini açın. *Yapay Zeka* sekmesi şeritte görünür.
3. Uygulama başlar başlamaz köprünün çalışmasını istiyorsanız *Köprüyü otomatik başlat* seçeneğini de açın. Bu seçenek yalnızca yapay zeka modu açıkken değiştirilebilir ve yalnızca masaüstü uygulamasında çalışır. Varsayılan olarak kapalıdır, çünkü bir port açmak bilinçli bir karardır.

Yapay zeka modunu kapatırsanız köprü durur ve *Yapay Zeka* sekmesi kaybolur.

### 2. Köprüyü başlatın

1. *Yapay Zeka* sekmesine gidin ve *Sunucu* altındaki *Köprüyü başlat* düğmesine tıklayın.
2. Düğmenin yanındaki duruma bakın. Orada *Kapalı*, *3877 portunda aktif*, *3877 portu kullanımda* veya *Hata* yazar. Başlatma başarılı olursa *3877 portunda aktif* yazar ve düğmenin adı *Köprüyü durdur* olur. *3877 portu kullanımda* veya *Hata* durumunda düğmenin adı *Köprüyü başlat* kalır. Bkz. sorunlar.

Köprü yalnızca kendi bilgisayarınızda, tek bir portta dinler. Varsayılan port 3877'dir. *Bağlantı* grubunda *Port* altından başka bir port seçebilirsiniz, ama yalnızca köprü durmuşken.

### 3. Asistanı bağlayın

1. *Bağlantı* altındaki *Bağlan* düğmesine tıklayın. *Bağlantı bilgileri* penceresi açılır.
2. İstemcinizin ihtiyacı olanı seçin. Aşağıya bakın.
3. Token gizlidir. Göz simgesiyle onu gösterirsiniz. Kopyalama düğmeleri, ekranda token gizli olsa bile her zaman gerçek değeri kopyalar.
4. Asistanın araç listesini istemesini sağlayın. Bu kontrol bağlantı istemi içinde de vardır: asistan `planner_` önekli araçları görmelidir. Beklenen sayı bağlantı istemindedir.

Pencerede üç bağlantı yolu vardır:

- *Yapılandırma parçası*: istemcinizin MCP ayarlarına yapıştıracağınız bir yapılandırma parçası.
- *Bağlantı istemi*: yapay zeka asistanınıza yapıştıracağınız bir metin. Asistan bundan sonra kendisi bağlanır.
- *Uç nokta* ve *Kimlik doğrulama*: ayrı bilgiler. Uç nokta `http://localhost:3877/mcp` adresidir ve taşıma yöntemi *streamable HTTP*'dir. Her istekte `Authorization: Bearer` başlığı gerekir. Bu değerin ardından token'ınızı yazın. İstemciniz MCP oturumlarını da desteklemelidir: bağlandığında köprü `Mcp-Session-Id` başlığında bir oturum kodu verir ve bu kod olmadan sonraki her isteği reddeder. Claude Code ve `mcp-remote` bunu kendiliğinden yapar.

**Uygulamayı güncelledikten sonra yeniden bağlanın.** Yapay zeka istemciniz uygulamanın eski bir sürümüne zaten bağlıysa, henüz oturum kodu göndermez ve köprü her isteği reddeder. Bu yüzden güncellemeden sonra yeniden bağlanın: Claude Code'da yeni bir oturum başlatın ve Claude Desktop'u tamamen kapatıp yeniden başlatın.

**Claude Code.** Yapılandırma parçası doğrudan Claude Code'a uyar. Bir terminalde şu komutu verin ve `<token>` yerine kendi token'ınızı yazın:

```
claude mcp add --transport http open-planner-studio http://localhost:3877/mcp --header "Authorization: Bearer <token>"
```

Yapılandırma parçasını projenizin klasöründeki `.mcp.json` dosyasına da koyabilirsiniz. Bu dosyayı git'e eklemeyin, çünkü token planınıza erişim sağlar. `.mcp.json` dosyasındaki bir sunucu, Claude Code'da ilk seferinde onaylanmalıdır.

**Claude Desktop.** Yapılandırma parçası Claude Desktop'a doğrudan uymaz. `claude_desktop_config.json` dosyasında Claude Desktop'un kendisinin başlattığı bir program adı verirsiniz, bir adres değil. Bu yüzden arada harici araç `mcp-remote` kullanın; bunun için Node.js gerekir. Claude Desktop'ta *Ayarlar › Geliştirici › Yapılandırmayı düzenle* öğesini seçin, bu metni dosyaya koyun (kendi token'ınızla) ve Claude Desktop'u yeniden başlatın:

```
{
  "mcpServers": {
    "open-planner-studio": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3877/mcp", "--header", "Authorization:${AUTH_HEADER}"],
      "env": { "AUTH_HEADER": "Bearer <token>" }
    }
  }
}
```

Token bilerek `args` içinde değil, `env` içinde yer alır: Windows'ta Claude Desktop, boşluk içeren bir argümanı bozar. Claude'daki *özel bağlayıcı* (*Özelleştir › Bağlayıcılar*) köprüyle çalışmaz. Claude o zaman Anthropic'in bulutundan bağlanır ve bu bulut, sizin bilgisayarınızdaki köprüye ulaşamaz.

*Bağlantı* grubunda ayrıca *Token* alanı vardır. Bu, uygulamanın sizin için oluşturduğu ve bu bilgisayarda sakladığı uzun, rastgele bir koddur. Pencerede şu yazar: *Bu belirteç açık plana erişim sağlar; başkalarıyla paylaşmayın*. *Yeni token* simgesiyle yeni bir token oluşturursunuz. Uygulama önce şunu sorar: *Yeni bir token oluşturmak mevcut tüm bağlantıları kesecek. Devam edilsin mi?* Köprü çalışıyorsa yeni token ile yeniden başlar ve eski token artık çalışmaz.

### 4. Asistanın ne yaptığını görün

1. *Etkinlik* altındaki *Etkinlik paneli* öğesine tıklayın. Kenar çubuğunda *Yapay zeka etkinliği* paneli açılır.
2. Köprünün her çağrısı bir satırda görünür. En yenisi en üsttedir. Satırda zaman, ne olduğu, ne kadar sürdüğü ve başarılı olup olmadığı yazar. Bir satıra tıklayın. *Bağımsız değişkenler* ve *Yanıt* açılır.
3. *Temizle* ile listeyi boşaltırsınız. Panel son 500 çağrıyı saklar. Henüz bir şey olmamışsa şu yazar: *Henüz yapay zeka etkinliği yok. Köprü çağrıları burada görünecek*.

Yapay zeka modu açıkken durum çubuğunun sağ altında *Yapay Zeka* yazan bir nokta vardır. Noktanın rengi köprünün durumunu gösterir. Noktaya tıklarsanız *Yapay Zeka* sekmesine gidersiniz.

### 5. Sınırları belirleyin

Yapay zekayı sınırlamak için *Güvenlik* altında düğmeler vardır:

- *Duraklat*: Yapay zeka geçici olarak hiçbir şeyi değiştiremez. Okumaya yine izin verilir. Köprü etkin kalır. Düğmenin adı *Devam ettir* olur.
- *Salt okunur*: Bu açıkken bir şeyi değiştiren tüm araçlar reddedilir.
- *Otomatik yedekleme: açık*: Yapay zeka bir belgede ilk değişikliğini yapmadan önce uygulama bir IFC yedeği yazar. Bu varsayılan olarak açıktır. Düğmeyle kapatırsınız; o zaman *Otomatik yedekleme: kapalı* yazar. Bu yedekleme, köprüyü her başlattığınızda her belge için bir kez yapılır.
- *Şimdi yedekle*: Etkin belgenin yedeğini hemen alır. Sonra dosya adıyla birlikte *Yedek oluşturuldu:* yazar.
- *Yedekleme klasörünü aç*: yedeklerin bulunduğu klasörü açar.

Yedekler, uygulamanın veri klasöründeki `ai-backups` klasöründedir. Uygulama son yedekleri saklar ve eski yedeklerin sayısını azaltır. Tam olarak nasıl olduğu [AI araçları](docs://ref-ai-tools) sayfasında yazılıdır.

### 6. Asistanın iyi plan yapmasını sağlayın

Bir asistan yalnızca planlama kurallarını biliyorsa iyi plan yapar. Bunun neden önemli olduğunu ve içinde neler olduğunu [Yapay zeka bağlantısı nasıl çalışır](docs://uitleg-ai-koppeling) sayfasında okursunuz. Bunları kendiniz yaparsınız:

1. **Temel kurallar için bir şey yapmayın.** Bunlar bağlanırken kendiliğinden gelir. Bunları istemcinizin sistem istemine koyup koymadığı istemciye bağlıdır.
2. **Kılavuzun okunmasını sağlayın.** *Bağlantı bilgileri* penceresindeki bağlantı istemi, asistandan kılavuzu `planner_get_planning_guide` aracıyla okumasını ister. Bu istemi kullanmazsanız asistandan kendiniz isteyin: *Bir şey değiştirmeden önce planlama kılavuzunu planner_get_planning_guide ile okuyun.* Kılavuzu kendiniz şu adreste okuyabilirsiniz: `https://open-planner-studio.open-aec.com/agent/planning-guide.md`.
3. **İsteğe bağlı: becerileri kurun.** Bu yalnızca beceri destekleyen bir asistanla çalışır. *goed-plannen* ve *progress-update* için `SKILL.md` dosyasını, asistanın çalıştığı proje klasöründe `.claude/skills/goed-plannen/SKILL.md` ve `.claude/skills/progress-update/SKILL.md` olarak koyun. Ya da her proje için `~/.claude/skills/` altına koyun.

Dosyaları iki yoldan alırsınız. Asistandan `part` değeri `skill` olacak şekilde `planner_get_planning_guide` aracını çağırmasını isteyin: yanıtta iki metin ve her beceri için nereye ait olduğu yer bulunur. Ya da bunları şu adreslerden indirin: `https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md` ve `https://open-planner-studio.open-aec.com/skills/progress-update/SKILL.md`. *goed-plannen* uygulamanın eski bir sürümünden hâlâ duruyorsa değiştirin: o eski metin Hollandacadır ve asistanlar için kılavuz yerine Yardım makalesine işaret eder.

Asistanın kılavuzu gerçekten okuyup okumadığını *Etkinlik paneli* içinde görürsünüz. Orada `planner_get_planning_guide` çağrısı görünür. Asistanın verdiği son yanıt bir varsayımlar listesi içermelidir: tahmini süreler, seçtiği ayrıştırma, kendisinin oluşturduğu ilişkiler ve koyduğu her kısıtlama. Bu liste yoksa isteyin. *progress-update* ile yapılan bir ilerleme güncellemesinden sonra yanıtta durum tarihi, yeni bitiş tarihi ve temel plana göre sapma belirtilmelidir.

## Sık karşılaşılan sorunlar ve uygulamanın o durumda yaptıkları

**Yapay zeka, geri almak istediğiniz bir şeyi değiştirir.** Yapay zekanın her değişikliği, *Geri al* (Ctrl+Z) ile geri alabileceğiniz bir adımdır. Yapay zekanın tek bir bütün olarak aktardığı değişiklikler dizisi tek bir adımdır. Ardından proje kaydedilmemiş olarak gösterilir. Bir değişiklikten sonra planlama yeniden hesaplanır. Bu yüzden F5 tuşuna kendiniz basmanız gerekmez.

**Uygulama yapay zekanın bir çağrısını reddeder.** *Duraklat* ve *Salt okunur* açıkken uygulama tüm değişiklikleri reddeder. Okuma yine mümkündür. Bu, eski bir planlamanın yeniden hesaplanmasını da kapsar. Siz kendiniz bir düzenleme ortasındaysanız, örneğin bir çubuğu sürüklüyor ya da bir alana yazıyorsanız, yapay zeka düzenlemenizden önceki tarihleri alır. Bu tarihlerin eski olduğu da bildirilir. Bir iletişim kutusu açıksa, örneğin ayarlar, bir görev penceresi ya da karşılama penceresi, ya da sunum modu açıksa, uygulama iletişim kutusunu kapatana kadar okuma dahil tüm çağrıları reddeder. Yapay zeka o zaman açık olanın iç adını içeren bir hata iletisi alır, örneğin `showTaskDialog`. Yalnızca `planner_get_planning_guide` çalışmaya devam eder, çünkü o planlamanızı okumaz.

**Yapay zeka çalışırken sekme değiştirirsiniz.** Yapay zeka, ilk değişikliğinin yapıldığı belgede çalışır. Bu arada sekme değiştirirseniz, uygulama bir sonraki değişikliğini reddeder. Yapay zeka diğer sekmede çalışmak istediğini onaylayana kadar reddeder. Böylece hiçbir şey yanlış projeye düşmez.

**Yapay zeka bir dosya yazar veya açar.** Yapay zeka bir planlamayı IFC dosyası olarak yazabilir ve bir planlama dosyasını yeni bir sekmede açabilir. Bunu yalnızca kendi kullanıcı klasörünüzün içinde yapabilir. Var olan bir dosyanın üzerine yalnızca yapay zeka bunu açıkça istediği zaman yazar.

**Durumda *3877 portu kullanımda* yazar.** Başka bir program bu portu kullanıyor. Uygulamanın iletisi bunun altında gösterilir. Port alanı o zaman kilitli kalır (*Yalnızca sunucu durmuşken düzenlenebilir.*). Köprü çalışmasa bile alan kilitli kalır ve durdur düğmesi yoktur. Bu bilinen bir eksikliktir. Düzeltilene kadar *Yapay zeka modunu etkinleştir* seçeneğini kapatıp yeniden açın. Durum o zaman yeniden *Kapalı* olur ve başka bir port seçebilirsiniz. Bağlantı bilgilerini sonra yeniden kopyalayın, çünkü uç nokta portu içerir.

**İstemci yeni bir token'dan sonra bağlanamaz.** Yeni bir token tüm mevcut bağlantıları keser. İstemciye yeni token'ı verin ya da yapılandırma parçasını yeniden yapıştırın.

**Köprüyü kendiniz durdurdunuz ve kendiliğinden başlamıyor.** *Köprüyü otomatik başlat* seçeneği her uygulama başlangıcında bir kez uygulanır. Köprüyü kendiniz durdurursanız uygulama onu sessizce yeniden açmaz.

**Sekme *Yapay Zeka* kayboldu.** Yapay zeka modu kapalıdır. Adım 1'de açın.

**Tarayıcıdaki bir web sayfası köprüyle konuşamaz.** Köprü, tarayıcıdan gelen her isteği reddeder. Doğru token'ı içermeyen her isteği de reddeder.

## Ayrıca bakın

- [Geri bildirim verme](docs://howto-feedback-geven): bağlantı burada anlatılandan farklı çalışıyorsa bildirin.
- [Yapay zeka bağlantısı nasıl çalışır](docs://uitleg-ai-koppeling): bağlantının ne olduğu, asistanın neden açık projenizde çalıştığı ve neleri yapamayacağı.
- [AI araçları](docs://ref-ai-tools): tüm `planner_*` araçları gruplarına göre, hata kodları ve yedeklerin ne kadar süre saklandığı.
- [İyi planlama](docs://gids-goed-plannen): planlama ilkeleri. Asistan bunları eklenmiş araçlarla birlikte İngilizce bir sürümde alır.
- [Uygulama ayarları](docs://ref-instellingen): yapay zeka ayarları.
