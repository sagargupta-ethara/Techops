import subprocess
import sys
from pathlib import Path


def test_analysis_module_imports_without_optional_llm_dependency() -> None:
    backend_dir = Path(__file__).parents[1]

    result = subprocess.run(
        [sys.executable, "-c", "import analysis"],
        cwd=backend_dir,
        capture_output=True,
        check=False,
        text=True,
    )

    assert result.returncode == 0, result.stderr
