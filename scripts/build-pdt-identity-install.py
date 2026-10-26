"""Render the reviewed identity rollout as ONE transaction. Never connects to a DB."""
import hashlib,json,pathlib,re,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
DIRECTORY=ROOT/'docs/sql-proposals/pdt/identity'
FILES=('00_repair_22_REVIEW.sql','01_creation_and_source_identity_REVIEW.sql','02_panel_v2_identity_REVIEW.sql')
def body(text):
 lines=text.splitlines();start=next(i for i,l in enumerate(lines) if re.fullmatch(r'BEGIN(?: ISOLATION LEVEL REPEATABLE READ)?;',l.strip()))
 end=max(i for i,l in enumerate(lines) if l.strip())
 if lines[end].strip()!='COMMIT;' or any(l.strip() and not l.lstrip().startswith('--') for l in lines[:start]):raise ValueError('Unexpected transaction wrapper')
 return '\n'.join(lines[start+1:end])
def render():return '\n'.join(['-- REVIEW ONLY. Requires explicit production authorization.','BEGIN ISOLATION LEVEL REPEATABLE READ;',"SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='120s';SET LOCAL timezone='UTC';"]+['-- SOURCE '+n+' SHA256 '+hashlib.sha256((DIRECTORY/n).read_bytes()).hexdigest()+'\n'+body((DIRECTORY/n).read_text()) for n in FILES]+['COMMIT;',''])
if __name__=='__main__':sys.stdout.write(render())
