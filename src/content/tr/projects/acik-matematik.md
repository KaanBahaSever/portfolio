---
title: Açık Matematik
shortDescription: Lisans matematik dersleri için Türkçe, açık kaynak bir yayın platformu ve ders kitabı projesi. Örneklerdeki sayılar elle yazılmıyor, koddan hesaplanıyor. Notların PDF ve EPUB sürümleri ücretsiz.
---

## Nedir?

Türkçe ders notları çoğu zaman dağınık oluyor; kimi el yazısı, kimi de zor okunuyor. Açık
Matematik bu notları herkesin ulaşabileceği tek bir kütüphanede topluyor: temiz, okunaklı notlar
ve özenle yazılmış belgeler. Sitede reklam yok, kodun tamamı da herkese açık.

## Nasıl başladı?

Her şey kendi derdimden çıktı: Üniversitedeki ders notlarından çalışmak zahmetliydi. Bu dertten
bir platform çıkarmak birkaç yıl sürdü:

- **2023**: Fikir doğdu.
- **Mart 2026**: İşler hızlandı.
- **Haziran 2026**: Site [acik-matematik.com](https://acik-matematik.com) adresinde yayına açıldı.
- **Eylül 2026**: Açık kaynak sürüm resmî olarak duyuruldu.

## Neler var?

- **Okunaklı, etkileşimli notlar**: Teoremler ve tanımlar kutularda duruyor, ispatlar ve
  çözümler siz isteyince açılıyor. Sitede etkileşimli hesaplayıcılar da var.
- **Koddan hesaplanan örnekler**: Notlar, sade bir metin biçimi olan Markdown ile yazılıyor.
  Quarto bunları kitaba çevirirken içlerindeki Python kodunu da çalıştırabiliyor. Böylece
  örneklerdeki sayılar elle yapıştırılmıyor, koddan yeniden hesaplanıyor.
- **Temaya uyan şekiller**: SVG çizimler hem açık hem koyu temada düzgün görünüyor.
- **PDF ve EPUB**: Notları PDF ya da e-kitap (EPUB) olarak ders ders indirebilirsiniz; birkaç
  döneme yayılan derslerde (örneğin Cebir 1–3 ya da Analiz 1–4) kısım kısım da.
- Sayılar teorisi ve kriptografiden stokastik süreçlere kadar uzanan dersler.

## Perde arkası

- **Bir katalog, her ders ayrı bir kitap**: En üstte bütün dersleri listeleyen bir Quarto sitesi
  var. Her ders ise kendi başına bir Quarto kitabı ve numaralandırması kendiliğinden yapılıyor.
  Dersler ayrı ayrı oluşturulduğu için müfredat büyüse de iş içinden çıkılmaz hâle gelmiyor.
- **Ortak ayarlar**: Tema, yazı düzeni, Türkçe teorem etiketleri ve genel görünüm kuralları (CSS)
  her kitapta tekrar yazılmıyor; hepsi tek bir ortak ayar dosyasında duruyor.
- **Site ve indirmeler**: Python betikleri ana siteyi ve bütün kitapları tek bir sitede
  birleştiriyor, her dersi de PDF (Typst ile) ve EPUB olarak çıkarıyor. Bu sırada araya küçük
  Lua betikleri (Pandoc filtreleri) giriyor. Bunlar ispat ve çözümleri açılıp kapanan bölümlere
  çeviriyor, şekilleri indirilecek sürümlere hazırlıyor, LaTeX yazımlarını da Typst için
  uyarlıyor.
- **Otomatik yayın (CI/CD)**: Ana dala (`main`) her değişiklik gönderildiğinde GitHub Actions
  siteyi oluşturup kontrol ediyor, sonra Cloudflare Pages üzerinde yayına alıyor. Önerilen
  değişiklikler (pull request) için de önizleme sürümü yayımlıyor.
