"""Write the API's OpenAPI schema, the source the web client's types are generated from.

    python -m app.openapi_spec ../web/openapi.json

CI regenerates it and fails if the committed copy differs, so web/src/lib/api-schema.ts can't
drift from the routes' response models.
"""

import json
import sys
from pathlib import Path

from app.main import app


def main(argv: list[str]) -> None:
    """Write the schema to the path given as the only argument.

    Raises:
        SystemExit: no output path was given.
    """
    if len(argv) != 1:
        raise SystemExit("usage: python -m app.openapi_spec <output.json>")
    Path(argv[0]).write_text(json.dumps(app.openapi(), indent=2, sort_keys=True) + "\n")


if __name__ == "__main__":
    main(sys.argv[1:])
