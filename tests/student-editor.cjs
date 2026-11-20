const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const editor=require('../public/assets/editor.js');
let checks=0;
function check(ok,label){assert.ok(ok,label);console.log(`PASS RICH EDITOR ${++checks} ${label}`);}
function rejected(fn,label){assert.throws(fn);check(true,label);}
const text='İlk karar\nGerekçe';
const doc={ops:[{insert:'İlk',attributes:{bold:true}},{insert:' karar\nGerekçe\n'}]};
check(editor.plainText(editor.normalize(doc,text))===text,'formatted Turkish answer remains exact plain text');
check(editor.plainText(editor.fromText('Yanıt\n'))==='Yanıt\n','user newline is distinct from Quill terminal newline');
check(editor.plainText(editor.fromText(''))==='','empty editor remains an empty required field');
check(editor.render(doc).includes('<strong>İlk</strong> karar'),'safe projection renders actual formatting');
check(editor.normalize({ops:[{insert:'Yanıt',attributes:{italic:true,bold:true}},{insert:'\n'}]}).ops[0].attributes.bold,'inline attributes normalized');
for(const [key,value] of Object.entries({underline:true,strike:true,header:2,size:'large',font:'serif',color:'#aabbcc',background:'#ffeeaa',list:'ordered',indent:2,align:'justify',blockquote:true,link:'https://example.org'}))check(!!editor.normalize({ops:[{insert:'Metin\n',attributes:{[key]:value}}]}),key+' format accepted');
rejected(()=>editor.normalize({ops:[{insert:{image:'https://example.org/image.png'}}]}),'image/embed cannot enter answer data');
rejected(()=>editor.normalize({ops:[{retain:1,attributes:{bold:true}}]}),'change deltas cannot masquerade as whole documents');
rejected(()=>editor.normalize({ops:[{insert:'wrong\n'}]},'expected'),'plain answer and formatting must match');
rejected(()=>editor.normalize({ops:[{insert:'missing terminator'}]}),'document requires terminal newline');
rejected(()=>editor.normalize({ops:[{insert:'x\n',attributes:{link:'javascript:alert(1)'}}]}),'executable link is rejected');
rejected(()=>editor.normalize({ops:[{insert:'x\n',attributes:{color:'red;position:fixed'}}]}),'arbitrary CSS is rejected');
rejected(()=>editor.normalize({ops:[{insert:'x\n',attributes:{onclick:'alert(1)'}}]}),'unknown event/HTML attributes rejected');
rejected(()=>editor.normalize({ops:[{insert:'x\n',attributes:{header:99}}]}),'invalid heading rejected');
rejected(()=>editor.normalize({ops:[{insert:'x\n',attributes:{indent:99}}]}),'invalid indentation rejected');
rejected(()=>editor.normalize({ops:[{insert:'a'.repeat(60001)+'\n'}]}),'server byte-size bound also enforced by client');
check(editor.render(editor.fromText('<img src=x onerror=alert(1)>')).includes('&lt;img'),'raw HTML displayed as text');
check(!editor.render({ops:[{insert:'x\n',attributes:{link:'data:text/html,<script>x</script>'}}]}),'unsafe document has no rendered projection');
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
    console.log(`TOTAL RICH EDITOR/STEPPER ${checks} checks passed; unit and workflow doubles.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
