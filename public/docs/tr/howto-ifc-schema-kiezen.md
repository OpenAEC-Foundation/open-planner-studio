# IFC şemasını seçme

Amaç: planlamanızı, birleştirmek istediğiniz yapı modelinin IFC şemasında kaydetmek.

## Ne zaman gerekir

Varsayılan olarak uygulama bir projeyi IFC 4.3 ADD2 olarak kaydeder. Bu, IfcOpenShell ve Bonsai'nin oluşturduğu dosyalardaki IFC 4.3 adıdır. Planlamayı bir yapı modeliyle tek bir 4D dosyada birleştirmek istiyorsanız, örneğin IfcOpenShell'in (ifcpatch) *MergeProjects* tarifiyle, iki dosyanın aynı şemaya sahip olması gerekir. Yapı modeli bir IFC4 dosyasıysa IfcOpenShell, onu bir IFC 4.3 planlamasıyla birleştirmeyi reddeder. Bu durumda modelin şemasını burada seçin.

## Adımlar

1. *Proje ayarları* öğesini açın: *Ayarlar › Proje › Proje ayarları*, veya *Dosya › Proje ayarları*.
2. *Kaydederken IFC şeması* altında, yapı modelinizin şemasını seçin.
3. *Uygula* düğmesini tıklayın. Proje şimdi *Kaydedilmedi* durumundadır.
4. *Kaydet* (Ctrl+S) veya *Farklı kaydet* ile kaydedin.

Üç seçenek:

- *IFC 4.3 ADD2 (varsayılan)* dosyanın başlığına `IFC4X3_ADD2` yazar.
- *IFC 4.3* `IFC4X3` yazar. Uygulamanın eski sürümleri IFC 4.3'ü bu şekilde yazıyordu.
- *IFC4* `IFC4` yazar; bu, IFC4 biçimindeki bir yapı modeli içindir.

## Tuzaklar ve uygulamanın yaptıkları

**Birleştirme en son adımdır.** Birleştirilmiş 4D dosyasını (yapı modeli ve planlama) uygulamada tekrar kaydetmek için açmayın. Uygulama yalnızca planlamayı tutar: duvarlar ve yapı modelinin diğer parçaları kaybolur, şemayı korusanız bile. Planlamayı kendi dosyanızda değiştirin ve daha sonra yeniden birleştirin.

**Uygulama, açılan bir dosyanın şeması farklıysa önce sorar.** Örneğin bir IFC4 dosyasını veya uygulamanın eski bir sürümünden bir IFC 4.3 dosyasını açarsanız, uygulama dosya türünü basitçe değiştirmez. *Kaydet* veya *Farklı kaydet* öğesini ilk kez kullandığınızda, uygulama önce dosyanın şemasını koruyup korumayacağınızı, yoksa IFC 4.3 ADD2'ye geçip geçmeyeceğinizi sorar. *IFC4 şemasını koru* (veya *IFC 4.3 şemasını koru*) Enter tuşuyla seçilen düğmedir. Soruyu Esc tuşuyla veya çarpı düğmesiyle kapatırsanız, uygulama hiçbir şey kaydetmez.

**Uygulama dosya başına yalnızca bir kez sorar.** Seçiminiz dosyanın kendisinde saklanır. Dosyayı daha sonra yeniden açarsanız, uygulama tekrar sormaz. *Proje ayarları* içinde kendiniz bir şema seçip *Uygula* düğmesini tıklarsanız, uygulama yine sormaz.

**Uygulamanın yazamadığı bir şema**, örneğin IFC2X3, uygulamada açılır. İlk kez kaydettiğinizde soru bunu söyler ve yukarıdaki üç şemadan birini seçersiniz.

**Otomatik kaydetme ve çökme kurtarma hiçbir şey sormaz.** Bunlar dosyanın şemasıyla yazar. Soruyu ise siz ilk kez kendiniz kaydedene kadar bırakırlar. Uygulamanın yazamadığı bir şema için *Otomatik kaydet*, siz soruyu yanıtlayana kadar dosyaya yazmaz.

**Yeni bir proje hiçbir şey sormaz.** Yeni bir proje ve XER, MPP veya CSV gibi başka bir biçimden gelen bir proje, *IFC 4.3 ADD2 (varsayılan)* ile başlar.

**Dosyanın içeriği değişmez.** Üç şema da uygulamanın aynı şekilde yazdığı planlama verilerini destekler. Yalnızca başlıktaki `FILE_SCHEMA` satırı farklıdır. Dolayısıyla başka bir şema seçtiğinizde hiçbir şey kaybetmezsiniz.

**Bir IfcOpenShell veya Bonsai modelinden gelen IFC 4.3 modeli** genellikle başlıkta `IFC4X3_ADD2` içerir, uygulamanın varsayılanı gibi. IfcOpenShell, `IFC4X3` şemalı bir planlamayı bu modele birleştirmez. Emin değilseniz, model dosyasının en üstündeki `FILE_SCHEMA` satırına bakın.

**Geri al şemayı değiştirmez.** Şema dosyaya aittir, tıpkı dosyanın saklandığı yer gibi. *Proje ayarları* içindeki bir seçim ve kaydederken soruya verilen yanıt bu yüzden *Geri al* adımı değildir. Geri dönmek için *Proje ayarları* içinde başka bir şema seçin. Bu sayede *Otomatik kaydet*, bir düzenlemeyi geri aldıktan sonra hiçbir zaman sessizce başka bir şema yazmaz.

## Ayrıca bakınız

- [Yeni proje ve Proje ayarları](docs://ref-projectinfo): formdaki tüm alanlar.
- [Dosyalar ve biçimler](docs://uitleg-bestanden): neden IFC uygulamanın kendi biçimi olduğu.
- [Dosya açma ve kaydetme](docs://howto-bestand-openen-en-opslaan): kaydetme ve farklı kaydetme.
