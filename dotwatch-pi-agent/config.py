import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / ".env"


def load_env_file(path=ENV_PATH):
    if not path.exists():
        return

    for line in path.read_text(encoding="utf-8").splitlines():
        raw = line.strip()
        if not raw or raw.startswith("#") or "=" not in raw:
            continue

        key, value = raw.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")

        if key and key not in os.environ:
            os.environ[key] = value


def get_int(name, default):
    try:
        return int(os.getenv(name, default))
    except Exception:
        return default


load_env_file()


class Settings:
    api_url = os.getenv("DOTWATCH_API_URL", "https://dotwatch-backend.onrender.com").rstrip("/")
    device_code = os.getenv("DEVICE_CODE", "")
    device_secret = os.getenv("DEVICE_SECRET", "")
    send_interval_seconds = get_int("SEND_INTERVAL_SECONDS", 5)
    firmware_version = os.getenv("FIRMWARE_VERSION", "rpi-agent-0.1.0")
    sensor_source = os.getenv("SENSOR_SOURCE", "dummy").strip().lower()
    modbus_config_path = os.getenv("MODBUS_CONFIG_PATH", str(BASE_DIR / "modbus_config.json"))


settings = Settings()
