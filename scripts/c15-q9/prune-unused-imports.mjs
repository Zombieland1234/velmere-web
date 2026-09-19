/** Offline review aid: only remove ESLint-reported unused import bindings when
 * both TypeScript and esbuild emit exactly the same canonical JavaScript.
 * Does not change JSX, styles, directives, hook logic, config or severity.
 * Run against a fresh lint JSON for the same source. Review emitted diff before use.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';
import esbuild from 'esbuild';
import {pathToFileURL} from 'node:url';
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const canonical = code => esbuild.transformSync(code,{loader:'jsx',jsx:'preserve',target:'es2022',format:'esm',minifyWhitespace:true,legalComments:'none'}).code;
export function emitted(code,filename){
  const opts={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.Preserve,removeComments:true,verbatimModuleSyntax:false};
  return {typescript:canonical(ts.transpileModule(code,{compilerOptions:opts,fileName:filename}).outputText),
    esbuild:esbuild.transformSync(code,{loader:filename.endsWith('x')?'tsx':'ts',target:'es2022',format:'esm',jsx:'preserve',minifyWhitespace:true,legalComments:'none',tsconfigRaw:{compilerOptions:{verbatimModuleSyntax:false}}}).code};
}
export function proposeImports(source,filename,messages){
  const ast=ts.createSourceFile(filename,source,ts.ScriptTarget.Latest,true,filename.endsWith('x')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  const unused=new Set(messages.filter(m=>m.ruleId==='@typescript-eslint/no-unused-vars').map(m=>ast.getPositionOfLineAndCharacter(m.line-1,m.column-1)));
  const isUnused = name=>name && unused.has(name.getStart(ast));
  const edits=[];const bindings=[];const printer=ts.createPrinter({newLine:ts.NewLineKind.LineFeed});
  for(const stmt of ast.statements){
    if(!ts.isImportDeclaration(stmt)||!stmt.importClause)continue;
    const c=stmt.importClause;let name=c.name;let bound=c.namedBindings;const removed=[];
    if(isUnused(name)){removed.push(name.text);name=undefined;}
    if(bound&&ts.isNamespaceImport(bound)){if(isUnused(bound.name)){removed.push(bound.name.text);bound=undefined;}}
    else if(bound&&ts.isNamedImports(bound)){
      const kept=bound.elements.filter(e=>{if(isUnused(e.name)){removed.push(e.name.text);return false;}return true;});
      if(kept.length!==bound.elements.length)bound=kept.length?ts.factory.updateNamedImports(bound,kept):undefined;
    }
    if(!removed.length)continue;
    const updated=(name||bound)?ts.factory.updateImportDeclaration(stmt,stmt.modifiers,ts.factory.updateImportClause(c,c.isTypeOnly,name,bound),stmt.moduleSpecifier,stmt.attributes):undefined;
    if(updated)ts.setEmitFlags(updated,ts.EmitFlags.NoLeadingComments|ts.EmitFlags.NoTrailingComments);
    edits.push({start:stmt.getStart(ast),end:stmt.end,text:updated?printer.printNode(ts.EmitHint.Unspecified,updated,ast):''});bindings.push(...removed);
  }
  let result=source;for(const edit of edits.sort((a,b)=>b.start-a.start))result=result.slice(0,edit.start)+edit.text+result.slice(edit.end);
  return {source:result,bindings};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const [lint,rootArg,out]=process.argv.slice(2);if(!lint||!rootArg||!out)throw new Error('usage: lint.json source-root new-report.json');
  const root=path.resolve(rootArg),rows=[];const input=JSON.parse(fs.readFileSync(lint,'utf8'));
  for(const f of input){
    const filename=path.resolve(f.filePath);if(!filename.startsWith(root+path.sep)||!/^(.+)\.tsx?$/.test(filename))continue;
    const source=fs.readFileSync(filename,'utf8');const proposal=proposeImports(source,filename,f.messages);
    if(!proposal.bindings.length)continue;
    const before=emitted(source,filename),after=emitted(proposal.source,filename);
    const accepted=before.typescript===after.typescript&&before.esbuild===after.esbuild;
    rows.push({file:path.relative(root,filename),bindings:proposal.bindings,accepted,sourceBefore:sha(source),sourceAfter:sha(proposal.source),typescriptBefore:sha(before.typescript),typescriptAfter:sha(after.typescript),esbuildBefore:sha(before.esbuild),esbuildAfter:sha(after.esbuild)});
    if(accepted)fs.writeFileSync(filename,proposal.source);
  }
  fs.writeFileSync(out,JSON.stringify({scope:'IMPORT_BINDINGS_ONLY_TWO_EMITTER_PARITY_NOT_BROWSER_VISUAL_PROOF',rows},null,2),{flag:'wx'});
  console.log(JSON.stringify({files:rows.filter(r=>r.accepted).length,bindings:rows.filter(r=>r.accepted).reduce((n,r)=>n+r.bindings.length,0),rejected:rows.filter(r=>!r.accepted).length}));
}
