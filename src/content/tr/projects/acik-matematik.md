---
title: Açık Matematik
shortDescription: Türkçe lisans matematiği için açık kaynak bir dijital yayın platformu ve modern ders kitabı girişimi; yeniden üretilebilir sayısal hesaplama ve ücretsiz PDF ile EPUB sürümleriyle.
---

## Nedir?

Açık Matematik, Türkçe lisans matematiği için açık kaynak bir dijital akademik yayın platformu
ve modern bir ders kitabı girişimi. Türkçe ders materyalleri çoğu zaman dağınık, el yazısı ya
da okunması zor; proje bu materyalleri erişilebilir tek bir kütüphanede topluyor: düzgün bir
dizgiyle hazırlanmış notlar, titiz bir belgeleme, reklamsız bir deneyim ve tamamen açık kaynak
kod.

## Nasıl başladı?

Açık Matematik'in çıkış noktası kendi yaşadığım bir sorundu: akademik ders notlarıyla
çalışırken karşılaştığım zorluklar. Bunu bir platforma dönüştürmek birkaç yıl sürdü:

- **2023**: projenin fikri ortaya çıkıyor.
- **Mart 2026**: geliştirme hız kazanıyor.
- **Haziran 2026**: canlı platform [acik-matematik.com](https://acik-matematik.com) adresinde
  yayına giriyor.
- **Eylül 2026**: açık kaynak sürüm resmî olarak duyuruluyor.

## Özellikler

- **Okunaklı, etkileşimli notlar**: teorem ve tanım kutuları, istendiğinde açılan ispatlar ve
  çözümler, web sürümünde etkileşimli hesaplayıcılar.
- **Yeniden üretilebilir sayısal hesaplama**: notlar Quarto ile Markdown'da yazılıyor. Quarto,
  kitap derlenirken Python kodunu çalıştırabildiği için sayısal örnekler kopyalanıp
  yapıştırılmak yerine kaynaktan yeniden hesaplanıyor.
- **Temaya uyumlu şekiller**: açık ve koyu modda doğru görünen SVG çizimler.
- **PDF ve EPUB indirmeleri**: yazılı notlar ders bazında, birkaç döneme yayılan derslerde ise
  (ör. Cebir 1–3 ya da Analiz 1–4) bölüm bölüm indirilebiliyor.
- Sayılar kuramı ve kriptografiden stokastik süreçlere uzanan dersler.

## Mimari

- **Çok projeli portal**: kök dizin, katalog işlevi gören bir Quarto web sitesi; her ders ise
  bağımsız ve otomatik numaralandırılan bir Quarto kitabı. Her ders ayrı derlendiği için geniş
  bir müfredat bile yönetilebilir kalıyor.
- **Ortak yapılandırma**: tema, tipografi, Türkçe teorem etiketleri ve genel CSS, her kitapta
  tekrarlanmak yerine tek bir ortak meta veri dosyasında duruyor.
- **Derleme ve dışa aktarma**: Python betikleri portalı ve tüm kitapları tek bir sitede
  derliyor, her dersi PDF (Typst ile) ve EPUB olarak dışa aktarıyor. Pandoc Lua filtreleri
  ispat ve çözüm bloklarını katlanabilir bölümlere dönüştürüyor, gömülü şekilleri indirilebilir
  sürümler için çeviriyor ve LaTeX yapılarını Typst için uyarlıyor.
- **CI/CD**: GitHub Actions, `main` dalına yapılan her push'ta siteyi derleyip denetliyor ve
  Cloudflare Pages'e dağıtıyor; pull request'ler için de önizleme dağıtımları oluşturuyor.
