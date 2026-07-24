# Baseline yönetimi

**Baseline'lar** penceresi, planın kaydedilmiş anlık görüntülerini yönetir: kaydetme, yeniden adlandırma, etkin baseline'ı seçme ve silme.

## Açma

**Planlama** → **Baseline ve ilerleme** şerit grubu → **Baseline kaydet…** veya **Baseline'ları yönet…** (ikisi de aynı pencereyi açar). **Esc**, **Kapat**, kapatma çarpısı veya pencerenin dışına bir tıklama kapatır; bu penceredeki tüm değişiklikler hemen etkili olur.

## Baseline tablosu

Kaydedilmiş baseline başına bir satır:

- **Etkin** — radyo düğmesi; tam olarak bir baseline etkin olabilir. Etkin baseline, Gantt'taki baseline bindirmesi ve variance raporu için karşılaştırma temelidir.
- **Ad** — satırda doğrudan düzenlenebilir.
- **Oluşturulma** — baseline'ın kaydedildiği tarih.
- **Sil** (çöp kutusu) — baseline'ı kaldırır. Etkin olan buysa, pencere önce onay ister ("Etkin baseline silinsin mi?"); bundan sonra en son kaydedilen kalan baseline etkin olur, veya hiçbir şey kalmadıysa hiçbiri.

Baseline olmadan pencere "Henüz baseline yok" gösterir.

## Yeni baseline kaydet

- **Ad alanı** — "Baseline {n} — {tarih}" ile önceden doldurulmuştur; adı istediğiniz gibi ayarlayın.
- **Kaydet** — her görevin başlangıcını, bitişini ve (kilometre taşları için) tarihini kaydeder ve yeni baseline'ı etkin yapar.
- **Uyarı** — plan son hesaplamadan bu yana güncel değilse, "Plan güncel değil — önce yeniden hesaplayın (F5)" görünür: bir ipucu, bir engelleme değil. Güncel olmayan bir plandaki bir baseline, yanlış tarihleri dondurur.

## Daha fazla okuma

- [Baseline'lar & ilerleme](docs://gids-baselines-voortgang) — baseline bindirmesi, variance raporu, ilerleme ve durum tarihi.
