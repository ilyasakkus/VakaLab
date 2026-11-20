<?php
declare(strict_types=1);

final class AiConfig {
    /** Resolve local configuration and the common hosting/OpenAI variable names. */
    public static function resolve(array $config,?array $environment=null): array {
        $read=static function(string ...$names)use($environment): string {
            foreach($names as $name){$value=$environment!==null?($environment[$name]??''):getenv($name);if(is_string($value)&&trim($value)!=='')return trim($value);}
            return '';
        };
        $a=$config['ai']??[];
        $key=$read('AI_KEY','OPENAI_API_KEY','OPENAI_KEY');if($key==='')$key=trim((string)($a['key']??''));
        $explicit=$read('AI_PROVIDER');$provider=strtolower($explicit!==''?$explicit:(string)($a['provider']??'auto'));
        // A copied example config must not mask a supplied real key. An explicit
        // AI_PROVIDER=mock remains available for deliberate synthetic testing.
        if($provider===''||$provider==='auto'||($provider==='mock'&&$key!==''&&$explicit===''))$provider=$key!==''?'compatible':'mock';
        $endpoint=$read('AI_ENDPOINT','OPENAI_API_URL');
        if($endpoint===''){$base=$read('OPENAI_BASE_URL');if($base!==''){$base=rtrim($base,'/');$endpoint=str_ends_with($base,'/chat/completions')?$base:$base.'/chat/completions';}}
        if($endpoint==='')$endpoint=trim((string)($a['endpoint']??''));
        if($provider==='openrouter'){$provider='compatible';if($read('AI_ENDPOINT','OPENAI_API_URL','OPENAI_BASE_URL')==='')$endpoint='https://openrouter.ai/api/v1/chat/completions';}
        elseif($provider==='openai'){$provider='compatible';if($read('AI_ENDPOINT','OPENAI_API_URL','OPENAI_BASE_URL')==='')$endpoint='https://api.openai.com/v1/chat/completions';}
        if($endpoint==='')$endpoint='https://api.openai.com/v1/chat/completions';
        $model=$read('AI_MODEL','OPENAI_MODEL');if($model==='')$model=trim((string)($a['model']??''));
        // Never send the example's synthetic-v1 ID to a real API or silently
        // select a paid model on the user's behalf.
        if($provider!=='mock'&&$model==='synthetic-v1')$model='';
        $timeout=$read('AI_TIMEOUT');$structured=$read('AI_STRUCTURED_OUTPUTS');
        $config['ai']=array_replace($a,['provider'=>$provider,'key'=>$key,'model'=>$model,'endpoint'=>$endpoint,'mode'=>$a['mode']??'normal','timeout'=>$timeout!==''?max(1,(int)$timeout):(int)($a['timeout']??90),'structured_outputs'=>$structured!==''?filter_var($structured,FILTER_VALIDATE_BOOLEAN):(bool)($a['structured_outputs']??false)]);
        return $config;
    }

    /** Safe display information: credentials are never returned to the browser. */
    public static function status(array $config): array {
        $a=$config['ai'];$host=parse_url($a['endpoint'],PHP_URL_HOST);
        $label=$a['provider']==='mock'?'Sentetik test':($host==='api.openai.com'?'OpenAI':($host==='openrouter.ai'?'OpenRouter':'AI sağlayıcısı'));
        return ['label'=>$label,'model'=>$a['model'],'ready'=>$a['provider']==='compatible'&&$a['key']!==''&&$a['model']!==''&&str_starts_with($a['endpoint'],'https://')];
    }
}
