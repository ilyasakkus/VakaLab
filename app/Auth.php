<?php
declare(strict_types=1);
final class Auth {
    public function __construct(private Db $db) {}
    public function session(): void {
        if(session_status()===PHP_SESSION_ACTIVE)return;
        session_name('vakalab'); session_set_cookie_params(['lifetime'=>0,'path'=>(cfg()['base_path']?:'').'/','secure'=>cfg()['https'],'httponly'=>true,'samesite'=>'Strict']);session_start();
        if(!isset($_SESSION['csrf']))$_SESSION['csrf']=uid();
    }
    public function user(): array {
        $this->session();$id=$_SESSION['uid']??'';$last=$_SESSION['last']??0;
        demand(time()-$last<7200,'Oturum sona erdi',401);
        $u=$this->db->one('SELECT * FROM users WHERE id=?',[$id]);demand($u&&$u['status']==='active','Giriş gerekli / hesap erişime kapalı',401);
        demand(hash_equals(hash('sha256',$u['password']),$_SESSION['credentials']??''),'Şifreniz değişti. Yeniden giriş yapın.',401);
        $_SESSION['last']=time();return $u;
    }
    public function csrf(): void {$this->session();demand(hash_equals($_SESSION['csrf'],$_SERVER['HTTP_X_CSRF_TOKEN']??''),'CSRF doğrulanamadı',403);}
    public function login(string $login,string $password): array {
        $this->session();$login=trim($login);$key=preg_match('/^[0-9]+$/D',$login)?ltrim($login,'0'):$login;$this->throttle('login|'.$key,15,'Çok fazla giriş denemesi; 15 dakika bekleyin');
        $u=$this->db->one('SELECT * FROM users WHERE login=?',[$login]);
        if(!$u&&preg_match('/^[0-9]+$/D',$login))$u=$this->db->one("SELECT * FROM users WHERE login=? AND role='student'",[ltrim($login,'0')]);
        $hash=$u['password']??'$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.';
        demand(password_verify($password,$hash)&&$u&&$u['status']==='active','Giriş bilgileri geçersiz veya hesap kapalı',401);
        $this->signIn($u);return $u;
    }
    private function throttle(string $scope,int $limit,string $message): void {
        $key=hash('sha256',($_SERVER['REMOTE_ADDR']??'cli').'|'.$scope);
        $allowed=$this->db->tx(function()use($key,$limit){$r=$this->db->one('SELECT * FROM rate_limits WHERE id=?'.($this->db->sqlite()?'':' FOR UPDATE'),[$key]);$n=($r&&time()-(int)$r['window_start']<900)?(int)$r['count']+1:1;if($r)$this->db->q('UPDATE rate_limits SET count=?,window_start=? WHERE id=?',[$n,$n===1?time():$r['window_start'],$key]);else $this->db->insert('rate_limits',['id'=>$key,'count'=>1,'window_start'=>time()]);return $n<=$limit;});
        demand($allowed,$message,429);
    }
    private function signIn(array $u): void {
        session_regenerate_id(true);$_SESSION=['uid'=>$u['id'],'credentials'=>hash('sha256',$u['password']),'csrf'=>uid(),'last'=>time(),'telemetry'=>uid()];
    }
    public static function validatePassword(string $password): void {
        demand(!str_contains($password,"\0")&&mb_strlen($password)>=12&&strlen($password)<=72,'Şifre en az 12 karakter, en fazla 72 bayt olmalı');
    }
    public function register(array $p): array {
        $this->session();demand(empty($_SESSION['uid']),'Kayıt oluşturmak için önce çıkış yapın',409);
        $this->throttle('register',10,'Çok fazla kayıt denemesi; 15 dakika bekleyin');
        foreach(['student_no','first_name','last_name','password'] as $key)demand(isset($p[$key])&&is_string($p[$key]),'Öğrenci numarası, ad, soyad ve şifre gerekli');
        $number=trim($p['student_no']);demand(strlen($number)<=100&&preg_match('/^[0-9]+$/D',$number)===1,'Öğrenci numarası yalnız rakamlardan oluşmalı');
        $number=ltrim($number,'0');demand($number!=='','Geçerli bir öğrenci numarası girin');
        $first=trim($p['first_name']);$last=trim($p['last_name']);
        foreach([$first,$last] as $name)demand(preg_match("/^[\p{L}\p{M} .’'\-]+$/uD",$name)===1&&preg_match('/\p{L}/u',$name)===1&&mb_strlen($name)<=90,'Ad ve soyad en fazla 90 karakter olmalı ve harf içermeli');
        self::validatePassword($p['password']);$hash=password_hash($p['password'],PASSWORD_DEFAULT);
        try{$u=$this->db->tx(function()use($number,$first,$last,$hash){
            $owner=cfg()['registration_owner_id']??'';
            $researcher=$owner!==''?$this->db->one("SELECT id FROM users WHERE id=? AND role='researcher' AND status='active'",[$owner]):$this->db->one("SELECT id FROM users WHERE role='researcher' AND status='active' ORDER BY created_at,id LIMIT 1");
            demand((bool)$researcher,'Kayıt şu anda açılamıyor. Yöneticiyle iletişime geçin.',503);
            $normalized=$this->db->sqlite()?"LTRIM(login,'0')":"TRIM(LEADING '0' FROM login)";
            demand(!$this->db->one("SELECT id FROM users WHERE login=? OR (role='student' AND $normalized=?)",[$number,$number]),'Bu öğrenci numarasıyla zaten bir hesap var. Şifrenizi unuttuysanız yöneticinize başvurun.',409);
            $u=['id'=>uid(),'login'=>$number,'name'=>$first.' '.$last,'password'=>$hash,'role'=>'student','status'=>'active','owner_id'=>$researcher['id'],'metadata'=>js(['first_name'=>$first,'last_name'=>$last,'self_registered'=>true]),'test'=>cfg()['env']==='test'?1:0,'created_at'=>now()];
            $this->db->insert('users',$u);$this->db->audit($u['id'],'register',$u['id'],'',['login'=>$number]);return $u;
        });}catch(PDOException $e){if(in_array((string)$e->getCode(),['23000','23505'],true))throw new Fault('Bu öğrenci numarasıyla zaten bir hesap var.',409);throw $e;}
        $this->signIn($u);return $u;
    }
    public static function researcher(array $u): void {demand($u['role']==='researcher','Araştırmacı yetkisi gerekli',403);}
}
