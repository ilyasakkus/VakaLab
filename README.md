# VakaLab

**20 Kasım 2026 — Araştırma planına uygun analiz paketi:** Admin panelindeki **Araştırma / Analiz** sekmesi hafta/grup/protokol tanımını, beş vaka geliştirme boyutunun notlarını, insan kontrollü ICAP mesaj/diyalog kodlamasını ve pilot veri kalitesini bir araya getirir. ZIP paketinde Gephi için katman bazlı CSV/GraphML ağları; içerik analizi, bağımsız kodlama formu, öğrenci/diyalog dizileri ve bireysel/grup süreç günlükleri vardır. İzole atanmış katılımcılar korunur; öz yanıtlar ham tabloda kalır. Kod veya görünürlük verisi otomatik Passive/Interactive sınıflamasına dönüştürülmez. Ayrıntılar: [Araştırma analiz rehberi](RESEARCH_ANALYSIS_GUIDE_TR.md).

Migration **005** yeni araştırma tablolarını otomatik oluşturur. Eski veriye hafta/grup/kod/sıra uydurulmaz. Yeni mesajlar gönderim anındaki ayar sürümü ve sunucu sırasıyla ilişkilendirilir. Kodlayıcı kararları ve ayar düzeltmeleri geçmişleriyle saklanır. Öğrenci ekranları bu araştırma kodlarını görmez. Mesaj kartı görünürlüğü yalnız destekleyen tarayıcılarda gözlemlenir; okuma kanıtı değildir.

**20 Kasım 2026 — Araştırmacı ekranı, rapor kaynakları ve forum kayıtları:** Öğrenci dosyasında Önce/Sonra katkıları yan yana, kime yanıt verildiği ve öğrencinin mesajlarına gelen doğrudan yanıtlarla birlikte gösterilir. Kendi mesajı, bağımsız mesaj, akrana verilen/alınan yanıt ve etkileşilen kişi sayıları ayrı tutulur. Yalnız seçilen denemenin katkıları sayılır; öz yanıtlar akran sayısına eklenmez. Kesinleşme anındaki mesaj metinleri ayrıca okunabilir. Vaka profili, yansıtma, bireysel AI konuşması ve tüm sınıfın ortak tartışması ayrı alanlardadır. Verileri yenile düğmesiyle son kayıtlar alınır; açık paneller ve filtreler korunur. Yeni forum düzeninde kaldırılan bireysel yanıtlar boş alan olarak gösterilmez; eski bireysel form kayıtları özgün biçimde korunur.

İşlem çizelgesi sunucuda doğrulanmış mesaj gönderimlerini tarayıcı gözlemleriyle birlikte sunar; aynı gönderim iki kez sayılmaz ve zaman kaynağı açıkça yazılır. Forum açma, editör odağı, taslak değişikliği ve yanıt hedefi seçme/iptal gözlemleri de kaydedilir; gönderilmemiş taslağın metni olaylara eklenmez. Yeni çalışmalarda bölüm/süre adları Önce/Sonra forumlarıyla eşleşir. JSON/Excel paketine `forum_edges` ve `forum_statistics` eklendi. Disco çıktısında her forum gönderimi sunucu zamanıyla tek anlık olaydır; mesaj/üst mesaj/aşama sütunları vardır. Yeni SQL migration gerekmez.

**20 Kasım 2026 — Ortak tartışma forumları:** Stepper'da **Genel Tartışma Forumu (Önce)** ve **Genel Tartışma Forumu (Sonra)** sekmeleri bulunur. Önce forumunda temel problem, karar ve gerekçeyi soran üç başlık; Sonra forumunda **Nihai kararınız nedir?** sorusu tartışmayı yönlendirir. Bu soruların ayrı bireysel yanıt kutuları yoktur; yanıtlar ve karşılıklı yorumlar yalnız ortak forumda paylaşılır. Aynı vakaya atanan öğrenciler birden fazla mesaj paylaşabilir, başkasının mesajına veya bir yanıta cevap verebilir. Quill editörü ve sekmede korunan bağımsız forum taslakları kullanılır. AI sohbeti öğrenciye özeldir.

(Önce) forumuna yazma, öğrencinin bu aşamayı tamamlayıp AI sohbetine geçmesiyle kapanır. (Sonra), öğrencinin kendi AI sohbetinde ilk tamamlanmış veya kısmi yanıtını almasıyla açılır. Geçiş ve teslim için öğrenci ilgili forumda en az bir görüş veya yanıt paylaşır; profil ölçümleri ve yansıtma korunur. Gönderilmemiş taslak varsa kesinleştirmeden önce paylaşılması veya temizlenmesi istenir. Teslim/veri toplama kapanışı yazmayı kapatır; okuma ve kişisel ek süre kuralları korunur. Öğrenci-vaka dosyasında iki forum birlikte incelenebilir; seçilen öğrencinin mesajları vurgulanır. Güncel rapor, yalnız öğrencinin kendi Önce/Sonra katkılarını ve yansıtmasını değerlendirir; başka öğrencinin mesajı ona mal edilmez. Tam JSON/Excel veri paketinde `case_forums` ve `forum_posts` bulunur; mesajlar aşama, yazar, deneme, vaka sürümü, yanıt ilişkisi ve sunucu zamanı taşır.

Migration **004**, `case_forums` ve `forum_posts` tablolarını ekler. Normal `php bin/console.php migrate` akışında veya v3 kurulumda ilk API isteğinde otomatik uygulanır; mevcut her vaka için iki boş forum oluşturur. Yeni vakalar ve izole öğrenci önizlemeleri de iki forumla başlar. Yeniden migration/seed mevcut mesajları değiştirmez; sahte tartışma mesajları üretilmez. Uygulama sunucusunun Node.js'e ihtiyacı yoktur.

**20 Kasım 2026 — Hazır zengin metin editörü:** Öğrenci yanıt alanları artık BSD-3-Clause lisanslı **Quill 2.0.3 / Snow** kullanır. Yazı tipi/boyutu, kalın/italik/altı çizili, renk/vurgu, başlık, liste, girinti, hizalama, alıntı, bağlantı ve yerleşik geri al/yinele araçları vardır. Biçimlendirme yazarken doğrudan görünür; ayrı Markdown/önizleme modu yoktur. Paket ve tema `public/assets/vendor/quill-2.0.3` içinde lisansıyla birlikte bulunur; üretimde CDN veya editör API anahtarı gerekmez.

Yanıtın düz metni AI/puanlama alanı olarak korunur; görsel biçimi doğrulanmış `rich_text` Delta verisiyle aynı taslak JSON'unda saklanır. Adım değişikliği ve yeniden açılışta biçim korunur; başlangıç/teslim kilitleri biçimlendirmeyi de kapsar. Eski yanıtlar değişmez, yeni SQL migration gerekmez. Gerçek Quill paketiyle `tests/rich-editor-dom.cjs` 23 DOM kontrolü geçti. Geliştirme testi için `jsdom@26.1.0` kurup `JSDOM_PATH` ile yolunu belirtebilirsiniz; üretimin Node.js'e ihtiyacı yoktur.

**20 Kasım 2026 — Sohbet bekleme göstergesi ve son mesajı izleme:** Gönderilen soru hemen sohbet içinde görünür; altında hareketli üç nokta ve **Yanıt hazırlanıyor…** gösterilir. Yeni mesajlar varsayılan olarak sohbetin en altında görünür. Öğrenci yukarı kaydırıp geçmişi okurken konumu korunur; **Son mesaja git ↓** ile yeniden en alta dönülür. Ağ hatası ve yeniden denemede metin/istek kimliği korunur, öğrenci mesajı çoğaltılmaz. Otomatik kaydırma öğrenci kaydırma olayı olarak kaydedilmez. `node tests/chat-ui.cjs` 44 kontrol geçti; gerçek tarayıcı kabulü bu ortamda yapılmadı.

**20 Kasım 2026 — AI yapılandırması, öğrenci editörü ve adım okları:** `AI_KEY` / `AI_MODEL` ile birlikte `OPENAI_API_KEY` / `OPENAI_MODEL` de okunur. Anahtar verildiğinde örnek config'in `mock` varsayılanı gerçek sağlayıcıyı engellemez; açıkça `AI_PROVIDER=mock` seçimi korunur. Gerçek AI için model kimliği ayrıca verilmelidir. Admin paneli sağlayıcı ve modeli anahtarı açığa çıkarmadan gösterir. Coolify ayarları değişince yeniden deploy gerekir; ayrıntılar [kurulum rehberinde](COOLIFY_KURULUM_REHBERI.md).

Öğrencinin yanıt ve mesaj alanları Quill zengin metin editörünü kullanır. Otomatik kayıt korunur; ham HTML kaydedilmez. Sağ üstteki Önceki / Sonraki okları geçişten önce taslağı kaydeder; ilk/son adım ve başlangıç kilidi dikkate alınır. `node tests/student-editor.cjs` 45 kontrol, mevcut hesap akışı testi 17 kontrol geçti. PHP yapılandırma testleri eklendi; PHP ve canlı API bağlantısı bu ortamda doğrulanamadı.

**19 Kasım 2026 — Öğrenci kaydı ve öğrenci olarak vaka denemesi:** Giriş ekranındaki **Hesap oluştur** ile öğrenci numarası, ad, soyad ve en az 12 karakterlik şifreyle kayıt yapılabilir. Baştaki sıfırlar kaldırılır; aynı numara tekrar kaydedilemez. Yeni öğrenciler ilk etkin araştırmacının Kullanıcılar listesine eklenir; vakalar mevcut atama ekranından atanır. Birden fazla çalışma alanında hedefi `registration_owner_id` ile, Docker/Coolify'da `REGISTRATION_OWNER_ID` ortam değişkeniyle belirleyebilirsiniz (araştırmacının kullanıcı ID'si).

**Kullanıcılar → Şifre sıfırla** yalnız araştırmacının kendi öğrencilerinde kullanılabilir; yeni şifre eski şifreyi ve açık öğrenci oturumlarını geçersiz kılar. **Vakalar ve atamalar → Öğrenci olarak Gör** yeni sekmede gerçek öğrenci çalışma akışını açar. Taslak/kapalı vakalar da ayrı bir test kopyasında denenebilir; başlangıç, AI sohbeti ve son teslim çalışır. Önizleme yanıtları öğrenci listelerine, atamalara ve araştırma dışa aktarımlarına girmez. **Yönetim paneline dön** ile çıkılır. Şema değişikliği gerekmez; güncellemeden önceki oturumlar yeniden giriş ister.

Bu değişikliğin istemci kontrolleri `node tests/auth-preview-ui.cjs`; PHP/SQLite alan kontrolleri `php tests/auth-preview.php` ile çalıştırılır. PHP kontrolleri bu geliştirme ortamında PHP bulunmadığı için çalıştırılamadı.

**23 Ekim 2026 gerçek AI yerel denemesi:** OpenRouter/GPT-5 Nano sentetik sohbet, profil ve tek soru puanlama bağlantısı doğrulandı. Destekleyen modeller için `ai.structured_outputs=true` ve yerel `ai.timeout=90` kullanıldı. Bu denemede eklenen JSON şeması/yorum korumaları henüz GitHub'a gönderilmedi. Tam UI/gerçek rubrik/hosting kabulü bekliyor; ayrıntılar TEST_RESULTS.md.

**GitHub teslimi · 23 Ekim 2026:** Aşağıdaki yerel hazırlık değişiklikleri, PHP güvenlik/8.4.27 kanıtları ve eski teslim düzeltmesi `ee31172` commit'iyle `origin/main` dalına gönderildi. Önceki “henüz commit/push edilmedi” kayıtları teslim öncesi durumu anlatır. Hosting dağıtımı yapılmadı; gerçek AI/hosting/kurum kabulü açık.

0.2.18 yerel güncelleme: Beş bölümlü değerlendirme ve tek güncel öğrenci raporu. Rapor alanı yalnız Öğrenci raporunu hazırla / Word / Excel / Öğrenciye göster düğmeleridir; geçmiş listeleri gösterilmez. Yeniden inceleme tamamlanınca aynı rapor güncellenir, öğrenciye tekrar açılması gerekir. Vaka veri toplama kapanış kuralı korunur. Yeni akış için Ctrl+F5; ayrıntılar CONTEXT.md.

**23 Ekim 2026 yerel durum:** Yerel HEAD `9098ff7`; uzak GitHub dalı bu incelemede sorgulanmadı. Puan–rubrik düzeyi eşleşmesi ve dolu gerekçe doğrulaması mevcut. Eski v1 teslimler sonradan eklenen nihai ciddiyet ölçümü olmadan analiz edilebilir; ölçülmemiş alan analiz çıktısında belirtilir, eski yanıtlar değiştirilmez. Yeni teslimlerde nihai ciddiyet zorunludur. PHP güvenlik güncellemesi ve bu yerel düzeltme henüz commit edilmedi. Güncel doğrulamalar [TEST_RESULTS.md](TEST_RESULTS.md), kalan dış kabuller [RELEASE_READINESS.md](RELEASE_READINESS.md).

0.2.1: Genel durumda matris yerine vaka/öğrenci listesi, vaka kartında atanan öğrenci diyaloğu; JSON gerektirmeyen rubrik boyut/düzey formu ve okunaklı/aranabilir/JSON indirilebilir işlem geçmişi. Şema değişikliği yok. Güncel koşular TEST_RESULTS.md, kullanım RELEASE_READINESS.md.

**0.2.0 — Araştırmacı paneli sadeleştirildi:** Ayrı araştırmacı çalışma alanları, kısa kullanıcı formu, toplu atama, etiket/rubrik Sil, vaka bazında veri toplama ve kişisel ek süre; vaka seçerek Excel/JSON veya Disco CSV indirme. [Kullanım ve yayın durumu](RELEASE_READINESS.md). Mevcut kurulumda önce özel yedek ve migration 002 gerekir; yerel SQLite için `php bin/upgrade-sqlite.php` yedeği ve eski alanların korunmasını doğrular.

Öğretmen adaylarının pedagojik vakalarda AI öncesi muhakemesini, vaka bazında AI etkileşimini, nihai kararını ve yansıtmasını toplayan Türkçe araştırma uygulaması. PHP/MySQL + vanilla JS/CSS; shared hosting için kalıcı worker gerektirmez.

Öğrenci paneli: altı çalışma bölümü + ayrı Son teslim sekmesi, başlangıç/profil atomik kilidi, revision/autosave, aynı hesap için sekme kurtarması, tek AI isteği, nihai/yansıtma tek teslimi. Araştırmacı: vaka/öğrenci seçimi, katılımcı/vaka/atama, sürümlü rubrik/etiket, olaylar/taslaklar/süreler, beş bölümlü değerlendirme ve dört insan kararı, tek güncel rapor ve Öğrenciye göster; gerçek DOCX/XLSX/CSV/JSON indirme. Tarihsel v1 raporlar ve PDF backend desteği korunur.

**Araştırmada kullanıma onay verilmedi.** Gerçek rubrik/onam ve AI sağlayıcısı bekleniyor. Mock sentetiktir. Gerçek hosting ve fiziksel mobil testleri yapılmadı. Çalıştırılan testlerin kapsamı [TEST_RESULTS.md](TEST_RESULTS.md), açık işler [plan.md](plan.md), devam bağlamı [CONTEXT.md](CONTEXT.md).

## Yerel başlatma

PHP 8.3.36+ (8.4 serisinde 8.4.27+, 8.5 serisinde 8.5.12+) ve gereken eklentiler, Composer; [kurulum rehberindeki](INSTALL_SHARED_HOSTING.md) bağımlılıklar. Yerel `.tools/php/php.exe` Windows testleri içindir; sunucu dağıtımına eklenmez. 21 Ekim 2026 güvenlik düzeltmeleri gereklidir: [resmî PHP duyurusu](https://www.php.net/archive/2026.php#2026-10-21-5).

```text
composer install --no-interaction --prefer-dist
php bin/console.php check
```

config/example.php → config/local.php kopyalayın. MySQL test DB adı `_test` içersin. SQLite hızlı yerel deneme için örnek değişiklik:

```php
$c = require __DIR__.'/example.php';
$c['dsn'] = 'sqlite:'.__DIR__.'/../storage/vakalab_test.sqlite';
$c['db_user'] = ''; $c['db_password'] = '';
$c['https'] = false;
return $c;
```

`pdo_sqlite` gerekir; üretim hedefi MySQL'dir. [TEST_DATA.md](TEST_DATA.md) komutlarıyla migrate + seed yapın; sonra:

```text
php -S 127.0.0.1:8088 -t public
```

[Yerel uygulama](http://127.0.0.1:8088/) → test hesapları TEST_DATA.md'de. PHP'nin Windows built-in sunucusu tek worker'dır: gecikmeli AI sırasında aynı sunucudaki autosave sırada bekleyebilir. Bu, uygulama session kilidi değildir; concurrency otomatik testleri iki bağımsız PHP worker ile çalışır. Hostingde en az iki worker ile tekrar deneyin. Üretimde built-in server kullanılmaz.

## Dizinler

| Yol | İşlev |
|---|---|
| public/ | Tek web kökü; index.php, api.php, assets |
| app/ | Auth, Db, domain, AI, analiz, telemetri, export |
| config/ | example.php ve git dışı local.php |
| migrations/001.sql | FK/unique içeren ilk şema |
| bin/console.php | check, migrate, seed, researcher, researcher-sql |
| storage/ | Web dışı geçici dosyalar / yerel test DB |
| tests/ | Alan, HTTP concurrency, Chromium, MariaDB/restore testleri |
| vendor/, composer.lock | Sabitlenmiş PHP dosya üretim kütüphaneleri |

## Testleri yeniden çalıştırma

```text
php tests/run.php
python tests/http_checks.py
node tests/browser.cjs
python tests/mysql_checks.py
```

HTTP testleri PHP_BIN ortam değişkenini veya Windows `.tools/php/php.exe` yolunu kullanır. Browser için Playwright paketini development ortamına kurun; `PLAYWRIGHT_PATH`, gerekirse `CHROME_BIN` belirtin. MariaDB testi için `MARIADB_HOME` taşınabilir Windows MariaDB dizinine işaret etmeli. Hostingde bu araçlar gerekmez. Otomatik testler benzersiz ayrı disposable DB üretir; normal kullanıcı/üretim verisini temizlemez.

## Belgeler

[Shared hosting kurulumu](INSTALL_SHARED_HOSTING.md) · [Sentetik veri](TEST_DATA.md) · [Manuel test](MANUAL_TESTS.md) · [Test sonuçları](TEST_RESULTS.md) · [Mimari](ARCHITECTURE.md) · [Veri sözlüğü](DATA_DICTIONARY.md) · [Olaylar](EVENT_CATALOG.md) · [AI girdileri](AI_INPUT_CONTRACTS.md) · [Hatalar](BUGS.md).

Kabul edilmiş özgün şartnameler 01_OGRENCI_PANELI.md ve 02_ARASTIRMACI_PANELI.md; 03_CODEX_GELISTIRME_PROMPTU.md görev kaynağıdır. Kalıcı silme yoktur. İlgili vaka ve kişisel ek süre kapanışı + rapor onayı + ayrı yayın olmadan öğrenciye puan/rapor erişimi verilmez.


Makale için ölçüm tanımları, etkinlik sözlüğü ve süre örnekleri: [Olaylar, etiketler ve süreler](METHODS_EVENTS_DURATIONS_TR.md). Uygulama içi özet araştırmacının Bölüm geçişleri ve ziyaret süreleri alanındadır.
