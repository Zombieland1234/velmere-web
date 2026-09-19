import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { extractRegisteredRpcNames, inventorySql } from './rpc-inventory.mjs';
const registry = body => `export const SUPABASE_RPC_OPERATIONS = {${body}} as const;`;
test('extracts exact production registry without executing it',()=>{
 const names=extractRegisteredRpcNames(readFileSync(new URL('../../lib/db/supabase-rpc-operation-registry.ts',import.meta.url),'utf8'));
 assert.equal(names.length,154);assert.ok(names.includes('velmere_issue_auth_session_family'));assert.equal(new Set(names).size,154);
});
test('ignores comments and unrelated strings rather than counting regex matches',()=>{
 assert.deepEqual(extractRegisteredRpcNames('// rpcName: "velmere_fake"\n'+registry('op:{rpcName:"velmere_real"}')),['velmere_real']);
});
test('rejects duplicate operation keys',()=>assert.throws(()=>extractRegisteredRpcNames(registry('op:{rpcName:"velmere_one"},op:{rpcName:"velmere_two"}')),/DUPLICATE_OPERATION/));
test('rejects duplicate RPC names',()=>assert.throws(()=>extractRegisteredRpcNames(registry('a:{rpcName:"velmere_one"},b:{rpcName:"velmere_one"}')),/DUPLICATE_RPC_NAME/));
test('rejects dynamic registry rather than silently missing entries',()=>assert.throws(()=>extractRegisteredRpcNames(registry('...other')),/STATIC_PROPERTIES/));
test('rejects dynamic RPC names',()=>assert.throws(()=>extractRegisteredRpcNames(registry('a:{rpcName:buildName()}')),/LITERAL/));
test('requires exactly one registry declaration',()=>assert.throws(()=>extractRegisteredRpcNames('const other={}'),/DECLARATION/));
test('rejects duplicate rpcName property within an operation',()=>assert.throws(()=>extractRegisteredRpcNames(registry('a:{rpcName:"velmere_one",rpcName:"velmere_two"}')),/LITERAL/));
test('SQL generator rejects unreviewable names before query construction',()=>assert.throws(()=>inventorySql(["not a registered identifier"]),/INVALID_NAMES/));
test('catalog query is read-only and never executes a registered RPC',()=>{
 const query=inventorySql(['velmere_one']);assert.ok(query.startsWith('BEGIN READ ONLY;'));assert.ok(query.endsWith('ROLLBACK;\n'));assert.ok(!query.includes('velmere_one('));assert.ok(query.includes("'releaseApproved',false"));
});
