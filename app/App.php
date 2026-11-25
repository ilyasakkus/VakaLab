<?php
declare(strict_types=1);
final class App {
    public function __construct(public Db $db,public array $config) {}
    public static function studentApplication(array $a): array {
        return array_intersect_key($a,array_flip(['id','user_id','case_id','version_id','case_title','attempt_no','state','revision','draft','active_request','initial_at','submitted_at','last_section','last_activity','created_at','collection_closed_at','allow_late']));
    }
    public function access(array $u,string $id,bool $write=false): array {
        $a=$this->db->one('SELECT a.*, c.title case_title,c.status case_status,c.stop_access,c.practice,c.test case_test,c.collection_closed_at,s.allow_late, s.active assigned FROM applications a JOIN cases c ON c.id=a.case_id JOIN assignments s ON s.case_id=a.case_id AND s.user_id=a.user_id WHERE a.id=?',[$id]);
        demand((bool)$a,'Uygulama bulunamadı',404);
        if($u['role']==='researcher')Scope::application($this->db,$u,$id);
        if($u['role']!=='researcher'){demand($a['user_id']===$u['id'],'Bu uygulamaya erişemezsiniz',403);demand((bool)$a['assigned']&&!$a['stop_access']&&in_array($a['case_status'],['active','closed'],true),'Vaka erişime kapalı',403);}
        if($write)demand($u['role']==='student'&&$a['state']!=='submitted'&&!Scope::collectionClosed($a),'Bu çalışma salt okunur veya veri toplama kapalı',409);
        return $a;
    }
    public function start(array $u,string $case): array {
        demand($u['role']==='student','Öğrenci hesabı gerekli',403);
        return self::studentApplication($this->db->tx(function()use($u,$case){
            // Lock the assignment even before an application exists (MySQL race prevention).
            $s=$this->db->one('SELECT * FROM assignments WHERE user_id=? AND case_id=?'.($this->db->sqlite()?'':' FOR UPDATE'),[$u['id'],$case]);demand($s&&(bool)$s['active'],'Vaka atanmadı',403);
            $c=$this->db->one('SELECT * FROM cases WHERE id=?',[$case]);$existing=$this->db->one('SELECT * FROM applications WHERE user_id=? AND case_id=? ORDER BY attempt_no DESC LIMIT 1',[$u['id'],$case]);
            if($existing)return $this->access($u,$existing['id']);
            demand($c&&$c['status']==='active'&&!$c['stop_access'],'Yeni başlangıç kapalı',403);
            $a=['id'=>uid(),'user_id'=>$u['id'],'case_id'=>$case,'version_id'=>$c['current_version'],'state'=>'initial','revision'=>0,'draft'=>js(Rules::draft([])),'created_at'=>now()];$this->db->insert('applications',$a);return $this->db->one('SELECT * FROM applications WHERE id=?',[$a['id']]);
        }));
    }
    public function view(array $u,string $id): array {
        $a=$this->access($u,$id);$v=$this->db->one('SELECT * FROM case_versions WHERE id=?',[$a['version_id']]);
        if($a['state']!=='submitted'){
            $current=$this->db->one('SELECT v.materials,v.quiz FROM cases c JOIN case_versions v ON v.id=c.current_version WHERE c.id=?',[$a['case_id']]);
            if($current){
                if($current['materials']!==null&&$current['materials']!=='')$v['materials']=$current['materials'];
                if($current['quiz']!==null&&$current['quiz']!=='')$v['quiz']=$current['quiz'];
            }
        }
        $result=['application'=>$a,'version'=>['id'=>$v['id'],'version'=>$v['version'],'body'=>$v['body'],'instructions'=>$v['instructions'],'materials'=>$v['materials']?:'{}','quiz'=>$v['quiz']?:'[]'], 'messages'=>$this->db->all('SELECT id,seq,role,content,status,created_at FROM messages WHERE app_id=? ORDER BY seq',[$id]),'snapshots'=>$this->db->all('SELECT * FROM snapshots WHERE app_id=?',[$id])];
        $result['forum_participation']=['before'=>0,'after'=>0];foreach($this->db->all('SELECT f.phase,COUNT(*) n FROM forum_posts p JOIN case_forums f ON f.id=p.forum_id WHERE p.app_id=? GROUP BY f.phase',[$id]) as $count)$result['forum_participation'][$count['phase']]=(int)$count['n'];
        if($u['role']==='researcher'){
            foreach(['events','draft_revisions','ai_requests','analysis_runs','reports','research_notes'] as $t)$result[$t]=$this->db->all('SELECT * FROM '.$t.' WHERE app_id=?'.($t==='analysis_runs'?' ORDER BY created_at,id':''),[$id]);
            foreach($result['analysis_runs'] as &$reviewRun)$reviewRun['review_version']=Review::version($this->db,$reviewRun['id']);unset($reviewRun);
            $result['review_questions']=Forum::reviewQuestions($this->db,$a);$result['forum_activity']=(new Forum($this))->research($u,$id);$result['research']=(new Research($this))->context($u,$a['case_id']);$result['forum_posts']=array_merge($result['forum_activity']['before']['own_posts'],$result['forum_activity']['after']['own_posts']);$result['server_events']=$this->db->all('SELECT id,action,target,detail,created_at FROM audit WHERE target=? ORDER BY created_at,id',[$id]);$forumMode=(obj($a['draft'])['response_mode']??'')==='forum';
            $result['labels']=$this->db->all('SELECT l.* FROM message_labels l JOIN messages m ON m.id=l.message_id WHERE m.app_id=?',[$id]);
            $result['label_reviews']=$this->db->all('SELECT l.* FROM label_reviews l JOIN messages m ON m.id=l.message_id WHERE m.app_id=? ORDER BY l.created_at',[$id]);
            $result['steps']=$this->db->all('SELECT s.* FROM analysis_steps s JOIN analysis_runs r ON r.id=s.run_id WHERE r.app_id=? ORDER BY s.created_at,s.step,s.attempt',[$id]);
            $result['decisions']=$this->db->all('SELECT d.* FROM decisions d JOIN analysis_steps s ON s.id=d.step_id JOIN analysis_runs r ON r.id=s.run_id WHERE r.app_id=? ORDER BY d.created_at,d.id',[$id]);
            $result['ai_attempts']=$this->db->all('SELECT t.* FROM ai_attempts t JOIN ai_requests r ON r.id=t.request_id WHERE r.app_id=? ORDER BY t.started_at,t.id',[$id]);$result['label_batches']=$this->db->all("SELECT id,detail,created_at FROM audit WHERE target=? AND action='message_labels_ai' ORDER BY created_at,id",[$id]);$result['events']=array_map(fn($event)=>EventLabels::describe($event,$forumMode),$result['events']);$result['navigation']=Navigation::build($result['events'],$a['submitted_at'],$forumMode);$result['timing']=Telemetry::visits($result['events']);$result['messages']=$this->db->all('SELECT id,app_id,request_id,seq,role,content,status,created_at FROM messages WHERE app_id=? ORDER BY seq',[$id]);$navigationDefinitions=$this->db->all("SELECT id,name FROM definitions WHERE owner_id=? AND family='label'",[$u['id']]);$result['navigation']['visits']=Navigation::labelVisits($result['navigation']['visits'],$result,$navigationDefinitions);$result['navigation']['activities']=Navigation::activities($result['navigation']['visits'],$result,$navigationDefinitions);
        }else{$result['requests']=$this->db->all('SELECT id,client_key,status,started_at,completed_at,error FROM ai_requests WHERE app_id=? ORDER BY started_at',[$id]);$result['reports']=$this->db->all('SELECT id,version,published_at FROM reports WHERE app_id=? AND approved_at IS NOT NULL AND published_at IS NOT NULL AND EXISTS(SELECT 1 FROM cases c JOIN assignments ass ON ass.case_id=c.id AND ass.user_id=? WHERE c.id=? AND c.collection_closed_at IS NOT NULL AND ass.allow_late=0)',[$id,$u['id'],$a['case_id']]);}
        if($u['role']!=='researcher'){
            $latest=$this->db->one('SELECT id,body FROM reports WHERE app_id=? ORDER BY version DESC LIMIT 1',[$id]);
            if($latest&&(obj($latest['body'])['review_version']??1)>=2)$result['reports']=array_values(array_filter($result['reports'],fn($r)=>$r['id']===$latest['id']));
        }
        $result['attempts']=$this->db->all('SELECT id,attempt_no,state,submitted_at FROM applications WHERE user_id=? AND case_id=? ORDER BY attempt_no DESC',[$a['user_id'],$a['case_id']]);
        if($u['role']!=='researcher')$result['application']=self::studentApplication($a);
        return $result;
    }
    public function save(array $u,string $id,array $p,string $action='save'): array {
        $this->access($u,$id);demand($u['role']==='student','Öğrenci hesabı gerekli',403);
        return self::studentApplication($this->db->tx(function()use($u,$id,$p,$action){$a=$this->db->lock($id);
            if(($action==='initial'&&$a['initial_at'])||($action==='submit'&&$a['submitted_at']))return $a;
            if($action==='initial'||$action==='submit')demand(!Scope::collectionClosed($this->access($u,$id)),'Bu vakada veri toplama kapalı',409);
            demand($a['state']!=='submitted','Teslim edilmiş çalışma değişmez',409);
            demand((int)($p['revision']??-1)===(int)$a['revision'],'Sürüm çakışması. Metninizi kopyalayın ve yeniden yükleyin.',409);
            $d=Rules::draft($p['draft']??[]);$old=obj($a['draft']);
            if(Scope::collectionClosed($this->access($u,$id))){
                demand($action==='save','Bu vakada veri toplama kapalı',409);
                foreach(['knowledge','confidence','difficulty','severity','problem','decision','reason','final_decision','final_reason','reflection','question','final_confidence','final_difficulty','final_severity'] as $k){
                    demand(($d[$k]??null)===($old[$k]??null),'Veri toplama açılmadan bu alanlar düzenlenemez',409);
                }
            }
            if(($old['response_mode']??'')==='forum')demand(($d['response_mode']??'')==='forum','Forum yanıt düzeni değiştirilemez',409);
            if($a['initial_at'])foreach(['knowledge','confidence','difficulty','severity','problem','decision','reason'] as $k)demand($d[$k]===$old[$k],'Başlangıç ve profil kilitli',409);
            if(!$a['initial_at'])foreach(['final_decision','final_reason','reflection','final_confidence','final_difficulty','final_severity','question'] as $k)demand($d[$k]===($old[$k]??null),'Önce başlangıcı kesinleştirin',409);
            if($a['initial_at'])RichText::lock($old,$d,['problem','decision','reason'],'Başlangıç biçimlendirmesi kilitli');
            else RichText::lock($old,$d,['final_decision','final_reason','reflection','question'],'Önce başlangıcı kesinleştirin');
            $forumPosts=null;
            if($action==='initial'){Rules::initial($d);if(($d['response_mode']??'')==='forum'){$forumPosts=Forum::contributions($this->db,$id,'before');demand((bool)$forumPosts,'Genel Tartışma Forumu (Önce) alanında en az bir görüş veya yanıt paylaşın');}}
            if($action==='submit'){demand((bool)$a['initial_at'],'Başlangıç kilitlenmeli',409);demand(!$a['active_request'],'AI yanıtı sürerken teslim yapılamaz',409);Rules::final($d);}
            if($action==='submit'&&($d['response_mode']??'')==='forum'){$forumPosts=Forum::contributions($this->db,$id,'after');demand((bool)$forumPosts,'Genel Tartışma Forumu (Sonra) alanında nihai görüşünüzü paylaşın');}
            $rev=(int)$a['revision'];if($d!==$old){$rev++;$this->db->insert('draft_revisions',['id'=>uid(),'app_id'=>$id,'revision'=>$rev,'previous_revision'=>$a['revision'],'body'=>js($d),'created_at'=>now()]);}
            $state=$action==='initial'?'working':($action==='submit'?'submitted':$a['state']);
            $this->db->q('UPDATE applications SET draft=?,revision=?,state=?,initial_at=?,submitted_at=?,last_activity=? WHERE id=?',[js($d),$rev,$state,$action==='initial'?now():$a['initial_at'],$action==='submit'?now():$a['submitted_at'],now(),$id]);
            if($action!=='save'){$body=$action==='initial'?array_intersect_key($d,array_flip(['knowledge','confidence','difficulty','severity','problem','decision','reason'])):array_intersect_key($d,array_flip(['final_decision','final_reason','final_confidence','final_difficulty','final_severity','reflection']));if($forumPosts!==null){$body['response_mode']='forum';$body['forum_posts']=$forumPosts;}$rich=array_intersect_key($d['rich_text']??[],$body);if($rich)$body['rich_text']=$rich;$this->db->insert('snapshots',['id'=>uid(),'app_id'=>$id,'kind'=>$action,'body'=>js($body),'revision'=>$rev,'created_at'=>now()]);}
            $this->db->audit($u['id'],$action,$id,'',['revision'=>$rev]);return $this->db->one('SELECT * FROM applications WHERE id=?',[$id]);
        }));
    }
    public function chat(array $u,string $id,array $p): array {
        $this->access($u,$id,true);$text=trim($p['text']??'');$retry=$p['retry_request']??null;demand($retry||($text!==''&&strlen($text)<=16000),'Mesaj boş veya çok uzun');$key=$p['key']??'';demand(is_string($key)&&strlen($key)>=16&&strlen($key)<=100,'İstek kimliği gerekli');
        $reserved=$this->db->tx(function()use($u,$id,$text,$key,$retry){$a=$this->db->lock($id);$r=$this->db->one('SELECT * FROM ai_requests WHERE app_id=? AND client_key=?',[$id,$key]);if($r&&!$retry){
                $message=$this->db->one("SELECT content FROM messages WHERE app_id=? AND request_id=? AND role='user'",[$id,$r['id']]);
                demand($message&&$message['content']===$text,'Bu istek kimliği başka bir mesaja ait. Güncel durumu yenileyip mesajınızı yeniden gönderin.',409);
                return ['existing'=>$r];
            }
            demand(!Scope::collectionClosed($this->access($u,$id)),'Bu vakada veri toplama kapalı',409);
            demand($a['initial_at']&&$a['state']!=='submitted','AI erişimi kapalı',409);demand(!$a['active_request'],'Bir AI yanıtı zaten sürüyor',409);
            if($retry){demand($r&&$r['id']===$retry&&$r['status']==='failed','Yalnız başarısız istek açıkça yeniden denenebilir',409);$r['attempt']=uid();$r['status']='running';$r['started_at']=now();$this->db->q("UPDATE ai_requests SET attempt=?,status='running',started_at=?,completed_at=NULL,error=NULL WHERE id=?",[$r['attempt'],$r['started_at'],$r['id']]);$this->db->insert('ai_attempts',['id'=>$r['attempt'],'request_id'=>$r['id'],'status'=>'running','started_at'=>now()]);$this->db->q('UPDATE applications SET active_request=? WHERE id=?',[$r['id'],$id]);return ['request'=>$r];}
            $count=$this->db->one('SELECT COUNT(*) n FROM ai_requests WHERE app_id=? AND started_at>?',[$id,gmdate('Y-m-d\TH:i:s\Z',time()-60)])['n'];demand($count<10,'AI hız sınırı',429);
            $rid=uid();$attempt=uid();$seq=(int)($this->db->one('SELECT MAX(seq) n FROM messages WHERE app_id=?',[$id])['n']??0)+1;
            $this->db->insert('messages',['id'=>uid(),'app_id'=>$id,'seq'=>$seq,'role'=>'user','content'=>$text,'status'=>'completed','request_id'=>$rid,'created_at'=>now()]);
            $v=$this->db->one('SELECT * FROM case_versions WHERE id=?',[$a['version_id']]);$payload=Ai::chatPayload($v,$this->db->all("SELECT * FROM messages WHERE app_id=? AND status='completed' ORDER BY seq",[$id]));
            $r=['id'=>$rid,'app_id'=>$id,'client_key'=>$key,'attempt'=>$attempt,'status'=>'running','model'=>$this->config['ai']['model'],'directive'=>Ai::DIRECTIVE,'payload'=>js($payload),'started_at'=>now()];$this->db->insert('ai_requests',$r);$this->db->insert('ai_attempts',['id'=>$attempt,'request_id'=>$rid,'status'=>'running','started_at'=>now()]);$this->db->q('UPDATE applications SET active_request=? WHERE id=?',[$rid,$id]);return ['request'=>$r];
        });
        if(isset($reserved['existing']))return $reserved['existing'];$r=$reserved['request'];
        // No session or transaction is held across this call. Browser uses a separate fetch.
        try{$out=(new Ai($this->config))->call(obj($r['payload']));$status=$out['status'];$error=null;}
        catch(Throwable $e){$out=['content'=>''];$status='failed';$error='provider_failed';}
        return $this->db->tx(function()use($id,$r,$out,$status,$error){$a=$this->db->lock($id);$fresh=$this->db->one('SELECT * FROM ai_requests WHERE id=?',[$r['id']]);if($a['active_request']!==$r['id']||$fresh['attempt']!==$r['attempt']||$fresh['status']!=='running')return $fresh;
            if($out['content']!==''){$seq=(int)$this->db->one('SELECT MAX(seq) n FROM messages WHERE app_id=?',[$id])['n']+1;$this->db->insert('messages',['id'=>uid(),'app_id'=>$id,'seq'=>$seq,'role'=>'assistant','content'=>$out['content'],'status'=>$status,'request_id'=>$r['id'],'created_at'=>now()]);}
            $this->db->q('UPDATE ai_requests SET status=?,completed_at=?,error=? WHERE id=?',[$status,now(),$error,$r['id']]);$this->db->q('UPDATE ai_attempts SET status=?,completed_at=?,error=? WHERE id=?',[$status,now(),$error,$r['attempt']]);$this->db->q('UPDATE applications SET active_request=NULL WHERE id=?',[$id]);return $this->db->one('SELECT * FROM ai_requests WHERE id=?',[$r['id']]);
        });
    }
}
