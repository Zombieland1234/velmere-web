/** Read-only check using an existing dedicated CI token, if configured.
 * Never prints tokens, secret values, cookies, decrypted env values or remote errors.
 */
import fs from 'node:fs';
const output=process.argv[2]||'/tmp/c12-hosting';fs.mkdirSync(output,{recursive:true});
const token=process.env.VERCEL_TOKEN;
const result={sourceSha:process.env.GITHUB_SHA,at:new Date().toISOString(),scope:'CONNECTED_CI_CREDENTIAL_AND_PREVIEW_METADATA_READ_ONLY',vercelTokenPresent:Boolean(token),automationBypassSecretPresent:Boolean(process.env.VERCEL_AUTOMATION_BYPASS_SECRET),projectEnvironmentRead:'NOT_ATTEMPTED',environmentMetadata:[],productionMutations:false};
if(token){
 try{
  const response=await fetch('https://api.vercel.com/v9/projects/prj_lZPnGp7RjET3aZAIKWVYNJgGdARG/env?teamId=team_HQFnEuyhyDfQirBvBtDr9SjJ',{headers:{authorization:`Bearer ${token}`},redirect:'error',signal:AbortSignal.timeout(15000)});
  result.httpStatus=response.status;
  if(response.ok){const data=await response.json();result.projectEnvironmentRead='READ';result.environmentMetadata=(Array.isArray(data.envs)?data.envs:[]).map(e=>({key:e.key,target:e.target,type:e.type,gitBranch:e.gitBranch??null}));}
  else{await response.body?.cancel();result.projectEnvironmentRead='HTTP_REFUSED';}
 }catch{result.projectEnvironmentRead='NETWORK_OR_PROTOCOL_ERROR';}
}else result.projectEnvironmentRead='MISSING_EXISTING_CI_TOKEN';
fs.writeFileSync(output+'/HOSTING_PREREQUISITES.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({sourceSha:result.sourceSha,vercelTokenPresent:result.vercelTokenPresent,projectEnvironmentRead:result.projectEnvironmentRead,metadataEntries:result.environmentMetadata.length}));
