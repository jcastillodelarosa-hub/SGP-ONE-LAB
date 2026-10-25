import unittest,tempfile,pathlib,json,copy
from catalog_compatibility import SECTIONS,load_catalog,compare_catalogs

class CatalogComparisonTests(unittest.TestCase):
    def catalog(self):
        data={s:[] for s in SECTIONS}
        data['captura']={'version_num':'170000'}
        data['funciones']=[{'oid':1,'firma':'sgp_sesion_actual(text)','retorno':'jsonb','definicion':'synthetic body','nombres_argumentos':['p_token'],'acl':'owner=X/owner'}]
        data['relaciones']=[{'nombre':'sgp_aluminio_pendientes','owner':'owner','columnas':[{'nombre':'id_pendiente','tipo':'uuid'}]}]
        return data
    def load(self,value):
        with tempfile.TemporaryDirectory() as directory:
            path=pathlib.Path(directory)/'catalog.json';path.write_text(json.dumps(value))
            return load_catalog(path)
    def test_editor_wrapped_export(self):
        expected=self.catalog()
        self.assertEqual(self.load([{'pdt_preflight_supabase':json.dumps(expected)}]),expected)
    def test_missing_definition_blocks(self):
        data=self.catalog();del data['funciones'][0]['definicion']
        with self.assertRaises(ValueError):self.load(data)
    def test_restore_oid_changes_are_not_schema_changes(self):
        data=self.catalog();replica=copy.deepcopy(data);replica['funciones'][0]['oid']=999
        self.assertEqual(compare_catalogs(data,replica),[])
    def test_body_permissions_and_column_mismatch_detected(self):
        for section,key in [('funciones','definicion'),('funciones','acl'),('relaciones','owner')]:
            data=self.catalog();replica=copy.deepcopy(data);replica[section][0][key]='different'
            self.assertIn(section,compare_catalogs(data,replica))
        data=self.catalog();replica=copy.deepcopy(data);replica['relaciones'][0]['columnas'][0]['tipo']='text'
        self.assertEqual(compare_catalogs(data,replica),['relaciones'])
    def test_argument_order_is_preserved(self):
        data=self.catalog();data['funciones'][0]['nombres_argumentos']=['p_token','p_id'];replica=copy.deepcopy(data)
        replica['funciones'][0]['nombres_argumentos'].reverse()
        self.assertEqual(compare_catalogs(data,replica),['funciones'])
    def test_equivalent_default_acl_is_not_a_privilege_change(self):
        data=self.catalog();data['relaciones'][0]['acl']='{owner=arwdDxtm/owner}'
        data['relaciones'][0]['acl_efectiva']=[{'grantee':'owner','privilegio':'SELECT','grantable':False}]
        replica=copy.deepcopy(data);replica['relaciones'][0]['acl']=None
        self.assertEqual(compare_catalogs(data,replica),[])
        replica['relaciones'][0]['acl_efectiva'].append({'grantee':'anon','privilegio':'INSERT','grantable':False})
        self.assertEqual(compare_catalogs(data,replica),['relaciones'])
    def test_postgres_major_and_extensions_are_dependencies(self):
        data=self.catalog();replica=copy.deepcopy(data);replica['captura']['version_num']='150000'
        self.assertIn('postgres_major',compare_catalogs(data,replica))
        replica=copy.deepcopy(data);replica['extensiones']=[{'nombre':'pgcrypto','version':'1.3','schema':'extensions'}]
        self.assertIn('extensiones',compare_catalogs(data,replica))
    def test_partial_inventory_is_not_a_catalog(self):
        with self.assertRaises(ValueError):self.load({'functions':[],'triggers':[]})

if __name__=='__main__':unittest.main()
