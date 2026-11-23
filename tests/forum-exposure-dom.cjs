/* Actual forum module; intersection geometry and focus are controlled browser observations. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require(process.env.JSDOM_PATH||'jsdom'),dom=new JSDOM('<!doctype html><body><section id="forum"></section></body>',{url:'https://vakalab.test/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
let observer,focused=true,visible=true,checks=0;w.document.hasFocus=()=>focused;Object.defineProperty(w.document,'hidden',{get:()=>!visible});
w.IntersectionObserver=class{constructor(callback){this.callback=callback;this.nodes=new Set();observer=this;}observe(n){this.nodes.add(n);}unobserve(n){this.nodes.delete(n);}disconnect(){this.nodes.clear();}fire(node,isIntersecting=true){this.callback([{target:node,isIntersecting}]);}};
const events=[],sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));const check=(ok,label)=>{assert.ok(ok,label);console.log(`PASS FORUM EXPOSURE ${++checks} ${label}`);};
(async()=>{let view;try{
 w.eval(fs.readFileSync(path.join(__dirname,'../public/assets/forum.js'),'utf8'));const host=w.document.querySelector('#forum');
 const post={id:'peer-message',author_id:'peer',author:'Akran',body:'Görüşüm',parent_id:null,created_at:'2026-11-20T12:00:00Z',is_own:false};
 view=w.VakaForum.mount(host,{api:async()=>({can_read:true,can_post:true,posts:[post],has_more:false}),userId:'student',appId:'attempt',phase:'before',pollMs:100000,onInteraction:(type,payload)=>events.push({type,payload})});await view.ready;
 const card=host.querySelector('[data-forum-post]'),feed=host.querySelector('.forum-feed');card.getBoundingClientRect=()=>({top:10,bottom:100});feed.getBoundingClientRect=()=>({top:0,bottom:400});
 check(events.find(e=>e.type==='forum_open').payload.visibility_observer_available===true,'forum advertises actual observer capability');
 observer.fire(card);await sleep(250);observer.fire(card,false);await sleep(850);check(!events.some(e=>e.type==='forum_message_visible'),'brief appearance below dwell threshold is not logged as exposure');
 focused=false;observer.fire(card);await sleep(1050);check(!events.some(e=>e.type==='forum_message_visible'),'unfocused browser cannot produce a visible-message observation');
 focused=true;observer.fire(card);await sleep(1050);const seen=events.filter(e=>e.type==='forum_message_visible');check(seen.length===1&&seen[0].payload.post_id===post.id&&seen[0].payload.author_id==='peer'&&seen[0].payload.visible_ms===1000,'focused sustained visibility records message and actor reference');
 check(!('icap_code' in seen[0].payload)&&!('read' in seen[0].payload)&&seen[0].payload.visibility_basis==='partial_card_min_40px','visibility observation never claims reading or assigns ICAP');
 observer.fire(card);await sleep(1050);check(events.filter(e=>e.type==='forum_message_visible').length===1,'polling or repeated intersections do not duplicate exposure within same mounted view');
 view.destroy();check(observer.nodes.size===0,'teardown disconnects observation and timers');
 console.log(`TOTAL FORUM EXPOSURE ${checks} checks; real dwell timers, controlled geometry/focus, no visual browser.`);
}finally{view?.destroy();dom.window.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
