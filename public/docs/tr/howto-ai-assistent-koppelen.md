# Bir MCP-istemcisini bağlama

Amaç: bir MCP-istemcisinin planlamanızı birlikte okumasına ve üzerinde çalışmasına izin vermek; ne yaptığını görürsünüz ve sınırları kendiniz koyarsınız.

## Hızlı yol: Claude'a yaptırın

Claude Desktop veya Claude Code ile mi çalışıyorsunuz? O zaman Claude bağlantıyı kendisi kurabilir:

1. Aşağıdaki *İstemi kopyalayın* düğmesine tıklayın.
2. İstemi yeni bir sohbete Claude ile yapıştırın ve gönderin.

Claude daha sonra Open Planner Studio uzantısını kurar ve bunu yaparken ne yaptığını açıklar. Kendiniz bir şey yapmanız gerekirse, örneğin Claude Desktop'ta *Kur* öğesine tıklamak gibi, Claude hangi tıklamayı yapacağınızı tam olarak söyler. Bunun için bir belirteç gerekmez.

```prompt
Open Planner Studio uzantısını benim için kur, böylece Open Planner Studio'daki inşaat planlamalarımı okuyabilesin ve değiştirebilirsin. Elinden geleni kendin yap. Her adımdan önce, ne yapacağını ve neden yapacağını tek ve sade bir cümleyle söyle. Bana ihtiyacın olursa, her seferinde bir şey sor ve cevabımı bekle. Bir şeyi kendim yapmam gerekirse, tam olarak hangi tek tıklamayı veya işlemi ve nerede yapacağımı söyle.

Bilmen gerekenler:
- Uzantı, en yeni sürümde tek bir dosyadır: open-planner-studio-<version>.mcpb: https://github.com/OpenAEC-Foundation/open-planner-studio/releases/latest. Doğrudan bağlantı, https://api.github.com/repos/OpenAEC-Foundation/open-planner-studio/releases/latest adresindeki yanıtta yer alır (adı .mcpb ile biten dosya). Dosya bir ZIP dosyasıdır.
- Uzantı, Open Planner Studio masaüstü uygulamasıyla da uygulama olmadan da çalışır. Uygulama açık ve MCP-köprüsü çalışıyorsa, uygulamada açık olan planlamada çalışırsın. Uygulama kapalıysa, ben seçtiğim çalışma klasöründeki planlama dosyalarında çalışırsın.
- Kurulum için belirteç ve şifre gerekmez. Benden birini isteme; birini okuma ve gösterme.

Claude Desktop'ta çalışıyorsan:
1. Bir dosyayı indirip bilgisayarımda açabiliyorsan, bunu .mcpb-dosyasıyla yap. Yapamıyorsan, bana doğrudan indirme bağlantısını ver ve indirme tamamlanınca dosyaya çift tıklamamı söyle.
2. Claude Desktop bundan sonra Open Planner Studio uzantısını gösterir. Bana Install'a tıklamamı söyle. Sonra bana, Working folder alanında planlama dosyalarımın olduğu klasörü seçmemi söyle.
3. Bana yeni bir sohbet başlatmamı söyle. Orada, hangi Open Planner Studio araçlarını gördüğünü sormamı söyle.

Claude Code'da çalışıyorsan:
1. Node.js 22 veya daha yeni bir sürümün kurulu olduğunu kontrol et. Kurulu değilse, bana nasıl kurulacağını söyle ve dur.
2. Bana planlama dosyalarımın hangi klasörde olduğunu sor. Bu, çalışma klasörüdür.
3. .mcpb-dosyasını indir ve kullanıcı klasörümde kendi yeni bir klasörüne çıkar. Orada manifest.json dosyasını oku: server.mcp_config, sunucunun nasıl başlayacağını gösterir. ${__dirname} yerine açılmış klasörü, ${user_config.workdir} yerine çalışma klasörünü koy.
4. claude mcp list komutunu çalıştır. open-planner-studio adında bir sunucu zaten varsa, onu değiştirmene izin verip vermeyeceğimi bana sor. Onun ayarlarını gösterme, çünkü ayarlar bir belirteç içerebilir.
5. Sunucuyu kullanıcı hesabım için ekle, örneğin: claude mcp add open-planner-studio --scope user -e OPS_MCP_ROOT=<çalışma klasörü> -- node <açılmış klasör>/server/index.mjs
6. Bana yeni bir Claude Code oturumu başlatmamı söyle. Orada /mcp, open-planner-studio bağlı mı, onu gösterir.

Başka bir yerde çalışıyorsan, örneğin tarayıcıda claude.ai, bana bunun Claude Desktop veya Claude Code gerektirdiğini söyle. Nerede çalıştığını bilmiyorsan, bana sor.

Kurulum bittiğinde, birkaç cümleyle şunları açıkla:
- uygulama açıkken, benim sana nasıl çalışma izni verdiğimi: Open Planner Studio'da Ayarlar › Proje › Uygulama ayarları'nı seçin, Gelişmiş sekmesinde MCP-bağlantısına izin ver'i açın. Sonra MCP sekmesinde Köprüyü başlat'a tıklayın.
- uygulama olmadan bir değişikliğin dosyada ancak siz kaydettikten sonra yer aldığını ve uygulama açıkken mevcut bir dosyanın üzerine yazılmayacağını.
Bir adım başarısız olursa, bana tek bir cümleyle ne ters gittiğini ve ben ne yapabileceğimi söyle. Tahmin etme.
```

Bunu kendiniz yapmayı mı tercih edersiniz, yoksa başka bir MCP-istemcisi mi kullanıyorsunuz? O zaman aşağıdaki adımları izleyin.

## Ne zaman buna ihtiyacınız olur?

Bir MCP-istemcisinin planlamanızı okumasını, analiz etmesini veya değiştirmesini istersiniz. Örneğin, ilk bir WBS taslağını çıkarmasını, görevleri düzeltmesini veya kritik yolu açıklamasını istersiniz. Bu, **Model Context Protocol** (MCP) üzerinden çalışır: bu standart, bir AI-programının, yani **MCP-istemcisinin**, başka bir programın araçlarını kullanmasına izin verir. Bunun için Open Planner Studio, kendi bilgisayarınızda **köprü** adında küçük bir sunucu çalıştırır. Köprü bir dizi araç sunar; hepsinin adı `planner_` ile başlar: görevleri, ilişkileri, kaynakları, takvimleri, temel planları, belgeleri ve dosyaları okumak ve değiştirmek. Hangi araçların olduğu ve neyi reddettikleri [MCP-araçları](docs://ref-ai-tools) bölümünde yer alır. MCP-istemcisi, açık olan projede çalışır, bir kopyada değil: eklediği bir görev Gantt'ta hemen görünür. Sizinle aynı hesaplamayı ve aynı *Geri al* geçmişini kullanır.

Köprü yalnızca masaüstü uygulamasında çalışır. MCP-bağlantısına tarayıcıda izin verirseniz, *MCP* sekmesini görürsünüz, ama *Köprüyü başlat* düğmesi gridir ve şu metni gösterir: *Köprü yalnızca masaüstü uygulamasında çalışır.* Bu makalenin geri kalanı masaüstü uygulamasıyla ilgilidir. Tarayıcıda *Şimdi yedekle* ve *Yedekleme klasörünü aç* de gri.

## Adımlar

### 1. MCP bağlantısına izin verin

1. *Ayarlar › Proje › Uygulama ayarları* öğesini seçin. Ayrıca *Dosya › Uygulama ayarları* öğesini de seçebilirsiniz ya da en üstteki dişli simgesine tıklayabilirsiniz.
2. *Gelişmiş* sekmesini seçin ve *MCP bağlantısına izin verin* seçeneğini açın. *MCP* sekmesi şeritte görünür.
3. Köprünün uygulama başlar başlamaz aktif olmasını istiyorsanız, *Köprüyü otomatik başlat* seçeneğini de açın. Bu seçenek yalnızca MCP bağlantısı açıkken etkinleşir ve yalnızca masaüstü uygulamasında çalışır. Varsayılan olarak kapalıdır, çünkü bir port açmak bilinçli bir seçimdir.

MCP bağlantısını kapatırsanız köprü durur ve *MCP* sekmesi kaybolur.

### 2. Köprüyü başlatın

1. *MCP* sekmesine gidin ve *Sunucu* grubundaki *Köprüyü başlat* düğmesine tıklayın.
2. Düğmenin yanındaki duruma bakın. Orada *Kapalı*, *3877 portunda aktif*, *3877 portu kullanımda* veya *Hata* yazar. Başlatma başarılı olursa *3877 portunda aktif* yazar ve düğmenin adı *Köprüyü durdur* olur. *3877 portu kullanımda* veya *Hata* durumunda düğme *Köprüyü başlat* olarak kalır; bkz. dikkat noktaları.

Köprü yalnızca kendi bilgisayarınızda, tek bir portta dinler. Varsayılan port 3877'dir. *Bağlantı* grubundaki *Port* alanında başka bir port numarası seçebilirsiniz; ancak yalnızca köprü durdurulmuşken. Bağlantı, kendi bilgisayarınızda düz HTTP'dir. Uygulamanın kendisi dışarıya hiçbir şey göndermez. MCP istemcisinin planlamanızla ne yaptığı, örneğin sağlayıcısının onunla ne yaptığı, uygulamanın dışında kalır.

### 3. MCP istemcisini bağlayın

1. *Bağlantı* grubundaki *Bağlan* düğmesine tıklayın. *Bağlantı bilgileri* penceresi açılır.
2. İstemcinizin neye ihtiyacı olduğunu seçin; aşağıya bakın.
3. Token gizlidir. Göz simgesiyle token'ı gösterirsiniz. Kopyalama düğmeleri, ekran token'ı gizlese bile her zaman gerçek değeri kopyalar.
4. MCP istemcisinin araç listesini istemesini sağlayın. Bu kontrol bağlantı isteminde de yer alır: istemci `planner_` önekli araçları görmelidir; beklenen sayı da bağlantı isteminde yazar.

Pencere, bağlanmak için dört yol sunar:

- *Claude'a yaptırın*: bu makalenin başındaki istemin aynısı, *İstemi kopyalayın* düğmesiyle. Bu, Claude Desktop ve Claude Code içindir. Bunun için token gerekmez.
- *Yapılandırma parçası*: istemcinizin MCP ayarlarına yapıştırdığınız bir yapılandırma parçası.
- *Bağlantı istemi*: MCP istemcinize yapıştırdığınız bir metin; bundan sonra istemci kendi kendine bağlanır.
- *Uç nokta* ve *Kimlik doğrulama*: ayrı bilgiler. Uç nokta `http://localhost:3877/mcp` adresidir, aktarım yöntemi *streamable HTTP*'dir. Her isteğin `Authorization: Bearer` başlığı olmalıdır; bunun ardından token'ınız gelir. İstemcinizin ayrıca MCP oturumlarını desteklemesi gerekir: bağlandığında köprü `Mcp-Session-Id` başlığında bir oturum kodu verir ve bu kod olmadan gelen sonraki her isteği reddeder. Claude Code ve `mcp-remote` bunu kendiliğinden yapar.

**Uygulamayı güncelledikten sonra yeniden bağlanın.** MCP istemciniz uygulamanın eski bir sürümüne zaten bağlıysa, henüz bir oturum kodu göndermez ve köprü her isteği reddeder. Bu yüzden güncellemeden sonra yeniden bağlanın: Claude Code'da yeni bir oturum başlatın ve Claude Desktop'u tamamen kapatıp yeniden başlatın.

**Claude Code.** Yapılandırma parçası doğrudan Claude Code için uygundur. Bir terminalde, `<token>` yerine kendi token'ınızı yazarak bu komutu verin:

```
claude mcp add --transport http open-planner-studio http://localhost:3877/mcp --header "Authorization: Bearer <token>"
```

Parçayı proje klasörünüzdeki `.mcp.json` dosyasına da koyabilirsiniz. Bu dosyayı git'e koymayın, çünkü token planınıza erişim verir. `.mcp.json` içindeki bir sunucu, Claude Code'da ilk kullanımda onaylanmalıdır.

**Claude Desktop.** Claude Desktop için bir uzantı vardır: `open-planner-studio-<version>.mcpb` dosyası. Claude Desktop bunu çift tıklamayla yükler. Bunun için Node.js gerekmez. Uzantı, uygulama ile ve uygulama olmadan çalışır. Bu makalenin başındaki istemle daha hızlıdır; aşağıda adımları elle bulursunuz.

1. En son sürümdeki `.mcpb` dosyasını indirin: `https://github.com/OpenAEC-Foundation/open-planner-studio/releases/latest`.
2. Dosyaya çift tıklayın. Claude Desktop açılır ve *Open Planner Studio* uzantısını gösterir. *Install* düğmesine tıklayın. Çift tıklama işe yaramazsa, Claude Desktop'ta *Ayarlar › Uzantılar* bölümünü açın ve dosyayı orada yükleyin.
3. *Working folder* alanında planlama dosyalarınızın bulunduğu klasörü seçin. Claude bu klasörü yalnızca uygulama kapalıyken kullanır. Claude bundan sonra yalnızca bu klasörde okur ve yazar.
4. Uzantıyı açın ve yeni bir sohbet başlatın. Claude'a Open Planner Studio'nun hangi araçlarını gördüğünü sorun.

Token veya port girmeniz gerekmez: köprü çalışırken uzantı uygulamayı kendiliğinden bulur. Her Claude isteğinde uzantı yeniden seçer:

- *Uygulama açık ve köprü çalışıyor*: Claude, uygulamada açık olan planda çalışır. Her değişikliği uygulamada hemen görürsünüz.
- *Uygulama kapalı veya köprü kapalı*: Claude, çalışma klasöründeki bir planlama dosyasında çalışır. Bir değişiklik yalnızca Claude dosyayı kaydettiğinde dosyada olur. Otomatik kaydetme yoktur. Uygulama açıkken Claude mevcut bir dosyanın üzerine yazmaz, yeni bir adla kaydeder.

Claude çalışırken uygulama açılır veya kapanırsa, uzantı geçiş yapar ve bunu Claude'a bildirir. Claude önce planı yeniden seçer veya açar; ancak ondan sonra bir şey değiştirir. Claude'un uygulama olmadan yaptığı ve henüz kaydetmediği değişiklikler varsa, uzantı Claude bunları kaydedene kadar uygulama olmadan çalışmaya devam eder. Böylece yapılan hiçbir şey kaybolmaz. Uzantı uygulamaya ulaşamazsa ve kullanılabilir bir çalışma klasörü yoksa, Claude yalnızca `open_planner_studio_status` aracını görür; bu araç ne yapmanız gerektiğini söyleyen bir mesaj verir.

**Uzantı olmadan Claude Desktop.** Uzantıyı kullanamıyorsanız, Claude Desktop'u harici `mcp-remote` aracıyla bağlayın. Yapılandırma parçası doğrudan Claude Desktop'a uymaz: `claude_desktop_config.json` dosyasında bir adres değil, Claude Desktop'un kendisinin başlattığı bir program adı verirsiniz. `mcp-remote` Node.js gerektirir. Claude Desktop'ta *Ayarlar › Geliştirici › Yapılandırmayı düzenle* yolunu seçin, aşağıdakini (kendi token'ınızla) dosyaya ekleyin ve Claude Desktop'u yeniden başlatın:

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

Token, bilerek `args` yerine `env` içinde yer alır: Windows'ta Claude Desktop, boşluk içeren bir argümanı bozar. Claude'daki bir *özel bağlayıcı* (*Özelleştir › Bağlayıcılar*) köprüyle çalışmaz. Claude bu durumda Anthropic'in bulutundan bağlanır ve bu bulut, kendi bilgisayarınızdaki köprüye ulaşamaz.

*Bağlantı* grubunda ayrıca *Token* alanı vardır. Bu, uygulamanın sizin için oluşturduğu ve bu bilgisayarda sakladığı uzun, rastgele bir koddur. Pencerede şu metin yer alır: *Bu belirteç açık plana erişim sağlar; başkalarıyla paylaşmayın*. *Yeni token* simgesiyle yeni bir token oluşturursunuz. Uygulama önce şunu sorar: *Yeni bir token oluşturmak mevcut tüm bağlantıları kesecek. Devam edilsin mi?* Köprü çalışıyorsa yeni token ile yeniden başlar ve eski token artık çalışmaz.

**Uzantı uygulamayı nasıl bulur.** Köprü çalışırken masaüstü uygulaması portu ve token'ı, uygulamanın veri klasöründeki `mcp/runtime.json` dosyasına yazar. Claude Desktop için uzantı her istekte bu dosyayı okur. Linux ve macOS'ta dosyayı yalnızca kendi kullanıcı hesabınız okuyabilir. Windows'ta dosyayı profil klasörünüzün varsayılan erişim ayarları korur; uygulama bunu ayrıca kontrol etmez. Köprüyü durdurduğunuzda veya MCP bağlantısını kapattığınızda uygulama dosyayı siler. Uygulama ayrıca açık dosyaların listesini `mcp/open-files.json` dosyasında tutar, MCP bağlantısı kapalı olsa bile. Bu dosya var olduğu sürece uzantı ve arayüzsüz MCP sunucusu mevcut hiçbir dosyanın üzerine yazmaz; az önce açtığınız ve henüz listede olmayan bir dosyanın üzerine de yazmaz. Yeni bir dosyaya izin verilir. Okumaya da izin verilir: Claude o zaman diskteki sürümü görür, henüz kaydetmediğiniz değişiklikleriniz olmadan.

### 4. MCP istemcisinin ne yaptığını görün

1. *Etkinlik* grubundaki *Etkinlik paneli* düğmesine tıklayın. Yan bölmede *MCP etkinliği* paneli açılır.
2. Köprünün her çağrısı bir satırda yer alır, en yenisi en üstte: saat, ne olduğu, ne kadar sürdüğü ve başarılı olup olmadığı. Bir satıra tıklayarak *Bağımsız değişkenler* ve *Yanıt* bölümlerini açın.
3. *Temizle* düğmesiyle listeyi boşaltırsınız. Panel son 500 çağrıyı saklar. Henüz hiçbir şey olmadığı sürece şu yazar: *Henüz MCP etkinliği yok. Köprü çağrıları burada görünür*.

MCP bağlantısı açıkken durum çubuğunda, sağ altta, yanında *MCP* yazan bir nokta vardır. Noktanın rengi köprünün durumunu gösterir; noktaya tıklarsanız *MCP* sekmesine gidersiniz.

### 5. Sınırları ayarlayın

*Güvenlik* grubunda, MCP istemcisini sınırlamak için kullandığınız düğmeler vardır:

- *Duraklat*: MCP istemcisi geçici olarak hiçbir şeyi değiştiremez; okumaya yine izin verilir. Köprü aktif kalır. Düğme *Devam ettir* olur.
- *Salt okunur*: bu açıkken bir şeyi değiştiren tüm araçlar reddedilir.
- *Otomatik yedekleme: açık*: MCP istemcisinin bir plandaki ilk değişikliğinden önce uygulama bir IFC-yedeği yazar. Bu, varsayılan olarak açıktır. Düğmeyle kapatırsanız *Otomatik yedekleme: kapalı* yazar. Bu yedek, köprüyü her başlattığınızda her plan için bir kez yazılır.
- *Şimdi yedekle*: etkin planın yedeğini hemen oluşturur. Ardından dosya adıyla birlikte *Yedek oluşturuldu:* yazar.
- *Yedekleme klasörünü aç*: yedeklerin bulunduğu klasörü açar.

Yedekler, uygulamanın veri klasöründeki `ai-backups` klasöründe bulunur. Uygulama yakın tarihli yedekleri saklar ve daha eski olanların bir kısmını siler. Bunun tam olarak nasıl işlediği [MCP araçları](docs://ref-ai-tools) bölümünde yazar.

### 6. MCP istemcisinin iyi planlama yapmasını sağlayın

Bir MCP istemcisi yalnızca planlama kurallarını biliyorsa iyi planlama yapar. Bunu kendiniz yaparsınız:

1. **Temel kurallar için bir şey yapmayın.** Bunlar bağlanırken kendiliğinden gelir: köprü bunları MCP el sıkışmasının `instructions` alanında gönderir. İstemcinizin bunları sistem istemine koyup koymadığı istemciye bağlıdır.
2. **Kılavuzun okunmasını sağlayın.** *Bağlantı bilgileri* penceresindeki bağlantı istemi, MCP istemcisinden kılavuzu `planner_get_planning_guide` aracıyla okumasını ister. İstemi kullanmıyorsanız, kendiniz şunu isteyin: *Bir şey değiştirmeden önce planlama kılavuzunu planner_get_planning_guide ile okuyun.* Kılavuzu kendiniz şu adreste okuyabilirsiniz: `https://open-planner-studio.open-aec.com/agent/planning-guide.md`
3. **İsteğe bağlı: becerileri yükleyin.** Bu yalnızca beceri destekleyen bir MCP istemcisiyle çalışır. *goed-plannen* ve *progress-update* için `SKILL.md` dosyasını, MCP istemcisinin çalıştığı proje klasöründe `.claude/skills/goed-plannen/SKILL.md` ve `.claude/skills/progress-update/SKILL.md` konumuna koyun; ya da her proje için `~/.claude/skills/` klasörüne koyun.

Dosyaları iki şekilde alırsınız. MCP istemcisinden `planner_get_planning_guide` aracını `part` için `skill` değeriyle çağırmasını isteyin: yanıtta iki metin ve her beceri için ait olduğu yerler bulunur. Ya da bunları şu adreslerden indirin: `https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md` ve `https://open-planner-studio.open-aec.com/skills/progress-update/SKILL.md`. Uygulamanın eski bir sürümünden *goed-plannen* hâlâ oradaysa, onu değiştirin: o eski metin Hollandaca yazılmıştır ve MCP istemcileri için kılavuz yerine Yardım makalesine işaret eder.

MCP istemcisinin kılavuzu gerçekten okuyup okumadığını *Etkinlik paneli* içinde görebilirsiniz: o zaman `planner_get_planning_guide` çağrısı görünür. Verdiği son yanıt bir varsayımlar listesi içermelidir: tahmini süreler, seçilen ayrıştırma, kendi oluşturduğu ilişkiler ve koyduğu her kısıtlama. Bu liste yoksa isteyin. *progress-update* becerisine göre yapılan bir ilerleme güncellemesinden sonra yanıtta durum tarihi, yeni bitiş tarihi ve temel plana göre sapma adı geçmelidir.

## Dikkat noktaları ve uygulamanın o durumda ne yaptığı

**MCP istemcisi geri almak istediğiniz bir şeyi değiştirir.** Her değişiklik, *Geri al* (Ctrl+Z) ile geri alabileceğiniz bir adımdır. MCP istemcisinin tek bir bütün olarak verdiği değişiklik dizisi tek bir adımdır. Bundan sonra plan kaydedilmemiş olarak gösterilir. Bir değişiklikten sonra planlama yeniden hesaplanır; bu yüzden F5 tuşuna kendiniz basmanız gerekmez.

**Uygulama, MCP istemcisinin bir çağrısını reddeder.** *Duraklat* ve *Salt okunur* açıkken uygulama tüm değişiklikleri reddeder; okumaya izin verilir, eskimiş bir planlamayı yeniden hesaplama dahil. Kendiniz bir düzenleme yapıyorsanız, örneğin bir çubuğu sürüklüyorsanız veya bir alana yazıyorsanız, MCP istemcisi düzenlemenizden önceki tarihleri, eskidiklerini bildiren bir uyarıyla alır. Açık bir iletişim kutunuz varsa, örneğin ayarlar, bir görev iletişim kutusu veya karşılama penceresi, ya da sunum modu açıksa, siz iletişim kutusunu kapatana kadar uygulama okuma dahil tüm çağrıları reddeder. MCP istemcisi o zaman açık olanın iç adını içeren bir hata mesajı alır, örneğin `showTaskDialog`. Yalnızca `planner_get_planning_guide` çalışmaya devam eder, çünkü planlamanızı okumaz.

**MCP istemcisi çalışırken sekme değiştirirseniz.** MCP istemcisi, ilk değişikliğinin yapıldığı plan üzerinde çalışır. Bu arada sekme değiştirirseniz, uygulama bir sonraki değişikliği reddeder; MCP istemcisi diğer sekmede çalışmak istediğini onaylayana kadar. Böylece hiçbir şey yanlış plana düşmez. MCP istemcisi bir planı kendisi açar veya çoğaltırsa, bundan sonra o yeni planda çalışır.

**MCP istemcisi bir dosya yazar veya açar.** MCP istemcisi bir planlamayı IFC dosyası olarak yazabilir ve bir planlama dosyasını yeni bir sekmede açabilir. Bunu yalnızca kendi kullanıcı klasörünüzün içinde yapabilir. Mevcut bir dosyanın üzerine yalnızca bunu açıkça istediğinde yazar.

**Durum *3877 portu kullanımda* durumundadır.** Başka bir program bu portu kullanıyor. Uygulamanın mesajı bunun altında gösterilir. Port alanı bu durumda kilitli kalır (*Yalnızca sunucu durdurulmuşken düzenlenebilir.*), köprü çalışmıyor olsa bile; ayrıca durdurma düğmesi yoktur. Bu bilinen bir eksikliktir. Düzeltilene kadar *MCP bağlantısına izin verin* seçeneğini kapatıp yeniden açın. Durum o zaman *Kapalı* olur ve başka bir port seçebilirsiniz. Ardından bağlantı bilgilerini yeniden kopyalayın, çünkü uç nokta portu içerir.

**Yeni bir token'dan sonra istemci bağlanamaz.** Yeni bir token, mevcut tüm bağlantıları keser. İstemciye yeni token'ı verin veya yapılandırma parçasını yeniden yapıştırın. Claude Desktop'taki uzantı yeni token'ı kendiliğinden okur; orada bir şey yapmanız gerekmez.

**Köprüyü kendiniz durdurdunuz ve kendiliğinden yeniden başlamaz.** *Köprüyü otomatik başlat* seçeneği, uygulama her başladığında bir kez çalışır. Köprüyü kendiniz durdurursanız, uygulama onu sessizce yeniden açmaz.

***MCP* sekmesi kayboldu.** MCP bağlantısı kapalıdır. Bunu 1. adımda açın.

**Tarayıcınızdaki bir web sayfası köprüyle konuşamaz.** Köprü, tarayıcıdan gelen her isteği ve doğru token'ı içermeyen her isteği reddeder.

## Uygulama olmadan

Masaüstü uygulaması olmadan çalışan bir MCP sunucusu da vardır: **başsız MCP sunucusu**. Aynı `planner_*` araçlarını sunar, ancak açık projeniz yerine diskteki bir planlama dosyası üzerinde çalışır. Bu nedenle değişiklikleri Gantt grafiğinde görmezsiniz ve uygulamadaki *Geri al* bunlar için geçerli değildir. Uygulamanın açık olmasını istemediğinizde veya ekranı olmayan bir bilgisayarda bunu kullanın.

Claude Desktop için uzantı, uygulama kapalıyken bu sunucuyu kendiliğinden başlatır (bkz. 3. adım). Aşağıdaki adımlar, Claude Code gibi başka bir MCP istemcisi içindir.

Bu sürümde hazır bir sunucu indirmesi yoktur. Sunucuyu kaynak koddan `npm run build:mcp-server` ile derlersiniz; bunun için Node.js 22 veya daha yenisi gerekir. Sonuç tek bir dosyadır: `server.mjs`.

1. Planlama dosyalarınızın bulunduğu bir çalışma klasörü seçin. Sunucu yalnızca o klasörde okur ve yazar.
2. MCP istemcinizi bağlayın. Claude Code için komut bu adımların altındadır.
3. MCP istemcisinden bir planlama açmasını isteyin, örneğin `~/plan.ifc`. Bu sunucuda `~` çalışma klasörü anlamına gelir.
4. MCP istemcisinden sonucu kaydetmesini isteyin. Otomatik kaydetme yoktur: MCP istemcisi dosyayı `planner_export_ifc` ile yazar. Sunucunun kaydetmediği şey, sunucu durduğunda kaybolur.

Claude Code için 2. adımda bu komutu bir terminalde, kendi yollarınızla girin:

```
claude mcp add open-planner -- node /path/to/server.mjs --root /path/to/working-folder
```

Uygulama gibi, sunucu her belgede ilk değişiklikten önce bir MCP yedeği alır. Çalışma klasörünün dışındaki bir yolu seçen MCP istemcisi, kısayol (sembolik bağlantı) üzerinden de olsa, ret alır. Uygulama açıkken sunucu, var olan bir dosyanın üzerine yazmaz.

## Ayrıca bakın

- [Geri bildirim vermek](docs://howto-feedback-geven): bağlantı burada anlatılandan farklı çalışıyorsa bunu bildirin.
- [MCP araçları](docs://ref-ai-tools): tüm `planner_*` araçları gruplara göre, hata kodları ve yedeklerin ne kadar süreyle saklandığı.
- [Uygulama ayarları](docs://ref-instellingen): MCP ayarları.
