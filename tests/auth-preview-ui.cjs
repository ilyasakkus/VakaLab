/* Client workflow checks with isolated DOM/API doubles; no database or browser. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let count=0;
function check(ok,label){assert.ok(ok,label);console.log(`PASS AUTH UI ${++count} ${label}`);}
function harness(search=''){
    const nodes=new Map(),requests=[],listeners={},storage=new Map();
    const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',disabled:false,hidden:false,dataset:{},textContent:'',innerHTML:'',addEventListener(type,fn){this[type]=fn;},focus(){this.focused=true;}});return nodes.get(id);};
    const context=vm.createContext({
        console,URL,URLSearchParams,TextEncoder,structuredClone,
        setTimeout:()=>1,clearTimeout(){},clearInterval(){},setInterval:()=>1,
        sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
        localStorage:{getItem:()=>null,removeItem(){}},
        crypto:{randomUUID:()=> '00000000-0000-4000-8000-000000000001'},
        location:{search,href:'https://vakalab.test/'+search,assign:url=>{context.assigned=url;}},
        navigator:{onLine:true},
        document:{body:{dataset:{}},hasFocus:()=>true,querySelector:s=>node(s),querySelectorAll:()=>[],addEventListener(){}},
        window:{addEventListener:(type,fn)=>{listeners[type]=fn;}},
        fetch:async(url,options={})=>{requests.push({url,options});return {ok:true,status:200,json:async()=>({data:{}})};}
    });
    const source=fs.readFileSync(require.resolve('../public/assets/app.js'),'utf8').replace(/init\(\)\.catch\(e=>notify\(e\.message\)\);\s*$/,'');
    vm.runInContext(source,context);vm.runInContext(fs.readFileSync(require.resolve('../public/assets/researcher.js'),'utf8'),context);
    return {context,node,requests,listeners,run:s=>vm.runInContext(s,context)};
}
(async()=>{
    const h=harness();h.run('login()');
    check(h.node('#root').innerHTML.includes('id="show-register"'),'login exposes account creation');
    h.node('#show-register').click();
    check(h.node('#root').innerHTML.includes('id="first-name"')&&h.node('#root').innerHTML.includes('id="last-name"'),'registration asks for separate names');
    h.node('#student-no').blur({target:h.node('#student-no')});
    h.node('#student-no').value='0002026111901';h.node('#student-no').blur({target:h.node('#student-no')});
    check(h.node('#student-no').value==='2026111901','student number stays text and loses leading zeroes');
    h.node('#first-name').value='İlyas';h.node('#last-name').value='Akkuş';h.node('#new-password').value='example-password';
    let resolveRequest;
    h.context.fetch=(url,options)=>{h.requests.push({url,options});return new Promise(resolve=>{resolveRequest=resolve;});};
    const attempt=h.node('#register-form').onsubmit({preventDefault(){}});
    check(h.node('#auth-submit').disabled,'registration disables submit while request runs');
    await h.node('#register-form').onsubmit({preventDefault(){}});
    check(h.requests.length===1,'double click cannot submit two registrations');
    const sent=JSON.parse(h.requests[0].options.body);
    check(sent.student_no==='2026111901'&&sent.first_name==='İlyas'&&sent.last_name==='Akkuş'&&!('role' in sent),'registration submits requested student fields');
    resolveRequest({ok:false,status:409,json:async()=>({error:'Bu öğrenci numarasıyla zaten bir hesap var.'})});await attempt;
    check(!h.node('#auth-error').hidden&&h.node('#auth-error').textContent.includes('zaten bir hesap'),'registration failure shown inside form');
    check(!h.node('#auth-submit').disabled&&h.node('#first-name').value==='İlyas','failed registration preserves fields and allows correction');
    let step=0;h.context.fetch=async()=>({ok:true,status:200,json:async()=>({data:++step===1?{csrf:'rotated',login:'2026111901'}:{id:'new-student',role:'student'}})});
    h.run('home=async()=>{globalThis.homeReached=true;}');await h.node('#register-form').onsubmit({preventDefault(){}});
    check(h.context.homeReached&&h.run('csrf')==='rotated'&&h.run('me.id')==='new-student','successful registration rotates CSRF and opens student home');

    h.run('showDialog=(html,fn)=>{globalThis.dialogHtml=html;globalThis.commitDialog=fn;return {querySelector:()=>({focus(){}})};}');
    h.run("resetStudentPassword({id:'student-1',login:'2026111901',name:'İlyas Akkuş'})");
    check(h.context.dialogHtml.includes('reset-password-confirm'),'password reset asks for confirmation');
    h.node('#reset-password').value='new-password-123';h.node('#reset-password-confirm').value='different-password';
    await assert.rejects(h.context.commitDialog(),/eşleşmiyor/);count++;console.log(`PASS AUTH UI ${count} mismatched reset passwords blocked before request`);
    h.node('#reset-password-confirm').value='new-password-123';let reset;
    h.context.fetch=async(url,options)=>{reset=JSON.parse(options.body);return {ok:true,json:async()=>({data:{id:'student-1'}})};};await h.context.commitDialog();
    check(reset.action==='reset_password'&&reset.id==='student-1'&&reset.password==='new-password-123','reset sends a scoped dedicated admin action');
    let previewUrl,closed=false;
    h.context.window.open=()=>({opener:'old',location:{replace:url=>{previewUrl=url;}},close(){closed=true;}});
    h.context.fetch=async()=>({ok:true,json:async()=>({data:{token:'private-token',app_id:'preview-app'}})});
    await h.run("previewCase('case-1')");
    check(new URL(previewUrl).searchParams.get('preview')==='private-token','preview opens an isolated student tab');
    h.context.fetch=async()=>({ok:false,status:403,json:async()=>({error:'Yetki gerekli'})});await h.run("previewCase('another-case')");
    check(closed&&h.node('#notice').textContent==='Yetki gerekli','failed preview closes blank tab and shows error');

    const preview=harness('?preview=private-token');
    await preview.run("api('save',{app_id:'preview-app',draft:{}})");
    check(new URL(preview.requests[0].url,'https://vakalab.test/').searchParams.get('preview')==='private-token','preview writes always carry the scoped token');
    preview.run("me={id:'preview-student',role:'student',config:{idle_ms:60000}};work={application:{id:'preview-app',state:'initial'},version:{id:'preview-version'}};flushExitEvents()");
    check(preview.requests.at(-1).options.keepalive&&preview.requests.at(-1).url.includes('preview=private-token'),'page exit telemetry stays in preview context');
    preview.run("csrf='valid';fetch=async url=>url.includes('op=token')?{ok:true,json:async()=>({data:{csrf:'valid'}})}:{ok:false,status:403,json:async()=>({error:'Önizleme sona erdi.'})}");await preview.run('init()');
    check(preview.node('#root').innerHTML.includes('Yönetim paneline dön'),'expired preview provides a route back to admin');
    console.log(`TOTAL AUTH UI ${count} checks passed; DOM/API doubles only.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
