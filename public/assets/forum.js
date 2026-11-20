'use strict';
(function(root){
    const escape=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const label=phase=>phase==='before'?'Önce':'Sonra';
    const questions={before:['Bu vakadaki temel problemi nasıl değerlendiriyorsunuz?','Kararınız nedir?','Bu kararı neden veriyorsunuz?'],after:['Nihai kararınız nedir?']};
    const questionHtml=phase=>'<div class="forum-questions" aria-label="Tartışma soruları"><p class="eyebrow">'+(phase==='before'?'Tartışmayı bu sorular üzerinden yürütün':'Nihai görüşünüzü bu soru üzerinden tartışın')+'</p><ol>'+questions[phase].map(question=>'<li><h4>'+escape(question)+'</h4></li>').join('')+'</ol></div>';
    function hasDraft(userId,appId,phase,storage=root.sessionStorage){try{return !!JSON.parse(storage.getItem(`vakalab:forum:${userId}:${appId}:${phase}`)||'null')?.body?.trim();}catch{return false;}}
    function threadRows(posts){
        const byId=new Map(posts.map(post=>[post.id,post])),children=new Map(),seen=new Set(),rows=[];
        for(const post of posts){const parent=post.parent_id&&byId.has(post.parent_id)?post.parent_id:null;if(!children.has(parent))children.set(parent,[]);children.get(parent).push(post);}
        const visit=(post,depth)=>{if(seen.has(post.id))return;seen.add(post.id);rows.push({post,depth:Math.min(depth,6)});for(const child of children.get(post.id)||[])visit(child,depth+1);};
        for(const post of children.get(null)||[])visit(post,0);for(const post of posts)visit(post,0);return rows;
    }
    function postHtml(posts,canPost,editor,highlightUser){
        const byId=new Map(posts.map(post=>[post.id,post]));
        return threadRows(posts).map(({post,depth})=>{
            const parent=byId.get(post.parent_id);let time='';try{time=new Intl.DateTimeFormat('tr-TR',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Istanbul'}).format(new Date(post.created_at));}catch{time='—';}
            const rich=post.rich_text&&editor?.render(post.rich_text),body=rich||'<p>'+escape(post.body).replace(/\n/g,'<br>')+'</p>';
            return `<article class="forum-post ${depth?'is-reply':''} ${post.author_id===highlightUser?'is-selected-student':''}" data-forum-post="${escape(post.id)}" data-depth="${depth}"><div class="forum-post-heading"><strong>${escape(post.author||'Öğrenci')}${post.is_own?' <span class="pill">Siz</span>':''}</strong><time datetime="${escape(post.created_at)}">${escape(time)}</time></div>${post.parent_id?`<p class="forum-parent">${parent?'<b>'+escape(parent.author)+'</b> adlı kişinin mesajına yanıt: '+escape(Array.from(parent.body).slice(0,140).join('')):'Önceki bir mesaja yanıt'}</p>`:''}<div class="forum-post-body">${body}</div><button type="button" class="secondary forum-reply" data-reply-id="${escape(post.id)}" ${canPost?'':'disabled'}>Yanıt ver</button></article>`;
        }).join('')||'<p class="empty">Henüz mesaj yok. İlk görüşünüzü paylaşabilirsiniz.</p>';
    }
    function mount(host,options){
        const {api,appId,phase,userId,editor=root.VakaEditor,highlightUser=null}=options;
        const key=`vakalab:forum:${userId}:${appId}:${phase}`,store=options.storage||root.sessionStorage;
        let draft={body:'',rich_text:null,parent_id:null,key:root.crypto.randomUUID()};
        try{const saved=JSON.parse(store.getItem(key)||'null');if(saved&&typeof saved.body==='string')draft={...draft,...saved};}catch{}
        let posts=[],cursor='',hasMore=false,canPost=false,canRead=false,posting=false,loading=false,destroyed=false,timer,quill,rendered='';
        const title='Genel Tartışma Forumu ('+label(phase)+')';
        host.classList.add('case-forum');host.dataset.forumPhase=phase;
        host.innerHTML=`<div class="forum-heading"><div><span class="eyebrow">Vaka arkadaşlarıyla tartışma</span><h3>${title}</h3></div><button type="button" class="secondary" data-forum-refresh>Yenile</button></div><p class="muted">${phase==='before'?'Bireysel AI sohbetinden önce bu vakaya ilişkin görüşlerinizi paylaşın. Bu aşamayı tamamlayıp AI sohbetine geçtikten sonra bu alana yeni mesaj yazamazsınız.':'Bireysel AI sohbetinin ardından bu vakaya ilişkin görüşlerinizi arkadaşlarınızla paylaşın.'} Birden fazla mesaj yazabilir ve bir mesaja yanıt verebilirsiniz.</p>${questionHtml(phase)}<p class="forum-permission" role="status"></p><p class="forum-count muted"></p><div class="forum-error" role="alert" hidden></div><div class="forum-feed" aria-label="${title} mesajları"></div><button type="button" class="secondary" data-forum-more hidden>Daha fazla mesaj yükle</button><div class="forum-composer" hidden><div class="forum-reply-target" hidden></div><label for="forum_body_${phase}">${phase==='after'?'Nihai görüşünüz / yanıtınız':'Görüşünüz / yanıtınız'}</label><textarea id="forum_body_${phase}"></textarea><div class="row spaced"><button type="button" data-forum-send>Mesajı paylaş</button><button type="button" class="secondary" data-forum-clear>Taslağı temizle</button><span class="muted forum-draft-status"></span></div></div>`;
        const find=selector=>host.querySelector(selector),feed=find('.forum-feed'),error=find('.forum-error'),source=find('textarea'),composer=find('.forum-composer'),replyTarget=find('.forum-reply-target'),send=find('[data-forum-send]');
        source.value=draft.body;
        const persist=(renew=false)=>{if(renew)draft.key=root.crypto.randomUUID();if(draft.body.trim()||draft.parent_id)store.setItem(key,JSON.stringify(draft));else store.removeItem(key);};
        const showError=message=>{if(destroyed)return;error.textContent=message;error.hidden=!message;};
        const updateControls=()=>{
            if(destroyed)return;const enabled=canPost&&!posting&&!(options.readOnly?.());
            composer.hidden=!canRead||(!canPost&&!draft.body.trim());source.disabled=!enabled;if(quill){quill.enable(enabled);quill.root.setAttribute('aria-readonly',String(!enabled));}
            send.disabled=!enabled||!draft.body.trim();send.textContent=posting?'Paylaşılıyor…':'Mesajı paylaş';
            find('[data-forum-clear]').disabled=posting;
            find('.forum-draft-status').textContent=draft.body.trim()?'Gönderilmemiş taslak bu sekmede korunuyor.':'';
            const parent=posts.find(post=>post.id===draft.parent_id);replyTarget.hidden=!draft.parent_id;
            replyTarget.innerHTML=draft.parent_id?`<span><b>${escape(parent?.author||'Seçilen mesaj')}</b> adlı kişiye yanıt yazıyorsunuz.</span> <button type="button" class="secondary" data-cancel-reply>Yanıtı iptal et</button>`:'';
            const cancel=find('[data-cancel-reply]');if(cancel)cancel.onclick=()=>{draft.parent_id=null;persist(true);updateControls();};
            feed.querySelectorAll('[data-reply-id]').forEach(button=>button.disabled=!enabled);
        };
        const ensureEditor=()=>{
            if(!quill&&editor?.mount&&canRead&&(canPost||draft.body.trim()))quill=editor.mount(source,{delta:draft.rich_text,onChange:delta=>{draft.rich_text=delta;},onError:e=>showError(e.message)});
        };
        const draw=()=>{
            if(destroyed)return;const top=feed.scrollTop,html=postHtml(posts,canPost&&!posting,editor,highlightUser);if(rendered!==html){rendered=html;feed.innerHTML=html;editor?.decorate?.(feed);feed.scrollTop=top;}
            feed.hidden=!canRead;find('.forum-count').textContent=canRead?`${posts.length}${hasMore?'+':''} mesaj`:'';find('[data-forum-more]').hidden=!hasMore||!canRead;
            ensureEditor();updateControls();
        };
        const merge=rows=>{const existing=new Map(posts.map(post=>[post.id,post]));for(const post of rows)existing.set(post.id,post);posts=[...existing.values()].sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));};
        const refresh=async()=>{
            if(destroyed||loading)return;loading=true;
            try{
                const data=await api('forum',undefined,{app_id:appId,phase,...(cursor?{after:cursor}:{})});if(destroyed)return;
                canRead=data.can_read;canPost=data.can_post;hasMore=data.has_more;find('.forum-permission').textContent=data.reason||'';
                if(!canRead){posts=[];cursor='';}else{merge(data.posts);cursor=data.next_after||cursor;}
                showError('');draw();options.onState?.(data);
            }catch(e){showError(e.message);}finally{loading=false;}
        };
        source.addEventListener('input',()=>{if(destroyed)return;draft.body=source.value;if(!editor?.has?.(source))draft.rich_text=null;persist(true);updateControls();});
        feed.addEventListener('click',event=>{const button=event.target.closest?.('[data-reply-id]');if(!button||!canPost||posting||options.readOnly?.())return;draft.parent_id=button.dataset.replyId;persist(true);updateControls();editor?.focus?.(source);composer.scrollIntoView?.({block:'nearest'});});
        find('[data-forum-refresh]').onclick=()=>refresh();find('[data-forum-more]').onclick=()=>refresh();
        find('[data-forum-clear]').onclick=async()=>{if(posting)return;if(draft.body.trim()&&options.confirm&&!(await options.confirm('Gönderilmemiş forum taslağı temizlensin mi?')))return;draft={body:'',rich_text:null,parent_id:null,key:root.crypto.randomUUID()};store.removeItem(key);source.value='';if(quill)editor.setText(source,'');updateControls();};
        send.onclick=async()=>{
            if(posting||!canPost||options.readOnly?.()||!draft.body.trim())return;
            if(Array.from(draft.body).length>8000){showError('Mesajınız en fazla 8.000 karakter olabilir.');return;}
            const payload={app_id:appId,phase,body:draft.body,rich_text:draft.rich_text,parent_id:draft.parent_id,key:draft.key};posting=true;persist();showError('');draw();
            try{
                const result=await api('forum_post',payload);
                // A late response must not remove a newer draft opened in the same tab.
                let saved;try{saved=JSON.parse(store.getItem(key)||'null');}catch{}
                if(saved?.key===payload.key)store.removeItem(key);
                if(destroyed)return;
                merge([result.post]);draft={body:'',rich_text:null,parent_id:null,key:root.crypto.randomUUID()};source.value='';if(quill)editor.setText(source,'');
                options.onPost?.(result.post);await refresh();
            }catch(e){showError(e.message+' Mesaj taslağınız korunuyor.');}
            finally{posting=false;if(!destroyed)draw();}
        };
        const ready=refresh();timer=root.setInterval(()=>{if(!root.document?.hidden)refresh();},options.pollMs||12000);
        return {ready,phase,refresh,hasDraft:()=>!!draft.body.trim()||posting,focus:()=>editor?.focus?.(source),destroy(){if(destroyed)return;persist();destroyed=true;root.clearInterval(timer);editor?.unmount?.(source);}};
    }
    const forum={mount,hasDraft,threadRows,postHtml};if(typeof module!=='undefined'&&module.exports)module.exports=forum;if(root)root.VakaForum=forum;
})(typeof globalThis!=='undefined'?globalThis:this);
