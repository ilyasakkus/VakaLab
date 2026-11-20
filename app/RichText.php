<?php
declare(strict_types=1);

final class RichText {
    public const FIELDS=['problem','decision','reason','final_decision','final_reason','reflection','question'];
    public const FORMATS=['bold','italic','underline','strike','header','size','font','color','background','list','indent','align','blockquote','link'];

    public static function normalize(array $rich,array $text): array {
        demand(!array_diff(array_keys($rich),self::FIELDS),'Biçimlendirme alanı geçersiz');$out=[];
        foreach(self::FIELDS as $field){
            if(!array_key_exists($field,$rich))continue;$doc=$rich[$field];
            demand(is_array($doc)&&array_keys($doc)===['ops']&&is_array($doc['ops'])&&array_is_list($doc['ops'])&&count($doc['ops'])>0&&count($doc['ops'])<=2000,'Editör içeriği geçersiz veya çok uzun');
            $ops=[];$plain='';
            foreach($doc['ops'] as $op){
                demand(is_array($op)&&!array_diff(array_keys($op),['insert','attributes'])&&isset($op['insert'])&&is_string($op['insert'])&&$op['insert']!=='','Editörde yalnız metin kullanılabilir');
                $plain.=$op['insert'];demand(strlen($plain)<=60001,'Metin sınırı aşıldı');$clean=['insert'=>$op['insert']];
                $attrs=$op['attributes']??[];demand(is_array($attrs)&&!array_diff(array_keys($attrs),self::FORMATS),'Editör biçimi geçersiz');$valid=[];
                foreach(self::FORMATS as $format){
                    if(!array_key_exists($format,$attrs))continue;$value=$attrs[$format];
                    $allowed=match($format){
                        'bold','italic','underline','strike','blockquote'=>$value===true,
                        'header'=>is_int($value)&&$value>=1&&$value<=3,
                        'indent'=>is_int($value)&&$value>=1&&$value<=8,
                        'size'=>in_array($value,['small','large','huge'],true),
                        'font'=>in_array($value,['serif','monospace'],true),
                        'list'=>in_array($value,['ordered','bullet','checked','unchecked'],true),
                        'align'=>in_array($value,['center','right','justify'],true),
                        'color','background'=>is_string($value)&&preg_match('/^#[0-9a-fA-F]{6}$/D',$value)===1,
                        'link'=>is_string($value)&&strlen($value)<=2000&&preg_match('~^(?:https?://|mailto:)[^\s<>"\x00-\x1f]+$~iD',$value)===1,
                        default=>false
                    };
                    demand($allowed,'Editör biçim değeri geçersiz');$valid[$format]=$value;
                }
                if($valid)$clean['attributes']=$valid;$ops[]=$clean;
            }
            demand(str_ends_with($plain,"\n")&&substr($plain,0,-1)===($text[$field]??''),'Editör metni ile yanıt uyuşmuyor');
            $out[$field]=['ops'=>$ops];
        }
        demand(strlen(js($out))<=500000,'Biçimlendirme içeriği çok uzun');return $out;
    }

    public static function lock(array $before,array $after,array $fields,string $message): void {
        foreach($fields as $field)demand(($before['rich_text'][$field]??null)===($after['rich_text'][$field]??null),$message,409);
    }
}
