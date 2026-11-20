'use strict';
// Quill 2.0.3 adapter. Plain answers remain the source for scoring and AI;
// a validated Delta preserves visual formatting alongside each answer.
(function(root){
    const fields=['problem','decision','reason','final_decision','final_reason','reflection','question'];
    const formats=['bold','italic','underline','strike','header','size','font','color','background','list','indent','align','blockquote','link'];
    const controllers=new WeakMap(),mounted=new Set();
    const escape=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    function validAttribute(key,value){
        if(['bold','italic','underline','strike','blockquote'].includes(key))return value===true;
        if(key==='header')return Number.isInteger(value)&&value>=1&&value<=3;
        if(key==='indent')return Number.isInteger(value)&&value>=1&&value<=8;
        if(key==='size')return ['small','large','huge'].includes(value);
        if(key==='font')return ['serif','monospace'].includes(value);
        if(key==='list')return ['ordered','bullet','checked','unchecked'].includes(value);
        if(key==='align')return ['center','right','justify'].includes(value);
        if(key==='color'||key==='background')return typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
        if(key==='link')return typeof value==='string'&&value.length<=2000&&/^(?:https?:\/\/|mailto:)[^\s<>"\x00-\x1f]+$/i.test(value);
        return false;
    }
    function plainText(delta){return delta.ops.map(op=>op.insert).join('').slice(0,-1);}
    function fromText(text){return {ops:[{insert:String(text)+'\n'}]};}
    function normalize(delta,expected){
        if(!delta||!Array.isArray(delta.ops)||!delta.ops.length||delta.ops.length>2000)throw new Error('Editör içeriği geçersiz veya çok uzun.');
        const ops=delta.ops.map(op=>{
            if(!op||typeof op.insert!=='string'||!op.insert||Object.keys(op).some(key=>!['insert','attributes'].includes(key)))throw new Error('Editörde yalnız metin kullanılabilir.');
            const out={insert:op.insert},attributes={};
            if(op.attributes&&Object.keys(op.attributes).some(key=>!formats.includes(key)))throw new Error('Editör biçimi geçersiz.');
            for(const key of formats){if(!Object.hasOwn(op.attributes||{},key))continue;const value=op.attributes[key];if(!validAttribute(key,value))throw new Error('Editör biçim değeri geçersiz.');attributes[key]=value;}
            if(Object.keys(attributes).length)out.attributes=attributes;return out;
        });
        const doc={ops},text=ops.map(op=>op.insert).join('');
        if(!text.endsWith('\n')||(expected!==undefined&&text.slice(0,-1)!==expected))throw new Error('Editör metni ile yanıt uyuşmuyor.');
        if(new TextEncoder().encode(text).length>60001)throw new Error('Metin sınırı aşıldı.');
        return doc;
    }
    function render(delta){
        let doc;try{doc=normalize(delta);}catch{return '';}
        const lines=[];let fragments=[];
        for(const op of doc.ops){const attrs=op.attributes||{},parts=op.insert.split('\n');
            for(let i=0;i<parts.length;i++){
                if(parts[i]){let html=escape(parts[i]);if(attrs.bold)html='<strong>'+html+'</strong>';if(attrs.italic)html='<em>'+html+'</em>';if(attrs.underline)html='<u>'+html+'</u>';if(attrs.strike)html='<s>'+html+'</s>';if(attrs.link)html='<a href="'+escape(attrs.link)+'" target="_blank" rel="noopener noreferrer">'+html+'</a>';fragments.push(html);}
                if(i<parts.length-1){lines.push({html:fragments.join('')||'<br>',attrs});fragments=[];}
            }
        }
        const out=[];let list='';const close=()=>{if(list){out.push('</'+list+'>');list='';}};
        for(const line of lines){if(line.attrs.list){const tag=line.attrs.list==='ordered'?'ol':'ul';if(list!==tag){close();list=tag;out.push('<'+tag+'>');}out.push('<li>'+line.html+'</li>');}else{close();const tag=line.attrs.header?'h'+Math.min(6,line.attrs.header+2):line.attrs.blockquote?'blockquote':'p';out.push('<'+tag+'>'+line.html+'</'+tag+'>');}}
        close();return out.join('');
    }
    function toolbar(doc){
        const bar=doc.createElement('div');bar.className='rich-toolbar';bar.setAttribute('role','group');bar.setAttribute('aria-label','Metin biçimlendirme araçları');
        const group=()=>{const span=doc.createElement('span');span.className='ql-formats';bar.append(span);return span;};
        const button=(parent,name,label,value)=>{const el=doc.createElement('button');el.type='button';el.className='ql-'+name;if(value!==undefined)el.value=value;el.title=label;el.setAttribute('aria-label',label);parent.append(el);return el;};
        const select=(parent,name,label,options)=>{const el=doc.createElement('select');el.className='ql-'+name;el.title=label;el.setAttribute('aria-label',label);for(const [value,text] of options){const option=doc.createElement('option');option.value=value;option.textContent=text;if(value==='')option.setAttribute('selected','selected');el.append(option);}parent.append(el);return el;};
        let part=group();button(part,'undo','Geri al');button(part,'redo','Yinele');
        part=group();select(part,'font','Yazı tipi',[['','Varsayılan'],['serif','Serif'],['monospace','Eş aralıklı']]);select(part,'header','Paragraf biçimi',[['','Normal metin'],['1','Başlık 1'],['2','Başlık 2'],['3','Başlık 3']]);select(part,'size','Yazı boyutu',[['small','Küçük'],['','Normal'],['large','Büyük'],['huge','Çok büyük']]);
        part=group();for(const [key,label] of [['bold','Kalın'],['italic','İtalik'],['underline','Altı çizili'],['strike','Üstü çizili']])button(part,key,label);
        part=group();select(part,'color','Yazı rengi',[]);select(part,'background','Vurgu rengi',[]);
        part=group();button(part,'list','Numaralı liste','ordered');button(part,'list','Madde işaretli liste','bullet');button(part,'indent','Girintiyi azalt','-1');button(part,'indent','Girintiyi artır','+1');
        part=group();select(part,'align','Metni hizala',[['','Sola hizala'],['center','Ortala'],['right','Sağa hizala'],['justify','İki yana yasla']]);button(part,'blockquote','Alıntı');button(part,'link','Bağlantı ekle');button(part,'clean','Biçimlendirmeyi temizle');
        return bar;
    }
    function mount(textarea,options={}){
        if(controllers.has(textarea))return controllers.get(textarea).quill;
        if(typeof root.Quill!=='function')return null;
        const doc=textarea.ownerDocument,wrapper=doc.createElement('div'),host=doc.createElement('div'),footer=doc.createElement('div'),label=doc.querySelector('label[for="'+textarea.id+'"]');
        wrapper.className='student-rich-editor';wrapper.dataset.editorFor=textarea.id;host.id=textarea.id+'-editor';footer.className='rich-editor-footer';
        textarea.before(wrapper);wrapper.append(textarea);const bar=textarea.disabled?null:toolbar(doc);if(bar)wrapper.append(bar);wrapper.append(host,footer);
        const icons=root.Quill.import('ui/icons');icons.undo='<svg viewBox="0 0 18 18"><path class="ql-stroke" d="M5 5H2V2M2 5a7 7 0 1 1 0 8"/></svg>';icons.redo='<svg viewBox="0 0 18 18"><path class="ql-stroke" d="M13 5h3V2m0 3a7 7 0 1 0 0 8"/></svg>';
        const quill=new root.Quill(host,{theme:'snow',readOnly:textarea.disabled,formats,placeholder:textarea.disabled?'':'Yanıtınızı buraya yazın…',modules:{toolbar:bar?{container:bar,handlers:{undo(){this.quill.history.undo();},redo(){this.quill.history.redo();}}}:false,history:{delay:800,maxStack:100,userOnly:true}}});
        let initial=fromText(textarea.value);if(options.delta){try{initial=normalize(options.delta,textarea.value);}catch{}}
        quill.setContents(initial,'silent');quill.history.clear();
        if(label){label.id=label.id||textarea.id+'-label';quill.root.setAttribute('aria-labelledby',label.id);}
        quill.root.setAttribute('role','textbox');quill.root.setAttribute('aria-multiline','true');quill.root.setAttribute('aria-readonly',String(textarea.disabled));quill.root.dataset.source=textarea.id;quill.root.dataset.editorField=textarea.id;
        if(textarea.disabled)quill.root.tabIndex=0;
        textarea.hidden=true;textarea.classList.add('rich-text-source');textarea.setAttribute('aria-hidden','true');
        const counter=()=>{footer.textContent=Array.from(quill.getText().slice(0,-1)).length.toLocaleString('tr-TR')+' karakter'+(textarea.disabled?' · Salt okunur':'');};
        const change=(_delta,_old,source)=>{
            if(source!=='user'||textarea.disabled)return;
            const text=quill.getText().slice(0,-1);let delta;
            try{
                const raw=quill.getContents();for(const op of raw.ops)if(op.attributes?.link&&!validAttribute('link',op.attributes.link))delete op.attributes.link;
                delta=normalize(raw,text);
            }catch(error){options.onError?.(error);delta=null;}
            textarea.value=text;options.onChange?.(delta);textarea.dispatchEvent(new Event('input',{bubbles:true}));counter();
        };
        const focus=()=>textarea.onfocus?.();
        const focusLabel=event=>{event.preventDefault();if(!textarea.disabled)quill.focus({preventScroll:true});};label?.addEventListener('click',focusLabel);
        const blur=event=>{if(!wrapper.contains(event.relatedTarget))textarea.onblur?.();};
        quill.on('text-change',change);quill.root.addEventListener('focus',focus);wrapper.addEventListener('focusout',blur);
        // Preserve compatibility with plain-text fallbacks and test/import tools.
        const sync=()=>{if(quill.getText().slice(0,-1)!==textarea.value){quill.setText(textarea.value,'silent');quill.history.clear();counter();}};
        textarea.addEventListener('input',sync);
        if(bar){
            bar.querySelectorAll('.ql-picker').forEach(picker=>{const select=picker.nextElementSibling,caption=select?.getAttribute('aria-label');if(caption){const control=picker.querySelector('.ql-picker-label');control?.setAttribute('aria-label',caption);control?.setAttribute('title',caption);}});
        }
        counter();const controller={quill,wrapper,focus(){if(!textarea.disabled)quill.focus({preventScroll:true});},destroy(){quill.off('text-change',change);label?.removeEventListener('click',focusLabel);quill.root.removeEventListener('focus',focus);wrapper.removeEventListener('focusout',blur);textarea.removeEventListener('input',sync);controllers.delete(textarea);mounted.delete(controller);}};
        controllers.set(textarea,controller);mounted.add(controller);return quill;
    }
    const editor={fields,formats,normalize,plainText,fromText,render,mount,
        has:textarea=>controllers.has(textarea),get:textarea=>controllers.get(textarea)?.quill,
        element:textarea=>controllers.get(textarea)?.quill.root,
        focus:textarea=>controllers.get(textarea)?.focus(),
        validation(textarea,invalid,id){const current=controllers.get(textarea);if(!current)return;current.wrapper.classList.toggle('field-invalid',invalid);current.quill.root.setAttribute('aria-invalid',String(invalid));if(invalid)current.quill.root.setAttribute('aria-describedby',id);else current.quill.root.removeAttribute('aria-describedby');},
        destroyAll(){for(const controller of [...mounted])controller.destroy();}
    };
    if(typeof module!=='undefined'&&module.exports)module.exports=editor;if(root)root.VakaEditor=editor;
})(typeof globalThis!=='undefined'?globalThis:this);
