"""Derive test-only anonymized XLSX files; original uploads are NOT committed."""
import sys,zipfile,xml.etree.ElementTree as E
from pathlib import Path
ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
ROOT=Path(__file__).resolve().parent
names={};projects={}
for stage,source in zip(['ensamble','empaque'],sys.argv[1:]):
 with zipfile.ZipFile(source) as original,zipfile.ZipFile(ROOT/'fixtures'/f'{stage}.xlsx','w',zipfile.ZIP_DEFLATED) as out:
  for name in original.namelist():
   data=original.read(name)
   if name=='xl/worksheets/sheet1.xml':
    root=E.fromstring(data);rows=root.findall('m:sheetData/m:row',ns)
    for row in rows[1:]:
     cells=row.findall('m:c',ns)
     if len(cells)<6 or ''.join(cells[0].itertext())=='Total':continue
     for index,mapping,prefix in [(3,projects,'QA-PROYECTO-'),(4,names,'QA-OP-')]:
      node=cells[index].find('m:is/m:t',ns)
      if node is not None:
       value=node.text or '';mapping.setdefault(value,prefix+str(len(mapping)+1).zfill(3));node.text=mapping[value]
    data=E.tostring(root,encoding='utf-8',xml_declaration=True)
   out.writestr(name,data)
print('Anonymized fixtures created:',len(names),'production labels')
