"""Ordered, atomic installation batches for disposable PostgreSQL only."""
import hashlib,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[3]
DIRECTORY=ROOT/'docs/sql-proposals/pdt'
PHASE_A=(
 '20261025_picking_entrega_68_compat_REVIEW.sql',
 '20261024_pdt_multifabricacion_avances_nc_DRAFT.sql',
 '20261025_pdt_fail_closed_REVIEW.sql',
 '20261024_pdt_rpc_contracts_REVIEW.sql',
 '20261024_pdt_reverso_REVIEW.sql',
 '20261024_pdt_nc_vincular_REVIEW.sql',
 '20261024_pdt_listar_v2_REVIEW.sql',
 '20261025_pdt_legacy_guard_REVIEW.sql',
 '20261025_pdt_capacidades_REVIEW.sql',
)
PHASE_B=('20261026_pdt_picking_B_REVIEW.sql',)

def files(phase):
    if phase=='A':return PHASE_A
    if phase=='B':return PHASE_B
    if phase=='AB':return PHASE_A+PHASE_B
    raise ValueError('Unknown installation phase')

def transaction_body(text):
    lines=text.splitlines()
    start=next((i for i,line in enumerate(lines) if line.strip()=='BEGIN;'),None)
    end=next((i for i in range(len(lines)-1,-1,-1) if lines[i].strip()),None)
    if start is None or end is None or lines[end].strip()!='COMMIT;':
        raise ValueError('Expected reviewed BEGIN/COMMIT wrapper')
    # These fixed, reviewed files may contain PL/pgSQL BEGIN blocks; never strip them.
    if any(line.strip() and not line.lstrip().startswith('--') for line in lines[:start]):
        raise ValueError('Unexpected statements before transaction')
    return '\n'.join(lines[:start]+lines[start+1:end])

def render(phase):
    parts=['-- ISOLATED REVIEW ONLY. Never a production application authorization.',
           'BEGIN;',"SET LOCAL lock_timeout='5s';","SET LOCAL statement_timeout='120s';",
           "SELECT pg_advisory_xact_lock(hashtextextended('sgp_pdt_isolated_install',0));"]
    for name in files(phase):
        parts+=['-- SOURCE: '+name,transaction_body((DIRECTORY/name).read_text())]
    return '\n'.join(parts+['COMMIT;',''])

def manifest(phase):
    return {name:hashlib.sha256((DIRECTORY/name).read_bytes()).hexdigest() for name in files(phase)}
