import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emitted,proposeImports} from './prune-unused-imports.mjs';
function messages(source,token){const at=source.indexOf(token),prefix=source.slice(0,at),lines=prefix.split('\n');return [{ruleId:'@typescript-eslint/no-unused-vars',line:lines.length,column:lines.at(-1).length+1}];}
const fixtures=[
 ['named','import { used, unused } from "./dep";\nexport const x=used;','unused'],
 ['default','import Unused from "./dep";\nexport const x=1;','Unused'],
 ['namespace','import * as Unused from "./dep";\nexport const x=1;','Unused'],
 ['type only','import type {Unused} from "./dep";\nexport const x=1;','Unused'],
 ['aliased','import {a as Unused,b} from "./dep";\nexport const x=b;','Unused'],
 ['tsx','"use client";\nimport {useState,Unused} from "react";\nexport function C(){const [n]=useState(1);return <div>{n}</div>;}','Unused'],
];
for(const [label,source,token] of fixtures)test(`Q9 import cleanup preserves both compiler outputs: ${label}`,()=>{
 const file='fixture.tsx',result=proposeImports(source,file,messages(source,token));assert.deepEqual(result.bindings,[token]);assert.deepEqual(emitted(source,file),emitted(result.source,file));
});
test('Q9 import cleanup leaves hooks, JSX and side-effect imports untouched',()=>{
 const source='"use client";\nimport "./side-effect";\nimport {Unused} from "./dep";\nexport function C(){return <div className="original">text</div>;}';
 const result=proposeImports(source,'fixture.tsx',messages(source,'Unused'));assert.ok(result.source.includes('import "./side-effect";'));assert.ok(result.source.endsWith(source.slice(source.indexOf('export function'))));assert.ok(result.source.startsWith('"use client";'));
});
test('Q9 unused local declarations are not removed by the import tool',()=>{const source='export const value=1;\nconst unused=sideEffect();';const result=proposeImports(source,'fixture.ts',messages(source,'unused'));assert.equal(result.source,source);assert.deepEqual(result.bindings,[]);});
test('Q9 import printer does not duplicate an existing leading comment',()=>{
 const source='/** original header */\nimport {used,Unused} from "./dep";\nexport const x=used;';
 const result=proposeImports(source,'fixture.ts',messages(source,'Unused'));
 assert.equal(result.source.split('/** original header */').length-1,1);
 assert.deepEqual(emitted(source,'fixture.ts'),emitted(result.source,'fixture.ts'));
});
