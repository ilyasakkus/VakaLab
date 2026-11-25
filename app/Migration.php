<?php
declare(strict_types=1);
final class Migration {
    public static function run(Db $db): void {
        $exists=$db->sqlite()?$db->one("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'"):$db->one("SHOW TABLES LIKE 'schema_migrations'");
        if(!$exists){
            if(!$db->sqlite()){$db->pdo->exec('SET default_storage_engine=InnoDB');$db->pdo->exec('SET NAMES utf8mb4');}
            $db->pdo->exec(file_get_contents(__DIR__.'/../migrations/001.sql'));
            $db->insert('schema_migrations',['version'=>1,'applied_at'=>now()]);
        }
        demand((bool)$db->one('SELECT version FROM schema_migrations WHERE version=1'),'Yarım kalmış migration: şemayı inceleyin');
        if(!$db->one('SELECT version FROM schema_migrations WHERE version=2')){
            $apply=function()use($db){
                foreach(explode(';',file_get_contents(__DIR__.'/../migrations/002.sql')) as $sql)if(trim($sql)!=='')$db->pdo->exec($sql);
                $first=$db->one("SELECT id FROM users WHERE role='researcher' ORDER BY created_at,id LIMIT 1");
                if($first){
                    foreach(['cases','definitions'] as $table)$db->q('UPDATE '.$table.' SET owner_id=? WHERE owner_id IS NULL',[$first['id']]);
                    $db->q("UPDATE users SET owner_id=? WHERE role='student' AND owner_id IS NULL",[$first['id']]);
                }
                // Preserve any historical global closure as individual case closures.
                $closed=$db->one('SELECT closed_at FROM study WHERE id=1')['closed_at'];
                if($closed)$db->q('UPDATE cases SET collection_closed_at=?',[$closed]);
                $db->insert('schema_migrations',['version'=>2,'applied_at'=>now()]);
            };
            if($db->sqlite())$db->tx($apply);else $apply(); // MySQL DDL requires prior backup; never auto-retry a partial migration.
        }
        if(!$db->one('SELECT version FROM schema_migrations WHERE version=3')){
            if($db->sqlite()){
                // Rebuild only the parent table; dependent records keep their original IDs.
                $db->pdo->exec('PRAGMA foreign_keys=OFF');
                try{$db->tx(function()use($db){
                    $schema=$db->one("SELECT sql FROM sqlite_master WHERE type='table' AND name='applications'")['sql'];
                    $schema=str_replace('CREATE TABLE applications','CREATE TABLE applications_new',$schema);
                    $schema=str_replace('UNIQUE(user_id,case_id)',"attempt_no INT NOT NULL DEFAULT 1, UNIQUE(user_id,case_id,attempt_no)",$schema);
                    $db->pdo->exec($schema);
                    $columns=implode(',',array_column($db->all('PRAGMA table_info(applications)'),'name'));
                    $db->pdo->exec('INSERT INTO applications_new ('.$columns.') SELECT '.$columns.' FROM applications');
                    $db->pdo->exec('DROP TABLE applications');
                    $db->pdo->exec('ALTER TABLE applications_new RENAME TO applications');
                    demand(!$db->all('PRAGMA foreign_key_check'),'Deneme migration bağlantı denetimi başarısız');
                    $db->insert('schema_migrations',['version'=>3,'applied_at'=>now()]);
                });}finally{$db->pdo->exec('PRAGMA foreign_keys=ON');}
            }else{
                // A single ALTER keeps the old unique index until its replacement is ready.
                $indexes=[];foreach($db->all('SHOW INDEX FROM applications') as $index)if(!(int)$index['Non_unique'])$indexes[$index['Key_name']][(int)$index['Seq_in_index']]=$index['Column_name'];
                $old=null;foreach($indexes as $name=>$columns){ksort($columns);if(array_values($columns)===['user_id','case_id'])$old=$name;}
                demand($old!==null,'Uygulama benzersiz indeksi bulunamadı');
                $db->pdo->exec('ALTER TABLE applications ADD COLUMN attempt_no INT NOT NULL DEFAULT 1, ADD UNIQUE KEY application_attempt (user_id,case_id,attempt_no), DROP INDEX `'.str_replace('`','``',$old).'`');
                $db->insert('schema_migrations',['version'=>3,'applied_at'=>now()]);
            }
        }
        self::forums($db);
        self::research($db);
        self::materials($db);
    }

    // Additive and retryable: safe on existing installs and concurrent first requests.
    public static function forums(Db $db): void {
        if($db->one('SELECT version FROM schema_migrations WHERE version=4'))return;
        demand((bool)$db->one('SELECT version FROM schema_migrations WHERE version=3'),'Önce mevcut veritabanı migration işlemlerini tamamlayın',503);
        $apply=function()use($db){
            if($db->one('SELECT version FROM schema_migrations WHERE version=4'))return;
            foreach(explode(';',file_get_contents(__DIR__.'/../migrations/004.sql')) as $sql)if(trim($sql)!=='')$db->pdo->exec($sql);
            foreach($db->all('SELECT id FROM cases') as $case)Forum::ensure($db,$case['id']);
            $tail=$db->sqlite()?' ON CONFLICT(version) DO NOTHING':' ON DUPLICATE KEY UPDATE version=version';
            $db->q('INSERT INTO schema_migrations (version,applied_at) VALUES (4,?)'.$tail,[now()]);
        };
        if($db->sqlite())$db->tx($apply);else $apply();
    }

    public static function research(Db $db): void {
        if($db->one('SELECT version FROM schema_migrations WHERE version=5'))return;
        demand((bool)$db->one('SELECT version FROM schema_migrations WHERE version=4'),'Önce forum tablolarını hazırlayın',503);
        $apply=function()use($db){
            if($db->one('SELECT version FROM schema_migrations WHERE version=5'))return;
            foreach(explode(';',file_get_contents(__DIR__.'/../migrations/005.sql')) as $sql)if(trim($sql)!=='')$db->pdo->exec($sql);
            $tail=$db->sqlite()?' ON CONFLICT(version) DO NOTHING':' ON DUPLICATE KEY UPDATE version=version';$db->q('INSERT INTO schema_migrations (version,applied_at) VALUES (5,?)'.$tail,[now()]);
        };
        if($db->sqlite())$db->tx($apply);else $apply();
    }

    public static function materials(Db $db): void {
        if($db->one('SELECT version FROM schema_migrations WHERE version=6'))return;
        $apply=function()use($db){
            if($db->one('SELECT version FROM schema_migrations WHERE version=6'))return;
            if($db->sqlite()){
                $cols=array_column($db->all('PRAGMA table_info(case_versions)'),'name');
                if(!in_array('materials',$cols,true))$db->pdo->exec('ALTER TABLE case_versions ADD COLUMN materials TEXT');
                if(!in_array('quiz',$cols,true))$db->pdo->exec('ALTER TABLE case_versions ADD COLUMN quiz TEXT');
            }else{
                $cols=array_column($db->all("SHOW COLUMNS FROM case_versions"),'Field');
                if(!in_array('materials',$cols,true))$db->pdo->exec('ALTER TABLE case_versions ADD COLUMN materials LONGTEXT');
                if(!in_array('quiz',$cols,true))$db->pdo->exec('ALTER TABLE case_versions ADD COLUMN quiz LONGTEXT');
            }
            $tail=$db->sqlite()?' ON CONFLICT(version) DO NOTHING':' ON DUPLICATE KEY UPDATE version=version';
            $db->q('INSERT INTO schema_migrations (version,applied_at) VALUES (6,?)'.$tail,[now()]);
        };
        if($db->sqlite())$db->tx($apply);else $apply();
    }
}
