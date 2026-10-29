"""Regression for the five phase-3 history inserts; no database access needed."""
from pathlib import Path
import re
import unittest

SQL = (Path(__file__).resolve().parents[2] /
       'docs/sql-proposals/pdt/manual/03_manual_operations_REVIEW.sql').read_text()


class ManualHistoryContract(unittest.TestCase):
    def test_all_five_events_write_real_before_and_after_states(self):
        expected = {
            'ENTREGA_MANUAL_PDT': ('p.estado', 'p.estado'),
            'VALIDACION_ENTREGA_MANUAL_PDT': ('parent_state', 'parent_state'),
            'ASIGNACION_ENTREGA_MANUAL_PDT': ('parent_state', 'parent_state'),
            'ANULACION_ENTREGA_MANUAL_PDT': ('parent_state', 'parent_state'),
            'CIERRE_MANUAL_PDT': ('p.estado', 'final_state'),
        }
        inserts = re.findall(
            r'INSERT INTO public\.sgp_aluminio_pendientes_historial\(([^;]+?)\)\s*'
            r'VALUES\(([^;]+?)\);', SQL, re.S)
        found = {}
        for columns, values in inserts:
            for event, states in expected.items():
                if "'" + event + "'" in values:
                    fields = [field.strip() for field in columns.split(',')]
                    self.assertIn('estado_anterior', fields)
                    self.assertIn('estado_nuevo', fields)
                    self.assertIn(','.join(states), values.replace(' ', ''))
                    found[event] = 1 + found.get(event, 0)
        self.assertEqual(found, {event: 1 for event in expected})
        self.assertIn("WHERE id_pendiente=parent AND estado='PENDIENTE' FOR UPDATE", SQL)
        self.assertEqual(SQL.count("SELECT estado INTO parent_state"), 3)
        self.assertIn('WHERE id_pendiente=p_id RETURNING estado INTO STRICT final_state', SQL)
        self.assertTrue(SQL.rstrip().endswith('COMMIT;'))


if __name__ == '__main__':
    unittest.main()
