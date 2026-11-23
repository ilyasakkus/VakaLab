# VakaLab — ICAP, sosyal ağ, dizi ve süreç analizi

Bu düzenleme, kullanıcının paylaştığı altı hafta / altı özel eğitim vakası araştırma planındaki veri gereksinimlerine dayanır. ICAP ve sosyal ağ ana veri kanallarıdır; dizi ve süreç analizi için gerekli kayıtlar ayrıca hazırlanır. Sistem anlamlılık testi, nedensellik veya otomatik bilişsel katılım sınıflaması üretmez.

## Kurulum ve ilk kullanım

Migration **005** normal migration sırasında veya ilk API isteğinde otomatik uygulanır. Mevcut mesajlar ve yanıtlar değişmez; eski kayıtlara hayalî hafta, grup, kod veya sunucu sırası yazılmaz.

1. **Admin → Araştırma / Analiz** sekmesini açın.
2. Gerçek tartışma grubunu tanımlayın. Aynı topluluk için altı haftada aynı grup kimliğini kullanın.
3. Her vakaya **W01–W06**, ilgili grup ve araştırma protokolü sürümünü girin. Beş vaka geliştirme boyutuna ilişkin uzman/pilot notlarını ekleyin. Bunlar bir ölçek veya otomatik puan değildir.
4. Pilot katkılardan sonra kalite panelini inceleyin. Mesaj sayısı, kod eksiği, belirsiz zaman sırası, eksik gezinme, hafta/grup ve tasarım notları görünür.
5. Mesajları ve bağlı diyalogları kodlayın; çalışma kapsamını seçip **Analiz paketini ZIP indir** düğmesini kullanın.

**Grup sınırı:** Mevcut öğrenci forumu vaka bazındadır; o vakaya atanan herkes aynı forumu görür. Grup alanı bu topluluğu belgeler, forumu kendi başına alt gruplara bölmez. Bağımsız gruplar için ayrı vaka kayıtları ve atamalar kullanın. Hafta/grup değişiklikleri gerekçeli yeni ayar sürümü oluşturur; yeni mesajlar gönderim anındaki ayara bağlanır. Eski bağlam sonradan uygulanmışsa bu durum ayrıca işaretlenir.

## Dosyalar ve kullanım amacı

| Dosya | Birim / içerik | Kullanım |
| --- | --- | --- |
| `networks/L-.../network.graphml` | Tek vaka × hafta × grup × Önce/Sonra ağı | Gephi'de tek ağ olarak açma |
| `networks/L-.../nodes.csv` | `Id`, `Label`; araştırma kimlikleri | Atanmış uygun katılımcıları ve izole düğümleri koruma |
| `networks/L-.../edges.csv` | `Source`, `Target`, `Type=Directed`, `Weight` | Yönlü, ağırlıklı yanıt ağı |
| `roster.csv` | Öğrenci-vaka ataması ve seçili denemeler | Ağ evrenini denetleme |
| `messages.csv` | Forum mesajı, üst mesaj, kök zincir, zaman, kodlama durumu | İçerik analizi ve mesaj-bağlantı eşleştirmesi |
| `coding_sheet.csv` | Önceden kod doldurulmamış mesaj kodlama formu | Ayrı kodlayıcıların dışarıda çalışması |
| `annotations.csv` | Kodlayıcı, tur, durum, gerekçe, önceki karar bağlantısı | Kodlayıcı uyumu ve karar geçmişi |
| `dialogues.csv` | Araştırmacının seçtiği bağlı tartışma birimi | Karşılıklı fikir geliştirme incelemesi |
| `sequence_individual.csv` | Öğrenci × deneme × forum aşamasındaki kendi katkıları | Bireysel davranış/kod dizisi |
| `sequence_dialogue.csv` | Seçilmiş bağlı diyaloğun mesaj sırası | Diyalog içindeki geçiş örüntüleri |
| `events_all.csv` | Ham gözlemlerin kimlikleri kodlanmış arşivi | Zaman, sıra ve eksik kayıt denetimi |
| `message_exposures.csv` | Mesaj kartının odaklı ekranda görünürlüğü | Görünürlük gözlemlerini ayrıca inceleme |
| `process_individual.csv` | Bir süreç = öğrenci-vaka denemesi | PM4Py/bupaR için etkinlik günlüğü |
| `process_group.csv` | Bir süreç = grup + hafta | Ortak grup süreci; hafta/grup eksikse üretilmez |
| `ai_messages.csv` | Ayrı kanalda bireysel AI soruları ve yanıtları | Forum ağına karıştırmadan AI etkileşimini inceleme |
| `student_responses.csv` | Ön/son profil ölçümleri ve yansıtma | Aynı öğrenci içindeki karşılaştırmalar |
| `case_versions.csv`, `settings_history.csv` | Vaka metninin ve araştırma ayarlarının sürümleri | Hangi bağlamın kullanıldığını izleme |
| `manifest.json`, `quality.json` | Kapsam, filtreler, sürüm ve veri eksikleri | Analizi yeniden üretme ve pilot kontrolü |
| `research-data.json` | Tabloların tamamı ve ağ katmanları | Özgün metinleri koruyan programatik arşiv |

Öğrenci kimliği bütün haftalarda kararlı `P-...` araştırma kodudur. Hafta, grup, vaka, deneme ve forum aşaması ayrı değişkenlerdir. Aynı kişinin çok sayıda mesajı bağımsız gözlem sayılmaz.

## Sosyal ağın tanımı

- **Source:** Yanıtı yazan öğrenci.
- **Target:** Yanıt verilen mesajın yazarı.
- **Weight:** Aynı katmanda Source → Target doğrudan yanıt sayısı.
- Öz yanıtlar ağ kenarına girmez; `reply_events.csv` içinde korunur.
- Düğümler yalnız mesaj yazanlardan seçilmez. Uygun atama evreni de alınır; böylece izole katılımcılar kaybolmaz.
- Kapsam dışında kalan hedefler ve farklı bağlama bağlanmış yanıtlar ana ağdan çıkarılıp kalite/ham ilişki kayıtlarında gösterilir.

Gephi'de önce **nodes.csv → Nodes**, ardından **edges.csv → Edges** içe aktarılabilir. CSV kenar tablosunda Source ve Target zorunludur. GraphML aynı ağın düğüm, kenar ve ağırlıklarını tek dosyada taşır. Hafta/aşama katmanlarını ayrı açın; bütün haftaları gelişigüzel birleştirmeyin.

Öğrenci veya tek deneme filtresi, tam sınıf ağı yerine kısmi seçim üretir. `scope_is_partial=1` iken ağın tamamına ilişkin yoğunluk/merkezilik yorumu yapmayın. Atama evreni güncel kayıt ve seçili gözlenmiş denemelere dayanır; geçmiş grup üyelikleri tahmin edilmez.

## ICAP kodlama ve diyaloglar

`P`, `A`, `C`, `I` ve `U` kodları araştırmacı tarafından girilir. Mesaj kartındaki **ICAP kodla / Geçmiş** düğmesi veya Araştırma sekmesindeki mesaj listesi kullanılabilir. Kodlayıcı etiketi, kodlama turu, gerekçe ve inceleme durumu ayrı saklanır.

Independent kodlama için `coding_sheet.csv` önceki uzlaşı kodlarını doldurmaz. K1/K2 gibi etiketler farklı kodlayıcıların kararlarını ayırır; etiketin yazılması kör ve bağımsız bir çalışma yapıldığını tek başına kanıtlamaz. Dışarıda yapılan kodlama araştırmacı tarafından arayüze aktarılabilir. Kodlayıcılar arası uyum bu ayrı kayıtlar üzerinden, seçilen yöntemle değerlendirilmelidir; sistem otomatik kappa vb. hesaplamaz.

Bir **diyalog**, aynı vaka/aşamadaki bağlantılı mesajlardan, üst mesaj önce gelecek şekilde seçilir. En az iki farklı katılımcı gerekir. Interactive girişi için kanıt diyaloğu, insan incelemesi işareti ve gerekçe zorunludur. Bunlar gerekli yapısal kayıtları sağlar; karşılıklı fikir geliştirme içeriğinin anlamsal değerlendirmesini yazılım yapmaz. Diyaloğun I kodu bütün üye mesajlarına otomatik verilmez.

Kod değişikliğinde eski karar silinmez: `supersedes_id` ile izlenir. Diziler en yüksek kodlama turundaki **açık uzlaşı** kodunu kullanır. Çatışma, henüz uzlaşılmamış karar veya kodlanmamış mesaj boş kalır. Boş kod **Passive değildir**.

## Dizi ve süreç birimleri

Öğrencinin kendi katkı dizisi ile cevap ilişkisine dayalı diyalog dizisi ayrıdır. Aynı forumda iki mesajın zaman sırasıyla art arda gelmesi aralarında bilişsel bağ kurmaz. Kodlanmamış olayları silerek iki yanındaki kodlar arasında yapay geçiş üretmeyin. Bir mesaj birden fazla insan tanımlı diyaloğa dahil olabilir; `dialogue_ids` ve diyalog üyelik satırları bu ilişkiyi korur.

Yeni forum kayıtlarında `server_sequence` güvenilir kabul sırasını sağlar. Eski/muğlak kayıtlarda timestamp + kimlik yalnız deterministik bir sıralamadır; eşzamanlı kayıtların nedensel sırası olduğu varsayılmaz. `sequence_order_quality` ve kalite uyarılarını inceleyin. TraMineR için uzun tablo uygun dizi tablosuna dönüştürülmeli; gerçek kod eksikliği ile değişken dizi uzunluğu açıkça ayrılmalıdır.

PM4Py sütun eşleştirmesi:

| Sütun | Anlam |
| --- | --- |
| `case:concept:name` | Süreç örneği; bireysel dosyada deneme, grup dosyasında grup + hafta |
| `concept:name` | Gözlenen/kaydedilen etkinlik |
| `time:timestamp` | Kaynağı belirtilmiş UTC zaman damgası |
| `org:resource` | Katılımcı araştırma kodu veya AI |
| `case_id` | Pedagojik vaka; süreç örneği kimliğiyle aynı kavram değildir |

`actor_lane=ai` satırları öğrenci eylemi değildir; araştırma sorusuna göre ayrı tutulmalıdır. Bozuk zamanlı tarayıcı kayıtları hazır süreç dosyalarına girmez, olay arşivinde kalır. Sunucu gönderimi bir anlık olaydır; mesaj yazma/okuma süresi tahmin edilmez. Yalnız zorunlu aşama geçişlerinin haritasını çıkarmak yerine forum editörü, yanıt hedefi ve mesaj görünürlüğü gibi gözlenen alt eylemler kullanılabilir.

## Veri yeterliliğinin sınırları

Mesaj görünürlüğü, kartın en az 40 pikselinin odaklı ekranda en az 1 saniye görünür gözlenmesidir; okuma/dikkat veya bir ICAP kodu değildir. Yeniden ziyaretler yeni gözlem olabilir; aynı açık forum görünümündeki tekrarlar tekilleştirilir. Observer desteği olmayan tarayıcılar ve özellik eklenmeden önceki kullanım için geçmiş görünürlük kaydı üretilmez.

Mevcut arayüzde ayrı materyal/yeni bilgi açma ya da gönderilmiş mesajı düzenleme eylemi yoktur; bu adlarla geriye dönük olay uydurulmaz. Bu eksik yetenekler `quality.capabilities` içinde açıktır. Süreç analizi pilot veri yeterliliğine bağlı kalır.

Kimlikler kodlanır; serbest metinlerdeki kişi/okul adları otomatik tam anonimleştirilmez. Metin seçeneğini kapatırsanız mesajlar, yansıtma ve kodlama kanıtları pakete eklenmez. CSV'de elektronik tablo formül koruması uygulanır; metni aynen almak için JSON arşivini kullanın.

## Teknik kaynaklar

- [Gephi CSV içe aktarma](https://docs.gephi.org/desktop/User_Manual/Import/CSV_Format/)
- [Gephi GraphML](https://docs.gephi.org/desktop/User_Manual/Import/GraphML_Format/)
- [PM4Py veri çerçevesi ve sütun eşleştirmesi](https://processintelligence.solutions/app/pm4py/api/api/pm4py.utils.html)
- [TraMineR dizi tanımı ve eksik durumlar](https://traminer.unige.ch/doc/seqdef.html)
