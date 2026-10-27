"""Historical CLI retained. Current base/receipt/processing contract supersedes assigned-only totals.
Issue103's original artifacts stay unchanged; this command writes the new test's own evidence.
"""
import runpy,pathlib
runpy.run_path(str(pathlib.Path(__file__).resolve().parents[1]/'mecanizado-base-progress/browser.py'),run_name='__main__')
