<?php
declare(strict_types=1);
require __DIR__.'/../app/bootstrap.php';
require __DIR__.'/Seed.php';

$checks=[];
function check(bool $ok,string $label): void {global $checks;if(!$ok)throw new RuntimeException($label);$checks[]=$label;}
function blocked(callable $fn,int $status,string $label): void {try{$fn();}catch(Fault $e){check($e->getCode()===$status,$label);return;}throw new RuntimeException('Not blocked: '.$label);}
$c=require __DIR__.'/../config/example.php';$c['dsn']='sqlite::memory:';$c['db_user']='';$c['db_password']='';$c['https']=false;
$config=tempnam(sys_get_temp_dir(),'vakalab-auth-test-');file_put_contents($config,'<?php return '.var_export($c,true).';');putenv('VAKALAB_CONFIG='.$config);
try{
    $db=new Db($c);Migration::run($db);$password=uid();Seed::run($db,$c,$password);
    $app=new App($db,$c);$admin=new Admin($app);$auth=new Auth($db);$auth->session();
    $researcher=$db->one("SELECT * FROM users WHERE id='test-researcher'");$student=$db->one("SELECT * FROM users WHERE id='test-student-1'");
    $payload=['student_no'=>'0002026111901','first_name'=>'  İlyas  ','last_name'=>'Akkuş','password'=>$password,'role'=>'researcher','owner_id'=>'forged','metadata'=>['preview_owner'=>'forged']];
    $oldSession=session_id();$oldCsrf=$_SESSION['csrf'];$registered=$auth->register($payload);
    check($registered['login']==='2026111901','student number loses leading zeroes');
    check($registered['name']==='İlyas Akkuş','Turkish first and last names are trimmed and stored');
    check(obj($registered['metadata'])['first_name']==='İlyas'&&obj($registered['metadata'])['last_name']==='Akkuş','separate names retained');
    check($registered['role']==='student'&&$registered['owner_id']===$researcher['id'],'registration cannot select role or another workspace');
    check(!isset(obj($registered['metadata'])['preview_owner']),'registration cannot forge preview metadata');
    check($registered['password']!==$password&&password_verify($password,$registered['password']),'only password hash stored');
    check($auth->user()['id']===$registered['id']&&session_id()!==$oldSession&&$_SESSION['csrf']!==$oldCsrf,'registration signs in with new session and CSRF');
    check(in_array($registered['id'],array_column($admin->dashboard($researcher)['users'],'id'),true),'self registered student visible to admin');
    blocked(fn()=>$auth->register($payload),409,'authenticated users cannot create another account');
    unset($_SESSION['uid']);blocked(fn()=>$auth->register($payload),409,'duplicate canonical number rejected');
    $legacy=$registered;$legacy['id']=uid();$legacy['login']='000123456';$db->insert('users',$legacy);
    blocked(fn()=>$auth->register(array_replace($payload,['student_no'=>'123456'])),409,'legacy padded number cannot be registered a second time');
    foreach([
        ['student_no'=>'000'],['student_no'=>'12e3'],['student_no'=>'12.3'],['student_no'=>'-123'],['student_no'=>123],
        ['first_name'=>' '],['last_name'=>'<script>'],['first_name'=>str_repeat('A',91)],['password'=>'short'],['password'=>str_repeat('x',73)],['password'=>str_repeat('ş',40)],['password'=>"long-password\0test"]
    ] as $i=>$change){$_SERVER['REMOTE_ADDR']='invalid-'.$i;blocked(fn()=>$auth->register(array_replace($payload,$change)),422,'invalid registration field '.$i.' rejected');}
    $_SERVER['REMOTE_ADDR']='login-test';$logged=$auth->login('0002026111901',$password);check($logged['id']===$registered['id'],'padded login reaches normalized student account');
    $session=$_SESSION;$csrfBeforeReset=$_SESSION['csrf'];
    $newPassword=uid();$admin->mutate($researcher,'reset_password',['id'=>$registered['id'],'password'=>$newPassword]);
    blocked(fn()=>$auth->user(),401,'password reset invalidates old student sessions');
    blocked(fn()=>$auth->login('2026111901',$password),401,'old password no longer works');
    check($auth->login('2026111901',$newPassword)['id']===$registered['id'],'new password works');
    $audit=$db->one("SELECT detail FROM audit WHERE action='reset_password' AND target=?",[$registered['id']]);
    check(!str_contains($audit['detail'],$newPassword),'audit does not expose reset password');
    blocked(fn()=>$admin->mutate($student,'reset_password',['id'=>$registered['id'],'password'=>uid()]),403,'student cannot reset passwords');
    blocked(fn()=>$admin->mutate($researcher,'reset_password',['id'=>$researcher['id'],'password'=>uid()]),403,'student reset action cannot modify researchers');
    blocked(fn()=>$admin->mutate($researcher,'reset_password',['id'=>$registered['id'],'password'=>'short']),422,'reset enforces password rules');
    $other=$researcher;$other['id']=uid();$other['login']='OTHER-RESEARCHER';$db->insert('users',$other);
    blocked(fn()=>$admin->mutate($other,'reset_password',['id'=>$registered['id'],'password'=>uid()]),403,'another researcher cannot reset this student');

    $auth->login('TEST-ARASTIRMACI',$password);$adminSession=$_SESSION['uid'];
    $beforeCases=$db->all('SELECT * FROM cases ORDER BY id');$beforeStudents=$db->all('SELECT id,password FROM users ORDER BY id');
    $beforeDashboard=$admin->dashboard($researcher);$export=new Export($app);$filters=['include_test'=>1,'include_practice'=>1,'include_excluded'=>1];$beforeExport=$export->dataset($researcher,$filters);
    $preview=new Preview($app);$created=$preview->create($researcher,'test-case-6');
    check($_SESSION['uid']===$adminSession,'preview preserves admin session');
    $puser=$preview->user($researcher,$created['token'],'view',$created['app_id']);$view=$app->view($puser,$created['app_id']);
    check($view['application']['state']==='initial'&&$puser['role']==='student','draft case opens as a working student');
    check(!isset($view['events'],$view['analysis_runs'],$view['version']['notes']),'preview receives student projection');
    check((bool)$puser['test']&&(bool)$db->one('SELECT excluded FROM applications WHERE id=?',[$created['app_id']])['excluded'],'preview is test data and excluded');
    $d=Rules::draft(['knowledge'=>5,'confidence'=>7,'difficulty'=>4,'severity'=>8,'problem'=>'Önizleme problemi','decision'=>'Önizleme kararı','reason'=>'Önizleme gerekçesi']);
    $a=$app->save($puser,$created['app_id'],['revision'=>0,'draft'=>$d],'initial');check($a['state']==='working','preview uses real initial confirmation rules');
    $request=$app->chat($puser,$a['id'],['text'=>'Bu vakayı tartışalım.','key'=>uid()]);check($request['status']==='completed','preview can chat with configured provider');
    $d=array_replace($d,['final_decision'=>'Son karar','final_reason'=>'Son gerekçe','final_confidence'=>8,'final_difficulty'=>3,'final_severity'=>7,'reflection'=>'Önizleme yansıtması']);
    $a=$app->save($puser,$a['id'],['revision'=>(int)$a['revision'],'draft'=>$d],'submit');check($a['state']==='submitted','preview completes real final submission');
    $afterDashboard=$admin->dashboard($researcher);
    foreach(['users','cases','assignments','applications'] as $key)check($beforeDashboard[$key]===$afterDashboard[$key],'preview does not enter dashboard '.$key);
    check($beforeExport===$export->dataset($researcher,$filters),'even full exports do not include preview data');
    foreach($beforeCases as $row)check($row===$db->one('SELECT * FROM cases WHERE id=?',[$row['id']]),'source case '.$row['id'].' unchanged');
    foreach($beforeStudents as $row)check($row===$db->one('SELECT id,password FROM users WHERE id=?',[$row['id']]),'existing account '.$row['id'].' unchanged');
    blocked(fn()=>$preview->create($student,'test-case-1'),403,'student cannot create a preview');
    blocked(fn()=>$preview->create($other,'test-case-1'),403,'another researcher cannot preview source case');
    blocked(fn()=>$preview->user($other,$created['token'],'view',$a['id']),403,'preview token cannot cross researcher boundaries');
    blocked(fn()=>$preview->user($researcher,uid(),'view',$a['id']),403,'unknown token rejected');
    blocked(fn()=>$preview->user($researcher,$created['token'],'dashboard',''),403,'preview cannot invoke administration');
    blocked(fn()=>$preview->user($researcher,$created['token'],'view','some-real-application'),403,'preview cannot target real applications');
    blocked(fn()=>$app->view($student,$a['id']),403,'real students cannot see preview responses');
    unset($_SESSION['previews']);blocked(fn()=>$preview->user($researcher,$created['token'],'view',$a['id']),403,'token expires with original session');
    unset($_SESSION['uid']);$_SERVER['REMOTE_ADDR']='registration-limit';
    for($i=0;$i<10;$i++)blocked(fn()=>$auth->register(array_replace($payload,['student_no'=>'bad'])),422,'registration rate allowance '.$i);
    blocked(fn()=>$auth->register(array_replace($payload,['student_no'=>'2026111999'])),429,'registration limited per IP');
    foreach($checks as $i=>$label)echo 'PASS AUTH/PREVIEW '.($i+1).' '.$label.PHP_EOL;
    echo 'TOTAL AUTH/PREVIEW '.count($checks).' checks passed'.PHP_EOL;
}finally{if(session_status()===PHP_SESSION_ACTIVE){$_SESSION=[];session_destroy();}unlink($config);}
