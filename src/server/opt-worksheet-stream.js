import {readWorksheetRow} from '../domain/powerbi/xlsx-reader.js';
const MAIN='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const decode=new TextDecoder('utf-8',{fatal:true});
const fail=message=>{throw Error(message);};
// Only a single row's elements are retained. No entities, resource loads or XML recovery.
class RowNode {
 constructor(tag){this.nodeType=1;this.localName=tag.local;this.namespaceURI=tag.uri;this.attributes=tag.attributes;this.childNodes=[];}
 get textContent(){const parts=[],pending=[...this.childNodes].reverse();while(pending.length){const node=pending.pop();if(node.nodeType===3)parts.push(node.textContent);else for(let i=node.childNodes.length-1;i>=0;i--)pending.push(node.childNodes[i]);}return parts.join('');}
 getAttribute(name){return this.attributes[name]?.value??'';}
 getElementsByTagNameNS(ns,name){const out=[];for(const child of this.childNodes){if(child.nodeType!==1)continue;if(child.namespaceURI===ns&&child.localName===name)out.push(child);out.push(...child.getElementsByTagNameNS(ns,name));}return out;}
}
export function createWorksheetXMLReader(SaxesParser){
 if(typeof SaxesParser!=='function')throw Error('OPT_XML_PARSER_REQUIRED');
 return function readWorksheetXML(bytes,{shared,allowStringCells}){
  if(!(bytes instanceof Uint8Array)||bytes.length>16*1024*1024)fail('Falta hoja XLSX o excede límite');
  const source=decode.decode(bytes);if(/<!DOCTYPE|<!ENTITY/i.test(source))fail('DTD y entidades no admitidos');
  const parser=new SaxesParser({xmlns:true}),stack=[],nodes=[],rows=[];let dataCount=0,rowNodes=0,last=0;
  parser.on('error',()=>fail('XML inválido'));
  parser.on('doctype',()=>fail('DTD y entidades no admitidos'));
  parser.on('opentag',tag=>{
   stack.push(tag);if(stack.length>128)fail('Profundidad XML excesiva');
   if(stack.length===1&&(tag.local!=='worksheet'||tag.uri!==MAIN))fail('Hoja inválida');
   if(tag.uri===MAIN&&['f','mergeCell'].includes(tag.local))fail('Fórmulas o celdas combinadas no admitidas');
   if(stack.length===2&&tag.local==='sheetData'&&tag.uri===MAIN){if(++dataCount!==1)fail('Estructura XLSX ambigua: sheetData');}
   const startsRow=stack.length===3&&stack[1].local==='sheetData'&&stack[1].uri===MAIN&&tag.local==='row'&&tag.uri===MAIN;
   if(startsRow){rowNodes=0;nodes.push(new RowNode(tag));}
   else if(nodes.length){if(++rowNodes>8192)fail('Fila XML excesiva');const node=new RowNode(tag);nodes.at(-1).childNodes.push(node);nodes.push(node);}
  });
  const text=value=>{if(nodes.length)nodes.at(-1).childNodes.push({nodeType:3,textContent:value});};
  parser.on('text',text);parser.on('cdata',text);
  parser.on('closetag',()=>{
   if(nodes.length){const node=nodes.pop();if(!nodes.length){const row=readWorksheetRow(node,last,{shared,allowStringCells});rows.push(row);last=row.row;}}
   stack.pop();
  });
  // Parse the complete sheet, including content after the last row. Never return partial rows.
  for(let offset=0;offset<source.length;offset+=65536)parser.write(source.slice(offset,offset+65536));
  parser.close();if(dataCount!==1)fail('Estructura XLSX ambigua: sheetData');
  return rows;
 };
}
