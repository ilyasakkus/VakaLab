<?php
declare(strict_types=1);

final class Preview {
    public function __construct(private App $app) {}

    public function create(array $researcher,string $caseId): array {
        $db=$this->app->db;
        // Copy into a separate, inaccessible workspace. The source case and real
        // students never receive assignments, answers, events or test attempts.
        $result=$db->tx(function()use($db,$researcher,$caseId){
            $case=Scope::owned($db,$researcher,'cases',$caseId);
            $version=$db->one('SELECT * FROM case_versions WHERE id=?',[$case['current_version']]);
            demand((bool)$version,'Vaka sürümü bulunamadı',404);
            $userId=uid();$copyId=uid();$versionId=uid();$appId=uid();
            $db->insert('users',['id'=>$userId,'login'=>'PREVIEW-'.$userId,'name'=>'Öğrenci önizlemesi','password'=>password_hash(uid(),PASSWORD_DEFAULT),'role'=>'student','status'=>'active','owner_id'=>$userId,'metadata'=>js(['preview_owner'=>$researcher['id'],'source_case'=>$caseId]),'test'=>1,'created_at'=>now()]);
            $db->insert('cases',['id'=>$copyId,'owner_id'=>$userId,'title'=>$case['title'],'position'=>$case['position'],'status'=>'active','practice'=>1,'test'=>1,'stop_access'=>0,'current_version'=>$versionId]);
            $db->insert('case_versions',['id'=>$versionId,'case_id'=>$copyId,'version'=>$version['version'],'body'=>$version['body'],'instructions'=>$version['instructions'],'notes'=>'','created_at'=>now()]);
            Forum::ensure($db,$copyId);
            $db->insert('assignments',['id'=>uid(),'user_id'=>$userId,'case_id'=>$copyId,'active'=>1]);
            $db->insert('applications',['id'=>$appId,'user_id'=>$userId,'case_id'=>$copyId,'version_id'=>$versionId,'state'=>'initial','revision'=>0,'draft'=>js(Rules::draft([])),'excluded'=>1,'exclusion_reason'=>'Yönetici öğrenci önizlemesi','created_at'=>now()]);
            $db->audit($researcher['id'],'student_preview',$caseId,'',['source_case_id'=>$caseId,'version'=>$version['version']]);
            return ['user_id'=>$userId,'app_id'=>$appId,'case_id'=>$copyId,'source_case_id'=>$caseId];
        });
        $token=uid();$_SESSION['previews'][$token]=$result;
        // Tokens are only valid in this authenticated researcher's session.
        if(count($_SESSION['previews'])>20)array_shift($_SESSION['previews']);
        return ['token'=>$token,'app_id'=>$result['app_id']];
    }

    public function user(array $researcher,string $token,string $op,string $appId): array {
        Auth::researcher($researcher);
        demand(in_array($op,['me','view','save','initial','submit','chat','forum','forum_post','events'],true),'Bu işlem öğrenci önizlemesinde kullanılamaz',403);
        $preview=$_SESSION['previews'][$token]??null;
        demand((bool)$preview,'Önizleme sona erdi. Yönetim panelinden yeniden açın.',403);
        demand($op==='me'||$appId===$preview['app_id'],'Bu çalışma önizlemeye ait değil',403);
        $u=$this->app->db->one('SELECT * FROM users WHERE id=?',[$preview['user_id']]);
        demand($u&&$u['role']==='student'&&(bool)$u['test']&&(obj($u['metadata'])['preview_owner']??null)===$researcher['id'],'Önizlemeye erişemezsiniz',403);
        return $u;
    }
}
