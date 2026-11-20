<?php
declare(strict_types=1);
require __DIR__.'/../app/bootstrap.php';require __DIR__.'/Seed.php';
$count=0;
function richCheck(bool $ok,string $label): void {global $count;demand($ok,$label);echo 'PASS RICH TEXT '.(++$count).' '.$label.PHP_EOL;}
function richBlocked(callable $fn,int $status,string $label): void {try{$fn();}catch(Fault $e){richCheck($e->getCode()===$status,$label);return;}throw new RuntimeException('Not blocked: '.$label);}
$text='İlk karar';$doc=['ops'=>[['insert'=>'İlk','attributes'=>['bold'=>true]],['insert'=>" karar\n"]]];
$d=Rules::draft(['decision'=>$text,'rich_text'=>['decision'=>$doc]]);
richCheck($d['decision']===$text&&$d['rich_text']['decision']===$doc,'formatting retained beside unchanged plain answer');
richCheck(!isset(Rules::draft([])['rich_text']),'legacy plain drafts retain original shape');
richBlocked(fn()=>Rules::draft(['decision'=>'different','rich_text'=>['decision'=>$doc]]),422,'formatted text must match scored plain answer');
foreach([
 ['ops'=>[['insert'=>['image'=>'https://example.org/x.png']]]],
 ['ops'=>[['retain'=>4]]],
 ['ops'=>[['insert'=>'not terminated']]],
 ['ops'=>[['insert'=>"İlk karar\n",'attributes'=>['link'=>'javascript:alert(1)']]]],
 ['ops'=>[['insert'=>"İlk karar\n",'attributes'=>['color'=>'red;position:fixed']]]],
 ['ops'=>[['insert'=>"İlk karar\n",'attributes'=>['onclick'=>'alert(1)']]]],
 ['ops'=>[['insert'=>"İlk karar\n",'attributes'=>['header'=>99]]]],
 ['ops'=>[['insert'=>"İlk karar\n",'attributes'=>['indent'=>99]]]],
 ['ops'=>[]]
] as $i=>$invalid)richBlocked(fn()=>Rules::draft(['decision'=>$text,'rich_text'=>['decision'=>$invalid]]),422,'unsafe/invalid Delta '.$i.' rejected');
richBlocked(fn()=>Rules::draft(['rich_text'=>['admin'=>['ops'=>[['insert'=>"\n"]]]]]),422,'unknown formatted field rejected');
$c=require __DIR__.'/../config/example.php';$c['dsn']='sqlite::memory:';$c['db_user']='';$c['db_password']='';
$db=new Db($c);Migration::run($db);Seed::run($db,$c,uid());$app=new App($db,$c);$student=$db->one("SELECT * FROM users WHERE id='test-student-1'");$a=$app->start($student,'test-case-1');
$draft=Rules::draft(['knowledge'=>5,'confidence'=>7,'difficulty'=>4,'severity'=>8,'problem'=>'Problem','decision'=>$text,'reason'=>'Gerekçe','rich_text'=>['decision'=>$doc]]);
$a=$app->save($student,$a['id'],['revision'=>0,'draft'=>$draft]);$revision=(int)$a['revision'];
richCheck(obj($a['draft'])['rich_text']['decision']===$doc,'formatting survives database save/reload');
$draft['rich_text']['decision']['ops'][0]['attributes']=['italic'=>true];$a=$app->save($student,$a['id'],['revision'=>$revision,'draft'=>$draft]);
richCheck((int)$a['revision']===$revision+1&&obj($a['draft'])['decision']===$text,'format-only edit creates revision without changing text');
$revision=(int)$a['revision'];$again=$app->save($student,$a['id'],['revision'=>$revision,'draft'=>$draft]);richCheck((int)$again['revision']===$revision,'same formatting does not create a phantom revision');
$early=$draft;$early['rich_text']['question']=['ops'=>[['insert'=>"\n"]]];richBlocked(fn()=>$app->save($student,$a['id'],['revision'=>$revision,'draft'=>$early]),409,'locked AI stage cannot acquire formatting before initial confirmation');
$a=$app->save($student,$a['id'],['revision'=>$revision,'draft'=>$draft],'initial');
$snap=obj($db->one("SELECT body FROM snapshots WHERE app_id=? AND kind='initial'",[$a['id']])['body']);richCheck($snap['rich_text']['decision']===$draft['rich_text']['decision'],'initial snapshot preserves exact visual document');
$changed=$draft;$changed['rich_text']['decision']=$doc;richBlocked(fn()=>$app->save($student,$a['id'],['revision'=>(int)$a['revision'],'draft'=>$changed]),409,'locked initial formatting cannot be changed while text stays identical');
$removed=$draft;unset($removed['rich_text']);richBlocked(fn()=>$app->save($student,$a['id'],['revision'=>(int)$a['revision'],'draft'=>$removed]),409,'locked initial formatting cannot be removed');
$draft=array_replace($draft,['final_decision'=>'Son karar','final_reason'=>'Son gerekçe','final_confidence'=>8,'final_difficulty'=>3,'final_severity'=>6,'reflection'=>'Yansıtma']);
$draft['rich_text']['final_decision']=['ops'=>[['insert'=>'Son','attributes'=>['underline'=>true]],['insert'=>" karar\n"]]];
$draft['question']='Mesaj taslağı';$draft['rich_text']['question']=['ops'=>[['insert'=>"Mesaj taslağı\n"]]];
$a=$app->save($student,$a['id'],['revision'=>(int)$a['revision'],'draft'=>$draft],'submit');
$snap=obj($db->one("SELECT body FROM snapshots WHERE app_id=? AND kind='submit'",[$a['id']])['body']);
richCheck($snap['rich_text']['final_decision']===$draft['rich_text']['final_decision'],'final submission preserves formatting');
richCheck(!isset($snap['rich_text']['question'])&&!isset($snap['rich_text']['decision']),'submission snapshot contains only submitted-stage formatting');
$view=$app->view($student,$a['id']);richCheck(obj($view['application']['draft'])['rich_text']===$draft['rich_text'],'student readonly view preserves all saved formatting');
richBlocked(fn()=>$app->save($student,$a['id'],['revision'=>(int)$a['revision'],'draft'=>$draft]),409,'submitted rich document stays immutable');
echo 'TOTAL RICH TEXT '.$count.' checks passed; isolated SQLite, no AI calls.'.PHP_EOL;
