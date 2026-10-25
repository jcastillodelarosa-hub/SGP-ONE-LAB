"""Compare read-only PDT_PREFLIGHT_SUPABASE.sql exports; never execute definitions."""
import json
SECTIONS=('funciones','relaciones','triggers','politicas','roles','membresias','secuencias','grants_por_defecto','extensiones')
SORTABLE=set(SECTIONS)|{'constraints','indices','existencia','acl_efectiva'}

def load_catalog(path):
    with open(path,encoding='utf-8') as handle:
        data=json.load(handle)
    if isinstance(data,list) and len(data)==1:
        data=data[0]
    if isinstance(data,dict) and 'pdt_preflight_supabase' in data:
        data=data['pdt_preflight_supabase']
    if isinstance(data,str):
        data=json.loads(data)
    if not isinstance(data,dict) or any(not isinstance(data.get(s),list) for s in SECTIONS):
        raise ValueError('Export incompleto: usar el JSON completo de PDT_PREFLIGHT_SUPABASE.sql')
    if not str(data.get('captura',{}).get('version_num','')).isdigit():
        raise ValueError('Export sin version PostgreSQL: volver a exportar con el script actual')
    if not data['funciones'] or not data['relaciones']:
        raise ValueError('Export sin funciones/relaciones; no es baseline compatible')
    session=[f for f in data['funciones'] if f.get('firma','').removeprefix('public.').replace(' ','')=='sgp_sesion_actual(text)']
    if len(session)!=1 or session[0].get('retorno') not in ('json','jsonb') or not session[0].get('definicion'):
        raise ValueError('Falta cuerpo y contrato JSON escalar de sgp_sesion_actual(text)')
    return data

def normalize(value,key=''):
    if isinstance(value,dict):
        # OIDs differ on restore. Retain definitions, argument order, owners and ACLs.
        return {k:normalize(v,k) for k,v in value.items() if k!='oid' and not (k=='acl' and 'acl_efectiva' in value)}
    if isinstance(value,list):
        values=[normalize(v) for v in value]
        return sorted(values,key=lambda v:json.dumps(v,sort_keys=True)) if key in SORTABLE else values
    return value

def compare_catalogs(expected,actual):
    differences=[]
    expected_version=expected.get('captura',{}).get('version_num')
    actual_version=actual.get('captura',{}).get('version_num')
    if expected_version is not None and (actual_version is None or int(expected_version)//10000!=int(actual_version)//10000):
        differences.append('postgres_major')
    for section in SECTIONS:
        if normalize(expected.get(section),section)!=normalize(actual.get(section),section):
            differences.append(section)
    return differences
