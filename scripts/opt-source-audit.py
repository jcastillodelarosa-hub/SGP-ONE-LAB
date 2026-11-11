"""Read-only geometric audit. Inputs remain private; output contains aggregate evidence only.
Usage: python3 scripts/opt-source-audit.py PDF CANDIDATE_JSON [--source-text LIBRARY_TEXT ...]
Requires pdfplumber. Never certifies production or infers missing row identities.
"""
import argparse, collections, hashlib, json, re
from fractions import Fraction
import pdfplumber

TARGETS = ['ES-SGD2020-' + n for n in ('024', '025', '028', '029')]
def normalized(value):
    return re.sub(r'\s+', '', str(value or ''))
def length32(value):
    parts=str(value).replace('"','').strip().split()
    result=sum((Fraction(x) for x in parts), Fraction(0))*32
    if result.denominator != 1: raise ValueError('fraction precision')
    return int(result)
def parse_cell(cell):
    # A geometric cell may contain multiple printed cuts; preserve each start line.
    chunks=[]
    for line in str(cell or '').strip().splitlines():
        if re.match(r'^\d+(?:\s+\d+/\d+)?"\s+',line): chunks.append([line])
        elif chunks: chunks[-1].append(line)
        elif line.strip(): raise ValueError('orphan reference text')
    result=[]
    for lines in chunks:
        match=re.match(r'^(\d+(?:\s+\d+/\d+)?")\s+(.+?)\s+(\d+)$',lines[0])
        if not match: raise ValueError('unparsed cell')
        result.append((length32(match[1]), normalized(' '.join([match[2]]+lines[1:])), int(match[3])))
    return result
def extract(pdf):
    patterns=[]; ref=''; bar=''; block=''; previous=None; issues=[]
    for page_number,page in enumerate(pdf.pages,1):
        if page_number < 8: continue
        events=[]
        for m in page.search(r'(?m)^(ES-[A-Z0-9-]+|ALU-[A-Z0-9-]+|PLA-[A-Z0-9-]+)\s+([^\n]+)'):
            events.append((m['top'],'ref',m['groups'][0]))
        for m in page.search(r'Longitud del perfil:\s*([^,]+),\s*Perfiles usados:\s*(\d+)[^\n]*CODIGO:\s*(\S+)'):
            events.append((m['top'],'bar',m['groups']))
        for table in page.find_tables(): events.append((table.bbox[1],'table',table.extract()))
        for _,kind,value in sorted(events,key=lambda e:e[0]):
            if kind=='ref': ref=value;previous=None;continue
            if kind=='bar': bar,expected,block=value;previous=None;continue
            table=value
            if len(table[0]) not in (7,15):continue
            for row in table:
                if row[0]=='#perf':continue
                columns=[1,4,7,10] if len(row)==15 else [1,2,3,4]
                cells=[str(row[i] or '').strip() for i in columns]
                first=str(row[0] or '').strip()
                if not first:
                    if any(cells):
                        if previous is None or previous['ref']!=ref or previous['block']!=block:
                            if ref in TARGETS:issues.append({'ref':ref,'page':page_number,'code':'ORPHAN_CONTINUATION'})
                        else:
                            for i,c in enumerate(cells):
                                if c:previous['cells'][i]+='\n'+c
                            previous['pages'].append(page_number)
                    continue
                if not first.isdigit():continue
                previous={'ref':ref,'bar':bar,'block':block,'perf':int(first),'rest':str(row[-2] or ''),'cells':cells,'pages':[page_number]}
                patterns.append(previous)
    return patterns,issues

def audit(pdf_path,candidate_path,source_texts):
    raw=open(pdf_path,'rb').read();candidate=json.load(open(candidate_path))
    with pdfplumber.open(pdf_path) as pdf:
        patterns,issues=extract(pdf)
        # Library extraction and local extraction must have identical token multiplicities
        # on each requested page. This is text agreement, never byte-equivalence proof.
        independent=[]
        for filename in source_texts:
            text=open(filename).read()
            chunks=re.split(r'<PARSED TEXT FOR PAGE: (\d+) / \d+>',text)
            matched=[];different=[]
            for i in range(1,len(chunks),2):
                n=int(chunks[i]);a=collections.Counter(chunks[i+1].split());b=collections.Counter((pdf.pages[n-1].extract_text() or '').split())
                (matched if a==b else different).append(n)
            independent.append({'pagesMatched':matched,'pagesDifferent':different})
        source_project={}
        for number,page in enumerate(pdf.pages,1):
            for table in page.extract_tables():
                for row in table:
                    if len(row)==6 and str(row[0] or '').isdigit() and str(row[5] or '').isdigit():
                        source_project[f'project-p{number}-item{row[0]}']=(normalized(row[1]),normalized(row[2]),length32(row[3]),normalized(row[4]),int(row[5]))
        actual_project={};duplicate_project=[]
        for row in candidate.get('sourceProjectRows',[]):
            key=row['sourceId']
            if key in actual_project:duplicate_project.append(key)
            actual_project[key]=(normalized(row['ref']),normalized(row['finish']),length32(row['length']),normalized(row['reference']),row['quantity'])
        project_differences=[key for key in source_project.keys()|actual_project.keys() if source_project.get(key)!=actual_project.get(key)]
        project_audit={'sourceRows':len(source_project),'candidateRows':len(actual_project),'differentRows':project_differences,'duplicateRows':duplicate_project,'allFieldsMatch':bool(source_project) and not project_differences and not duplicate_project}
        printed_cuts={ref:collections.Counter() for ref in TARGETS}
        printed_bars={ref:collections.Counter() for ref in TARGETS}
        for page in pdf.pages[:7]:
            for table in page.extract_tables():
                for row in table:
                    if len(row)==6 and row[1] in TARGETS and str(row[5] or '').isdigit():
                        printed_cuts[row[1]][length32(row[3])]+=int(row[5])
        for page in pdf.pages[47:]:
            for table in page.extract_tables():
                for row in table:
                    if len(row)==8 and row[1] in TARGETS and str(row[4] or '').isdigit():
                        printed_bars[row[1]][(length32(row[3]),str(row[6]))]+=int(row[4])
        results=[]
        for ref in TARGETS:
            own=[p for p in patterns if p['ref']==ref];actual=[p for p in candidate['plans'] if p['ref']==ref]
            expected_cuts=collections.Counter();actual_cuts=collections.Counter();unparsed=0
            for p in own:
                for cell in p['cells']:
                    try:c=parse_cell(cell)
                    except ValueError:unparsed+=1;continue
                    for length,reference,qty in c:expected_cuts[(length,reference)]+=p['perf']*qty
            for p in actual:
                for cut in p['cuts']:
                    try:actual_cuts[(length32(cut['length']),normalized(cut.get('project')))]+=int(cut.get('qty',1))
                    except (ValueError,TypeError):unparsed+=1
            missing=expected_cuts-actual_cuts;extra=actual_cuts-expected_cuts
            expected_lengths=collections.Counter();actual_lengths=collections.Counter()
            for (length,_),qty in expected_cuts.items():expected_lengths[length]+=qty
            for (length,_),qty in actual_cuts.items():actual_lengths[length]+=qty
            expected_bars=collections.Counter();actual_bars=collections.Counter()
            for p in own:
                try:expected_bars[(length32(p['bar']),p['block'])]+=p['perf']
                except ValueError:unparsed+=1
            for p in actual:
                try:actual_bars[(length32(p['length']),str(p.get('code','')))]+=p['barqty']
                except ValueError:unparsed+=1
            expected_patterns=collections.Counter();candidate_patterns=collections.Counter();unresolved_patterns=0
            for p in own:
                try:
                    parts=collections.Counter()
                    for cell in p['cells']:
                        for size,identity,qty in parse_cell(cell):parts[(size,identity)]+=qty
                    signature=(length32(p['bar']),p['block'],length32(p['rest']),tuple(sorted(parts.items())))
                    expected_patterns[signature]+=p['perf']
                except (ValueError,KeyError):unresolved_patterns+=1
            for p in actual:
                for instance in range(1,p['barqty']+1):
                    try:
                        parts=collections.Counter()
                        for c in p['cuts']:
                            if int(c.get('profileInstance',0))==instance:parts[(length32(c['length']),normalized(c.get('project')))]+=int(c.get('qty',1))
                        if not parts:raise ValueError('missing physical instance')
                        rest=p.get('rest') or (p['cuts'][0].get('rest') if p['cuts'] else '')
                        signature=(length32(p['length']),str(p.get('code','')),length32(rest),tuple(sorted(parts.items())))
                        candidate_patterns[signature]+=1
                    except (ValueError,TypeError,KeyError):unresolved_patterns+=1
            results.append({'barPatternAndRemainderMultisetMatch':unresolved_patterns==0 and expected_patterns==candidate_patterns,'unresolvedBarPatterns':unresolved_patterns,'reference':ref,'sourcePages':sorted({n for p in own for n in p['pages']}),
                'sourcePatterns':len(own),'candidatePatterns':len(actual),
                'sourceBars':sum(p['perf'] for p in own),'candidateBars':sum(p['barqty'] for p in actual),
                'sourceCuts':sum(expected_cuts.values()),'candidateCuts':sum(actual_cuts.values()),
                'printedBars':sum(printed_bars[ref].values()),'printedCuts':sum(printed_cuts[ref].values()),
                'sourceBarsMatchPrintedSummary':bool(printed_bars[ref]) and expected_bars==printed_bars[ref],
                'sourceCutLengthsMatchProjectData':bool(printed_cuts[ref]) and expected_lengths==printed_cuts[ref],
                'candidateCutLengthsMatchProjectData':bool(printed_cuts[ref]) and actual_lengths==printed_cuts[ref],
                'barLengthsAndCodesMatch':expected_bars==actual_bars,
                'cutLengthsMatch':expected_lengths==actual_lengths,
                'cutLengthAndReferenceMultisetMatch':expected_cuts==actual_cuts,
                'missingIdentityOccurrences':sum(missing.values()),'extraIdentityOccurrences':sum(extra.values()),
                'unparsedCells':unparsed,'issues':[x for x in issues if x['ref']==ref],
                'barPatternAllocationVerified':False,'status':'PROVISIONAL','productionEnabled':False})
        return {'schema':'sgp.opt.source-audit.v1','pdfSha256':hashlib.sha256(raw).hexdigest(),
            'projectData':project_audit,'independentLibraryText':independent,'references':results,'certified':False,
            'limits':['PDF bytes not independently materialized from Library','Geometric table extraction is not visual certification','Whitespace-normalized references; individual production identities and remnants still require reconciliation']}
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('pdf');p.add_argument('candidate');p.add_argument('--source-text',nargs='*',default=[]);a=p.parse_args()
    print(json.dumps(audit(a.pdf,a.candidate,a.source_text),indent=2))
