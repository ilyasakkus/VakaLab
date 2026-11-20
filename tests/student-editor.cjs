const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {format,render,history,mount,focus}=require('../public/assets/editor.js');
let checks=0;
function check(ok,label){assert.ok(ok,label);console.log(`PASS EDITOR ${++checks} ${label}`);}

const bold=format('İlk karar',0,3,'bold');
check(bold.value==='**İlk** karar'&&bold.start===2&&bold.end===5,'bold preserves Turkish text and selection');
check(format(bold.value,bold.start,bold.end,'bold').value==='İlk karar','bold toggles off');
check(format('İlk karar',4,9,'italic').value==='İlk *karar*','italic wraps only selected answer');
check(format('ilk karar',5,5,'bold').value==='ilk **karar**','collapsed cursor formats its word');
check(format('',0,0,'bold').value==='','empty answer never gains fabricated placeholder text');
check(format('   ',0,0,'bullet').value==='   ','empty list action keeps answer empty');
const numbered=format('Birinci\nİkinci\nÜçüncü',0,14,'number');
check(numbered.value==='1. Birinci\n2. İkinci\nÜçüncü','numbered list respects selected line boundaries');
check(format('Bir\nİki',0,7,'bullet').value==='- Bir\n- İki','bullet list supports multiple lines');
check(format('- Bir\n- İki',0,11,'bullet').value==='Bir\nİki','bullet toggle removes list markers');
check(format('Karar\nGerekçe',0,0,'heading').value==='## Karar\nGerekçe','heading changes current line');
check(format('## Karar',0,8,'heading').value==='Karar','heading toggles off');
check(format('Karar',0,5,'quote').value==='> Karar','quote command formats answer');
check(format('- **Önemli** *karar*',0,20,'clear').value==='Önemli karar','clear removes editor formatting');
check(format('x\ny',0,2,'heading').value==='## x\ny','selection ending in newline leaves next line untouched');
check(format('Yanıt',0,5,'unknown').value==='Yanıt','unknown commands cannot alter content');
check(render('**Gerekçe** ve *karar*').includes('<strong>Gerekçe</strong> ve <em>karar</em>'),'preview renders bold and italic');
check(render('## Başlık\n\n- Bir\n- İki').includes('<h4>Başlık</h4><ul><li>Bir</li><li>İki</li></ul>'),'preview renders headings and lists');
check(render('1. Bir\n2. İki\n\n> Alıntı').includes('<ol><li>Bir</li><li>İki</li></ol><blockquote>Alıntı</blockquote>'),'preview closes list before quote');
const hostile=render('## <img src=x onerror=alert(1)>\n\n<script>alert(1)</script>\n**<svg onload=alert(2)>**');
check(!/<(?:img|script|svg)\b/.test(hostile)&&hostile.includes('&lt;script&gt;'),'preview escapes executable HTML, including formatted headings');
check(render('[tıkla](javascript:alert(1))').indexOf('<a')===-1,'preview never creates unsafe links');
check(render('Bir\r\nİki').includes('Bir<br>İki'),'preview preserves line breaks');
check(render('  ').includes('Henüz metin yazılmadı'),'empty preview is distinguishable from an answer');
const undo=history('');undo.record('Bir');undo.record('**Bir**');
check(undo.canUndo&&undo.undo()==='Bir','undo restores answer before formatting');
check(undo.redo()==='**Bir**'&&!undo.canRedo,'redo restores formatting');
undo.undo();undo.record('Yeni');check(!undo.canRedo&&undo.undo()==='Bir','new input after undo discards stale redo branch');
for(let i=0;i<70;i++)undo.record(String(i));for(let i=0;i<50;i++)undo.undo();check(!undo.canUndo,'editor history has a bounded memory footprint');

// Exercise the mounted editor's autosave contract without a browser service.
class Element {
    constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.dataset={};this.attributes={};this.listeners={};this.value='';this.disabled=false;this.className='';this.selectionStart=0;this.selectionEnd=0;}
    setAttribute(k,v){this.attributes[k]=v;}
    append(...nodes){for(const node of nodes){if(node.parentElement)node.parentElement.children=node.parentElement.children.filter(child=>child!==node);node.parentElement=this;this.children.push(node);}}
    before(node){const parent=this.parentElement;node.parentElement=parent;parent.children.splice(parent.children.indexOf(this),0,node);}
    closest(selector){let node=this;while(node){if(selector==='.'+node.className)return node;node=node.parentElement;}return null;}
    querySelectorAll(){const result=[];for(const child of this.children){if(child.dataset.editorCommand)result.push(child);result.push(...child.querySelectorAll());}return result;}
    addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
    dispatchEvent(event){this['on'+event.type]?.(event);for(const fn of this.listeners[event.type]||[])fn(event);}
    setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;}
    focus(){this.ownerDocument.activeElement=this;}
}
const doc={createElement:tag=>new Element(tag,doc),querySelector:()=>({textContent:'Kararınız'})};
const host=new Element('div',doc),area=new Element('textarea',doc);area.id='decision';area.value='İlk karar';area.selectionEnd=3;host.append(area);let autosaves=0;area.oninput=()=>autosaves++;
mount(area);const wrapper=host.children[0],toolbar=wrapper.children[0],tool=command=>toolbar.querySelectorAll().find(button=>button.dataset.editorCommand===command),toggle=toolbar.children.at(-1);
mount(area);check(host.children.length===1&&wrapper.children.includes(area),'mount retains original textarea and cannot duplicate editor');
tool('bold').onclick();check(area.value==='**İlk** karar'&&autosaves===1,'toolbar dispatches input through existing autosave handler');
tool('undo').onclick();check(area.value==='İlk karar'&&autosaves===2,'mounted undo updates draft through same input event');
tool('redo').onclick();check(area.value==='**İlk** karar'&&autosaves===3,'mounted redo survives input listener without corrupting history');
toggle.onclick();check(area.hidden&&tool('bold').disabled&&wrapper.children[2].innerHTML.includes('<strong>İlk</strong>'),'preview shows safe formatting and disables editing controls');
focus(area);check(!area.hidden&&doc.activeElement===area,'required-field navigation can reveal textarea from preview mode');
const readonly=new Element('textarea',doc);readonly.id='locked-problem';readonly.value='**Kilitli** yanıt';readonly.disabled=true;host.append(readonly);mount(readonly);const lockedTool=readonly.parentElement.children[0].querySelectorAll().find(button=>button.dataset.editorCommand==='bold');lockedTool.onclick();
check(lockedTool.disabled&&readonly.value==='**Kilitli** yanıt'&&readonly.hidden,'readonly answers cannot be modified by toolbar actions');

const nodes=new Map(),events=[],context=vm.createContext({
    console,URLSearchParams,TextEncoder,structuredClone,
    crypto:{randomUUID:()=> 'test-tab'},sessionStorage:{getItem:()=>null,setItem(){}},
    document:{querySelector:s=>nodes.get(s)||null,addEventListener(){}},window:{addEventListener(){},scrollY:120,scrollTo(){}},location:{search:''},
    setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},navigator:{onLine:true}
});
vm.runInContext(fs.readFileSync(require.resolve('../public/assets/app.js'),'utf8').replace(/init\(\)\.catch\(e=>notify\(e\.message\)\);\s*$/,''),context);
context.record=(...args)=>events.push(args);
vm.runInContext("work={application:{initial_at:null}};renderWork=()=>record('render',section);event=(...args)=>record('event',...args);save=async()=>{record('save');dirty=false;};",context);
const run=s=>vm.runInContext(s,context);
(async()=>{
    check(run("section='case';adjacentSection(-1)")===null,'previous arrow stops at first step');
    check(run("section='confirm';adjacentSection(1)")===null,'next arrow stops at final step');
    run("section='profile';dirty=true");await run('advanceWork(1)');
    check(run('section')==='initial'&&events[0][0]==='save'&&events[1][0]==='render','arrows save draft before changing step');
    const before=events.length;await run('advanceWork(1)');
    check(run('section')==='initial'&&events.length===before,'next arrow cannot bypass initial confirmation');
    run("work.application.initial_at='confirmed'");await run('advanceWork(1)');
    check(run('section')==='ai','confirmed initial answer unlocks next arrow');
    await run('advanceWork(-1)');check(run('section')==='initial','previous arrow follows same seven-step order');
    run("dirty=true;save=async()=>{throw new Error('offline');}");await assert.rejects(run('advanceWork(1)'),/offline/);
    check(run('section')==='initial'&&run('dirty'),'save failure preserves step and unsaved text');
    run("dirty=false");await run('navigateWork("unknown")');check(run('section')==='initial','invalid target cannot change current step');
    run("section='confirm'");check(run('stepControls()').includes('id="work-next" disabled'),'last step arrow is visibly disabled');
    run("section='case'");check(run('stepControls()').includes('id="work-previous" disabled'),'first step arrow is visibly disabled');
    let completeSave;context.waitForSave=()=>new Promise(resolve=>{completeSave=resolve;});
    run("dirty=true;save=async()=>{await waitForSave();dirty=false;}");const first=run('advanceWork(1)');await run('advanceWork(1)');completeSave();await first;
    check(run('section')==='profile','rapid arrow clicks cannot skip a step while saving');
    check(events.some(e=>e[0]==='event'&&e[1]==='section_open'),'arrow navigation preserves section timing telemetry');
    console.log(`TOTAL EDITOR/STEPPER ${checks} checks passed; unit and workflow doubles.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
