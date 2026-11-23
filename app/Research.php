<?php
declare(strict_types=1);

final class Research {
    public const FRAMEWORK=['relevant','realistic','engaging','challenging','instructional'];
    public function __construct(private App $app) {}
    public static function settings(Db $db,string $caseId): ?array {return $db->one('SELECT * FROM research_settings WHERE case_id=? ORDER BY revision DESC LIMIT 1',[$caseId]);}
    public static function capture(Db $db,array $post): void {
        // Forum::post already holds the case lock (and SQLite's write transaction).
        $case=$db->one('SELECT case_id FROM case_forums WHERE id=?',[$post['forum_id']]);$s=self::settings($db,$case['case_id']);
        $ordinal=(int)($db->one('SELECT MAX(ordinal) n FROM research_post_context WHERE forum_id=?',[$post['forum_id']])['n']??0)+1;
        $db->insert('research_post_context',['post_id'=>$post['id'],'forum_id'=>$post['forum_id'],'ordinal'=>$ordinal,'settings_id'=>$s['id']??null,'week_id'=>$s['week_id']??null,'group_id'=>$s['group_id']??null]);
    }
    public static function active(array $annotations): array {
        $replaced=array_filter(array_column($annotations,'supersedes_id'));return array_values(array_filter($annotations,fn($a)=>!in_array($a['id'],$replaced,true)));
    }
    public static function resolved(array $annotations,string $field,string $id): array {
        $rows=array_values(array_filter(self::active($annotations),fn($a)=>($a[$field]??null)===$id));$round=$rows?max(array_column($rows,'round_no')):null;
        $rows=array_values(array_filter($rows,fn($a)=>(int)$a['round_no']===(int)$round&&$a['status']==='consensus'));$codes=array_unique(array_column($rows,'code'));
        return ['icap_code'=>count($codes)===1?array_values($codes)[0]:null,'coding_status'=>count($codes)>1?'conflict':($codes?'consensus':($round!==null?'pending_consensus':'uncoded')),'coding_round'=>$round,'annotation_ids'=>array_column($rows,'id')];
    }
    public function context(array $u,string $caseId): array {
        Auth::researcher($u);Scope::owned($this->app->db,$u,'cases',$caseId);$db=$this->app->db;
        $dialogues=$db->all('SELECT * FROM research_dialogues WHERE case_id=? ORDER BY created_at,id',[$caseId]);
        foreach($dialogues as &$d)$d['posts']=$db->all('SELECT dp.post_id,dp.position,p.user_id,p.parent_id FROM research_dialogue_posts dp JOIN forum_posts p ON p.id=dp.post_id WHERE dp.dialogue_id=? ORDER BY dp.position',[$d['id']]);unset($d);
        $annotations=$db->all('SELECT a.* FROM research_annotations a LEFT JOIN forum_posts p ON p.id=a.post_id LEFT JOIN case_forums f ON f.id=p.forum_id LEFT JOIN research_dialogues d ON d.id=a.dialogue_id WHERE f.case_id=? OR d.case_id=? ORDER BY a.created_at,a.id',[$caseId,$caseId]);
        $s=self::settings($db,$caseId);$postCodes=[];$dialogueCodes=[];foreach(array_unique(array_filter(array_column($annotations,'post_id'))) as $id)$postCodes[$id]=self::resolved($annotations,'post_id',$id);foreach($dialogues as $d)$dialogueCodes[$d['id']]=self::resolved($annotations,'dialogue_id',$d['id']);return ['settings'=>$s,'group'=>!empty($s['group_id'])?$db->one('SELECT id,name FROM research_groups WHERE id=?',[$s['group_id']]):null,'dialogues'=>$dialogues,'annotations'=>$annotations,'post_codes'=>$postCodes,'dialogue_codes'=>$dialogueCodes];
    }
    public function overview(array $u,array $p=[]): array {
        Auth::researcher($u);$db=$this->app->db;$cases=$db->all('SELECT id,title,position FROM cases WHERE owner_id=? ORDER BY position,id',[$u['id']]);
        foreach($cases as &$case){$case['research']=self::settings($db,$case['id']);$case['post_count']=(int)$db->one('SELECT COUNT(*) n FROM forum_posts p JOIN case_forums f ON f.id=p.forum_id WHERE f.case_id=?',[$case['id']])['n'];}unset($case);
        $out=['cases'=>$cases,'groups'=>$db->all('SELECT * FROM research_groups WHERE owner_id=? ORDER BY name',[$u['id']])];
        if(!empty($p['case_id'])){$cid=$p['case_id'];$out+=$this->context($u,$cid);$out['posts']=$db->all('SELECT p.id,p.app_id,p.user_id,p.parent_id,p.body,p.created_at,f.phase,u.name author,c.ordinal FROM forum_posts p JOIN case_forums f ON f.id=p.forum_id JOIN users u ON u.id=p.user_id LEFT JOIN research_post_context c ON c.post_id=p.id WHERE f.case_id=? ORDER BY p.created_at,c.ordinal,p.id',[$cid]);}
        if(!empty($p['quality'])){$bundle=(new ResearchExport($this->app))->build($u,$p);$out['quality']=$bundle['quality'];$out['networks']=array_map(fn($n)=>['id'=>$n['id'],'case_id'=>$n['case_id'],'week_id'=>$n['week_id'],'group_id'=>$n['group_id'],'phase'=>$n['phase'],'nodes'=>count($n['nodes']),'edges'=>count($n['edges']),'isolates'=>$n['isolates']],$bundle['networks']);}
        return $out;
    }
    public function mutate(array $u,array $p): array {
        Auth::researcher($u);$db=$this->app->db;$action=$p['action']??'';
        if($action==='group')return $db->tx(function()use($db,$u,$p){$name=trim($p['name']??'');demand($name!==''&&mb_strlen($name)<=150,'Grup adı 1–150 karakter olmalı');$old=$db->one('SELECT * FROM research_groups WHERE owner_id=? AND name=?',[$u['id'],$name]);if($old)return $old;$row=['id'=>uid(),'owner_id'=>$u['id'],'name'=>$name,'created_at'=>now()];$db->insert('research_groups',$row);$db->audit($u['id'],'research_group',$row['id']);return $row;});
        if($action==='settings'){
            $case=Scope::owned($db,$u,'cases',$p['case_id']??'');$week=trim($p['week_id']??'');demand($week===''||preg_match('/^[a-zA-Z0-9_-]{1,64}$/D',$week)===1,'Hafta kimliğinde harf, sayı, tire veya alt çizgi kullanın');
            $group=($p['group_id']??'')?:null;if($group)demand((bool)$db->one('SELECT id FROM research_groups WHERE id=? AND owner_id=?',[$group,$u['id']]),'Grup bu çalışma alanına ait değil',403);
            $protocol=trim($p['protocol_version']??'');demand(mb_strlen($protocol)<=100,'Protokol sürümü çok uzun');$framework=$p['framework']??[];demand(is_array($framework)&&!array_diff(array_keys($framework),self::FRAMEWORK),'Vaka geliştirme boyutu geçersiz');foreach($framework as $text)demand(is_string($text)&&mb_strlen($text)<=4000,'Boyut açıklaması çok uzun');
            return $db->tx(function()use($db,$u,$p,$case,$week,$group,$protocol,$framework){$db->one('SELECT id FROM cases WHERE id=?'.($db->sqlite()?'':' FOR UPDATE'),[$case['id']]);$old=self::settings($db,$case['id']);$reason=trim($p['reason']??'');demand(mb_strlen($reason)<=4000,'Gerekçe çok uzun');if($old)demand($reason!=='','Araştırma ayarı değişikliğinin gerekçesini yazın');
                $row=['id'=>uid(),'case_id'=>$case['id'],'revision'=>(int)($old['revision']??0)+1,'week_id'=>$week?:null,'group_id'=>$group,'protocol_version'=>$protocol,'framework'=>js($framework),'reason'=>$reason,'actor'=>$u['id'],'created_at'=>now()];$db->insert('research_settings',$row);$db->audit($u['id'],'research_settings',$case['id'],$reason,['settings_id'=>$row['id'],'revision'=>$row['revision']]);return $row;});
        }
        if($action==='dialogue'){
            $case=Scope::owned($db,$u,'cases',$p['case_id']??'');$ids=$p['post_ids']??[];demand(is_array($ids)&&array_is_list($ids)&&count($ids)>=2&&count($ids)<=100&&!array_diff($ids,array_filter($ids,'is_string'))&&count(array_unique($ids))===count($ids),'Diyalog için 2–100 farklı mesaj seçin');
            $rows=[];foreach($ids as $id){$row=$db->one('SELECT p.*,f.case_id,f.phase FROM forum_posts p JOIN case_forums f ON f.id=p.forum_id WHERE p.id=?',[$id]);demand($row&&$row['case_id']===$case['id'],'Diyalog mesajı bu vakaya ait değil',403);$rows[]=$row;}
            demand(count(array_unique(array_column($rows,'phase')))===1,'Önce ve Sonra mesajları aynı diyaloğa karıştırılamaz');demand(count(array_unique(array_column($rows,'user_id')))>=2,'Diyalog en az iki farklı katılımcı içermeli');
            $seen=[];$roots=0;foreach($rows as $row){if(in_array($row['parent_id'],$ids,true))demand(in_array($row['parent_id'],$seen,true),'Yanıt verilen mesajı diyaloğun sıralamasında önce seçin');else $roots++;$seen[]=$row['id'];}demand($roots===1,'Mesajlar tek bir yanıt zinciri içinde bağlantılı olmalı');
            $label=trim($p['label']??'');$rationale=trim($p['rationale']??'');demand($label!==''&&mb_strlen($label)<=150&&mb_strlen($rationale)>=10&&mb_strlen($rationale)<=5000,'Diyalog adı ve en az 10 karakter inceleme gerekçesi gerekli');
            return $db->tx(function()use($db,$u,$case,$rows,$ids,$label,$rationale){$row=['id'=>uid(),'case_id'=>$case['id'],'phase'=>$rows[0]['phase'],'label'=>$label,'rationale'=>$rationale,'actor'=>$u['id'],'created_at'=>now()];$db->insert('research_dialogues',$row);foreach($ids as $i=>$id)$db->insert('research_dialogue_posts',['dialogue_id'=>$row['id'],'post_id'=>$id,'position'=>$i+1]);$db->audit($u['id'],'research_dialogue',$case['id'],'',['dialogue_id'=>$row['id'],'post_ids'=>$ids]);return $row;});
        }
        if($action==='annotation'){
            $post=($p['post_id']??'')?:null;$dialogue=($p['dialogue_id']??'')?:null;demand(($post===null)!==($dialogue===null),'Bir mesaj veya bir diyalog seçin');
            if($post){$target=$db->one('SELECT p.*,f.case_id FROM forum_posts p JOIN case_forums f ON f.id=p.forum_id WHERE p.id=?',[$post]);demand((bool)$target,'Mesaj bulunamadı',404);}else{$target=$db->one('SELECT * FROM research_dialogues WHERE id=?',[$dialogue]);demand((bool)$target,'Diyalog bulunamadı',404);}Scope::owned($db,$u,'cases',$target['case_id']);
            $code=$p['code']??'';$status=$p['status']??'';$coder=trim($p['coder_label']??'');$round=$p['round_no']??1;$evidence=trim($p['evidence']??'');demand(in_array($code,['P','A','C','I','U'],true)&&in_array($status,['provisional','reviewed','consensus'],true),'Kod veya inceleme durumu geçersiz');demand($coder!==''&&mb_strlen($coder)<=80&&is_int($round)&&$round>=1&&$round<=100&&mb_strlen($evidence)>=10&&mb_strlen($evidence)<=5000,'Kodlayıcı etiketi, 1–100 tur ve en az 10 karakter gerekçe gerekli');
            $proof=($p['evidence_dialogue_id']??'')?:null;if($code==='I'){$proof=$dialogue?:$proof;demand($proof&& !empty($p['interactive_reviewed']),'Interactive kodu için karşılıklı fikir geliştirme diyaloğunu inceleyip doğrulayın');$d=$db->one('SELECT * FROM research_dialogues WHERE id=? AND case_id=?',[$proof,$target['case_id']]);demand((bool)$d,'Kanıt diyaloğu bu vakaya ait değil');if($post)demand((bool)$db->one('SELECT post_id FROM research_dialogue_posts WHERE dialogue_id=? AND post_id=?',[$proof,$post]),'Mesaj kanıt diyaloğunda bulunmuyor');}else $proof=null;
            return $db->tx(function()use($db,$u,$target,$post,$dialogue,$code,$status,$coder,$round,$evidence,$proof,$p){$db->one('SELECT id FROM cases WHERE id=?'.($db->sqlite()?'':' FOR UPDATE'),[$target['case_id']]);$field=$post?'post_id':'dialogue_id';$previous=$db->all('SELECT * FROM research_annotations WHERE '.$field.'=? AND coder_label=? AND round_no=?',[$post?:$dialogue,$coder,$round]);$active=self::active($previous);demand(count($active)<=1,'Kodlama geçmişinde çözülmemiş çakışma var',409);
                $row=['id'=>uid(),'post_id'=>$post,'dialogue_id'=>$dialogue,'evidence_dialogue_id'=>$proof,'coder_label'=>$coder,'round_no'=>$round,'code'=>$code,'status'=>$status,'evidence'=>$evidence,'interactive_reviewed'=>$code==='I'?1:0,'supersedes_id'=>$active[0]['id']??null,'actor'=>$u['id'],'created_at'=>now()];$db->insert('research_annotations',$row);$db->audit($u['id'],'research_annotation',$target['case_id'],'',['annotation_id'=>$row['id'],'post_id'=>$post,'dialogue_id'=>$dialogue,'coder_label'=>$coder,'round_no'=>$round,'status'=>$status]);return $row;});
        }
        throw new Fault('Araştırma işlemi bulunamadı',422);
    }
}
