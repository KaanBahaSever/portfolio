---
title: NeoSMBIOS’u yayımladım
dateLabel: Ağustos 2026
---

[NeoSMBIOS](/projects/neosmbios/) projesini MIT Lisansıyla yayımladım. Bu, C++23 için yazılmış
bir SMBIOS/DMI ayrıştırıcısı. Yalnızca başlık dosyalarından oluşuyor
(<span lang="en">header-only</span>) ve veriyi kopyalamadan okuyor
(<span lang="en">zero-copy</span>). Firmware tablolarını okumak için WMI’ya ya da işletim
sisteminin başlık dosyalarına ihtiyaç duymuyor.
