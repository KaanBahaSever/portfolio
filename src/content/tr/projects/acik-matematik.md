---
title: Açık Matematik
shortDescription: Lisans düzeyindeki matematik dersleri için Türkçe, açık kaynak bir yayın platformu ve modern bir ders kitabı girişimi. Sayısal örnekler koddan yeniden hesaplanıyor; PDF ve EPUB sürümleri ücretsiz.
---

## Nedir?

Açık Matematik, lisans düzeyindeki matematik dersleri için Türkçe, açık kaynak bir dijital
yayın platformu ve modern bir ders kitabı girişimi. Türkçe ders materyalleri çoğu zaman
dağınık, el yazısıyla hazırlanmış ya da okunması zor. Proje bu materyalleri herkesin
ulaşabileceği tek bir kütüphanede topluyor. Notlar özenli bir dizgiyle hazırlanıyor, belgeler
titizlikle yazılıyor. Sayfalarda reklam yok, kaynak kodun tamamı da açık.

## Nasıl başladı?

Açık Matematik kendi yaşadığım bir sorundan doğdu: Akademik ders notlarından çalışmak
zahmetliydi. Bu sorundan yola çıkıp bir platform kurmak birkaç yıl sürdü:

- **2023**: Projenin fikri ortaya çıktı.
- **Mart 2026**: Geliştirme hızlandı.
- **Haziran 2026**: Platform [acik-matematik.com](https://acik-matematik.com) adresinde yayına
  açıldı.
- **Eylül 2026**: Açık kaynak sürüm resmî olarak duyuruldu.

## Özellikler

- **Okunaklı, etkileşimli notlar**: teorem ve tanım kutuları, istenince açılan ispatlar ve
  çözümler, web sürümünde de etkileşimli hesaplayıcılar.
- **Yeniden üretilebilir sayısal hesaplama**: Notlar Quarto ile Markdown’da yazılıyor. Quarto,
  bir kitap derlenirken Python kodunu çalıştırabiliyor. Bu sayede sayısal örnekler elle
  yapıştırılmıyor, kaynaktan yeniden hesaplanıyor.
- **Temaya uyan şekiller**: hem açık hem koyu temada düzgün görünen SVG çizimler.
- **PDF ve EPUB indirme**: Yazılı notlar ders ders indirilebiliyor. Birkaç döneme yayılan
  derslerde (örneğin Cebir 1–3 ya da Analiz 1–4) notlar kısım kısım da indirilebiliyor.
- Sayılar teorisi ve kriptografiden stokastik süreçlere kadar uzanan dersler.

## Mimari

- **Çok projeli portal**: En üstte, katalog görevi gören bir Quarto web sitesi var. Her ders
  ise otomatik numaralandırılan, bağımsız bir Quarto kitabı. Dersler ayrı ayrı derlendiği için
  büyük bir müfredat bile içinden çıkılmaz hâle gelmiyor.
- **Ortak ayarlar**: Tema, tipografi, Türkçe teorem etiketleri ve genel CSS her kitapta
  tekrarlanmıyor; hepsi tek bir ortak meta veri dosyasında duruyor.
- **Derleme ve dışa aktarma**: Python betikleri portalı ve bütün kitapları tek bir site olarak
  derliyor, her dersi de PDF (Typst ile) ve EPUB olarak dışa aktarıyor. Pandoc Lua filtreleri
  ispat ve çözüm bloklarını açılıp kapanan bölümlere çeviriyor, gömülü şekilleri indirilebilir
  sürümlere uygun hâle getiriyor ve LaTeX yapılarını Typst için uyarlıyor.
- **CI/CD**: `main` dalına yapılan her push’ta GitHub Actions siteyi derleyip kontrol ediyor,
  ardından Cloudflare Pages üzerinde yayına alıyor. Pull request’ler için de birer önizleme
  sürümü yayımlıyor.
