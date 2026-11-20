'use strict';
// VakaLab's dependency-free Markdown editor. No service, license key or CDN.
(function(root){
    const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const modes=new Map();
    const controllers=new WeakMap();
    const prefixes={heading:/^\s{0,3}#{1,6}\s+/,bullet:/^\s*[-*+]\s+/,number:/^\s*\d+[.)]\s+/,quote:/^\s{0,3}>\s+/};
    const anyPrefix=/^\s{0,3}(?:#{1,6}\s+|[-*+]\s+|\d+[.)]\s+|>\s+)/;
    function format(value,start,end,command){
        start=Math.max(0,Math.min(start,value.length));end=Math.max(start,Math.min(end,value.length));
        const unchanged=()=>({value,start,end});
        if(!value.trim())return unchanged();
        if(command==='bold'||command==='italic'){
            if(start===end){while(start>0&&!/\s/.test(value[start-1]))start--;while(end<value.length&&!/\s/.test(value[end]))end++;}
            if(start===end)return unchanged();
            const mark=command==='bold'?'**':'*',length=mark.length,text=value.slice(start,end);
            if(start>=length&&value.slice(start-length,start)===mark&&value.slice(end,end+length)===mark)return {value:value.slice(0,start-length)+text+value.slice(end+length),start:start-length,end:end-length};
            if(text.startsWith(mark)&&text.endsWith(mark)&&text.length>length*2)return {value:value.slice(0,start)+text.slice(length,-length)+value.slice(end),start,end:end-length*2};
            return {value:value.slice(0,start)+mark+text+mark+value.slice(end),start:start+length,end:end+length};
        }
        if(!prefixes[command]&&command!=='clear')return unchanged();
        const from=start===0?0:value.lastIndexOf('\n',start-1)+1;
        const last=end>start&&value[end-1]==='\n'?end-1:end;
        const found=value.indexOf('\n',last),to=found<0?value.length:found;
        const lines=value.slice(from,to).split('\n'),remove=prefixes[command]&&lines.filter(line=>line.trim()).every(line=>prefixes[command].test(line));
        let number=0;
        const replacement=lines.map(line=>{
            if(!line.trim())return line;
            if(command==='clear')return line.replace(anyPrefix,'').replace(/\*\*([^*]+)\*\*/g,'$1').replace(/\*([^*]+)\*/g,'$1');
            if(remove)return line.replace(prefixes[command],'');
            const text=line.replace(anyPrefix,'');number++;
            return ({heading:'## ',bullet:'- ',number:number+'. ',quote:'> '}[command])+text;
        }).join('\n');
        return {value:value.slice(0,from)+replacement+value.slice(to),start:from,end:from+replacement.length};
    }
    function inline(text){return escape(text).replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>').replace(/\*([^*\n]+)\*/g,'<em>$1</em>');}
    function render(value){
        const lines=String(value).replace(/\r\n?/g,'\n').split('\n'),out=[];let list='',paragraph=[];
        const closeParagraph=()=>{if(paragraph.length){out.push('<p>'+paragraph.map(inline).join('<br>')+'</p>');paragraph=[];}};
        const closeList=()=>{if(list){out.push('</'+list+'>');list='';}};
        for(const line of lines){
            if(!line.trim()){closeParagraph();closeList();continue;}
            const heading=line.match(/^\s{0,3}(#{1,6})\s+(.+)$/),quote=line.match(/^\s{0,3}>\s+(.+)$/),bullet=line.match(/^\s*[-*+]\s+(.+)$/),number=line.match(/^\s*\d+[.)]\s+(.+)$/);
            if(heading||quote){closeParagraph();closeList();if(heading){const level=heading[1].length===1?3:4;out.push('<h'+level+'>'+inline(heading[2])+'</h'+level+'>');}else out.push('<blockquote>'+inline(quote[1])+'</blockquote>');}
            else if(bullet||number){closeParagraph();const tag=bullet?'ul':'ol';if(list!==tag){closeList();out.push('<'+tag+'>');list=tag;}out.push('<li>'+inline((bullet||number)[1])+'</li>');}
            else{closeList();paragraph.push(line);}
        }
        closeParagraph();closeList();return out.join('')||'<p class="muted">Henüz metin yazılmadı.</p>';
    }
    function history(initial){
        let past=[],future=[],value=initial;
        return {
            record(next){if(next===value)return;past.push(value);if(past.length>50)past.shift();value=next;future=[];},
            undo(){if(!past.length)return value;future.push(value);value=past.pop();return value;},
            redo(){if(!future.length)return value;past.push(value);value=future.pop();return value;},
            get canUndo(){return past.length>0;},get canRedo(){return future.length>0;}
        };
    }
    function mount(textarea){
        if(textarea.closest('.student-editor'))return;
        const doc=textarea.ownerDocument,wrapper=doc.createElement('div'),toolbar=doc.createElement('div'),preview=doc.createElement('div'),footer=doc.createElement('div');
        wrapper.className='student-editor';wrapper.dataset.editorFor=textarea.id;
        toolbar.className='student-editor-toolbar';toolbar.setAttribute('role','group');toolbar.setAttribute('aria-label','Metin düzenleme araçları');
        const tools=[['bold','Kalın (Ctrl/Cmd+B)','K'],['italic','İtalik (Ctrl/Cmd+I)','İ'],['heading','Başlık','Başlık'],['bullet','Madde işaretli liste','• Liste'],['number','Numaralı liste','1. Liste'],['quote','Alıntı','❝'],['clear','Biçimlendirmeyi temizle','Temizle'],['undo','Geri al (Ctrl/Cmd+Z)','↶'],['redo','Yinele (Ctrl/Cmd+Shift+Z)','↷']];
        for(const [command,label,text] of tools){const button=doc.createElement('button');button.type='button';button.dataset.editorCommand=command;button.title=label;button.setAttribute('aria-label',label);button.textContent=text;toolbar.append(button);}
        const toggle=doc.createElement('button');toggle.type='button';toggle.className='student-editor-toggle';toggle.setAttribute('aria-controls',textarea.id+'-preview');toolbar.append(toggle);
        preview.id=textarea.id+'-preview';preview.className='student-editor-preview prose';preview.tabIndex=0;
        preview.dataset.source=textarea.id;
        preview.setAttribute('role','region');preview.setAttribute('aria-label',(doc.querySelector('label[for="'+textarea.id+'"]')?.textContent||'Yanıt')+' · Önizleme');
        footer.className='student-editor-footer';const hint=doc.createElement('span'),counter=doc.createElement('span');hint.textContent='Metin seçerek biçimlendirin. Önizleme ile görünümünü kontrol edin.';counter.setAttribute('aria-label','Karakter sayısı');footer.append(hint,counter);
        textarea.before(wrapper);wrapper.append(toolbar,textarea,preview,footer);
        const changes=history(textarea.value),readonly=textarea.disabled;let previewing=readonly||(modes.get(textarea.id)??false);
        const update=()=>{
            preview.innerHTML=render(textarea.value);counter.textContent=Array.from(textarea.value).length.toLocaleString('tr-TR')+' karakter';
            textarea.hidden=previewing;preview.hidden=!previewing;toggle.textContent=previewing?'Düzenle':'Önizleme';toggle.setAttribute('aria-pressed',String(previewing));toggle.disabled=readonly;
            toolbar.querySelectorAll('[data-editor-command]').forEach(button=>{button.disabled=readonly||previewing||(button.dataset.editorCommand==='undo'&&!changes.canUndo)||(button.dataset.editorCommand==='redo'&&!changes.canRedo);});
        };
        const replace=(value,start,end,record=true)=>{
            if(value===textarea.value)return;
            if(record)changes.record(value);textarea.value=value;textarea.focus({preventScroll:true});textarea.setSelectionRange(start,end);
            textarea.dispatchEvent(new Event('input',{bubbles:true}));update();
        };
        const apply=command=>{
            if(readonly||previewing)return;
            if(command==='undo'||command==='redo'){const value=changes[command]();replace(value,value.length,value.length,false);return;}
            const result=format(textarea.value,textarea.selectionStart,textarea.selectionEnd,command);replace(result.value,result.start,result.end);
        };
        toolbar.querySelectorAll('[data-editor-command]').forEach(button=>{button.onpointerdown=e=>e.preventDefault();});
        toggle.onclick=()=>{previewing=!previewing;modes.set(textarea.id,previewing);update();if(previewing)preview.focus();else textarea.focus();};
        let applyingHistory=false;
        // Record ordinary input; programmatic formatting already records its
        // value, while undo/redo dispatches input to the same autosave handler.
        textarea.addEventListener('input',()=>{if(!applyingHistory)changes.record(textarea.value);update();});
        const applyWithHistory=command=>{applyingHistory=command==='undo'||command==='redo';try{apply(command);}finally{applyingHistory=false;}};
        toolbar.querySelectorAll('[data-editor-command]').forEach(button=>button.onclick=()=>applyWithHistory(button.dataset.editorCommand));
        textarea.addEventListener('keydown',e=>{if(!(e.ctrlKey||e.metaKey)||e.altKey||readonly)return;const key=e.key.toLowerCase(),command=key==='b'?'bold':key==='i'?'italic':key==='z'?(e.shiftKey?'redo':'undo'):key==='y'?'redo':null;if(command){e.preventDefault();applyWithHistory(command);}});
        controllers.set(textarea,{focus(){if(readonly)return;previewing=false;modes.set(textarea.id,false);update();textarea.focus({preventScroll:true});}});
        update();
    }
    const editor={format,render,history,mount,focus:textarea=>controllers.get(textarea)?.focus()};
    if(typeof module!=='undefined'&&module.exports)module.exports=editor;
    if(root)root.VakaEditor=editor;
})(typeof globalThis!=='undefined'?globalThis:this);
