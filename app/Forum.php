<?php
declare(strict_types=1);

final class Forum {
    public const QUESTIONS=['before'=>['Bu vakadaki temel problemi nasıl değerlendiriyorsunuz?','Kararınız nedir?','Bu kararı neden veriyorsunuz?'],'after'=>['Nihai kararınız nedir?']];
    public function __construct(private App $app) {}

    public static function contributions(Db $db,string $appId,string $phase): array {
        return $db->all('SELECT p.id,p.parent_id,p.body,p.rich_text,p.created_at FROM forum_posts p JOIN case_forums f ON f.id=p.forum_id WHERE p.app_id=? AND f.phase=? ORDER BY p.created_at,p.id',[$appId,$phase]);
    }

    public static function answer(Db $db,array $a,string $phase): string {
        $snapshot=$db->one('SELECT body FROM snapshots WHERE app_id=? AND kind=?',[$a['id'],$phase==='before'?'initial':'submit']);$body=$snapshot?obj($snapshot['body']):[];
        if(array_key_exists('forum_posts',$body))return implode("\n\n",array_column($body['forum_posts'],'body'));
        $posts=self::contributions($db,$a['id'],$phase);if($posts)return implode("\n\n",array_column($posts,'body'));
        // A student who already finished the old initial form retains that original evidence.
        if($phase==='before'&&$snapshot){$lines=[];foreach(['problem'=>'Temel problem','decision'=>'Karar','reason'=>'Gerekçe'] as $key=>$title)if(trim($body[$key]??'')!=='')$lines[]=$title.': '.$body[$key];return implode("\n",$lines);}
        return '';
    }

    public static function reviewQuestions(Db $db,array $a): array {
        $draft=obj($a['draft']);$out=[];
        if(($draft['response_mode']??'')==='forum'){
            foreach(['before','after'] as $phase)$out[]=['source_id'=>'forum_'.$phase,'section'=>'Genel Tartışma Forumu ('.($phase==='before'?'Önce':'Sonra').')','question'=>implode(' ',self::QUESTIONS[$phase]),'answer'=>self::answer($db,$a,$phase)];
            $out[]=['source_id'=>'reflection','section'=>'Yansıtma','question'=>Review::QUESTIONS[6]['reflection'],'answer'=>$draft['reflection']??''];return $out;
        }
        foreach(Review::QUESTIONS as $step=>$questions)foreach($questions as $key=>$question)$out[]=['source_id'=>$key,'section'=>[3=>'Başlangıç değerlendirmesi',4=>'Nihai değerlendirme',6=>'Yansıtma'][$step],'question'=>$question,'answer'=>$draft[$key]??''];return $out;
    }

    public static function ensure(Db $db,string $caseId): void {
        $tail=$db->sqlite()?' ON CONFLICT(case_id,phase) DO NOTHING':' ON DUPLICATE KEY UPDATE id=id';
        foreach(['before','after'] as $phase)$db->q('INSERT INTO case_forums (id,case_id,phase,created_at) VALUES (?,?,?,?)'.$tail,[uid(),$caseId,$phase,now()]);
    }

    private function board(array $a,string $phase): array {
        demand(in_array($phase,['before','after'],true),'Tartışma aşaması geçersiz');
        $board=$this->app->db->one('SELECT * FROM case_forums WHERE case_id=? AND phase=?',[$a['case_id'],$phase]);
        demand((bool)$board,'Vaka forumları hazırlanamadı. Sayfayı yenileyin.',503);return $board;
    }

    private function exposure(string $appId): ?array {
        return $this->app->db->one("SELECT id,created_at FROM messages WHERE app_id=? AND role='assistant' AND status IN ('completed','partial') ORDER BY seq LIMIT 1",[$appId]);
    }

    private function permission(array $u,array $a,string $phase): array {
        if($u['role']==='researcher')return ['can_read'=>true,'can_post'=>false,'reason'=>'Araştırmacı görünümü · Mesajlar yalnız öğrenciler tarafından gönderilir.'];
        if($phase==='after'&&!$this->exposure($a['id']))return ['can_read'=>false,'can_post'=>false,'reason'=>'Tartışma Forumu (Sonra), bireysel AI sohbetinde bir yanıt aldıktan sonra açılır.'];
        $reason=$a['state']==='submitted'?'Çalışmanız teslim edildi. Tartışmayı okuyabilirsiniz.':(Scope::collectionClosed($a)?'Bu vakada veri toplama kapalı. Tartışmayı okuyabilirsiniz.':($phase==='before'&&$a['initial_at']?'AI öncesi tartışmayı tamamladınız. (Önce) forumu sizin için salt okunurdur.':''));
        return ['can_read'=>true,'can_post'=>$reason==='','reason'=>$reason];
    }

    private function project(array $row,array $u): array {
        $rich=obj($row['rich_text']);
        return ['id'=>$row['id'],'parent_id'=>$row['parent_id'],'author_id'=>$row['user_id'],'author'=>$row['author'],'body'=>$row['body'],'rich_text'=>$rich?:null,'created_at'=>$row['created_at'],'is_own'=>$row['user_id']===$u['id']];
    }

    public function listing(array $u,string $appId,string $phase,string $after=''): array {
        $a=$this->app->access($u,$appId);$board=$this->board($a,$phase);$permission=$this->permission($u,$a,$phase);
        $out=['id'=>$board['id'],'phase'=>$phase,'title'=>'Genel Tartışma Forumu ('.($phase==='before'?'Önce':'Sonra').')','questions'=>self::QUESTIONS[$phase],'posts'=>[],'own_post_count'=>0,'has_more'=>false,'next_after'=>$after]+$permission;
        if(!$permission['can_read'])return $out;
        $out['own_post_count']=(int)$this->app->db->one('SELECT COUNT(*) n FROM forum_posts WHERE forum_id=? AND app_id=?',[$board['id'],$appId])['n'];
        $where='p.forum_id=?';$params=[$board['id']];
        if($after!==''){$cursor=$this->app->db->one('SELECT id,created_at FROM forum_posts WHERE id=? AND forum_id=?',[$after,$board['id']]);demand((bool)$cursor,'Forum sayfa işareti geçersiz');$where.=' AND (p.created_at>? OR (p.created_at=? AND p.id>?))';array_push($params,$cursor['created_at'],$cursor['created_at'],$cursor['id']);}
        $rows=$this->app->db->all('SELECT p.*,u.name author FROM forum_posts p JOIN users u ON u.id=p.user_id WHERE '.$where.' ORDER BY p.created_at,p.id LIMIT 101',$params);
        $out['has_more']=count($rows)>100;if($out['has_more'])array_pop($rows);
        $out['posts']=array_map(fn($row)=>$this->project($row,$u),$rows);
        if($rows)$out['next_after']=$rows[count($rows)-1]['id'];return $out;
    }

    public function post(array $u,string $appId,array $p): array {
        demand($u['role']==='student','Yalnız öğrenciler forum mesajı yazabilir',403);
        $this->app->access($u,$appId);$phase=$p['phase']??'';demand(is_string($phase),'Tartışma aşaması gerekli');
        $body=$p['body']??null;$key=$p['key']??null;$parent=$p['parent_id']??null;
        demand(is_string($body)&&trim($body)!==''&&strlen($body)<=32000&&mb_strlen($body)<=8000,'Mesaj boş olamaz ve en fazla 8.000 karakter olabilir');
        demand(is_string($key)&&preg_match('/^[A-Za-z0-9_-]{16,100}$/D',$key)===1,'Mesaj kimliği geçersiz');
        demand($parent===null||(is_string($parent)&&strlen($parent)>0&&strlen($parent)<=64),'Yanıt verilen mesaj geçersiz');
        $rich=$p['rich_text']??null;
        if($rich!==null){demand(is_array($rich),'Biçimlendirme geçersiz');$rich=RichText::normalize(['reflection'=>$rich],['reflection'=>$body])['reflection'];}
        $richJson=$rich===null?'{}':js($rich);$db=$this->app->db;
        return $db->tx(function()use($db,$u,$appId,$phase,$body,$key,$parent,$richJson){
            $a=$db->lock($appId);demand($a['user_id']===$u['id'],'Bu çalışmaya erişemezsiniz',403);$lock=$db->sqlite()?'':' FOR UPDATE';
            $case=$db->one('SELECT * FROM cases WHERE id=?'.$lock,[$a['case_id']]);
            $assignment=$db->one('SELECT * FROM assignments WHERE case_id=? AND user_id=?'.$lock,[$a['case_id'],$u['id']]);
            demand($assignment&&(bool)$assignment['active']&&!(bool)$case['stop_access']&&in_array($case['status'],['active','closed'],true),'Vaka erişime kapalı',403);
            $a['collection_closed_at']=$case['collection_closed_at'];$a['allow_late']=$assignment['allow_late'];$board=$this->board($a,$phase);
            $old=$db->one('SELECT p.*,u.name author FROM forum_posts p JOIN users u ON u.id=p.user_id WHERE p.app_id=? AND p.forum_id=? AND p.client_key=?',[$appId,$board['id'],$key]);
            if($old){demand($old['body']===$body&&$old['parent_id']===$parent&&$old['rich_text']===$richJson,'Bu mesaj kimliği başka bir mesaja ait',409);return ['post'=>$this->project($old,$u),'duplicate'=>true];}
            $permission=$this->permission($u,$a,$phase);demand($permission['can_post'],$permission['reason'],409);
            if($parent)demand((bool)$db->one('SELECT id FROM forum_posts WHERE id=? AND forum_id=?',[$parent,$board['id']]),'Yalnız aynı forumdaki bir mesaja yanıt verebilirsiniz',422);
            $count=(int)$db->one('SELECT COUNT(*) n FROM forum_posts WHERE app_id=? AND created_at>?',[$appId,gmdate('Y-m-d\TH:i:s\Z',time()-60)])['n'];demand($count<20,'Çok hızlı mesaj gönderiyorsunuz. Biraz bekleyin.',429);
            $post=['id'=>uid(),'forum_id'=>$board['id'],'app_id'=>$appId,'user_id'=>$u['id'],'version_id'=>$a['version_id'],'parent_id'=>$parent,'client_key'=>$key,'body'=>$body,'rich_text'=>$richJson,'created_at'=>now()];$db->insert('forum_posts',$post);
            $exposure=$phase==='after'?$this->exposure($appId):null;
            $db->audit($u['id'],'forum_post',$appId,'',['post_id'=>$post['id'],'case_id'=>$a['case_id'],'phase'=>$phase,'parent_id'=>$parent,'first_ai_message_id'=>$exposure['id']??null,'first_ai_at'=>$exposure['created_at']??null]);
            $post['author']=$u['name'];return ['post'=>$this->project($post,$u),'duplicate'=>false];
        });
    }
}
