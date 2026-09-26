---
title: Açık Matematik
shortDescription: Lisans matematik dersleri için Türkçe, açık kaynak bir yayın platformu ve modern bir ders kitabı projesi. Örneklerdeki sayılar elle yazılmıyor, koddan hesaplanıyor. Notların PDF ve EPUB sürümleri ücretsiz.
---

## Nedir?

Türkçe ders notları çoğu zaman dağınık oluyor; kimi el yazısıyla tutulmuş, kimi de zor okunuyor.
Açık Matematik bunları herkesin ulaşabileceği tek bir kütüphanede topluyor: Notlar temiz ve
okunaklı, belgeler özenle yazılmış. Sitede reklam yok, kodun tamamı da herkese açık.

## Nasıl başladı?

Her şey kendi derdimle başladı: Üniversitede ders notlarından çalışmak zahmetliydi. Buradan bir
platform çıkarmam birkaç yıl sürdü:

- **2023**: Fikir doğdu.
- **Mart 2026**: İşler hızlandı.
- **Haziran 2026**: Site [acik-matematik.com](https://acik-matematik.com) adresinde yayına açıldı.
- **Eylül 2026**: Açık kaynak sürüm resmî olarak duyuruldu.

## Neler var?

- **Okunaklı, etkileşimli notlar**: Teoremler ve tanımlar kutularda duruyor, ispatlar ve
  çözümler siz isteyince açılıyor. Sitede kurcalayabileceğiniz hesaplayıcılar da var.
- **Koddan hesaplanan örnekler**: Notlar, sade bir metin biçimi olan Markdown ile yazılıyor.
  Quarto adlı bir araç bunları kitaba çevirirken içlerindeki Python kodunu da çalıştırabiliyor.
  Böylece örneklerdeki sayılar elle yapıştırılmıyor, koddan hesaplanıyor.
- **Temaya uyan şekiller**: SVG çizimler hem açık hem koyu temada düzgün görünüyor.
- **PDF ve EPUB**: Notları ders ders PDF ya da e-kitap (EPUB) olarak indirebilirsiniz. Birkaç
  döneme yayılan derslerde (örneğin Cebir 1–3 ya da Analiz 1–4) her kısmın ayrı dosyası da var.
- Dersler sayılar teorisi ve kriptografiden stokastik süreçlere kadar uzanıyor.

## Perde arkası

- **Bir katalog, her ders ayrı bir kitap**: En üstte bütün dersleri listeleyen bir Quarto sitesi
  var. Her ders ise kendi başına bir Quarto kitabı, numaralandırması da kendiliğinden yapılıyor.
  Her kitap ayrı oluşturulduğu için müfredat büyüse de işler karışmıyor.
- **Ortak ayarlar**: Tema, yazı düzeni, Türkçe teorem etiketleri ve genel görünüm kuralları (CSS)
  her kitapta yeniden yazılmıyor; hepsi ortak bir ayar dosyasında duruyor.
- **Site ve indirmeler**: Python betikleri kataloğu ve bütün kitapları tek bir sitede
  birleştiriyor, her dersi de PDF (Typst ile) ve EPUB olarak çıkarıyor. Bu sırada araya küçük
  Lua betikleri (Pandoc filtreleri) giriyor. Bunlar ispat ve çözümleri açılıp kapanan bölümlere
  çeviriyor, şekilleri indirilecek sürümlere hazırlıyor, LaTeX komutlarını da Typst için
  uyarlıyor.
- **Otomatik yayın (CI/CD)**: Kodun ana dalına (`main`) her değişiklik gönderildiğinde GitHub
  Actions siteyi oluşturup kontrol ediyor, sonra Cloudflare Pages üzerinde yayına alıyor.
  Önerilen değişiklikler (pull request) için de önizleme sürümü yayımlıyor.
