"""Optional acceptance check of the private source auditor output. No fixtures included."""
import json,sys
report=json.load(open(sys.argv[1]))
assert report['schema']=='sgp.opt.source-audit.v1'
assert report['certified'] is False
assert report['projectData']['allFieldsMatch'] is True
requested=set(sys.argv[2:]);rows=[r for r in report['references'] if r['reference'] in requested]
assert len(rows)==len(requested)>0
for row in rows:
 assert row['sourceBars']==row['candidateBars']
 assert row['sourceCuts']==row['candidateCuts']
 for key in ['sourceBarsMatchPrintedSummary','sourceCutLengthsMatchProjectData','candidateCutLengthsMatchProjectData','barLengthsAndCodesMatch','cutLengthsMatch','cutLengthAndReferenceMultisetMatch','barPatternAndRemainderMultisetMatch']:
  assert row[key] is True,(row['reference'],key)
 assert row['unparsedCells']==0
 assert row['productionEnabled'] is False
 assert row['status']=='PROVISIONAL'
assert all(not x['pagesDifferent'] and x['pagesMatched'] for x in report['independentLibraryText'])
print('PASS: private-source equality; production remains blocked')
