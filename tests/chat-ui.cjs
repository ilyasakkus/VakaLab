/* Chat markup, viewport and async-send contracts; no PHP or provider required. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const chat=require('../public/assets/chat.js');
let count=0;
function check(ok,label){assert.ok(ok,label);console.log(`PASS CHAT UI ${++count} ${label}`);}
const outgoing={messages:[],requests:[],pendingChat:{key:'pending-key',text:'Öğrenci sorusu <script>x</script>',afterSeq:0,status:'sending'}};
const waiting=chat.messages(outgoing,true);
check(waiting.indexOf('chat-outgoing')<waiting.indexOf('chat-waiting'),'student question appears above waiting indicator');
check(waiting.includes('Yanıt hazırlanıyor…')&&(waiting.match(/<span><\/span>/g)||[]).length===3,'waiting indicator has three dots and clear text');
check(waiting.includes('role="status"')&&!waiting.includes('class="message assistant"'),'loading is announced without pretending to be an assistant response');
check(!waiting.includes('<script>')&&waiting.includes('&lt;script&gt;'),'optimistic question is escaped');
check(!chat.messages(outgoing,false).includes('chat-waiting'),'loading disappears as soon as request stops waiting');
const canonical={...outgoing,messages:[{id:'u',seq:1,role:'user',content:outgoing.pendingChat.text,status:'completed'}]};
check(!chat.messages(canonical,true).includes('chat-outgoing'),'server-confirmed question replaces optimistic bubble without duplication');
const repeat={messages:[{id:'old',seq:1,role:'user',content:'Aynı soru',status:'completed'}],requests:[],pendingChat:{key:'new',text:'Aynı soru',afterSeq:1,status:'sending'}};
check(chat.messages(repeat,true).includes('chat-outgoing'),'a deliberately repeated question is still shown as a new message');
repeat.requests=[{client_key:'new'}];check(!chat.messages(repeat,true).includes('chat-outgoing'),'known idempotent request does not duplicate its question');
outgoing.pendingChat.status='uncertain';check(chat.messages(outgoing,false).includes('Gönderim doğrulanamadı'),'uncertain network result remains distinct from accepted message');
check(chat.messages({messages:[]},false).includes('Henüz mesaj yok'),'empty chat has a readable state');
check(chat.messages({messages:[{id:'a',seq:1,role:'assistant',status:'completed',content:'<img src=x onerror=alert(1)>'}]},false).includes('&lt;img'),'assistant HTML is also escaped');
check(chat.failures([{id:'failed',status:'failed'}],true).includes('disabled'),'retry controls stay disabled while another answer is pending');

class Scroller {
    constructor(html='old',height=2000){this._html=html;this.scrollHeight=height;this.clientHeight=400;this._top=0;this.listeners=new Map();this.replacements=0;}
    get innerHTML(){return this._html;}
    set innerHTML(value){this._html=value;this.scrollHeight=2000+value.length;this._top=0;this.replacements++;}
    get scrollTop(){return this._top;}
    set scrollTop(value){this._top=Math.max(0,Math.min(value,this.scrollHeight-this.clientHeight));}
    addEventListener(type,fn){this.listeners.set(type,fn);}
    removeEventListener(type){this.listeners.delete(type);}
    scrollTo(top){this.scrollTop=top;this.listeners.get('scroll')?.();}
}
const pane=new Scroller(),latest={hidden:true},observed=[];
let controller=chat.mount(pane,latest,'viewport-case',()=>observed.push('scroll'));
check(chat.nearBottom(pane)&&pane.scrollTop===1600,'opening chat shows its latest messages');
pane.listeners.get('scroll')();check(observed.length===0,'automatic follow scrolling is not recorded as student interaction');
controller.update('Long response '.repeat(2000));check(pane.scrollTop===pane.scrollHeight-pane.clientHeight,'long response scrolls to bottom while following');
pane.scrollTo(250);controller.update('Another response '.repeat(3000));
check(pane.scrollTop===250&&!latest.hidden,'new response preserves history-reading position and offers latest button');
const writes=pane.replacements;controller.update(pane.innerHTML);check(pane.replacements===writes&&pane.scrollTop===250,'unchanged polls never replace messages or reset scrolling');
latest.onclick();check(chat.nearBottom(pane)&&latest.hidden,'latest button returns to newest response and resumes following');
pane.scrollTop=300;controller.update('response before scroll event '.repeat(1000));check(pane.scrollTop===300,'history position is preserved even before its scroll event arrives');
controller.update('new outgoing',{forceBottom:true});check(chat.nearBottom(pane),'sending a question deliberately reveals latest outgoing message');
pane.scrollTo(275);controller.destroy();const restoredPane=new Scroller('new outgoing',pane.scrollHeight),restoredButton={hidden:true};
controller=chat.mount(restoredPane,restoredButton,'viewport-case');check(restoredPane.scrollTop===275&&!restoredButton.hidden,'returning to chat preserves deliberate history position');
const otherPane=new Scroller();const other=chat.mount(otherPane,{hidden:true},'another-viewport-case');check(chat.nearBottom(otherPane),'different case gets its own independent scroll position');other.destroy();
controller.destroy();const beforeDestroy=restoredPane.scrollTop;controller.update('stale update',{forceBottom:true});check(restoredPane.scrollTop===beforeDestroy&&!restoredPane.listeners.has('scroll'),'destroyed chat cannot scroll a later screen');
check(observed.length===2,'manual scroll remains connected to research telemetry');

function harness(){
    const nodes=new Map(),storage=new Map(),calls=[],records=[];let uuid=0;
    nodes.set('#chat',new Scroller('',500));nodes.set('#chat-latest',{hidden:true});nodes.set('#send',{disabled:false});nodes.set('#ai-status',{textContent:''});nodes.set('#question',{value:''});nodes.set('#notice',{textContent:''});nodes.set('#chat-failures',{innerHTML:''});
    const context=vm.createContext({
        console,URLSearchParams,TextEncoder,structuredClone,Event,
        crypto:{randomUUID:()=> 'request-key-'+(++uuid)},
        sessionStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
        document:{querySelector:key=>nodes.get(key)||null,querySelectorAll:()=>[],addEventListener(){}},
        window:{addEventListener(){}},location:{search:''},navigator:{onLine:true},
        setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){}
    });
    vm.runInContext(fs.readFileSync(require.resolve('../public/assets/chat.js'),'utf8'),context);
    vm.runInContext(fs.readFileSync(require.resolve('../public/assets/app.js'),'utf8').replace(/init\(\)\.catch\(e=>notify\(e\.message\)\);\s*$/,''),context);
    context.record=(...args)=>records.push(args);context.transport=async()=>{throw new Error('Unconfigured fixture');};
    vm.runInContext("me={id:'student'};section='ai';work={application:{id:'app',active_request:null},version:{id:'v'},draft:{question:'  Yeni soru\\n'},messages:[],requests:[]};locked=()=>false;updateSubmitGate=()=>{};event=(...args)=>record('event',...args);save=async()=>{dirty=false;record('save');};scheduleSave=()=>record('autosave');renderWork=()=>{record('render');syncChat();};confirmStudent=async()=>true;api=(...args)=>transport(...args);",context);
    return {context,nodes,storage,calls,records,run:code=>vm.runInContext(code,context)};
}
const tick=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};
(async()=>{
    const h=harness();let finishSave,finishChat,sentKey;
    h.context.waitForSave=()=>new Promise(resolve=>finishSave=resolve);h.run('save=waitForSave');
    h.context.transport=(op,payload)=>{
        h.calls.push({op,payload});
        if(op==='chat'){sentKey=payload.key;return new Promise(resolve=>finishChat=resolve);}
        if(op==='view')return Promise.resolve({application:{active_request:null},messages:[],requests:[]});
    };
    const sending=h.run('sendChat()');
    check(h.nodes.get('#chat').innerHTML.includes('Yeni soru')&&h.nodes.get('#chat').innerHTML.includes('chat-waiting'),'click shows question and loading before autosave finishes');
    check(h.run('busy')&&h.nodes.get('#send').disabled,'another send is blocked immediately');
    await h.run('sendChat()');check(h.calls.length===0,'double click does not create another request while saving');
    await h.run('refreshChat()');check(h.run('busy')&&h.nodes.get('#chat').innerHTML.includes('chat-waiting'),'early heartbeat cannot hide loading before POST is reserved');
    finishSave();await tick();check(h.calls.filter(call=>call.op==='chat').length===1,'one request is sent after draft is safe');
    h.nodes.get('#question').value='Yeni, gönderilmemiş taslak';h.run("work.draft.question='Yeni, gönderilmemiş taslak'");
    h.context.transport=async()=>({application:{active_request:null},messages:[{id:'u',seq:1,role:'user',content:'Yeni soru',status:'completed'},{id:'a',seq:2,role:'assistant',content:'Uzun AI yanıtı '.repeat(600),status:'completed'}],requests:[{id:'r',client_key:sentKey,status:'completed'}]});
    finishChat({id:'r',status:'completed'});await sending;
    check(!h.run('busy')&&!h.nodes.get('#chat').innerHTML.includes('chat-waiting'),'complete response removes loading');
    check(!h.nodes.get('#chat').innerHTML.includes('chat-outgoing')&&h.run('work.messages.length')===2,'confirmed response replaces optimistic state without duplicate message');
    check(h.nodes.get('#question').value==='Yeni, gönderilmemiş taslak'&&!h.records.some(row=>row[0]==='render'),'response preserves newly typed draft and avoids rebuilding its editor');
    check(chat.nearBottom(h.nodes.get('#chat')),'new AI answer remains visible at bottom');
    check(!h.storage.has(h.run("recoveryKey()+':request'")),'successful request clears retry key only after reconciliation');

    const failed=harness();failed.context.transport=async()=>{throw new Error('network failed');};await failed.run('sendChat()');
    check(!failed.run('busy')&&!failed.nodes.get('#chat').innerHTML.includes('chat-waiting'),'network failure removes spinner and unlocks send');
    check(failed.run('work.draft.question')==='  Yeni soru\n'&&failed.nodes.get('#chat').innerHTML.includes('Gönderim doğrulanamadı'),'network failure preserves draft and marks local question honestly');
    check(failed.storage.has(failed.run("recoveryKey()+':request'")),'network failure retains idempotency key for safe retry');

    const unsaved=harness();unsaved.run("save=async()=>{throw new Error('save failed');}");await unsaved.run('sendChat()');
    check(!unsaved.nodes.get('#chat').innerHTML.includes('chat-waiting')&&unsaved.nodes.get('#chat').innerHTML.includes('Gönderilemedi'),'autosave failure leaves no false pending response');
    check(!unsaved.storage.has(unsaved.run("recoveryKey()+':request'")),'autosave failure never reserves an AI request key');

    const recovered=harness();recovered.context.transport=async op=>{if(op==='chat')return {id:'recovered',status:'completed'};throw new Error('view failed');};await recovered.run('sendChat()');
    check(recovered.storage.has(recovered.run("recoveryKey()+':request'")),'lost follow-up read also retains idempotency key');

    const providerFailure=harness();let finishFailure,failureKey;
    providerFailure.context.transport=(op,payload)=>{if(op==='chat'){failureKey=payload.key;return new Promise(resolve=>finishFailure=resolve);}return Promise.resolve({application:{active_request:null},messages:[{id:'u',seq:1,role:'user',content:'Yeni soru',status:'completed'}],requests:[{id:'provider-failed',client_key:failureKey,status:'failed'}]});};
    const failing=providerFailure.run('sendChat()');await tick();providerFailure.run("work.draft.question='Bir sonraki taslağım'");finishFailure({id:'provider-failed',status:'failed'});await failing;
    check(providerFailure.nodes.get('#chat-failures').innerHTML.includes('data-retry-request="provider-failed"')&&!providerFailure.records.some(row=>row[0]==='render'),'provider failure reveals retry without rebuilding newly edited draft');

    const stale=harness();let reply;
    stale.context.transport=()=>new Promise(resolve=>reply=resolve);const oldSend=stale.run('sendChat()');await tick();
    stale.run("work={application:{id:'another-app',active_request:'new-request'},messages:[],draft:{question:'Diğer vaka taslağı'}};busy=true");
    reply({id:'old-request',status:'completed'});await oldSend;
    check(stale.run("work.application.id==='another-app'&&busy&&work.messages.length===0"),'late old-case reply cannot stop current-case loading or insert its messages');

    const retry=harness();retry.run("work.messages=[{id:'u',seq:1,role:'user',content:'Önceki soru',status:'completed'}];work.requests=[{id:'failed-request',client_key:'original-key',status:'failed'}]");let finishRetry;
    retry.context.transport=(op,payload)=>{retry.calls.push({op,payload});if(op==='chat')return new Promise(resolve=>finishRetry=resolve);return Promise.resolve({application:{active_request:null},messages:[{id:'u',seq:1,role:'user',content:'Önceki soru',status:'completed'},{id:'a',seq:2,role:'assistant',content:'Tekrar yanıtı',status:'completed'}],requests:[{id:'failed-request',client_key:'original-key',status:'completed'}]});};
    const retrying=retry.run("retryChat('failed-request')");await tick();
    check(retry.nodes.get('#chat').innerHTML.includes('chat-waiting')&&!retry.nodes.get('#chat').innerHTML.includes('chat-outgoing'),'retry displays loading without inventing another student message');
    finishRetry({id:'failed-request',status:'completed'});await retrying;
    check(!retry.run('busy')&&retry.nodes.get('#chat').innerHTML.includes('Tekrar yanıtı')&&!retry.nodes.get('#chat').innerHTML.includes('chat-waiting'),'retry completion shows answer and clears loading');
    console.log(`TOTAL CHAT UI ${count} checks passed; unit and DOM/API doubles only.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
