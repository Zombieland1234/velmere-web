/** Read-only inventory of declared RPC names. Not full signature or schema parity. */
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

export function extractRegisteredRpcNames(source) {
  const ast = ts.createSourceFile('registry.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (ast.parseDiagnostics.length) throw new Error('REGISTRY_SYNTAX_INVALID');
  const declarations = ast.statements.filter(ts.isVariableStatement)
    .flatMap(s => [...s.declarationList.declarations])
    .filter(d => ts.isIdentifier(d.name) && d.name.text === 'SUPABASE_RPC_OPERATIONS');
  if (declarations.length !== 1) throw new Error('REGISTRY_DECLARATION_REQUIRED');
  let init = declarations[0].initializer;
  while (init && (ts.isAsExpression(init) || ts.isSatisfiesExpression(init) || ts.isParenthesizedExpression(init))) init = init.expression;
  if (!init || !ts.isObjectLiteralExpression(init)) throw new Error('REGISTRY_OBJECT_REQUIRED');
  const operations = new Set(), names = new Set();
  for (const property of init.properties) {
    if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name) || !ts.isObjectLiteralExpression(property.initializer)) throw new Error('REGISTRY_STATIC_PROPERTIES_REQUIRED');
    const operation = property.name.text;
    if (operations.has(operation)) throw new Error('DUPLICATE_OPERATION');
    operations.add(operation);
    const entries = property.initializer.properties.filter(p => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === 'rpcName');
    if (entries.length !== 1 || !ts.isStringLiteral(entries[0].initializer)) throw new Error('SINGLE_LITERAL_RPC_NAME_REQUIRED');
    const rpcName = entries[0].initializer.text;
    if (!/^velmere_[a-z0-9_]{1,150}$/.test(rpcName)) throw new Error('INVALID_RPC_NAME');
    if (names.has(rpcName)) throw new Error('DUPLICATE_RPC_NAME');
    names.add(rpcName);
  }
  if (!names.size) throw new Error('EMPTY_REGISTRY');
  return [...names].sort();
}
export function inventorySql(names) {
  if (!Array.isArray(names) || !names.length || new Set(names).size !== names.length || names.some(n => typeof n !== 'string' || !/^velmere_[a-z0-9_]{1,150}$/.test(n))) throw new Error('INVALID_NAMES');
  return `BEGIN READ ONLY;
SET LOCAL statement_timeout = '10s';
WITH wanted(name) AS (VALUES ${names.map(n => `('${n}')`).join(',')}),
checks AS (
 SELECT w.name, count(p.oid)::int AS overloads,
   coalesce(bool_and(has_function_privilege('service_role',p.oid,'EXECUTE')),false) AS service_execute,
   coalesce(bool_and(NOT has_function_privilege('anon',p.oid,'EXECUTE') AND NOT has_function_privilege('authenticated',p.oid,'EXECUTE')),false) AS client_execute_denied
 FROM wanted w LEFT JOIN pg_namespace n ON n.nspname='public'
 LEFT JOIN pg_proc p ON p.pronamespace=n.oid AND p.proname=w.name
 GROUP BY w.name
)
SELECT jsonb_build_object('schema','velmere.registered-rpc-presence.v1','readOnly',true,
 'scope','REGISTERED_NAMES_AND_BASIC_EXECUTE_ACL_NOT_COMPLETE_SCHEMA_PARITY',
 'expected',count(*),'present',count(*) FILTER(WHERE overloads>0),
 'singleOverloadWithServiceOnlyExecute',count(*) FILTER(WHERE overloads=1 AND service_execute AND client_execute_denied),
 'signatureValidationPerformed',false,'bodyParityPerformed',false,'releaseApproved',false,
 'checks',jsonb_agg(to_jsonb(checks) ORDER BY name)) FROM checks;
ROLLBACK;
`;
}
function main() {
  if (process.env.Q19_DISPOSABLE_ACK !== 'ISOLATED_TEST_ONLY' || process.env.PGHOST !== '127.0.0.1' || process.env.PGUSER !== 'postgres' || process.env.PGDATABASE !== 'q10_payment_fixture') throw new Error('ISOLATED_LOCAL_FIXTURE_REQUIRED');
  if (process.argv.length !== 3) throw new Error('usage: node scripts/c15-q19/rpc-inventory.mjs NEW_EVIDENCE_DIRECTORY');
  const root = fileURLToPath(new URL('../../',import.meta.url));
  const source = readFileSync(path.join(root,'lib/db/supabase-rpc-operation-registry.ts'),'utf8');
  const names = extractRegisteredRpcNames(source), query=inventorySql(names);
  const out = path.resolve(process.argv[2]);mkdirSync(out);
  writeFileSync(path.join(out,'query.sql'),query);
  const run=spawnSync('psql',['-X','-qAt','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',timeout:15000});
  writeFileSync(path.join(out,'stderr.log'),run.stderr ?? '');
  if (run.error || run.status!==0) throw new Error('INVENTORY_QUERY_FAILED');
  const data=JSON.parse(run.stdout);
  data.registrySha256=createHash('sha256').update(source).digest('hex');
  data.observedAt=new Date().toISOString();data.hostScope='FRESH_LOCAL_DISPOSABLE_CLUSTER_NOT_HOSTED_SUPABASE';
  writeFileSync(path.join(out,'RESULTS.json'),JSON.stringify(data,null,2)+'\n');
  console.log(JSON.stringify({expected:data.expected,present:data.present,releaseApproved:false}));
  process.exitCode=data.present===data.expected && data.singleOverloadWithServiceOnlyExecute===data.expected ? 0 : 2;
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) main();
