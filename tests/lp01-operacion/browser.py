"""Compatibility entry point. Current closure UI uses the real XLSX acceptance suite.
Historical CSV UI evidence belongs to c5178d8; its SQL compatibility is tested separately.
"""
from pathlib import Path
import runpy,sys
suite=Path(__file__).resolve().parents[1]/'lp01-powerbi'/'browser.py'
sys.path.insert(0,str(suite.parent))
runpy.run_path(str(suite),run_name='__main__')
