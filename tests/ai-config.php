<?php
declare(strict_types=1);
require __DIR__.'/../app/bootstrap.php';
$count=0;
function check(bool $ok,string $label): void {global $count;demand($ok,$label);echo 'PASS AI CONFIG '.(++$count).' '.$label.PHP_EOL;}
$base=require __DIR__.'/../config/example.php';
$resolve=fn(array $env)=>AiConfig::resolve($base,$env)['ai'];
$ai=$resolve([]);check($ai['provider']==='mock'&&$ai['key']==='','no credentials retains honest mock mode');
$ai=$resolve(['AI_KEY'=>'test-key','AI_MODEL'=>'configured-model']);
check($ai['provider']==='compatible'&&$ai['key']==='test-key'&&$ai['model']==='configured-model','AI_KEY enables real provider without AI_PROVIDER');
$ai=$resolve(['OPENAI_API_KEY'=>' openai-test-key ','OPENAI_MODEL'=>' chosen-model ']);
check($ai['provider']==='compatible'&&$ai['key']==='openai-test-key'&&$ai['model']==='chosen-model','OpenAI variable names and whitespace supported');
check($ai['endpoint']==='https://api.openai.com/v1/chat/completions','OpenAI endpoint is used by default');
$ai=$resolve(['AI_PROVIDER'=>'mock','OPENAI_API_KEY'=>'test-key','OPENAI_MODEL'=>'chosen-model']);
check($ai['provider']==='mock','explicit mock selection is preserved');
$ai=$resolve(['AI_PROVIDER'=>'openai','AI_KEY'=>'test-key','AI_MODEL'=>'chosen-model']);check($ai['provider']==='compatible','OpenAI provider alias accepted');
$ai=$resolve(['AI_PROVIDER'=>'openrouter','AI_KEY'=>'test-key','AI_MODEL'=>'openai/chosen-model']);check($ai['endpoint']==='https://openrouter.ai/api/v1/chat/completions'&&$ai['model']==='openai/chosen-model','OpenRouter alias keeps configured model');
$ai=$resolve(['OPENAI_BASE_URL'=>'https://proxy.example/v1/','OPENAI_API_KEY'=>'test-key','OPENAI_MODEL'=>'chosen-model']);check($ai['endpoint']==='https://proxy.example/v1/chat/completions','base URL is expanded to Chat Completions');
$ai=$resolve(['AI_KEY'=>'preferred','OPENAI_API_KEY'=>'fallback','AI_MODEL'=>'preferred-model','OPENAI_MODEL'=>'fallback-model']);check($ai['key']==='preferred'&&$ai['model']==='preferred-model','VakaLab-specific variables take precedence');
$ai=$resolve(['AI_KEY'=>'test-key']);check($ai['provider']==='compatible'&&$ai['model']==='','real credentials never send synthetic model or choose a paid model automatically');
$configured=$base;$configured['ai']['key']='local-test-key';$configured['ai']['model']='local-model';
$local=AiConfig::resolve($configured,[]);check($local['ai']['provider']==='compatible','local config key overrides copied mock default');
$status=AiConfig::status($local);check($status['ready']&&$status['label']==='OpenAI'&&!str_contains(js($status),'local-test-key'),'browser status is useful without exposing credential');
$ai=$resolve(['AI_KEY'=>'test-key','AI_MODEL'=>'chosen-model','AI_TIMEOUT'=>'120','AI_STRUCTURED_OUTPUTS'=>'true']);check($ai['timeout']===120&&$ai['structured_outputs'],'timeout and structured-output options retained');
echo 'TOTAL AI CONFIG '.$count.' checks passed; no provider calls.'.PHP_EOL;
