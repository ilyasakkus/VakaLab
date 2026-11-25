'use strict';
if(typeof window!=='undefined'){if(!window.crypto)window.crypto={};if(typeof window.crypto.randomUUID!=='function'){window.crypto.randomUUID=function(){if(typeof window.crypto.getRandomValues==='function'){return([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,c=>(c^window.crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16));}return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==='x'?r:(r&0x3|0x8)).toString(16);});};}}
const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let viewId=null,visitEditedFields=new Set();
let chatView=null,forumViews=[];
function destroyForums(){for(const view of forumViews)view.destroy();forumViews=[];}
function forumDraftPending(phase){return forumViews.some(view=>(!phase||view.phase===phase)&&view.hasDraft())||!!(work&&typeof VakaForum!=='undefined'&&(phase?[phase]:['before','after']).some(p=>VakaForum.hasDraft(me.id,work.application.id,p)));}
let me,csrf,work,section='case',saveTimer,saveChain=Promise.resolve(),dirty=false,saving=false,conflict=false,busy=false,readOnlyTab=false,events=[],seq=0,dash,leaseTimer,heartbeatTimer,lastInput=Date.now(),lastEvent=0;
const previewToken=new URLSearchParams(location.search).get('preview')||'';
const tab=sessionStorage.getItem('vakalab:tab')||crypto.randomUUID();sessionStorage.setItem('vakalab:tab',tab);
const names={materials:'Ders kaynakları',quiz:'Ön hazırlık quizi',case:'Vaka',profile:'Vaka profili',initial:'Genel Tartışma Forumu (Önce)',ai:'AI sohbeti',final:'Genel Tartışma Forumu (Sonra)',reflection:'Yansıtma',confirm:'Son teslim'};
const stateName=s=>({initial:'Başlangıç aşamasında',working:'Devam ediyor',submitted:'Teslim edildi'}[s]||'Açmadı');
const notify=t=>{ $('#notice').textContent=t;clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('#notice').textContent='',9000);};
async function api(op,body,params={}){const r=await fetch('api.php?'+new URLSearchParams({op,...(previewToken?{preview:previewToken}:{}),...params}),{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:body===undefined?undefined:JSON.stringify(body)});let j;try{j=await r.json();}catch{const e=new Error('Sunucudan geçerli yanıt alınamadı. Durumu yenileyip yeniden deneyin.');e.status=r.status;throw e;}if(!r.ok){const e=new Error(j.error||'İstek başarısız');e.status=r.status;if(r.status===401&&me)notify('Oturum sona erdi. Metin kurtarma taslağı bu sekmede korunuyor; aynı hesapla yeniden giriş yapın.');throw e;}return j.data;}
const handler=(sel,fn)=>{const el=$(sel);if(el)el.addEventListener('click',()=>Promise.resolve(fn()).catch(e=>notify(e.message)));};
const displayTime=value=>value&&Number.isFinite(new Date(value).getTime())?`<time datetime="${esc(value)}" title="Ham zaman: ${esc(value)}">${esc(formatTimestamp(value,me.config.timezone))}</time>`:'—';
const pretty=x=>`<pre>${esc(JSON.stringify(typeof x==='string'?JSON.parse(x):x,null,2))}</pre>`;
const field=(key,label,value='',type='text',disabled=false)=>`<label for="${key}">${label}</label>${type==='textarea'?`<textarea id="${key}" ${disabled?'disabled':''}>${esc(value)}</textarea>`:`<input id="${key}" type="${type}" value="${esc(value)}" ${disabled?'disabled':''}>`}`;
const numberField=(key,label,value,disabled=false)=>`<label for="${key}">${label} <small>0–10 · Bir değer seçin</small></label><select id="${key}" ${disabled?'disabled':''}><option value="">Seçilmedi</option>${Array.from({length:11},(_,i)=>`<option value="${i}" ${value===i?'selected':''}>${i}</option>`).join('')}</select>`;
function getValue(key){return $('#'+key)?.value??'';}
function download(params){window.open('api.php?'+new URLSearchParams({op:'download',...params}),'_blank','noopener');}
async function init(){csrf=(await api('token')).csrf;try{me=await api('me');await home();}catch(e){if(previewToken){$('#root').innerHTML=`<div class="card"><h1>Önizleme açılamadı</h1><p>${esc(e.message)}</p><a href="./">Yönetim paneline dön</a></div>`;}else if(e.status===401)login();else notify(e.message);}}
function login(){
    delete document.body.dataset.uiRole;me=null;$('#identity').innerHTML='';
    $('#root').innerHTML=`<div class="card login"><div class="eyebrow">Pedagojik vaka araştırması</div><h1>Çalışma alanınıza<br>hoş geldiniz.</h1><p class="muted">Öğrenci numaranız ve şifreniz ile giriş yapın.</p><form id="login-form"><label for="login">Öğrenci numarası / araştırmacı hesabı</label><input id="login" autocomplete="username" maxlength="100" required><label for="password">Şifre</label><input id="password" type="password" autocomplete="current-password" required><p id="auth-error" class="dialog-error" role="alert" hidden></p><button id="auth-submit">Giriş yap →</button></form><div class="auth-switch"><p>Henüz hesabınız yok mu?</p><button class="secondary" id="show-register">Hesap oluştur</button></div></div>`;
    handler('#show-register',registerForm);
    $('#login-form').onsubmit=async e=>{e.preventDefault();await submitAuth('login',{login:getValue('login'),password:getValue('password')});};
}
function registerForm(){
    $('#root').innerHTML=`<div class="card login"><div class="eyebrow">Öğrenci kaydı</div><h1>Hesap oluştur</h1><p class="muted">Öğrenci numaranızı başında sıfır olmadan girin. Numaranız giriş için kullanılacaktır.</p><form id="register-form"><label for="student-no">Öğrenci numarası</label><input id="student-no" type="text" inputmode="numeric" pattern="[0-9]+" maxlength="100" autocomplete="username" aria-describedby="student-no-help" required><small id="student-no-help">Yalnız rakam kullanın. Baştaki sıfırlar kaldırılır.</small><label for="first-name">Ad</label><input id="first-name" autocomplete="given-name" maxlength="90" required><label for="last-name">Soyad</label><input id="last-name" autocomplete="family-name" maxlength="90" required><label for="new-password">Şifre</label><input id="new-password" type="password" autocomplete="new-password" minlength="12" maxlength="72" aria-describedby="password-help" required><small id="password-help">En az 12 karakter kullanın.</small><p id="auth-error" class="dialog-error" role="alert" hidden></p><button id="auth-submit">Hesap oluştur →</button></form><div class="auth-switch"><p>Zaten hesabınız var mı?</p><button class="secondary" id="show-login">Giriş yap</button></div></div>`;
    $('#student-no').addEventListener('blur',e=>{e.target.value=e.target.value.trim().replace(/^0+/,'');});
    handler('#show-login',login);
    $('#register-form').onsubmit=async e=>{e.preventDefault();await submitAuth('register',{student_no:getValue('student-no'),first_name:getValue('first-name'),last_name:getValue('last-name'),password:getValue('new-password')});};
}
async function submitAuth(op,payload){
    const button=$('#auth-submit'),error=$('#auth-error');if(button.disabled)return;button.disabled=true;error.hidden=true;
    try{const r=await api(op,payload);csrf=r.csrf;me=await api('me');await home();if(op==='register')notify('Hesabınız oluşturuldu. Öğrenci numaranız: '+r.login);}
    catch(e){error.textContent=e.message;error.hidden=false;button.disabled=false;}
}
async function exitPreview(){
    if(dirty)await save();event('section_leave',{reason:'preview_exit'});await drainEvents();releaseLease();clearInterval(heartbeatTimer);location.assign('./');
}

function releaseLease(){clearInterval(leaseTimer);if(!me||!work)return;const key=`lease:${me.id}:${work.application.id}`;try{const old=JSON.parse(localStorage.getItem(key)||'null');if(old?.tab===tab)localStorage.removeItem(key);}catch{} }
async function home(){destroyForums();if(typeof VakaEditor!=='undefined')VakaEditor.destroyAll();destroyChatView();document.body.dataset.uiRole=me.role;releaseLease();clearInterval(heartbeatTimer);work=null;if(me.preview_app_id){$('#identity').innerHTML='<span>Öğrenci önizlemesi</span><button class="secondary" id="exit-preview">Yönetim paneline dön</button>';handler('#exit-preview',exitPreview);$('#banner').textContent='ÖĞRENCİ ÖNİZLEMESİ · Bu deneme araştırma verilerine eklenmez. '+(me.mock?'AI yanıtları sentetiktir.':'AI sohbeti yapılandırılmış sağlayıcıyı kullanır.');await openWork(me.preview_app_id);return;}$('#identity').innerHTML=`<span>${esc(me.login)} · ${me.role==='researcher'?'Araştırmacı':'Öğrenci'}</span><button class="secondary" id="logout">Çıkış</button>`;handler('#logout',async()=>{if((dirty||forumDraftPending())&&!(await confirmStudent('Kaydedilmemiş metin var. Çıkışta bu sekmedeki kurtarma taslakları temizlenir. Çıkılsın mı?')))return;event('section_leave',{reason:'logout'});await drainEvents();await api('logout',{});releaseLease();clearInterval(heartbeatTimer);work=null;viewId=null;for(const k of Object.keys(sessionStorage))if(k.startsWith('vakalab:'))sessionStorage.removeItem(k);location.reload();});$('#banner').textContent=me.mock?'SENTETİK TEST ORTAMI · Mock yanıtlar gerçek AI değerlendirmesi değildir.':'';if(me.role==='researcher')await adminHome();else await studentHome();}
async function studentHome(){const cases=await api('cases');$('#root').innerHTML=`<div class="eyebrow">Çalışma alanım</div><h1>Her vaka, yeni bir bakış açısı.</h1><p class="intro">Önce ders kaynaklarını ve quizi tamamlayın. Ardından arkadaşlarınızla tartışın ve bireysel AI sohbetine geçin. Yanıtlarınız bölüm geçişlerinde korunur.</p><div class="toolbar"><h2>Vakalarım <span class="pill">${cases.length} atama</span></h2></div><div class="cards">${cases.map((c,i)=>`<article class="card"><div class="case-num"><strong>${String(i+1).padStart(2,'0')}</strong><span class="pill">${c.collection_closed_at&&!Number(c.allow_late)?'Ön hazırlık aşamasında':esc(stateName(c.state))}</span></div><h2>${esc(c.title)}</h2><p class="muted">${c.practice?'Deneme vakası · Araştırma dışı':'Pedagojik vaka · Ders kaynakları, quiz ve vaka incelemesi'}${c.attempt_no?' · Deneme '+c.attempt_no:''}</p><button data-case="${c.id}">${c.state==='submitted'?'Görüntüle':c.app_id?'Devam et':'Başla'} →</button></article>`).join('')||'<div class="empty">Henüz atanmış aktif vaka yok.</div>'}</div>`;document.querySelectorAll('[data-case]').forEach(b=>b.onclick=async()=>{try{const a=await api('start',{case_id:b.dataset.case});await openWork(a.id);}catch(e){notify(e.message);}});}
function showDialog(html,fn){
    const d=document.createElement('dialog');d.innerHTML=html+'<button class="secondary spaced" id="dialog-close">Kapat / İptal</button>';
    const error=document.createElement('div');error.id='dialog-error';error.className='dialog-error';error.setAttribute('role','alert');error.tabIndex=-1;error.hidden=true;
    const commit=d.querySelector('#commit');if(commit)commit.before(error);else d.append(error);
    document.body.append(d);d.showModal();d.querySelector('#dialog-close').onclick=()=>d.close();d.onclose=()=>d.remove();
    if(commit)commit.onclick=async()=>{commit.disabled=true;error.hidden=true;d.querySelectorAll('[aria-invalid="true"]').forEach(el=>el.removeAttribute('aria-invalid'));try{await fn();d.close();}catch(e){error.textContent=e.message;error.hidden=false;commit.disabled=false;const reason=d.querySelector('#reason');if(reason&&!reason.value.trim()){reason.setAttribute('aria-invalid','true');reason.setAttribute('aria-describedby','dialog-error');reason.focus();}else (d.querySelector('[aria-invalid="true"]')||error).focus();(d.querySelector('[aria-invalid="true"]')||error).scrollIntoView({block:'center'});}};
    return d;
}
function confirmStudent(message){return new Promise(resolve=>{const d=document.createElement('dialog');d.id='work-confirm';d.setAttribute('aria-labelledby','work-confirm-title');d.innerHTML=`<h2 id="work-confirm-title">Onay</h2><p>${esc(message)}</p><div class="row"><button id="work-confirm-accept">Onayla</button><button class="secondary" id="work-confirm-cancel" autofocus>Vazgeç</button></div>`;d.addEventListener('close',()=>{const accepted=d.returnValue==='confirm';d.remove();resolve(accepted);},{once:true});d.querySelector('#work-confirm-accept').onclick=()=>d.close('confirm');d.querySelector('#work-confirm-cancel').onclick=()=>d.close('cancel');document.body.append(d);d.showModal();});}
function recoveryKey(){return `vakalab:${me.id}:${work.application.id}:${work.version.id}`;}
function localSave(){if(work&&dirty)sessionStorage.setItem(recoveryKey(),JSON.stringify({revision:Number(work.application.revision),draft:work.draft}));}
async function openWork(id){work=await api('view',undefined,{app_id:id});viewId=crypto.randomUUID();visitEditedFields=new Set();work.draft=JSON.parse(work.application.draft);validationScope=null;dirty=false;conflict=false;busy=!!work.application.active_request;section=work.application.last_section||'materials';if(sectionLocked(section))section='materials';const key=`lease:${me.id}:${id}`;
    const check=()=>{const old=JSON.parse(localStorage.getItem(key)||'null');readOnlyTab=!!old&&old.tab!==tab&&Date.now()-old.at<20000;if(!readOnlyTab)localStorage.setItem(key,JSON.stringify({tab,at:Date.now()}));};check();clearInterval(leaseTimer);leaseTimer=setInterval(check,5000);
    events=JSON.parse(sessionStorage.getItem(recoveryKey()+':events')||'[]');seq=Math.max(Number(sessionStorage.getItem(recoveryKey()+':seq')||0),...events.map(e=>e.seq));
    const recovery=sessionStorage.getItem(recoveryKey());if(recovery&&work.application.state!=='submitted'&&!readOnlyTab){const r=JSON.parse(recovery);if(r.revision===Number(work.application.revision)&&(await confirmStudent('Bu hesap ve vaka için sunucuya ulaşmamış taslak bulundu. Kurtarılsın mı?'))){work.draft=r.draft;dirty=true;event('recovered');}else if(r.revision!==Number(work.application.revision))notify('Eski kurtarma taslağı korunuyor; sunucu sürümü değiştiği için otomatik uygulanmadı.');}
    clearInterval(heartbeatTimer);if(work.application.state!=='submitted')heartbeatTimer=setInterval(()=>{event('heartbeat');flushEvents();if(busy)refreshChat().catch(()=>{});},me.config.heartbeat_ms);renderWork();event('section_open');flushEvents();if(dirty)scheduleSave();
}
function isCollectionClosed(){return !!(work?.application?.collection_closed_at&&!Number(work.application.allow_late));}
function locked(){return work.application.state==='submitted'||(isCollectionClosed()&&section!=='materials'&&section!=='quiz')||readOnlyTab||conflict;}
function sectionLocked(s){
    if(s==='materials'||s==='quiz')return false;
    if(isCollectionClosed()&&work.application.state!=='submitted')return true;
    return !work.application.initial_at&&['ai','final','reflection','confirm'].includes(s);
}
let navigatingWork=false;
function adjacentSection(direction){const keys=Object.keys(names);return keys[keys.indexOf(section)+direction]||null;}
function stepControls(){
    const previous=adjacentSection(-1),next=adjacentSection(1),index=Object.keys(names).indexOf(section)+1;
    return `<nav class="student-step-actions" aria-label="Adımlar arasında gezinme"><span class="student-step-position">${index} / ${Object.keys(names).length}</span><button type="button" class="secondary" id="work-previous" ${!previous?'disabled':''} aria-label="Önceki adım${previous?': '+esc(names[previous]):''}"><span aria-hidden="true">←</span> Önceki</button><button type="button" class="secondary" id="work-next" ${!next||sectionLocked(next)?'disabled':''} aria-label="Sonraki adım${next?': '+esc(names[next]):''}" ${next&&sectionLocked(next)?'title="Önce (Önce) forumundaki tartışmayı tamamlayın"':''}>Sonraki <span aria-hidden="true">→</span></button></nav>`;
}
async function navigateWork(next){
    if(!work||!Object.hasOwn(names,next)||next===section||navigatingWork)return;
    const target=work,old=section;navigatingWork=true;
    try{
        if(dirty)await save();if(work!==target)return;
        scrolls[old]=window.scrollY;section=next;renderWork();window.scrollTo(0,scrolls[section]||0);event('section_open',{locked:sectionLocked(section)});
    }finally{navigatingWork=false;}
}
async function advanceWork(direction){const next=adjacentSection(direction);if(next&&!sectionLocked(next))await navigateWork(next);}
function status(t,error=false){const e=$('#save-status');if(e){e.textContent=t;e.classList.toggle('error',error);}}
function scheduleSave(){dirty=true;localSave();status('Kaydedilmemiş değişiklik var');updateValidationFeedback();clearTimeout(saveTimer);saveTimer=setTimeout(()=>save().catch(e=>notify(e.message)),me.config.autosave_ms);}
async function save(action='save'){clearTimeout(saveTimer);const task=async()=>{if(!work||(!dirty&&action==='save'))return;demandUi(!conflict,'Sürüm çakışmasını çözmeden kayıt yapılamaz.');const id=work.application.id, snapshot=structuredClone(work.draft);saving=true;updateSubmitGate();status('Kaydediliyor…');try{const a=await api(action,{app_id:id,revision:Number(work.application.revision),draft:snapshot});work.application={...work.application,...a};dirty=JSON.stringify(work.draft)!==JSON.stringify(snapshot);if(!dirty)sessionStorage.removeItem(recoveryKey());else localSave();status(dirty?'Kaydedilmemiş değişiklik var':'Sunucuya kaydedildi');return a;}catch(e){localSave();if(e.status===409){conflict=true;notify('Sürüm çakışması / kilit değişimi. Taslağınız bu sekmede korunuyor; metninizi kopyalayıp yeniden yükleyin.');}status(navigator.onLine?e.message:'Bağlantı yok, sunucuya gönderilemedi',true);throw e;}finally{saving=false;updateValidationFeedback();}};saveChain=saveChain.catch(()=>{}).then(task);return saveChain;}
function demandUi(ok,text){if(!ok)throw new Error(text);}
function removeRichText(draft,key){if(draft.rich_text){delete draft.rich_text[key];if(!Object.keys(draft.rich_text).length)delete draft.rich_text;}}
function bindFields(keys){const target=work;for(const k of keys){const el=$('#'+k);if(!el)continue;el.oninput=()=>{if(work!==target)return;work.draft[k]=el.tagName==='SELECT'?(el.value===''?null:Number(el.value)):el.value;if(el.tagName==='TEXTAREA'&&(typeof VakaEditor==='undefined'||!VakaEditor.has(el)||VakaEditor.get(el).getText().slice(0,-1)!==el.value))removeRichText(work.draft,k);lastInput=Date.now();const first=!visitEditedFields.has(k);visitEditedFields.add(k);event(k==='question'?'question_changed':el.tagName==='SELECT'?'profile_changed':'text_changed',{field:k},!first);scheduleSave();};el.onfocus=()=>{if(work===target)event('field_focus',{field:k});};el.onblur=()=>{if(work===target&&dirty)save().catch(()=>{});};}}
function mountStudentEditors(){
    if(typeof VakaEditor==='undefined')return;const target=work;
    document.querySelectorAll('#section-body textarea').forEach(textarea=>VakaEditor.mount(textarea,{delta:target.draft.rich_text?.[textarea.id],onChange:delta=>{if(work!==target)return;if(delta){target.draft.rich_text??={};target.draft.rich_text[textarea.id]=delta;}else removeRichText(target.draft,textarea.id);},onError:error=>notify(error.message+' Metniniz düz metin olarak korunuyor.')}));
}

const materialClickCounts=new Map();
function trackMaterialClick(id,title,url){
    const key=work?work.application.id+':'+id:id;
    const count=(materialClickCounts.get(key)||0)+1;
    materialClickCounts.set(key,count);
    event('material_click',{id,title,url,click_count:count});
    flushEvents();
}

function renderMaterialsSection(){
    const mats=typeof work.version.materials==='string'?processObject(work.version.materials):(work.version.materials||{});
    const videoUrl=(mats.video_url||'').trim();
    const videoTitle=(mats.video_title||'').trim()||'Ders Konu Anlatım Videosu';
    const videoDesc=(mats.video_desc||'').trim();
    const items=Array.isArray(mats.items)?mats.items:[];

    let embedHtml='';
    if(videoUrl){
        const ytMatch=videoUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
        const vimeoMatch=videoUrl.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|video\/|)(\d+)/i);

        if(ytMatch){
            const videoId=ytMatch[1];
            embedHtml=`<div class="video-container"><iframe id="study-video-iframe" src="https://www.youtube.com/embed/${videoId}?enablejsapi=1" title="${esc(videoTitle)}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
        }else if(vimeoMatch){
            const vimeoId=vimeoMatch[3];
            embedHtml=`<div class="video-container"><iframe id="study-video-iframe" src="https://player.vimeo.com/video/${vimeoId}" title="${esc(videoTitle)}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;
        }else{
            embedHtml=`<div class="video-container"><video id="study-html5-video" controls style="width:100%;max-height:480px;border-radius:8px;background:#000;"><source src="${esc(videoUrl)}">Tarayıcınız video etiketini desteklemiyor.</video></div>`;
        }
    }

    return `<span class="eyebrow">Ön hazırlık · Ders kaynakları</span>
        <h2>${esc(videoTitle)}</h2>
        ${videoDesc?`<div class="prose" style="margin-bottom:16px;">${esc(videoDesc)}</div>`:''}
        ${embedHtml?embedHtml:'<div class="empty">Bu vaka için video bağlantısı eklenmemiştir.</div>'}
        
        <div class="materials-links-section" style="margin-top:28px;">
            <h3>Ek Ders Materyalleri & Kaynaklar</h3>
            ${items.length?`<div class="cards" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr));margin-top:12px;">
                ${items.map(item=>`
                    <article class="card material-item-card">
                        <h4>${esc(item.title||'Ders Materyali')}</h4>
                        ${item.desc?`<p class="muted">${esc(item.desc)}</p>`:''}
                        <a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer" class="material-link-btn" data-track-material="${esc(item.id)}" data-title="${esc(item.title||'Materyal')}" data-url="${esc(item.url)}" style="display:inline-block;margin-top:8px;padding:8px 14px;background:var(--accent,#0056b3);color:#fff;border-radius:6px;text-decoration:none;font-weight:500;">
                            Kaynağı Aç / İncele ↗
                        </a>
                    </article>
                `).join('')}
            </div>`:'<p class="muted">Ek ders materyali bulunmuyor.</p>'}
        </div>
        <div class="row spaced" style="margin-top:24px;">
            <button type="button" id="go-to-quiz" class="primary">Ön Hazırlık Quizine Geç →</button>
        </div>`;
}

function renderQuizSection(){
    const rawQuiz=work.version.quiz;
    const quizItems=Array.isArray(rawQuiz)?rawQuiz:(typeof rawQuiz==='string'?processObject(rawQuiz):[]);
    const quizList=Array.isArray(quizItems)?quizItems:(Array.isArray(quizItems?.questions)?quizItems.questions:[]);
    const savedAnswers=work.draft.quiz_answers||{};

    return `<span class="eyebrow">Ön hazırlık · Quiz</span>
        <h2>Ön Hazırlık Quizi</h2>
        <p class="intro">Vaka çalışmasına başlamadan önce ders kaynaklarını inceleyip bu soruları yanıtlayınız. Yanıtlarınız otomatik olarak kaydedilir.</p>
        ${quizList.length?`
            <div class="quiz-questions-list">
                ${quizList.map((q,idx)=>{
                    const currentAnswer=savedAnswers[q.id]??savedAnswers[idx]??'';
                    return `
                        <div class="card quiz-card" data-quiz-item="${esc(q.id||idx)}" style="margin-bottom:16px;">
                            <h3 style="margin-top:0;"><strong>Soru ${idx+1}:</strong> ${esc(q.question)}</h3>
                            <div class="quiz-options-group" style="display:flex;flex-direction:column;gap:8px;margin-top:12px;">
                                ${q.options.map((opt)=>`
                                    <label class="quiz-option-label" style="display:flex;align-items:center;gap:10px;padding:10px 14px;border:1px solid var(--border,#ccc);border-radius:6px;cursor:pointer;background:${currentAnswer===opt?'var(--selected-bg,#e8f0fe)':'transparent'}">
                                        <input type="radio" name="quiz_q_${idx}" value="${esc(opt)}" ${currentAnswer===opt?'checked':''} data-quiz-answer-input data-qid="${esc(q.id||idx)}" data-idx="${idx}">
                                        <span>${esc(opt)}</span>
                                    </label>
                                `).join('')}
                            </div>
                            ${q.explanation&&currentAnswer?`<div class="quiz-explanation muted" style="margin-top:10px;padding:8px 12px;background:var(--subtle-bg,#f8f9fa);border-radius:4px;"><small><b>Açıklama:</b> ${esc(q.explanation)}</small></div>`:''}
                        </div>
                    `;
                }).join('')}
            </div>
            <div class="row spaced" style="margin-top:20px;">
                <button type="button" id="save-quiz-btn">Quiz Yanıtlarını Kaydet & Tamamla</button>
            </div>
        `:'<div class="empty">Bu vaka için tanımlanmış quiz sorusu bulunmuyor.</div>'}`;
}

function studentTabHtml(key,label,index,initialLock){
    const shortNames={materials:'Kaynaklar',quiz:'Quiz',case:'Vaka',profile:'Profil',initial:names.initial,ai:'AI sohbeti',final:names.final,reflection:'Yansıtma',confirm:'Son teslim'};
    const isClosed=isCollectionClosed()&&work.application.state!=='submitted';
    const state=sectionLocked(key)?(isClosed&&!['materials','quiz'].includes(key)?'Veri toplama kapalı':'Kilitli'):(initialLock&&['profile','initial'].includes(key))||locked()?'Salt okunur':'';
    const accessible=`${index+1}. ${label}${state?' · '+state:''}`;
    return `<button data-section="${key}" class="${section===key?'active':''}" aria-current="${section===key?'step':'false'}" aria-label="${esc(accessible)}" title="${esc(accessible)}"><span class="student-tab-number" aria-hidden="true">${index+1}</span><span class="student-tab-copy"><span class="student-tab-label">${shortNames[key]}</span>${state?`<span class="student-tab-state ${state==='Kilitli'||state==='Veri toplama kapalı'?'is-locked':'is-readonly'}" aria-hidden="true">${state==='Kilitli'||state==='Veri toplama kapalı'?'🔒 Kilitli':'Salt okunur'}</span>`:''}</span></button>`;
}
function renderWork(){destroyForums();if(typeof VakaEditor!=='undefined')VakaEditor.destroyAll();destroyChatView();const a=work.application,d=work.draft,initialLock=!!a.initial_at||locked();if(a.state!=='submitted')d.response_mode='forum';$('#root').innerHTML=`<div class="student-work-heading"><div class="toolbar"><div><div class="eyebrow">Vaka çalışma alanı · sürüm ${work.version.version} · Deneme ${a.attempt_no}</div><h1>${esc(a.case_title||'Pedagojik vaka')}</h1></div><div class="row"><span class="pill">${esc(stateName(a.state))}</span><span id="save-status" class="status">${dirty?'Kaydedilmemiş değişiklik var':'Sunucudaki sürüm yüklendi'}</span><button id="back" class="secondary">${me.preview_app_id?'← Yönetim paneli':'← Vakalarım'}</button>${stepControls()}</div></div>${work.attempts?.length>1?`<div class="row" aria-label="Vaka denemeleri">${work.attempts.map(t=>`<button class="secondary" data-student-attempt="${t.id}" ${t.id===a.id?'disabled':''}>Deneme ${t.attempt_no} · ${esc(stateName(t.state))}</button>`).join('')}</div>`:''}</div><div class="workspace-top"><nav class="tabs" aria-label="Çalışma bölümleri">${Object.entries(names).map(([k,v],i)=>studentTabHtml(k,v,i,initialLock)).join('')}</nav></div><div class="section">${a.collection_closed_at&&!Number(a.allow_late)?'<p class="warning">Bu vakada veri toplama henüz açılmadı veya kapalı. Ön hazırlık ve ders kaynaklarını inceleyebilirsiniz.</p>':''}${readOnlyTab?'<p class="warning">Bu vaka başka sekmede açık. Bu sekme salt okunur. Diğer sekmeyi kapattıktan 20 saniye sonra yeniden yükleyin.</p>':''}${conflict?'<p class="warning">Sürüm çakışması: taslağı kopyalayıp sunucu sürümünü yeniden yükleyin.</p>':''}${section==='confirm'?'<div id="validation-summary" class="validation-summary" role="alert" hidden></div>':''}<div class="card" id="section-body"></div>${section==='confirm'?reportLinks():''}</div>`;
    let html='';
    if(sectionLocked(section)){
        if(isCollectionClosed()&&work.application.state!=='submitted'){
            html='<span class="eyebrow">Veri toplama henüz açılmadı</span><h2>Ön hazırlık aşaması</h2><p class="prose">Bu vaka için veri toplama süreci henüz başlatılmamıştır. Lütfen önce <b>Ders kaynakları</b> ve <b>Ön hazırlık quizi</b> adımlarını tamamlayınız.</p><p class="muted">Öğretmeniniz / araştırmacı veri toplamayı başlattığında vaka metni ve sonraki aşamalar erişiminize açılacaktır.</p>';
        }else{
            html='<h2>Bu bölüm henüz açık değil</h2><p>Genel Tartışma Forumu (Önce) aşamasını tamamladığınızda AI sohbeti, nihai değerlendirme, yansıtma ve son teslim bölümleri açılacaktır.</p>';
        }
    }
    else if(section==='materials')html=renderMaterialsSection();
    else if(section==='quiz')html=renderQuizSection();
    else if(section==='case')html=`<span class="eyebrow">Vaka metni · sürüm ${work.version.version}</span><h2>Durumu inceleyin</h2><div class="prose" data-source="case">${esc(work.version.body)}</div><p class="prose">${esc(work.version.instructions)}</p>`;
    else if(section==='profile')html=`<span class="eyebrow">Başlangıç profili</span><h2>Bu vakaya ilişkin görüşünüz</h2><p class="muted">Her alan başlangıçta boştur. Profiliniz (Önce) tartışmasını tamamladığınızda kesinleşir.</p><div class="grid">${[['knowledge','Ön bilgi: Bu konu hakkında ne kadar bilginiz var?'],['confidence','Başlangıç güveni: Uygun karar verebileceğinize ne kadar güveniyorsunuz?'],['difficulty','Algılanan zorluk'],['severity','Yanlış kararın sonucunun ciddiyeti']].map(([k,l])=>`<div>${numberField(k,l,d[k],initialLock)}</div>`).join('')}</div>`;
    else if(section==='initial')html=`<section id="case-forum"></section><button class="spaced" id="initial" ${initialLock?'disabled':''}>Tartışmayı tamamla ve AI sohbetini aç</button>`;
    else if(section==='ai')html=`<div class="toolbar"><div><span class="eyebrow">Vaka ile bağımsız sohbet</span><h2>AI ile etkileşim</h2></div><span class="pill" id="ai-status">${busy?'Yanıt hazırlanıyor…':'Sohbet hazır'}</span></div><p class="muted">Gerçek kişilere ait tanımlayıcı bilgi paylaşmayın. Yalnız vaka ve bu sohbette gönderdiğiniz mesajlar AI'a iletilir.</p><div class="chat-frame"><div class="chat" id="chat" role="log" aria-label="AI sohbet mesajları" aria-relevant="additions text">${VakaChat.messages(work,busy)}</div><button type="button" class="secondary chat-latest" id="chat-latest" hidden>Son mesaja git <span aria-hidden="true">↓</span></button></div>${field('question','Mesaj taslağı',d.question,'textarea',locked())}<div class="row spaced"><button id="send" ${locked()||busy?'disabled':''}>Mesajı gönder</button><small>Akış ölçümü yok; yanıt tamamlandığında gösterilir. Yanıt sürerken diğer bölümlerde yazabilirsiniz.</small></div>`;
    else if(section==='final')html=`<section id="case-forum"></section><div class="forum-final-profile"><h3>Son değerlendirmeniz</h3>${numberField('final_confidence','Nihai kararınıza ne kadar güveniyorsunuz?',d.final_confidence,locked())}${numberField('final_difficulty','Son değerlendirmenize göre bu vakada karar vermek size ne kadar zor geliyor?',d.final_difficulty,locked())}${numberField('final_severity','Son değerlendirmenize göre, bu vakada yanlış karar vermenin sonuçları ne kadar ciddidir?',d.final_severity,locked())}</div>`;
    else if(section==='reflection')html=`<span class="eyebrow">Süreç üzerine düşünme</span><h2>Yansıtmanız</h2>${field('reflection',"AI ile etkileşiminiz nihai kararınızı nasıl etkiledi? AI'ın hangi önerisini kabul ettiniz, değiştirdiniz veya reddettiniz? Neden?",d.reflection,'textarea',locked())}`;
    else if(section==='confirm')html=`<div class="toolbar"><div><span class="eyebrow">Çalışmayı tamamla</span><h2>Son teslim</h2><p class="muted">Nihai yanıt ve yansıtma birlikte kilitlenir. Sürecinizi sonrasında görüntüleyebilirsiniz.</p></div><button id="submit" aria-describedby="submit-help" ${!canSubmit()?'disabled':''}>Vakayı tamamla ve tüm yanıtlarımı kesinleştir</button></div><div id="submit-help" class="submit-help" aria-live="polite"></div>${a.submitted_at?`<p>Teslim: ${displayTime(a.submitted_at)}</p>`:''}`;
    if(section==='ai'&&!sectionLocked(section))html+=`<div id="chat-failures">${VakaChat.failures(work.requests,locked()||busy)}</div>`;
    $('#section-body').innerHTML=html;bindFields(['knowledge','confidence','difficulty','severity','problem','decision','reason','question','final_decision','final_reason','final_confidence','final_difficulty','final_severity','reflection']);
    mountStudentEditors();
    if(section==='materials'){
        const v5=$('#study-html5-video');
        if(v5){
            v5.onplay=()=>event('video_play',{time:v5.currentTime,url:v5.currentSrc});
            v5.onpause=()=>event('video_pause',{time:v5.currentTime,url:v5.currentSrc});
            v5.onended=()=>event('video_ended',{time:v5.currentTime,url:v5.currentSrc});
        }
        document.querySelectorAll('[data-track-material]').forEach(btn=>{
            btn.onclick=()=>{
                trackMaterialClick(btn.dataset.trackMaterial,btn.dataset.title,btn.dataset.url);
            };
        });
        handler('#go-to-quiz',()=>navigateWork('quiz'));
    }else if(section==='quiz'){
        event('quiz_view',{});
        document.querySelectorAll('[data-quiz-answer-input]').forEach(radio=>{
            radio.onchange=()=>{
                const qid=radio.dataset.qid,idx=Number(radio.dataset.idx),val=radio.value;
                work.draft.quiz_answers=work.draft.quiz_answers||{};
                work.draft.quiz_answers[qid]=val;
                event('quiz_answer',{question_id:qid,question_index:idx,answer:val});
                scheduleSave();
                renderWork();
            };
        });
        handler('#save-quiz-btn',async()=>{
            await save('save');
            event('quiz_submit',{answered_count:Object.keys(work.draft.quiz_answers||{}).length});
            notify('Quiz yanıtlarınız başarıyla kaydedildi.');
        });
    }
    const forumHost=$('#case-forum');if(forumHost&&typeof VakaForum!=='undefined'){const phase=section==='initial'?'before':'after',target=work;forumViews.push(VakaForum.mount(forumHost,{api,appId:target.application.id,phase,userId:me.id,confirm:confirmStudent,readOnly:()=>work!==target||locked(),onInteraction:(type,payload,throttle=false)=>{if(work===target){lastInput=Date.now();event(type,payload,throttle);}},onState:data=>{if(work!==target)return;if(Number.isInteger(data.own_post_count)){target.forum_participation??={};target.forum_participation[phase]=data.own_post_count;updateValidationFeedback();}},onPost:post=>{if(work!==target)return;target.forum_participation??={};target.forum_participation[phase]=(target.forum_participation[phase]||0)+1;updateValidationFeedback();event('forum_posted',{phase,post_id:post.id,parent_id:post.parent_id});}}));}
    document.querySelectorAll('[data-section]').forEach(b=>{b.onpointerdown=e=>{if(dirty&&e.button===0)e.preventDefault();};b.onclick=()=>navigateWork(b.dataset.section).catch(e=>notify(e.message));});
    for(const [id,direction] of [['work-previous',-1],['work-next',1]]){const button=$('#'+id);button.onpointerdown=e=>{if(dirty&&e.button===0)e.preventDefault();};handler('#'+id,()=>advanceWork(direction));}
    document.querySelectorAll('[data-student-attempt]').forEach(b=>b.onclick=async()=>{try{if(dirty)await save();event('section_leave',{reason:'home'});await drainEvents();releaseLease();clearInterval(heartbeatTimer);await openWork(b.dataset.studentAttempt);}catch(e){notify(e.message);}});
    handler('#back',async()=>{if(me.preview_app_id)return exitPreview();if(dirty)await save();event('section_leave',{reason:'home'});await drainEvents();await home();});handler('#initial',async()=>{if(forumDraftPending('before')){notify('Foruma yazdığınız taslağı paylaşın veya temizleyin; ardından AI sohbetine geçin.');forumViews.find(view=>view.hasDraft())?.focus();return;}if(!validateBeforeConfirm('initial'))return;if(!(await confirmStudent('Vaka profiliniz kesinleşecek ve (Önce) forumuna yeni mesaj yazamayacaksınız. AI sohbetine geçilsin mi?')))return;if(!validateBeforeConfirm('initial'))return;await save('initial');event('workflow_confirmed',{kind:'initial'});validationScope=null;section='ai';renderWork();event('section_open');});
    handler('#submit',async()=>{if(forumDraftPending('after')){await navigateWork('final');notify('Foruma yazdığınız taslağı paylaşın veya temizleyin; ardından teslim edin.');forumViews.find(view=>view.phase==='after')?.focus();return;}if(!validateBeforeConfirm('submit'))return;if(!canSubmit()){notify('Teslim için kayıt ve AI işlemlerinin tamamlanmasını bekleyin.');return;}if(!(await confirmStudent('Yeni mesaj ve düzenleme yapılamayacak; tüm süreci görüntüleyebileceksiniz. Teslim edilsin mi?')))return;if(!validateBeforeConfirm('submit')||!canSubmit())return;await save('submit');event('workflow_confirmed',{kind:'submit'});clearInterval(heartbeatTimer);await drainEvents();validationScope=null;renderWork();notify('Vaka teslim edildi.');});handler('#send',sendChat);
    syncChat();document.querySelectorAll('[data-report]').forEach(b=>b.onclick=()=>download({report_ids:b.dataset.report,format:b.dataset.format}));bindStudentReports();
    updateValidationFeedback();
    const activeTab=document.querySelector('[data-section="'+section+'"]');
    if(activeTab){const nav=activeTab.parentElement;nav.scrollLeft=Math.max(0,activeTab.offsetLeft-nav.offsetLeft-(nav.clientWidth-activeTab.offsetWidth)/2);}
}
const scrolls={};

function bindStudentReports(){document.querySelectorAll('[data-student-report]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{const r=await api('report_data',undefined,{id:b.dataset.studentReport,student_view:1});const dialog=showDialog(studentReportHtml(r),()=>{});dialog.querySelector('#dialog-close').textContent='Kapat';const article=dialog.querySelector('.student-report');article.tabIndex=-1;article.focus({preventScroll:true});dialog.scrollTop=0;dialog.querySelectorAll('[data-student-download]').forEach(button=>button.onclick=()=>download({report_ids:r.id,format:button.dataset.studentDownload,student_view:1}));}catch(e){notify(e.message);}finally{b.disabled=false;}});}
async function editReportFeedback(reportId,appId){
    const r=await api('report_data',undefined,{id:reportId,student_view:1}),report=r.report;
    demandUi(!r.approved_at,'Onaylı rapor değiştirilemez; yeni rapor hazırlayın.');
    showDialog(`<h2>Geri bildirimleri düzenle</h2><p>Öğrencinin okuyacağı açıklamaları düzenleyin. Kaydetmek yeni bir rapor sürümü oluşturur; puanlar korunur. Puanı değiştirmek için ilgili analiz adımındaki kararınızı düzenleyip yeni rapor hazırlayın.</p>${Object.entries(report.sections).map(([key,section])=>`<h3>${esc(section.title)}</h3>${section.criteria.map((c,i)=>`<p><b>${esc(c.name)}</b> · ${c.score===null?'Puanlanmadı':esc(c.score)+' / '+esc(c.max)}</p>${field('feedback-'+key+'-'+i,'Öğrenciye geri bildirim',c.feedback,'textarea')}`).join('')}`).join('')}${field('feedback-overall',report.format==='student-v2'?'Vaka profilindeki değişim yorumu':'Genel geri bildirim',report.overall_feedback,'textarea')}<button id="commit" class="spaced">Yeni rapor sürümü olarak kaydet</button>`,async()=>{
        const feedback={overall_feedback:getValue('feedback-overall')};
        for(const [key,section] of Object.entries(report.sections))feedback[key]=Object.fromEntries(section.criteria.map((c,i)=>[c.id,getValue('feedback-'+key+'-'+i)]));
        const saved=await api('report',{action:'edit_feedback',id:reportId,feedback});await processView(appId);notify(`Düzenlenen geri bildirimler rapor sürümü ${saved.version} olarak kaydedildi. Önizleyip ayrıca onaylayabilirsiniz.`);
    });
}
function studentReportHtml(r){
    if(r.report.format==='student-v3')return holisticStudentHtml(r);
    const d=r.report,v2=d.format==='student-v2',score=(n,max)=>n==null?'Puanlanmadı':`${esc(n)} / ${esc(max)} puan`;
    const sections=Object.values(d.sections),complete=['initial','final','reflection'].every(key=>d.sections[key]?.total!=null&&d.sections[key]?.max!=null);
    const total=v2?(complete?sections.reduce((n,s)=>n+Number(s.total),0):null):d.total,max=v2?(complete?sections.reduce((n,s)=>n+Number(s.max),0):null):d.max;
    const answer=text=>`<div class="report-answer"><span class="report-field-label">Öğrenci yanıtı</span><p class="prose">${esc(text??'Bu rapor kaydında öğrenci yanıtının metni bulunmuyor.')}</p></div>`;
    return `<article class="student-report"><div class="eyebrow">Öğrenci değerlendirme raporu${v2?'':' · Sürüm '+esc(r.version)}</div><h1>${esc(d.case_title)}</h1><p>Öğrenci: ${esc(d.participant)} · Rubrik: ${esc(d.rubric_name)}</p><p>${r.approved_at?'Araştırmacı tarafından onaylandı.':'İnceleme taslağı · Henüz onaylanmadı.'}</p>
    <div class="report-total"><h2>Toplam alınan puan: ${score(total==null?null:Math.round(total*10000)/10000,max==null?null:Math.round(max*10000)/10000)}</h2><p>${v2?'Başlangıç değerlendirmesi, nihai değerlendirme ve yansıtma puanlarının toplamıdır.':'Nihai değerlendirme puanıdır. Başlangıç puanı karşılaştırma amacıyla ayrıca gösterilir.'}</p></div>
    <p class="muted">Puanlar alınan puan / en yüksek puan biçiminde gösterilir. Öğrenci yanıtı, teslim edilen metindir; değerlendirme yorumu ise bu yanıta ilişkin geri bildirimdir.</p>
    <div class="report-feedback"><h2>${v2?'Profil değişimine ilişkin değerlendirme yorumu':'Genel değerlendirme yorumu'}</h2><p class="prose">${esc(d.overall_feedback)}</p></div>
    ${sections.map(section=>`<section><h2>${esc(section.title)}</h2>${!v2?Object.entries(section.answers||{}).map(([title,text])=>`<h3>${esc(title)}</h3>${answer(text)}`).join(''):''}
    ${section.criteria.map(c=>`<div class="report-criterion"><h3>${v2?'Soru':'Değerlendirme ölçütü'}: ${esc(c.name)}</h3>${v2?answer(c.answer):''}<p class="report-question-score"><strong>${v2?'Bu sorudan':'Bu ölçütten'} alınan puan: ${score(c.score,c.max)}</strong>${c.level?' · Düzey: '+esc(c.level):''}${Number(c.weight)!==1?` · Ağırlık: ${esc(c.weight)}`:''}</p><div class="report-feedback"><span class="report-field-label">Değerlendirme yorumu</span><p class="prose">${esc(c.feedback)}</p></div></div>`).join('')}
    <div class="report-section-total"><strong>Bu bölümden alınan toplam puan: ${score(section.total,section.max)}</strong><p>${v2?'Bu bölümdeki sorulardan alınan puanların toplamıdır.':'Ölçüt puanlarının ağırlıklarıyla çarpılıp toplanmasıyla hesaplanır.'}</p></div></section>`).join('')}
    <div class="row"><button class="secondary" data-student-download="docx">Word indir</button><button class="secondary" data-student-download="pdf">PDF indir</button></div></article>`;
}

function reportLinks(){return (work.reports||[]).length?`<div class="card"><h2>Yayımlanan raporlar</h2>${[...work.reports].sort((a,b)=>Number(b.version)-Number(a.version)).map(r=>`<p>Sürüm ${r.version} <button class="secondary" data-student-report="${r.id}">Raporu görüntüle</button> <button class="secondary" data-report="${r.id}" data-format="docx">Word</button> <button class="secondary" data-report="${r.id}" data-format="pdf">PDF</button></p>`).join('')}</div>`:'';}
const recordedResponses=new Set();
function destroyChatView(){chatView?.destroy();chatView=null;}
function syncChat(forceBottom=false){
    const scroller=$('#chat');if(!work||section!=='ai'||!scroller)return;
    if(!chatView||chatView.scroller!==scroller){destroyChatView();chatView=VakaChat.mount(scroller,$('#chat-latest'),work.application.id,()=>event('scroll',{},true));}
    chatView.update(VakaChat.messages(work,busy),{forceBottom});
    const send=$('#send'),status=$('#ai-status');if(send)send.disabled=locked()||busy;if(status)status.textContent=busy?'Yanıt hazırlanıyor…':'Sohbet hazır';
    const failures=$('#chat-failures'),failureHtml=VakaChat.failures(work.requests,locked()||busy);if(failures&&failures.innerHTML!==failureHtml)failures.innerHTML=failureHtml;
    document.querySelectorAll('[data-retry-request]').forEach(button=>{button.disabled=locked()||busy;button.onclick=()=>retryChat(button.dataset.retryRequest);});
}
function recordResponse(r){if(!work||!['completed','partial','failed'].includes(r?.status))return;const key=work.application.id+'/'+r.id+'/'+r.status+'/'+(r.completed_at||'');if(recordedResponses.has(key))return;recordedResponses.add(key);event('response_visible',{request:r.id,status:r.status,quality:'full_response_only',in_ai:section==='ai'});}
async function refreshChat(){const target=work;if(!target)return;const pendingRequest=target.application.active_request;const updated=await api('view',undefined,{app_id:target.application.id});if(work!==target)return;target.messages=updated.messages;target.requests=updated.requests;target.application.active_request=updated.application.active_request;const wasBusy=busy;busy=!!updated.application.active_request||!!target.chatInFlight;updateSubmitGate();syncChat();if(wasBusy&&!busy){const completed=target.requests.find(r=>r.id===pendingRequest);if(completed)recordResponse(completed);notify('AI işlemi tamamlandı. Sohbet bölümünden görüntüleyebilirsiniz.');}}
async function sendChat(){
    if(!work||busy||locked())return;
    const target=work,draftAtSend=target.draft.question,text=draftAtSend.trim();if(!text)return;
    const keyName=recoveryKey()+':request',textKey=keyName+':text',previousKey=sessionStorage.getItem(keyName),previousText=sessionStorage.getItem(textKey);
    const key=previousKey&&(previousText===text||previousText===null)?previousKey:crypto.randomUUID();let posted=false;
    target.pendingChat={key,text,afterSeq:Math.max(0,...target.messages.map(message=>Number(message.seq))),status:'sending'};
    target.chatInFlight=true;busy=true;updateSubmitGate();syncChat(true);
    try{
        await save();
        if(work!==target){target.chatInFlight=false;target.pendingChat=null;return;}
        demandUi(!locked(),'Sohbet şu anda salt okunur. Gönderilen metin taslağınızda korunuyor.');
        sessionStorage.setItem(keyName,key);sessionStorage.setItem(textKey,text);posted=true;
        event('message_send',{request_key:key});
        const r=await api('chat',{app_id:target.application.id,text,key});target.chatInFlight=false;
        if(work!==target){sessionStorage.removeItem(keyName);sessionStorage.removeItem(textKey);notify('Önceki vakadaki AI işlemi tamamlandı.');return;}
        await refreshChat();if(work!==target)return;
        sessionStorage.removeItem(keyName);sessionStorage.removeItem(textKey);target.pendingChat=null;
        const clearDraft=!busy&&target.draft.question===draftAtSend;
        if(clearDraft){target.draft.question='';removeRichText(target.draft,'question');scheduleSave();}
        if(section==='ai'){if(clearDraft)renderWork();else syncChat();}else notify(`AI işlemi: ${r.status}. Sohbet bölümünden görüntüleyebilirsiniz.`);
        recordResponse(r);
    }catch(e){
        target.chatInFlight=false;
        if(target.pendingChat)target.pendingChat.status=posted&&!e.status?'uncertain':'failed';
        if(e.status===409){sessionStorage.removeItem(keyName);sessionStorage.removeItem(textKey);}
        if(work===target){busy=!!target.application.active_request;updateSubmitGate();syncChat();notify(e.message+(posted?' Ağ belirsizliğinde aynı mesajı tekrar gönderebilirsiniz.':''));}
    }
}
async function retryChat(requestId){
    const target=work;if(!target||busy||locked())return;
    const request=target.requests.find(r=>r.id===requestId);if(!request)return;
    if(!(await confirmStudent('Sağlayıcıda önceki isteğin maliyeti oluşmuş olabilir. Yeni deneme yapılsın mı? Öğrenci mesajı çoğaltılmayacak.'))||work!==target||busy||locked())return;
    target.chatInFlight=true;busy=true;updateSubmitGate();syncChat(true);event('message_send',{request_key:request.client_key});
    try{
        const result=await api('chat',{app_id:target.application.id,key:request.client_key,retry_request:request.id});
        target.chatInFlight=false;
        if(work!==target)return;
        await refreshChat();if(work!==target)return;
        recordResponse(result);if(section==='ai')renderWork();else notify('Yeniden deneme tamamlandı.');
    }catch(e){target.chatInFlight=false;if(work===target){busy=!!target.application.active_request;updateSubmitGate();if(section==='ai')renderWork();notify(e.message);}}
}
function event(type,payload={},throttle=false){if(!work||me?.role!=='student'||(work.application.state==='submitted'&&!(type==='workflow_confirmed'&&payload.kind==='submit')))return;if(type==='section_open')visitEditedFields=new Set();if(throttle&&Date.now()-lastEvent<700)return;if(throttle)lastEvent=Date.now();events.push({key:crypto.randomUUID(),tab,seq:++seq,at:new Date().toISOString(),type,section,payload:{...payload,view_id:viewId,response_mode:work.draft.response_mode||'individual',navigation_version:2,pending_request:work.application.active_request||null,app_active:!document.hidden&&document.hasFocus(),locked:sectionLocked(section),read_only_tab:readOnlyTab,submitted:work.application.state==='submitted',visible:!document.hidden,focused:document.hasFocus(),interactive:Date.now()-lastInput<me.config.idle_ms}});sessionStorage.setItem(recoveryKey()+':events',JSON.stringify(events));sessionStorage.setItem(recoveryKey()+':seq',String(seq));if(events.length>=20)flushEvents();}
let flushTask=null;
async function flushEvents(){if(flushTask)return flushTask;if(!work||!events.length)return;const target=work,queued=events,chunk=queued.slice(0,100),id=target.application.id,key=recoveryKey()+':events';flushTask=(async()=>{try{const r=await api('events',{app_id:id,events:chunk}),remaining=(work===target?events:queued).filter(e=>!r.accepted.includes(e.key));if(work===target)events=remaining;sessionStorage.setItem(key,JSON.stringify(remaining));}catch(e){/* retain queue for authenticated retry */}finally{flushTask=null;}})();return flushTask;}
async function drainEvents(){for(let i=0;work&&events.length&&i<20;i++){const before=events.length;await flushEvents();if(events.length>=before)break;}}
function flushExitEvents(){if(!work||me?.role!=='student'||work.application.state==='submitted')return;event('page_exit',{reason:'pagehide'});let chunk=events.slice(-50),body=JSON.stringify({app_id:work.application.id,events:chunk});while(new TextEncoder().encode(body).length>60000&&chunk.length>1){chunk=chunk.slice(1);body=JSON.stringify({app_id:work.application.id,events:chunk});}fetch('api.php?'+new URLSearchParams({op:'events',...(previewToken?{preview:previewToken}:{})}),{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},credentials:'same-origin',body,keepalive:true}).catch(()=>{});}
window.addEventListener('pagehide',flushExitEvents);
window.addEventListener('pageshow',e=>{if(e.persisted&&work&&work.application.state!=='submitted'){viewId=crypto.randomUUID();event('section_open');flushEvents();}});

let lastPresence=null;
function recordPresence(){if(!work)return;const active=!document.hidden&&document.hasFocus(),key=viewId+'/'+active;if(lastPresence===key)return;lastPresence=key;event('app_presence',{app_active:active});flushEvents();}
document.addEventListener('visibilitychange',()=>{event('visibility');recordPresence();});
window.addEventListener('focus',()=>{event('focus');recordPresence();});window.addEventListener('blur',()=>{event('focus');recordPresence();});window.addEventListener('offline',()=>{event('offline');status('Bağlantı yok, sunucuya gönderilemedi',true);updateSubmitGate();});window.addEventListener('online',()=>{event('online');flushEvents();updateSubmitGate();if(dirty)save().catch(e=>notify(e.message));});
window.addEventListener('beforeunload',e=>{if(dirty||forumDraftPending()){localSave();e.preventDefault();e.returnValue='';}});
document.addEventListener('paste',e=>{const editor=e.target.closest?.('[data-editor-field]');if(editor||e.target.matches('textarea,input'))event('paste',{field:editor?.dataset.editorField||e.target.id});});
document.addEventListener('copy',()=>{if(!work)return;const el=document.activeElement;let source=section,quote='',start=null,end=null;if(el?.matches('textarea,input')){start=el.selectionStart;end=el.selectionEnd;quote=el.value.slice(start,end);source=el.id;}else if(typeof VakaEditor!=='undefined'&&el?.closest('[data-editor-field]')){source=el.closest('[data-editor-field]').dataset.editorField;const input=document.getElementById(source),range=VakaEditor.get(input)?.getSelection();if(range){start=range.index;end=Math.min(input.value.length,start+range.length);quote=input.value.slice(start,end);}else quote=window.getSelection()?.toString()||'';}else{const s=window.getSelection();quote=s?.toString()||'';const node=s?.anchorNode?.parentElement?.closest('[data-source]');source=node?.dataset.source||section;if(s?.rangeCount){const range=s.getRangeAt(0);if(node&&node.contains(range.startContainer)&&node.contains(range.endContainer)){const pre=range.cloneRange();pre.selectNodeContents(node);pre.setEnd(range.startContainer,range.startOffset);start=pre.toString().length;end=start+quote.length;}}}event('copy',{source,version:work.version.id,revision:work.application.revision,start,end,length:quote.length,quote:quote.slice(0,6000)});});
let adminTab='overview',currentAnalysisView=null;
async function processView(id,guard=null,loaded=null){rememberProcessUi();const v=loaded||await api('view',undefined,{app_id:id}),a=v.application,u=dash.users.find(u=>u.id===a.user_id),c=dash.cases.find(c=>c.id===a.case_id);if(guard&&!guard())return;destroyForums();$('#root').innerHTML=`<div class="toolbar"><div><div class="eyebrow">Öğrenci-vaka dosyası · ${esc(a.id)}</div><h1>${esc(u.login)} · ${esc(c.title)}</h1><span class="pill">${esc(stateName(a.state))}</span></div><div class="row"><button class="secondary" id="process-refresh">Verileri yenile</button><button class="secondary" id="process-study">Hafta / grup ve ICAP</button><button class="secondary" id="process-research-export">Bu denemenin araştırma JSON'u</button><button class="secondary" id="admin-back">← Genel durum</button></div></div><div class="card"><h2>Özet ve veri bütünlüğü</h2><p>Deneme ${a.attempt_no} · Vaka sürümü ${v.version.version} · ${typeof VakaResearchForum!=='undefined'&&VakaResearchForum.isForum(v)?'Önce aşaması tamamlanma':'Başlangıç'} ${displayTime(a.initial_at)} · Teslim ${displayTime(a.submitted_at)}</p><div class="row">${v.attempts.map(t=>`<button class="secondary" data-attempt="${t.id}" ${t.id===a.id?'disabled':''}>Deneme ${t.attempt_no} · ${esc(stateName(t.state))}</button>`).join('')}<button id="new-attempt" ${a.state!=='submitted'||v.attempts[0].id!==a.id?'disabled':''}>Yeni deneme aç</button><button class="secondary" id="exclude">${Number(a.excluded)?'Analize dahil et':'Analiz dışı işaretle'}</button><button class="secondary" id="process-json">Ham JSON indir</button><button class="secondary" id="process-disco">Disco: geçişler ve süreler</button><button class="secondary" id="process-disco-events">Disco: ayrıntılı olaylar ve AI</button></div></div>${v.research?.settings?`<p class="study-context">Araştırma bağlamı · Hafta: ${esc(v.research.settings.week_id||'Tanımlanmadı')} · Grup: ${esc(v.research.group?.name||'Tanımlanmadı')} · Protokol: ${esc(v.research.settings.protocol_version||'Tanımlanmadı')} · Ayar sürümü ${v.research.settings.revision}</p>`:''}${processDataHtml(v)}<details class="card research-forums" id="research-forums"><summary>Tüm sınıfın tartışması (Önce / Sonra)</summary><p class="muted">Bu vakadaki bütün öğrencilerin ortak tartışmaları bağlam için gösterilir. Seçilen öğrencinin mesajları vurgulanır.</p><section id="research-forum-before"></section><section id="research-forum-after"></section></details><div class="card"><div class="toolbar"><h2>Değerlendirme ve rapor</h2></div>${renderAnalysisRuns(v)}</div>`;
    const forumPanel=$('#research-forums');if(forumPanel&&typeof VakaForum!=='undefined')forumPanel.ontoggle=()=>{if(forumPanel.open&&!forumPanel.dataset.loaded){forumPanel.dataset.loaded='1';for(const phase of ['before','after'])forumViews.push(VakaForum.mount($('#research-forum-'+phase),{api,appId:id,phase,userId:me.id,highlightUser:a.user_id}));}};
    if(typeof VakaEditor!=='undefined')VakaEditor.decorate($('#root'));
    currentAnalysisView=v;bindProcessData(v,id);if(typeof VakaStudy!=='undefined')VakaStudy.bindProcess(v);bindReviewV2(v,id);bindHolisticReview(v,id);watchAnalysis(id,v);
    document.querySelectorAll('[data-attempt]').forEach(b=>b.onclick=()=>processView(b.dataset.attempt).catch(e=>notify(e.message)));
    handler('#new-attempt',()=>showDialog(`<h2>Yeni deneme aç</h2><p>Öğrenci bu vakayı boş yanıtlarla baştan dolduracak. Önceki teslim, sohbet ve değerlendirmeler ayrı kayıtta korunacak. Vaka metni aynı kalacak. Veri toplama kapalıysa bu öğrenciye ek süre açılacak.</p>${field('reason','Yeni deneme açma gerekçesi','','textarea')}<button id="commit" class="spaced">Yeni deneme aç</button>`,async()=>{const next=await api('admin',{action:'new_attempt',app_id:id,reason:getValue('reason')});dash=await api('dashboard');await processView(next.id);notify('Yeni deneme açıldı. Öğrenci Vakalarım üzerinden başlayabilir.');}));
    document.querySelectorAll('[data-current-report]').forEach(b=>b.onclick=()=>download({report_ids:b.dataset.currentReport,student_view:1,format:b.dataset.format}));
    document.querySelectorAll('[data-show-report]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await api('report',{action:'show',id:b.dataset.showReport});await processView(id);notify('Güncel rapor öğrenciye gösteriliyor.');}catch(e){notify(e.message);b.disabled=false;}});
    document.querySelectorAll('[data-hide-report]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await api('report',{action:'hide',id:b.dataset.hideReport});await processView(id);notify('Rapor öğrenciye kapatıldı.');}catch(e){notify(e.message);b.disabled=false;}});
    handler('#add-note',()=>showDialog(`<h2>İç araştırmacı notu</h2>${field('note-body','Not','','textarea')}${field('reason','Gerekçe','','textarea')}<button id="commit" class="spaced">Notu ekle</button>`,async()=>{await api('admin',{action:'note',app_id:id,body:getValue('note-body'),reason:getValue('reason')});await processView(id);}));handler('#admin-back',()=>adminHome());handler('#process-json',()=>download({format:'json',app_id:id,include_test:1,include_practice:1,include_excluded:1,coded:0}));handler('#exclude',()=>showDialog(`<h2>Analiz kapsamını değiştir</h2>${field('reason','Gerekçe','','textarea')}<button id="commit" class="spaced">Kaydet</button>`,async()=>{await api('admin',{action:'exclude',id,excluded:!Number(a.excluded),reason:getValue('reason')});await processView(id);}));
    document.querySelectorAll('[data-start-analysis]').forEach(b=>b.onclick=()=>startAnalysisSequence(b.dataset.startAnalysis,id));
    document.querySelectorAll('[data-next-step]').forEach(b=>b.onclick=async()=>{if(b.disabled)return;const runEl=b.closest('[data-analysis-run]');runEl.querySelectorAll('[data-next-step]').forEach(el=>el.disabled=true);b.textContent='Çalışıyor…';runEl.querySelector(`[data-analysis-step="${b.dataset.nextStep}"] [data-step-status]`).textContent='Çalışıyor';try{const s=await api('step',{run_id:b.dataset.run,step:Number(b.dataset.nextStep)});notify(s.status==='failed'?'Adım başarısız; çıktı puana çevrilmedi.':'Adım tamamlandı.');await processView(id);}catch(e){notify(e.message);await processView(id);}});
    document.querySelectorAll('[data-decide]').forEach(b=>b.onclick=()=>decisionForm(v.steps.find(s=>s.id===b.dataset.decide),id,'edit'));
    document.querySelectorAll('[data-accept-step]').forEach(b=>b.onclick=()=>acceptReviewStep(v.steps.find(s=>s.id===b.dataset.acceptStep),id));
    document.querySelectorAll('[data-recalculate-step]').forEach(b=>b.onclick=()=>recalculateReviewStep(v.steps.find(s=>s.id===b.dataset.recalculateStep),id));
    document.querySelectorAll('[data-other-decision]').forEach(b=>b.onclick=()=>decisionForm(v.steps.find(s=>s.id===b.dataset.otherDecision),id,b.dataset.action));
    document.querySelectorAll('[data-create-report]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await api('report',{action:'create',run_id:b.dataset.createReport});await processView(id);}catch(e){notify(e.message);b.disabled=false;}});
    document.querySelectorAll('[data-edit-feedback]').forEach(b=>b.onclick=()=>editReportFeedback(b.dataset.editFeedback,id).catch(e=>notify(e.message)));
    document.querySelectorAll('[data-report-action]').forEach(b=>b.onclick=async()=>{try{await api('report',{action:b.dataset.reportAction,id:b.dataset.id});await processView(id);}catch(e){notify(e.message);}});
    document.querySelectorAll('[data-report]').forEach(b=>b.onclick=()=>download({report_ids:b.dataset.report,format:b.dataset.format}));bindStudentReports();
    handler('#combined',async()=>{const ids=[];for(const other of dash.applications.filter(x=>x.user_id===a.user_id)){const ov=await api('view',undefined,{app_id:other.id});ids.push(...ov.reports.map(r=>r.id));}download({report_ids:ids.join(','),format:'docx'});});
    document.querySelectorAll('[data-label-message]').forEach(b=>b.onclick=()=>labelForm(b.dataset.labelMessage,v,id));
    document.querySelectorAll('[data-resolve-analysis]').forEach(b=>b.onclick=()=>showDialog(`<h2>Takılı analiz adımı</h2>${field('reason','Gerekçe','','textarea')}<button id="commit" class="danger spaced">Timeout sonrası kapat</button>`,async()=>{await api('admin',{action:'resolve_analysis',id:b.dataset.resolveAnalysis,reason:getValue('reason')});await processView(id);}));document.querySelectorAll('[data-resolve]').forEach(b=>b.onclick=()=>showDialog(`<h2>Takılı isteği gerekçeli kapat</h2><p>Timeout + 60 saniye dolmalı. Sağlayıcı isteği ayrıca durdurulmuş sayılmaz; geç yanıt attempt kimliğiyle reddedilir.</p>${field('reason','Gerekçe','','textarea')}<button id="commit" class="danger spaced">İsteği başarısız kapat</button>`,async()=>{await api('admin',{action:'resolve_request',id:b.dataset.resolve,reason:getValue('reason')});await processView(id);}));
}

let activeAnalysisSequence=null;
let analysisObserver=null;
function analysisWorkPending(v,appId){
    if(activeAnalysisSequence?.appId===appId)return true;
    const run=[...(v?.analysis_runs||[])].reverse().find(r=>Number(r.review_version)>=2);
    return !!run&&(v.steps||[]).some(s=>s.run_id===run.id&&s.status==='running');
}
function watchAnalysis(appId,view){
    analysisObserver?.stop();analysisObserver=null;
    const pending=v=>analysisWorkPending(v,appId);
    if(!pending(view))return;
    const newRun=$('#new-run');if(newRun)newRun.disabled=true;
    const visible=()=>me?.role==='researcher'&&$('#process-data')?.dataset.appId===appId;
    analysisObserver=observeAnalysis({initial:view,isCurrent:visible,hasWork:pending,load:()=>api('view',undefined,{app_id:appId}),onChange:async next=>{
        // Do not destroy an open researcher edit or confirmation dialog.
        if(document.querySelector('dialog[open]')||holisticDirty(appId))return false;
        const scroll=window.scrollY,details=[...document.querySelectorAll('.review-workspace details')].map(el=>el.open);
        await processView(appId,visible,next);
        if(visible()){
            document.querySelectorAll('.review-workspace details').forEach((el,i)=>{if(details[i]!==undefined)el.open=details[i];});
            window.scrollTo(0,scroll);
        }
    }});
}
async function startAnalysisSequence(runId,appId){
    if(activeAnalysisSequence)return;
    if(analysisWorkPending(currentAnalysisView,appId)){watchAnalysis(appId,currentAnalysisView);notify('Değerlendirme sürüyor; sonuçlar otomatik güncellenecek.');return;}
    activeAnalysisSequence={runId,appId,step:null};
    const visible=()=>me?.role==='researcher'&&$('#process-data')?.dataset.appId===appId;
    try{
        await processView(appId,visible);
        const result=await runSequentialAnalysis(runId,{
            load:()=>api('view',undefined,{app_id:appId}),
            execute:step=>api('step',{run_id:runId,step}),
            canContinue:visible,
            update:async(_,state)=>{
                activeAnalysisSequence.step=state.step;
                if(!visible())return;
                if(state.phase==='running'){
                    const run=document.querySelector(`[data-analysis-run="${runId}"]`);
                    const status=run?.querySelector('[data-sequence-status]');
                    if(status)status.textContent=state.step===1?'Öğrenci kayıtları kontrol ediliyor…':state.step===8?'Kararlarınız rapor için birleştiriliyor…':`${analysisStepLabel(runId,state.step)} hazırlanıyor…`;
                    const badge=run?.querySelector(`[data-analysis-step="${state.step}"] [data-step-status]`);
                    if(badge)badge.textContent='Çalışıyor';
                }else await processView(appId,visible);
            }
        });
        if(visible())notify({review:'Değerlendirmeler hazır. Her karttaki Kabul et veya Düzenle düğmesiyle kararınızı kaydedin.',completed:'Analiz adımları tamamlandı. Raporu ayrıca hazırlayıp onaylayabilirsiniz.',failed:`${result.step}. adım başarısız. Önceki sonuçlar korundu; Hazırlamaya devam et ile yeniden deneyebilirsiniz.`,running:'Sunucuda çalışan bir adım var; sonuçlar otomatik güncellenecek.',paused:'Sıralı analiz durduruldu; tamamlanan sonuçlar korundu.'}[result.status]);
    }catch(e){if(visible())notify(e.message+' Sunucudaki durum otomatik kontrol ediliyor.');}
    finally{activeAnalysisSequence=null;if(visible()){try{await processView(appId,visible);}catch(e){notify(e.message);}}}
}

const stepNames={1:'Veri bütünlüğü',2:'Profil ve güven farkı',3:'Başlangıç rubriği',4:'Nihai rubriği',5:'Dönüşüm',6:'Etkileşim ve etiketler',7:'Yansıtma',8:'Rapor birleştirme'};
function renderAnalysisRuns(v){
    return renderHolisticReview(v);
}
function reviewResultHtml(s,decision,v){
    const d=processObject(decision&&['accept','edit'].includes(decision.action)?decision.body:s.output),rubric=processObject(s.input).rubric;
    if(d.scores){
        const dims=rubric?.dimensions||[];let total=0,max=0;
        for(const dim of dims){total+=Number(d.scores[dim.id]?.score||0)*Number(dim.weight);max+=Number(dim.max)*Number(dim.weight);}
        const round=n=>Math.round(n*10000)/10000;
        return `<div class="review-total">Toplam puan <strong>${round(total)} / ${round(max)}</strong></div><div class="review-criteria">${dims.map(dim=>{const score=d.scores[dim.id];if(!score)return '';return `<article class="review-criterion"><div class="review-criterion-heading"><h4>${esc(dim.name)}</h4><strong>${esc(score.score)} / ${esc(dim.max)}</strong></div><p class="muted">${esc(score.level)}${Number(dim.weight)!==1?' · Ağırlık: '+esc(dim.weight):''}</p><h5>Geri bildirim</h5><p class="prose">${esc(score.feedback||(/\b(mock|AI|JSON|prompt)\b/i.test(score.reason||'')?'Bu eski sonuçta öğrenciye yönelik geri bildirim yok. Düzenle ile yazabilir veya bu kartı yeniden hesaplatabilirsiniz.':score.reason)||'Geri bildirim bulunmuyor.')}</p></article>`;}).join('')}</div>`;
    }
    return `<p class="review-no-score">Bu bölüm sayısal olarak puanlanmaz.</p><h4>Değerlendirme</h4><p class="prose">${esc(d.summary||'Henüz açıklama hazırlanmadı.')}</p>${d.labels?`<details><summary>Mesaj etiketlerini göster</summary>${Object.entries(d.labels).map(([mid,ids])=>`<p>Mesaj ${esc(v.messages.find(m=>m.id===mid)?.seq||'—')}: ${esc(labelNames(ids))}</p>`).join('')}</details>`:''}`;
}
function renderRun(run,v){
    const progress=analysisProgress(run.id,v),busy=!!activeAnalysisSequence||progress.some(p=>p.status==='running');
    const reviews=progress.slice(2,7),ready=reviews.filter(p=>p.done).length;
    const decisionFor=s=>s?v.decisions.filter(d=>d.step_id===s.id).at(-1):null;
    const reviewed=reviews.filter(p=>decisionFor(p.done)).length;
    const generated=progress.slice(0,7).every(p=>p.done),failed=progress.find(p=>!p.done&&p.latest?.status==='failed');
    const titles={3:'Başlangıç yanıtı',4:'Nihai yanıt',5:'Karardaki değişim',6:'AI ile etkileşim',7:'Yansıtma'};
    const context={3:'Öğrencinin AI kullanmadan önce verdiği yanıt.',4:'Öğrencinin çalışma sonunda verdiği yanıt.',5:'Başlangıç ve nihai yanıt arasındaki değişim.',6:'Öğrencinin AI ile konuşmasının değerlendirmesi.',7:'Öğrencinin süreç hakkındaki yansıtması.'};
    return `<section class="analysis-run review-workspace" data-analysis-run="${run.id}"><div class="review-progress"><p><b>${ready} / 5 değerlendirme hazır</b> · ${reviewed} / 5 karar kaydedildi</p><p class="muted">${displayTime(run.created_at)}</p></div><button data-start-analysis="${run.id}" ${busy||generated?'disabled':''} ${generated&&!busy?'hidden':''}>${busy?'Hazırlanıyor…':ready?'Analize devam et':'Değerlendirmeyi başlat'}</button><p data-sequence-status role="status" aria-live="polite">${busy?'Değerlendirme hazırlanıyor; sonuçlar sırayla burada görünecek.':failed?`${stepNames[failed.n]} hazırlanamadı. Analize devam et ile tekrar deneyebilirsiniz.`:generated?'Her kartı inceleyin. Uygunsa Kabul et, değişiklik gerekiyorsa Düzenle düğmesini kullanın.':'Başlat düğmesine bir kez basın; değerlendirmeler sırayla hazırlanır.'}</p><div class="review-cards">${reviews.map(p=>{
        const s=p.done,decision=decisionFor(s),accepted=decision&&['accept','edit'].includes(decision.action);
        const state=p.status==='running'?'Hazırlanıyor':!s?(p.latest?.status==='failed'?'Hazırlanamadı':'Sırası bekleniyor'):decision?({accept:'Kabul edildi',edit:'Düzenlendi ve onaylandı',reject:'Kabul edilmedi',uncertain:'Karar bekliyor'}[decision.action]):'İncelemeniz bekleniyor';
        return `<article class="analysis-step review-card ${p.done?'completed':''} ${p.status}" data-analysis-step="${p.n}"><div class="review-card-heading"><div><h3>${titles[p.n]}</h3><p class="muted">${context[p.n]}</p></div><span class="pill ${accepted?'':'warn'}" data-step-status>${state}</span></div>${p.latest?.status==='failed'?`<p class="status error">${s?'Yeniden hesaplanamadı; önceki sonuç korundu.':'Değerlendirme hazırlanamadı. Yeniden deneyebilirsiniz.'}</p>`:''}${s?`${reviewResultHtml(s,decision,v)}<div class="review-actions"><button data-accept-step="${s.id}" ${busy||accepted?'disabled':''}>${accepted?'Kabul edildi':'Kabul et'}</button><button class="secondary" data-decide="${s.id}" ${busy?'disabled':''}>Düzenle</button><button class="secondary" data-recalculate-step="${s.id}" ${busy?'disabled':''}>Yalnız bunu yeniden hesaplat</button></div><details class="review-source"><summary>Öğrencinin yanıtını ve dayanağı göster</summary>${processAnalysisInput(s.input)}${(processObject(s.output).scores?Object.values(processObject(s.output).scores):processObject(s.output).evidence||[]).map(e=>e.quote?`<blockquote>${esc(e.quote)}</blockquote>`:'').join('')}</details><details class="review-other"><summary>Diğer karar seçenekleri</summary><button class="secondary" data-other-decision="${s.id}" data-action="reject" ${busy?'disabled':''}>Kabul etme</button> <button class="secondary" data-other-decision="${s.id}" data-action="uncertain" ${busy?'disabled':''}>Karar veremedim</button></details><details class="analysis-results review-history"><summary>Önceki sonuçlar ve kararlar (${p.attempts.length} sonuç)</summary>${p.attempts.map(attempt=>`<article class="analysis-attempt"><h4>Sonuç ${attempt.attempt} · ${esc(processStatus(attempt.status))}</h4>${attempt.status==='completed'?processAnalysisOutput(attempt.output,v,processObject(attempt.input).rubric?.dimensions||[]):'<p>Bu denemede kullanılabilir sonuç oluşmadı.</p>'}${processDecisionHistory(v.decisions.filter(d=>d.step_id===attempt.id),v)}</article>`).join('')}</details>`:'<p>Sonuç hazır olduğunda puan veya açıklama burada görünecek.</p>'}</article>`;
    }).join('')}</div><div class="review-report"><p data-merge-status>${reviewed<5?'Rapor hazırlamak için beş değerlendirmedeki kararlarınızı tamamlayın.':progress[7].done?'İncelemeler tamamlandı. Öğrencinin göreceği raporu hazırlayabilirsiniz.':'Kararlarınız rapor için birleştiriliyor.'}</p>${progress[7].done&&!busy?`<button data-create-report="${run.id}">Öğrenci raporunu hazırla</button>`:''}</div><details class="review-technical"><summary>Veri kontrolü ve hesaplama ayrıntıları</summary>${[progress[0],progress[1],progress[7]].map(p=>`<div class="analysis-step ${p.done?'completed':''}" data-analysis-step="${p.n}"><h4>${stepNames[p.n]}</h4><span data-step-status>${p.done?'Tamamlandı':'Bekliyor'}</span>${p.done?processAnalysisOutput(p.done.output,v):'<p>Henüz tamamlanmadı.</p>'}</div>`).join('')}</details></section>`;
}
async function acceptReviewStep(s,appId){
    if(activeAnalysisSequence)return;
    const button=document.querySelector(`[data-accept-step="${s.id}"]`);if(button)button.disabled=true;
    try{await api('decision',{step_id:s.id,action:'accept',reason:'Araştırmacı Kabul et düğmesiyle bu değerlendirmeyi kabul etti.'});await finishReview(s.run_id,appId);}catch(e){notify(e.message);if(button)button.disabled=false;}
}
async function finishReview(runId,appId){
    await processView(appId);
    if(analysisProgress(runId,currentAnalysisView).find(p=>p.n===8)?.status==='ready')await startAnalysisSequence(runId,appId);
}
async function recalculateReviewStep(s,appId){
    if(activeAnalysisSequence)return;
    if(analysisWorkPending(currentAnalysisView,appId)){watchAnalysis(appId,currentAnalysisView);notify('Değerlendirme sürüyor; sonuçlar otomatik güncellenecek.');return;}
    activeAnalysisSequence={runId:s.run_id,appId,step:Number(s.step),mode:'repeat'};
    const visible=()=>me?.role==='researcher'&&$('#process-data')?.dataset.appId===appId;
    try{await processView(appId,visible);const result=await api('step',{run_id:s.run_id,step:Number(s.step),repeat:true});if(visible())notify(result.status==='completed'?'Yeni sonuç hazır. Bu kartı yeniden inceleyip kararınızı kaydedin.':'Yeniden hesaplanamadı; önceki sonuç korundu.');}
    catch(e){if(visible())notify(e.message);}
    finally{activeAnalysisSequence=null;if(visible()){try{await processView(appId,visible);}catch(e){notify(e.message);}}}
}

function decisionForm(s,id,initialAction='edit'){
    const latest=currentAnalysisView?.decisions.filter(d=>d.step_id===s.id).at(-1),output=processObject(latest?.action==='edit'?latest.body:s.output),payload=processObject(s.input),scores=Object.entries(output.scores||{}),dims=Object.fromEntries((payload.rubric?.dimensions||[]).map(d=>[d.id,d]));
    const sources=Object.keys(payload.sources||{}).map(key=>[key,{initial:'Başlangıç yanıtı',final:'Nihai yanıt',reflection:'Yansıtma'}[key]||'Konuşma mesajı']);
    const editor=scores.length?scores.map(([key,score],i)=>`<fieldset class="process-entry"><legend>${esc(dims[key]?.name||'Ölçüt')}</legend><div class="grid"><div>${field('review-score-'+i,'Puan (en fazla '+dims[key]?.max+')',score.score,'number')}</div><div>${select('review-level-'+i,'Düzey',[...new Set([score.level,...(dims[key]?.levels||[]).map(l=>l.name)])].map(name=>[name,name]),score.level)}</div></div>${field('review-feedback-'+i,'Öğrenciye geri bildirim',score.feedback||(/\b(mock|AI|JSON|prompt)\b/i.test(score.reason||'')?'':score.reason),'textarea')}<details><summary>Puanlama dayanağını düzenle</summary>${select('review-source-'+i,'Dayanak yanıt',sources,score.source)}${field('review-quote-'+i,'Öğrenci yanıtındaki dayanak pasaj',score.quote,'textarea')}${field('review-reason-'+i,'İç puanlama gerekçesi',score.reason,'textarea')}</details></fieldset>`).join(''):`${field('review-summary','Değerlendirme açıklaması',output.summary||'','textarea')}<details><summary>Dayanak pasajları düzenle</summary>${(output.evidence||[]).map((e,i)=>`${select('review-source-'+i,'Dayanak yanıt',sources,e.source)}${field('review-quote-'+i,'Dayanak pasaj',e.quote,'textarea')}`).join('')}</details>`;
    const dialog=showDialog(`<h2>${esc(stepNames[s.step])} · Düzenle</h2><p>${scores.length?'Puanları ve öğrencinin okuyacağı geri bildirimleri düzenleyin.':'Değerlendirme açıklamasını düzenleyin.'} Kaydettiğiniz değişiklikler onaylı kararınız olur; önceki sonuçlar korunur.</p><div id="review-editor" ${initialAction==='edit'?'':'hidden'}>${editor}</div><details><summary>Karar ve iç not</summary>${select('decision-action','Karar',[['accept','Kabul et'],['edit','Düzenle'],['reject','Kabul etme'],['uncertain','Karar veremedim']],initialAction)}${field('reason','İç not (isteğe bağlı)','','textarea')}</details><button id="commit" class="spaced">Kaydet ve onayla</button>`,async()=>{
        const action=getValue('decision-action'),body=structuredClone(output);
        if(action==='edit'){
            if(scores.length){for(const [i,[key]] of scores.entries()){
                if(getValue('review-score-'+i).trim()==='')throw new Error('Puanı doldurun.');
                body.scores[key]={score:Number(getValue('review-score-'+i)),level:getValue('review-level-'+i),source:getValue('review-source-'+i),quote:getValue('review-quote-'+i),reason:getValue('review-reason-'+i),feedback:getValue('review-feedback-'+i)};
            }}else{body.summary=getValue('review-summary');body.evidence=(output.evidence||[]).map((e,i)=>({source:getValue('review-source-'+i),quote:getValue('review-quote-'+i)}));}
        }
        await api('decision',{step_id:s.id,action,body,reason:getValue('reason').trim()||'Araştırmacı bu değerlendirmeyi inceleyerek kararını kaydetti.'});
        document.querySelector('dialog #dialog-close')?.click();await finishReview(s.run_id,id);
    });
    dialog.querySelector('#decision-action').onchange=()=>dialog.querySelector('#review-editor').hidden=getValue('decision-action')!=='edit';
    for(const [i,[key]] of scores.entries()){
        const el=dialog.querySelector('#review-score-'+i),level=dialog.querySelector('#review-level-'+i);el.readOnly=true;el.step='any';
        const update=()=>{const selected=dims[key]?.levels.find(l=>l.name===level.value);el.value=selected?.score??'';};level.onchange=update;update();
    }
}
function labelNames(ids){return ids.length?ids.map(id=>{const d=dash.definitions.find(d=>d.id===id);return d?`${d.name} · v${d.version}`:`Tanımı bulunamayan etiket (${id})`;}).join(', '):'Etiket yok';}
function labelCurrent(mid,v){const state=labelReviewState(v,mid);return `<p class="label-current"><b>Güncel araştırmacı seçimi:</b> ${esc(state.history.length?labelNames(state.current):'Henüz karar verilmedi')}</p>${state.aiKnown?`<p class="muted"><b>AI önerisi (araştırmacı seçimi değildir):</b> ${esc(labelNames(state.ai))}</p>`:'<p class="muted">AI etiket önerisi henüz hazırlanmadı.</p>'}`;}
function labelForm(mid,v,id){
    const state=labelReviewState(v,mid),message=v.messages.find(m=>m.id===mid),selected=state.history.length?state.current:state.ai;
    const labels=dash.definitions.filter(d=>d.family==='label'&&JSON.parse(d.body).target_role===message.role&&!d.deleted_at&&(!Number(d.archived)&&!dash.definitions.some(n=>n.parent_id===d.id)||state.current.includes(d.id)));
    showDialog(`<h2>Mesaj etiketlerini düzenle</h2><p><b>#${message.seq} · ${message.role==='user'?'Öğrenci':'AI'} mesajı</b></p><blockquote class="label-context">${esc(message.content)}</blockquote>${labelCurrent(mid,v)}<fieldset class="label-options"><legend>Yeni seçim</legend><p class="muted">Araştırmacı seçimi varsa o seçim, yoksa AI önerileri işaretlidir. Eklemek için işaretleyin, kaldırmak için işareti kaldırın. Hiçbiri seçili değilse etiketler temizlenir.</p>${labels.map(l=>`<label class="inline-check"><input type="checkbox" data-choose-label="${esc(l.id)}" ${selected.includes(l.id)?'checked':''}>${esc(l.name)} · v${l.version}</label>`).join('')}</fieldset><div id="label-change-preview" class="label-change" aria-live="polite"></div>${field('reason','Değişiklik gerekçesi (zorunlu)','','textarea')}<p class="muted">Kaydetmek için seçiminizi açıklayan kısa bir gerekçe yazın.</p><button id="commit" class="spaced">Etiket değişikliğini kaydet</button><details class="label-history"><summary>Değişiklik geçmişi (${state.history.length} karar)</summary>${state.history.length?[...state.history].reverse().map((r,i)=>`<article class="label-review"><h3>Karar ${state.history.length-i}${i===0?' · Güncel':''}</h3><p>${displayTime(r.created_at)} · ${esc(dash.users.find(u=>u.id===r.actor)?.login||r.actor)}</p><p><b>Önceki seçim:</b> ${esc(labelNames(r.before))}</p><p><b>Yeni seçim:</b> ${esc(labelNames(r.ids))}</p><p><b>Eklenenler:</b> ${esc(labelNames(r.added))}</p><p><b>Kaldırılanlar:</b> ${esc(labelNames(r.removed))}</p><p><b>Gerekçe:</b> ${esc(r.reason)}</p></article>`).join(''):'<p>Henüz araştırmacı kararı kaydedilmedi.</p>'}</details>`,async()=>{const ids=[...document.querySelectorAll('[data-choose-label]:checked')].map(e=>e.dataset.chooseLabel);await api('admin',{action:'labels',message_id:mid,labels:ids,reason:getValue('reason')});await processView(id);notify('Etiketler kaydedildi. Güncel seçim: '+labelNames(ids));});
    const preview=()=>{const ids=[...document.querySelectorAll('[data-choose-label]:checked')].map(e=>e.dataset.chooseLabel),added=ids.filter(x=>!state.current.includes(x)),removed=state.current.filter(x=>!ids.includes(x));$('#label-change-preview').innerHTML=`<h3>Kaydedilecek değişiklik</h3><p><b>Önce:</b> ${esc(labelNames(state.current))}</p><p><b>Sonra:</b> ${esc(labelNames(ids))}</p><p><b>Eklenenler:</b> ${esc(labelNames(added))}</p><p><b>Kaldırılanlar:</b> ${esc(labelNames(removed))}</p>${!added.length&&!removed.length?'<p>Seçim değişmedi.</p>':''}`;};
    document.querySelectorAll('[data-choose-label]').forEach(el=>el.addEventListener('change',preview));preview();
}
init().catch(e=>notify(e.message));
