"""Verify isolated recovery evidence from private GCS, not a green Actions badge."""
import datetime,json,os,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'pdt-backup'))
from gcs_storage import PrivateStorage,SafeFailure,PREFIX,BUCKET
def verify():
 s=PrivateStorage();s.verify_boundary()
 record=s.latest_backup_manifest()
 base=record['prefix']
 requested_object=os.environ.get('BACKUP_OBJECT','')
 actual_object=record['objects']['database']['name']
 if not requested_object.startswith('gs://') or requested_object!='gs://'+BUCKET+'/'+actual_object:
  raise SafeFailure('BACKUP_OBJECT_IDENTITY_MISMATCH')
 if not base.startswith(PREFIX):raise SafeFailure('WRONG_BACKUP_PREFIX')
 raw=s.get(record['objects']['database'])
 import hashlib
 digest=hashlib.sha256(raw).hexdigest()
 expected=os.environ.get('BACKUP_SHA256','').lower()
 if expected!=digest:raise SafeFailure('BACKUP_HASH_MISMATCH')
 verified=json.loads(s.get({'name':base+'recovery-verified.json',
  'generation':os.environ['RECOVERY_GENERATION'],
  'bytes':int(os.environ['RECOVERY_BYTES']),
  'sha256':os.environ['RECOVERY_SHA256']}))
 if verified.get('status')!='POSTGRES_BACKUP_RESTORED_VERIFIED':raise SafeFailure('RESTORE_NOT_VERIFIED')
 v=verified.get('verification',{})
 if not all(v.get(k) is True for k in ('table_counts_equal','catalog_sections_equal','archive_sha256_checked_on_download','postgres_scope_only')):raise SafeFailure('RESTORE_PROOF_INCOMPLETE')
 if verified.get('prefix')!=base or verified.get('project_ref')!='ocvxbwzqxbrfndkvjmfx':raise SafeFailure('RESTORE_SOURCE_MISMATCH')
 when=datetime.datetime.fromisoformat(verified['created_utc'].replace('Z','+00:00'))
 age=datetime.datetime.now(datetime.timezone.utc)-when
 if not datetime.timedelta(0)<=age<=datetime.timedelta(hours=6):raise SafeFailure('BACKUP_NOT_FRESH')
 print('PRIVATE_RESTORE_HASH_COUNTS_CATALOG_VERIFIED')
if __name__=='__main__':
 try:verify()
 except Exception as e:
  print('::error::RESTORE_EVIDENCE_NOT_VERIFIED: '+str(e));sys.exit(1)
