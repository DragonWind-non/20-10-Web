"""Run the shared directional-passage acceptance, including visible-pose continuity."""
import runpy
from pathlib import Path

if __name__ == '__main__':
    runpy.run_path(str(Path(__file__).with_name('test-liquid-passage.py')), run_name='__main__')
