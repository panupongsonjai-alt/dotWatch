import time
from datetime import datetime

from config import settings
from services.dotwatch_api import post_ingest
from sensors.dummy_sensor import read_dummy_metrics


def read_metrics():
    if settings.sensor_source == "modbus":
        from sensors.modbus_sensor import read_modbus_metrics
        return read_modbus_metrics(settings.modbus_config_path)

    return read_dummy_metrics()


def main():
    print("dotWatch Raspberry Pi Agent started")
    print(f"API URL: {settings.api_url}")
    print(f"Device Code: {settings.device_code}")
    print(f"Send interval: {settings.send_interval_seconds}s")
    print(f"Sensor source: {settings.sensor_source}")
    print(f"Modbus config: {settings.modbus_config_path}")

    while True:
        try:
            metrics = read_metrics()
            result = post_ingest(settings, metrics)

            print(f"[{datetime.now().isoformat(timespec='seconds')}] Sent metrics: {metrics}")
            print(f"Server response: {result}")

        except Exception as error:
            print(f"[{datetime.now().isoformat(timespec='seconds')}] ERROR: {error}")

        time.sleep(settings.send_interval_seconds)


if __name__ == "__main__":
    main()
