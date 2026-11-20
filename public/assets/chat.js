'use strict';
(function(root){
    const escape=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const positions=new Map();
    function messages(work,waiting){
        const rows=work.messages||[],pending=work.pendingChat;
        let html=rows.map(message=>`<div class="message ${message.role==='user'?'user':'assistant'}" data-source="message:${escape(message.id)}"><strong>${message.role==='user'?'Siz':'AI'} · ${escape(message.status)} · #${escape(message.seq)}</strong>${escape(message.content)}</div>`).join('');
        if(pending){
            const knownRequest=(work.requests||[]).some(request=>request.client_key===pending.key);
            const confirmed=rows.some(message=>message.role==='user'&&message.content===pending.text&&(knownRequest||Number(message.seq)>pending.afterSeq));
            if(!confirmed){
                const label=pending.status==='uncertain'?'Gönderim doğrulanamadı':pending.status==='failed'?'Gönderilemedi':'Gönderiliyor…';
                html+=`<div class="message user chat-outgoing" data-pending-message="${escape(pending.key)}"><strong>Siz · ${label}</strong>${escape(pending.text)}</div>`;
            }
        }
        if(waiting)html+='<div class="message chat-waiting" role="status" aria-live="polite"><span class="chat-loading-dots" aria-hidden="true"><span></span><span></span><span></span></span><span class="chat-loading-label">Yanıt hazırlanıyor…</span></div>';
        return html||'<p class="empty">Henüz mesaj yok.</p>';
    }
    function nearBottom(scroller){return scroller.scrollHeight-scroller.clientHeight-scroller.scrollTop<=64;}
    function failures(requests,disabled){return (requests||[]).filter(request=>request.status==='failed').map(request=>`<p class="warning">Yanıt alınamadı. Mesajınız korunuyor. <button class="secondary" data-retry-request="${escape(request.id)}" ${disabled?'disabled':''}>Aynı mesajı yeniden dene</button></p>`).join('');}
    function mount(scroller,latestButton,key,onScroll=()=>{}){
        const state=positions.get(key)||{following:true,top:0};positions.set(key,state);
        if(positions.size>100)positions.delete(positions.keys().next().value);
        let destroyed=false,lastHtml=scroller.innerHTML,observer,automaticTop=null;
        const updateButton=()=>{if(latestButton)latestButton.hidden=state.following||scroller.scrollHeight<=scroller.clientHeight;};
        const restore=()=>{if(destroyed)return;scroller.scrollTop=state.following?scroller.scrollHeight:state.top;state.top=scroller.scrollTop;automaticTop=scroller.scrollTop;updateButton();};
        const scroll=()=>{if(automaticTop!==null&&Math.abs(scroller.scrollTop-automaticTop)<1)return;automaticTop=null;state.following=nearBottom(scroller);state.top=scroller.scrollTop;updateButton();onScroll();};
        const jump=()=>{state.following=true;restore();};
        scroller.addEventListener('scroll',scroll,{passive:true});
        if(latestButton)latestButton.onclick=jump;
        restore();
        if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(restore);observer.observe(scroller);}
        return {
            scroller,
            update(html,{forceBottom=false}={}){
                if(destroyed)return;
                if(html!==lastHtml){
                    // Capture the actual viewport before replacing messages,
                    // including a scroll whose event has not fired yet.
                    state.following=nearBottom(scroller);state.top=scroller.scrollTop;
                    scroller.innerHTML=html;lastHtml=html;
                }
                if(forceBottom)state.following=true;
                restore();
            },
            destroy(){if(destroyed)return;state.following=nearBottom(scroller);state.top=scroller.scrollTop;destroyed=true;scroller.removeEventListener('scroll',scroll);observer?.disconnect();if(latestButton)latestButton.onclick=null;}
        };
    }
    const chat={messages,failures,nearBottom,mount};
    if(typeof module!=='undefined'&&module.exports)module.exports=chat;
    if(root)root.VakaChat=chat;
})(typeof globalThis!=='undefined'?globalThis:this);
