import json
from pathlib import Path

from sensors.modbus_sensor import read_modbus_metrics


BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = BASE_DIR / "modbus_config.json"


def main():
    try:
        metrics = read_modbus_metrics(CONFIG_PATH)
        print(json.dumps({"ok": True, "config_path": str(CONFIG_PATH), "metrics": metrics}, ensure_ascii=False, indent=2))
    except Exception as error:
        print(json.dumps({"ok": False, "config_path": str(CONFIG_PATH), "error": str(error)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
