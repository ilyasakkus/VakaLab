<?php
declare(strict_types=1);
require __DIR__.'/../app/bootstrap.php';require __DIR__.'/Seed.php';
$checks=0;
function promptCheck(bool $ok,string $label): void {global $checks;demand($ok,$label);echo 'PASS FORUM PROMPTS '.(++$checks).' '.$label.PHP_EOL;}
function promptDeny(callable $fn,int $status,string $label): void {try{$fn();}catch(Fault $e){promptCheck($e->getCode()===$status,$label.' ('.$e->getCode().')');return;}throw new RuntimeException('Not blocked: '.$label);}
$c=require __DIR__.'/../config/example.php';$c['dsn']='sqlite::memory:';$c['db_user']='';$c['db_password']='';$db=new Db($c);Migration::run($db);Seed::run($db,$c,uid());$app=new App($db,$c);$forum=new Forum($app);
$u=$db->one("SELECT * FROM users WHERE id='test-student-1'");$peer=$db->one("SELECT * FROM users WHERE id='test-student-2'");$r=$db->one("SELECT * FROM users WHERE id='test-researcher'");$a=$app->start($u,'test-case-1');$id=$a['id'];$b=$app->start($peer,'test-case-1');
$draft=Rules::draft(['response_mode'=>'forum','knowledge'=>5,'confidence'=>7,'difficulty'=>4,'severity'=>8]);
promptCheck($draft['problem']===''&&$draft['decision']===''&&$draft['reason']==='','forum workflow does not invent individual answers');
$a=$app->save($u,$id,['revision'=>0,'draft'=>$draft]);promptDeny(fn()=>$app->save($u,$id,['revision'=>$a['revision'],'draft'=>$draft],'initial'),422,'cannot finish before discussion without own contribution');
$otherPost=$forum->post($peer,$b['id'],['phase'=>'before','body'=>'PEER BEFORE: gizli bireysel yanıt değil, ortak mesaj.','key'=>uid()])['post'];
promptDeny(fn()=>$app->save($u,$id,['revision'=>$a['revision'],'draft'=>$draft],'initial'),422,'classmate contribution cannot stand in for own answer');
$one=$forum->post($u,$id,['phase'=>'before','body'=>'Öğrencilerin farklı koşullarını dinleyip adil destek planlarım.','parent_id'=>$otherPost['id'],'key'=>uid()])['post'];
promptCheck(count($forum->listing($u,$id,'before')['questions'])===3,'before forum publishes exactly three guiding questions');
promptCheck($app->view($u,$id)['forum_participation']===['before'=>1,'after'=>0],'participation counts isolated to current student application');
$a=$app->save($u,$id,['revision'=>$a['revision'],'draft'=>$draft],'initial');
promptCheck($a['initial_at']!==null&&$a['state']==='working','own forum reply unlocks AI without removed individual answer fields');
$snap=obj($db->one("SELECT body FROM snapshots WHERE app_id=? AND kind='initial'",[$id])['body']);
promptCheck($snap['response_mode']==='forum'&&array_column($snap['forum_posts'],'id')===[$one['id']]&&$snap['forum_posts'][0]['parent_id']===$otherPost['id'],'initial snapshot freezes own contribution with exact reply reference');
$downgrade=$draft;unset($downgrade['response_mode']);promptDeny(fn()=>$app->save($u,$id,['revision'=>$a['revision'],'draft'=>$downgrade]),409,'confirmed forum workflow cannot switch back to bypass contribution rules');
$request=$app->chat($u,$id,['text'=>'Bu vaka hakkında başka hangi bakış açısını düşünebilirim?','key'=>uid()]);promptCheck($request['status']==='completed','private AI conversation still works');
$final=$draft+['unused'=>true];$final['reflection']='Görüşümü yeniden gözden geçirerek kararımı gerekçelendirdim.';$final['final_confidence']=8;$final['final_difficulty']=4;$final['final_severity']=7;
promptDeny(fn()=>$app->save($u,$id,['revision'=>$a['revision'],'draft'=>$final],'submit'),422,'final submission requires actual final forum response');
$two=$forum->post($u,$id,['phase'=>'after','body'=>'Nihai kararım, destek koşullarını uyarlayıp katılımı izlemek.','key'=>uid()])['post'];
$three=$forum->post($u,$id,['phase'=>'after','body'=>'Kararımı gerekçelerle ve ölçülebilir katılım bilgisiyle güçlendiririm.','parent_id'=>$two['id'],'key'=>uid()])['post'];
promptCheck($forum->listing($u,$id,'after')['questions']===['Nihai kararınız nedir?'],'after forum has one final-decision question');
$a=$app->save($u,$id,['revision'=>$a['revision'],'draft'=>$final],'submit');
promptCheck($a['state']==='submitted'&&obj($a['draft'])['final_decision']===''&&obj($a['draft'])['final_reason']==='','forum contribution replaces individual final answer boxes');
$snap=obj($db->one("SELECT body FROM snapshots WHERE app_id=? AND kind='submit'",[$id])['body']);promptCheck(array_column($snap['forum_posts'],'id')===[$two['id'],$three['id']],'final snapshot captures all own posts and replies');
$review=new HolisticReview($app);$payload=$review->payload($r,$id,'test-rubric-v1');
promptCheck(array_column($payload['question_answers'],'source_id')===['forum_before','forum_after','reflection'],'current report uses forum stages and reflection instead of removed fields');
promptCheck($payload['sources']['forum_before']===$one['body']&&$payload['sources']['forum_after']===$two['body']."\n\n".$three['body'],'report evidence is exact own forum text');
promptCheck(!str_contains(js($payload['sources']),'PEER BEFORE'),'report never attributes peer text to student');
$view=$app->view($r,$id);promptCheck($view['review_questions']===$payload['question_answers'],'researcher report editor and provider use same source questions');
$report=$review->handle($r,['action'=>'generate','app_id'=>$id,'rubric_id'=>'test-rubric-v1','version'=>0]);
promptCheck(array_keys(obj($report['body'])['student_report']['sections'])===['forum_before','forum_after','reflection'],'mock provider completes actual report flow for new forum responses');
promptDeny(fn()=>(new Analysis($app))->newRun($r,$id,'test-rubric-v1'),409,'old individual grading contract cannot grade missing individual fields');
$old=$db->one("SELECT * FROM applications WHERE user_id='test-student-6' AND case_id='test-case-1'");$oldPayload=$review->payload($r,$old['id'],'test-rubric-v1');promptCheck(count($oldPayload['question_answers'])===6,'historical individual submissions keep original six questions');
// Students already past the old initial form can finish using the new final forum.
$legacy=$db->one("SELECT * FROM applications WHERE user_id='test-student-4' AND case_id='test-case-1'");$lu=$db->one("SELECT * FROM users WHERE id='test-student-4'");$ld=obj($legacy['draft']);$ld['response_mode']='forum';$ld['final_confidence']=8;$ld['final_difficulty']=3;$ld['final_severity']=7;$ld['reflection']='Önceki görüşümü ve yeni tartışmayı birlikte değerlendirdim.';
$forum->post($lu,$legacy['id'],['phase'=>'after','body'=>'Eski başlangıç yanıtımı koruyarak nihai tartışmaya katılırım.','key'=>uid()]);$legacy=$app->save($lu,$legacy['id'],['revision'=>$legacy['revision'],'draft'=>$ld],'submit');
$legacyPayload=$review->payload($r,$legacy['id'],'test-rubric-v1');promptCheck(str_contains($legacyPayload['sources']['forum_before'],$ld['problem']),'transition preserves original frozen initial evidence for ongoing legacy work');
promptCheck(!$db->all('PRAGMA foreign_key_check'),'forum workflow database integrity valid');echo "OK FORUM PROMPTS $checks checks\n";
