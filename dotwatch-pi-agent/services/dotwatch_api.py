import json
import urllib.error
import urllib.request


def post_ingest(settings, metrics):
    if not settings.api_url:
        raise RuntimeError("DOTWATCH_API_URL is missing")

    if not settings.device_code:
        raise RuntimeError("DEVICE_CODE is missing")

    if not settings.device_secret:
        raise RuntimeError("DEVICE_SECRET is missing")

    url = f"{settings.api_url.rstrip('/')}/api/ingest"

    payload = {
        "device_code": settings.device_code,
        "device_secret": settings.device_secret,
        "deviceCode": settings.device_code,
        "deviceSecret": settings.device_secret,
        "secret": settings.device_secret,
        "firmware_version": settings.firmware_version,
        "firmwareVersion": settings.firmware_version,
        "metrics": metrics,
        **metrics,
    }

    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "x-device-code": settings.device_code,
            "x-device-secret": settings.device_secret,
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            body = response.read().decode("utf-8")
            return json.loads(body) if body else {"ok": True}

    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8")
        raise RuntimeError(f"HTTP {error.code}: {body}") from error

    except urllib.error.URLError as error:
        raise RuntimeError(f"Network error: {error.reason}") from error
