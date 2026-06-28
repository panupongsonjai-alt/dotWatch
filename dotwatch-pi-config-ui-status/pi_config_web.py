#!/usr/bin/env python3
import base64
import html
import json
import os
import platform
import shutil
import socket
import subprocess
import time
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs

APP_VERSION = "0.8.0"

PROJECT_DIR = Path(os.getenv("DOTWATCH_AGENT_DIR", "/home/pi/dotwatch-pi-agent"))
ENV_PATH = PROJECT_DIR / ".env"
MODBUS_CONFIG_PATH = PROJECT_DIR / "modbus_config.json"
LAST_TEST_PATH = PROJECT_DIR / "modbus_last_test_result.json"
HOST = os.getenv("DOTWATCH_CONFIG_HOST", "0.0.0.0")
PORT = int(os.getenv("DOTWATCH_CONFIG_PORT", "8080"))

DEFAULTS = {
    "DOTWATCH_API_URL": "https://dotwatch-backend.onrender.com",
    "DEVICE_CODE": "",
    "DEVICE_SECRET": "",
    "SEND_INTERVAL_SECONDS": "5",
    "FIRMWARE_VERSION": "rpi-agent-modbus-0.8.0",
    "SENSOR_SOURCE": "dummy",
    "MODBUS_CONFIG_PATH": str(MODBUS_CONFIG_PATH),
    "CONFIG_UI_USERNAME": "admin",
    "CONFIG_UI_PASSWORD": "change-this-config-password",
}


def default_register(index):
    defaults = [
        ("Voltage", "V", "holding", 0, "uint16", 1, 0.1, 0, 1),
        ("Current", "A", "holding", 1, "uint16", 1, 0.01, 0, 2),
        ("Active Power", "W", "holding", 2, "int32", 2, 1, 0, 0),
        ("Energy", "kWh", "holding", 4, "uint32", 2, 0.01, 0, 2),
        ("Frequency", "Hz", "holding", 6, "uint16", 1, 0.01, 0, 2),
        ("Power Factor", "PF", "holding", 7, "int16", 1, 0.001, 0, 3),
        ("Temperature", "°C", "holding", 8, "int16", 1, 0.1, 0, 1),
        ("Humidity", "%", "holding", 9, "uint16", 1, 0.1, 0, 1),
        ("Status", "", "coil", 0, "raw", 1, 1, 0, 0),
        ("Alarm", "", "discrete", 0, "raw", 1, 1, 0, 0),
    ]

    if index < len(defaults):
        name, unit, function, address, data_type, count, scale, offset, round_value = defaults[index]
    else:
        name, unit, function, address, data_type, count, scale, offset, round_value = (
            f"Custom {index + 1}", "", "holding", index, "uint16", 1, 1, 0, 2
        )

    return {
        "enabled": index < 6,
        "metric_key": f"metric_{index + 1}",
        "name": name,
        "unit": unit,
        "function": function,
        "address": address,
        "data_type": data_type,
        "count": count,
        "scale": scale,
        "offset": offset,
        "round": round_value,
        "unit_id": 1,
        "byte_order": "big",
        "word_order": "big",
    }


def default_modbus_config():
    return {
        "enabled": True,
        "mode": "tcp",
        "unit_id": 1,
        "tcp": {"host": "192.168.1.22", "port": 502, "timeout": 3},
        "rtu": {"port": "/dev/ttyUSB0", "baudrate": 9600, "parity": "N", "stopbits": 1, "bytesize": 8, "timeout": 3},
        "registers": [default_register(i) for i in range(20)],
    }


def esc(value):
    return html.escape(str(value or ""), quote=True)


def selected(current, value):
    return "selected" if str(current or "") == str(value) else ""


def checked(value):
    return "checked" if bool(value) else ""


def read_env(path=ENV_PATH):
    data = DEFAULTS.copy()

    if not path.exists():
        return data

    for line in path.read_text(encoding="utf-8").splitlines():
        raw = line.strip()
        if not raw or raw.startswith("#") or "=" not in raw:
            continue

        key, value = raw.split("=", 1)
        data[key.strip()] = value.strip().strip('"').strip("'")

    return data


def write_env(values, path=ENV_PATH):
    keys = [
        "DOTWATCH_API_URL",
        "DEVICE_CODE",
        "DEVICE_SECRET",
        "SEND_INTERVAL_SECONDS",
        "FIRMWARE_VERSION",
        "SENSOR_SOURCE",
        "MODBUS_CONFIG_PATH",
        "CONFIG_UI_USERNAME",
        "CONFIG_UI_PASSWORD",
    ]

    path.parent.mkdir(parents=True, exist_ok=True)

    lines = [
        "# dotWatch Raspberry Pi Agent settings",
        f"# Updated at {datetime.now().isoformat(timespec='seconds')}",
        "",
    ]

    for key in keys:
        lines.append(f"{key}={str(values.get(key, DEFAULTS.get(key, ''))).strip()}")

    lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def read_modbus_config():
    if not MODBUS_CONFIG_PATH.exists():
        return default_modbus_config()

    try:
        data = json.loads(MODBUS_CONFIG_PATH.read_text(encoding="utf-8"))
    except Exception:
        return default_modbus_config()

    cfg = default_modbus_config()
    cfg.update(data)
    cfg["tcp"] = {**default_modbus_config()["tcp"], **data.get("tcp", {})}
    cfg["rtu"] = {**default_modbus_config()["rtu"], **data.get("rtu", {})}

    registers = data.get("registers", [])
    normalized = []

    for i in range(20):
        base = default_register(i)

        if i < len(registers) and isinstance(registers[i], dict):
            base.update(registers[i])

        base["metric_key"] = f"metric_{i + 1}"
        normalized.append(base)

    cfg["registers"] = normalized
    return cfg


def write_modbus_config(config):
    MODBUS_CONFIG_PATH.write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8")


def run_cmd(args, timeout=12, cwd=None):
    try:
        result = subprocess.run(
            args,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
        output = (result.stdout or result.stderr or "").strip()
        return {"ok": result.returncode == 0, "output": output, "code": result.returncode}
    except Exception as error:
        return {"ok": False, "output": str(error), "code": -1}


def get_service_status(service):
    active = run_cmd(["systemctl", "is-active", service], timeout=5)
    enabled = run_cmd(["systemctl", "is-enabled", service], timeout=5)
    return {"active": active["output"] or "unknown", "enabled": enabled["output"] or "unknown"}


def get_network():
    ip_br = run_cmd(["ip", "-br", "addr"], timeout=5)["output"] or "N/A"
    primary_ip = "N/A"

    for line in ip_br.splitlines():
        if "UP" in line and "127.0.0.1" not in line:
            parts = line.split()
            if len(parts) >= 3:
                primary_ip = parts[2].split("/")[0]
                break

    return {"primary_ip": primary_ip, "ip_br": ip_br}


def system_status():
    net = get_network()
    return {
        "hostname": socket.gethostname(),
        "primary_ip": net["primary_ip"],
        "platform": platform.platform(),
        "agent": get_service_status("dotwatch-pi-agent"),
        "config_ui": get_service_status("dotwatch-pi-config-ui"),
    }


def dot_class(value):
    return "" if value == "active" else "offline"


def mask_secret(value):
    if not value:
        return "Not set"
    if len(value) <= 8:
        return "********"
    return f"{value[:4]}{'*' * 8}{value[-4:]}"


def install_requirements():
    venv_python = PROJECT_DIR / "venv" / "bin" / "python"
    python_bin = str(venv_python) if venv_python.exists() else "python3"
    req = PROJECT_DIR / "requirements.txt"

    if not req.exists():
        return False, "requirements.txt not found on Raspberry Pi"

    result = run_cmd([python_bin, "-m", "pip", "install", "-r", str(req)], timeout=180, cwd=str(PROJECT_DIR))
    return result["ok"], result["output"]


def test_modbus():
    venv_python = PROJECT_DIR / "venv" / "bin" / "python"
    python_bin = str(venv_python) if venv_python.exists() else "python3"
    script = PROJECT_DIR / "modbus_test.py"

    if not script.exists():
        return False, "modbus_test.py not found. Upload the Modbus agent files first."

    result = run_cmd([python_bin, str(script)], timeout=45, cwd=str(PROJECT_DIR))

    output = result["output"] or ""

    try:
        data = json.loads(output)
    except Exception:
        data = {"ok": False, "raw_output": output}

    data["time"] = datetime.now().isoformat(timespec="seconds")
    LAST_TEST_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    if data.get("ok"):
        return True, json.dumps(data, ensure_ascii=False, indent=2)

    return False, json.dumps(data, ensure_ascii=False, indent=2)


def read_last_test():
    if not LAST_TEST_PATH.exists():
        return {}
    try:
        return json.loads(LAST_TEST_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


STYLE = """
<style>
:root{color-scheme:dark;--bg:#070a12;--sidebar:#0b1020;--line:rgba(148,163,184,.16);--text:#f8fafc;--muted:#9fb2cd;--muted2:#64748b;--accent:#ef4444;--accent2:#f97316;--green:#22c55e;--red:#ef4444;--yellow:#f59e0b;--radius:22px;--shadow:0 24px 70px rgba(0,0,0,.34)}
*{box-sizing:border-box}body{margin:0;min-height:100vh;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--text);background:radial-gradient(circle at -10% -20%,rgba(239,68,68,.24),transparent 34rem),linear-gradient(135deg,#070a12,#0b1020 48%,#070a12)}a{color:inherit;text-decoration:none}button,input,select{font:inherit}.app{min-height:100vh;display:grid;grid-template-columns:280px 1fr}.sidebar{position:sticky;top:0;height:100vh;padding:22px;background:linear-gradient(180deg,rgba(11,16,32,.96),rgba(7,10,18,.96));border-right:1px solid var(--line)}.brand{display:flex;gap:12px;align-items:center;padding:10px 8px 22px}.logo{width:46px;height:46px;border-radius:16px;display:grid;place-items:center;background:linear-gradient(135deg,var(--accent),var(--accent2));font-weight:950}.brand-title{font-size:1.1rem;font-weight:950}.brand-subtitle{color:var(--muted2);font-size:.78rem;font-weight:800;text-transform:uppercase}.nav-label{padding:0 10px 10px;color:var(--muted2);font-size:.72rem;font-weight:900;text-transform:uppercase;letter-spacing:.12em}.nav-link{display:flex;gap:10px;padding:12px 13px;margin-bottom:8px;border:1px solid transparent;border-radius:16px;color:var(--muted);font-weight:850}.nav-link.active{color:#fff;border-color:rgba(239,68,68,.34);background:linear-gradient(135deg,rgba(239,68,68,.20),rgba(249,115,22,.10));box-shadow:inset 3px 0 0 rgba(239,68,68,.95)}.nav-icon{width:28px;height:28px;border-radius:10px;display:grid;place-items:center;background:rgba(148,163,184,.09)}.main{min-width:0;padding:26px clamp(18px,3vw,36px) 44px}.header{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;margin-bottom:20px}.eyebrow{color:#fca5a5;font-size:.78rem;font-weight:950;text-transform:uppercase;letter-spacing:.12em}h1{margin:6px 0 0;font-size:clamp(1.7rem,3vw,2.65rem);line-height:1.03;letter-spacing:-.055em}.header p{margin:10px 0 0;color:var(--muted)}.header-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end}.pill{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:999px;background:rgba(15,23,42,.70);color:var(--muted);padding:9px 12px;font-size:.82rem;font-weight:850}.status-dot{width:9px;height:9px;border-radius:99px;background:var(--green);box-shadow:0 0 0 5px rgba(34,197,94,.12)}.status-dot.offline{background:var(--red);box-shadow:0 0 0 5px rgba(239,68,68,.12)}.button-link,button{border:0;border-radius:14px;padding:11px 14px;color:#fff;cursor:pointer;font-weight:950;background:linear-gradient(135deg,var(--accent),var(--accent2));box-shadow:0 14px 30px rgba(239,68,68,.18);font-size:.88rem}.secondary{background:rgba(148,163,184,.10);border:1px solid var(--line);box-shadow:none}.warning{background:rgba(245,158,11,.13);border:1px solid rgba(245,158,11,.25);box-shadow:none;color:#fde68a}.danger{background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.28);box-shadow:none;color:#fecaca}.grid{display:grid;grid-template-columns:1fr 380px;gap:18px;align-items:start}.card{border:1px solid var(--line);background:linear-gradient(180deg,rgba(16,24,39,.92),rgba(13,20,34,.90));border-radius:var(--radius);box-shadow:var(--shadow);overflow:hidden}.card-header{padding:20px 22px 16px;border-bottom:1px solid var(--line);background:rgba(255,255,255,.025)}.card-header h2{margin:0;font-size:1.04rem}.card-header p{margin:8px 0 0;color:var(--muted);font-size:.88rem;line-height:1.55}.card-body{padding:20px 22px 22px}.block{padding:16px;border:1px solid var(--line);border-radius:18px;background:rgba(2,6,23,.22);margin-bottom:16px}.block-title{margin:0 0 14px;color:#cbd5e1;font-size:.76rem;font-weight:950;text-transform:uppercase;letter-spacing:.11em}.form-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.field{display:flex;flex-direction:column;gap:8px}.field.full{grid-column:1/-1}.field.two{grid-column:span 2}label{color:#cbd5e1;font-size:.82rem;font-weight:850}input,select{width:100%;border:1px solid rgba(148,163,184,.18);background:rgba(2,6,23,.52);color:var(--text);border-radius:14px;padding:11px 12px;outline:none}.hint{color:var(--muted2);font-size:.78rem;line-height:1.45}.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}.notice{border-radius:16px;padding:13px 15px;margin-bottom:16px;border:1px solid var(--line);background:rgba(56,189,248,.08);color:#bfdbfe;line-height:1.5}.notice.success{background:rgba(34,197,94,.10);border-color:rgba(34,197,94,.22);color:#bbf7d0}.notice.danger{background:rgba(239,68,68,.10);border-color:rgba(239,68,68,.22);color:#fecaca}.notice.warning{background:rgba(245,158,11,.10);border-color:rgba(245,158,11,.22);color:#fde68a}.map-table-wrap{overflow:auto;border:1px solid var(--line);border-radius:18px}.map-table{width:100%;min-width:1260px;border-collapse:separate;border-spacing:0;background:rgba(2,6,23,.28)}.map-table th,.map-table td{border-bottom:1px solid var(--line);padding:10px 8px;text-align:left;vertical-align:middle}.map-table th{position:sticky;top:0;background:#111827;color:#cbd5e1;font-size:.74rem;text-transform:uppercase;letter-spacing:.08em;z-index:1}.map-table tr:last-child td{border-bottom:0}.map-table input,.map-table select{padding:9px 10px;border-radius:11px;font-size:.84rem}.map-table .mini{width:76px}.map-table .tiny{width:58px}.map-table .name{width:170px}.map-table .metric{width:86px}.check{width:18px;height:18px}.result-list{display:grid;gap:10px}.result-item{display:grid;grid-template-columns:90px 1fr auto;gap:10px;align-items:center;border:1px solid var(--line);border-radius:14px;padding:12px;background:rgba(2,6,23,.28)}.result-item span{color:var(--muted);font-size:.78rem}.result-item strong{overflow-wrap:anywhere}.result-value{font-size:1rem;color:#bbf7d0;font-weight:950}.empty{color:var(--muted2);font-size:.9rem;line-height:1.5}pre{margin:0;padding:14px;border:1px solid var(--line);border-radius:14px;background:rgba(2,6,23,.52);color:#cbd5e1;overflow:auto;max-height:360px;font-size:.78rem;line-height:1.55}.footer{margin-top:18px;color:var(--muted2);font-size:.8rem;text-align:center}@media(max-width:1200px){.grid{grid-template-columns:1fr}.form-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:1080px){.app{grid-template-columns:1fr}.sidebar{position:relative;height:auto;border-right:0;border-bottom:1px solid var(--line)}.nav-section{display:flex;gap:8px;overflow:auto}.nav-label{display:none}}@media(max-width:640px){.main{padding:18px 12px 36px}.header{flex-direction:column}.form-grid{grid-template-columns:1fr}.field.two{grid-column:span 1}}
</style>
"""


def shell(content, page="modbus", message="", message_type="info"):
    st = system_status()
    active = {name: "active" if page == name else "" for name in ["settings", "status", "network", "modbus"]}
    title = {
        "settings": "Pi Gateway Settings",
        "status": "Raspberry Pi Status",
        "network": "Network Settings",
        "modbus": "Modbus Mapping 20 Values",
    }.get(page, "Pi Gateway Settings")
    subtitle = {
        "settings": "Manage backend and agent runtime settings.",
        "status": "Monitor services and network health.",
        "network": "View current network status for the gateway.",
        "modbus": "Easy mapping table for metric_1 to metric_20 with live test result display.",
    }.get(page, "")
    message_html = f'<div class="notice {esc(message_type)}">{esc(message)}</div>' if message else ""
    refresh_path = f"/{page}" if page != "settings" else "/"

    return f"""<!doctype html>
<html lang="th">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>dotWatch Pi Config</title>{STYLE}</head>
<body>
<div class="app">
<aside class="sidebar">
  <div class="brand"><div class="logo">d</div><div><div class="brand-title">dotWatch</div><div class="brand-subtitle">Pi Gateway</div></div></div>
  <div class="nav-label">Navigation</div>
  <nav class="nav-section">
    <a class="nav-link {active["settings"]}" href="/"><span class="nav-icon">⚙</span>Settings</a>
    <a class="nav-link {active["status"]}" href="/status"><span class="nav-icon">●</span>Pi Status</a>
    <a class="nav-link {active["network"]}" href="/network"><span class="nav-icon">⌁</span>Network</a>
    <a class="nav-link {active["modbus"]}" href="/modbus"><span class="nav-icon">↔</span>Modbus Map</a>
    <a class="nav-link" href="/logout"><span class="nav-icon">↩</span>Logout</a>
  </nav>
</aside>
<main class="main">
  <header class="header">
    <div><div class="eyebrow">dotWatch Raspberry Pi</div><h1>{esc(title)}</h1><p>{esc(subtitle)}</p></div>
    <div class="header-actions">
      <span class="pill"><span class="status-dot {dot_class(st["agent"]["active"])}"></span>Agent: {esc(st["agent"]["active"])}</span>
      <span class="pill">IP: {esc(st["primary_ip"])}</span>
      <a class="button-link secondary" href="{refresh_path}">Refresh</a>
    </div>
  </header>
  {message_html}
  {content}
  <div class="footer">dotWatch Pi Config UI v{APP_VERSION} · Local network only</div>
</main>
</div>
</body>
</html>""".encode("utf-8")


def settings_page(message="", message_type="info"):
    cfg = read_env()
    content = f"""
    <section class="card">
      <div class="card-header"><h2>Settings</h2><p>ตั้งค่าพื้นฐานของ dotWatch Pi Agent</p></div>
      <div class="card-body">
        <form method="POST" action="/save">
          <div class="form-grid">
            <div class="field two"><label>Backend API URL</label><input name="DOTWATCH_API_URL" value="{esc(cfg.get("DOTWATCH_API_URL"))}"></div>
            <div class="field"><label>Device Code</label><input name="DEVICE_CODE" value="{esc(cfg.get("DEVICE_CODE"))}"></div>
            <div class="field"><label>Device Secret</label><input name="DEVICE_SECRET" type="password" value="{esc(cfg.get("DEVICE_SECRET"))}"><div class="hint">{esc(mask_secret(cfg.get("DEVICE_SECRET")))}</div></div>
            <div class="field"><label>Send Interval</label><input name="SEND_INTERVAL_SECONDS" type="number" value="{esc(cfg.get("SEND_INTERVAL_SECONDS"))}"></div>
            <div class="field"><label>Firmware</label><input name="FIRMWARE_VERSION" value="{esc(cfg.get("FIRMWARE_VERSION"))}"></div>
            <div class="field"><label>Sensor Source</label><select name="SENSOR_SOURCE"><option value="dummy" {selected(cfg.get("SENSOR_SOURCE"), "dummy")}>Dummy</option><option value="modbus" {selected(cfg.get("SENSOR_SOURCE"), "modbus")}>Modbus</option></select></div>
            <div class="field"><label>Modbus Config Path</label><input name="MODBUS_CONFIG_PATH" value="{esc(cfg.get("MODBUS_CONFIG_PATH") or str(MODBUS_CONFIG_PATH))}"></div>
            <div class="field"><label>UI Username</label><input name="CONFIG_UI_USERNAME" value="{esc(cfg.get("CONFIG_UI_USERNAME"))}"></div>
            <div class="field"><label>UI Password</label><input name="CONFIG_UI_PASSWORD" type="password" value="{esc(cfg.get("CONFIG_UI_PASSWORD"))}"></div>
          </div>
          <div class="actions"><button type="submit">Save Settings</button></div>
        </form>
      </div>
    </section>
    """
    return shell(content, "settings", message, message_type)


def status_page(message="", message_type="info"):
    st = system_status()
    content = f"""
    <section class="card"><div class="card-header"><h2>Status</h2></div><div class="card-body">
      <pre>Hostname: {esc(st["hostname"])}
Primary IP: {esc(st["primary_ip"])}
Agent: {esc(st["agent"]["active"])}
Config UI: {esc(st["config_ui"]["active"])}
Platform: {esc(st["platform"])}</pre>
    </div></section>
    """
    return shell(content, "status", message, message_type)


def network_page(message="", message_type="info"):
    st = system_status()
    content = f"""
    <section class="card"><div class="card-header"><h2>Network</h2></div><div class="card-body">
      <pre>{esc(st["primary_ip"])}
{esc(st.get("network", {}).get("ip_br", ""))}</pre>
    </div></section>
    """
    return shell(content, "network", message, message_type)


def render_register_rows(registers):
    rows = []

    for i, item in enumerate(registers[:20]):
        rows.append(f"""
        <tr>
          <td><input class="check" type="checkbox" name="reg_{i}_enabled" value="true" {checked(item.get("enabled", False))}></td>
          <td><input class="metric" name="reg_{i}_metric_key" value="metric_{i+1}" readonly></td>
          <td><input class="name" name="reg_{i}_name" value="{esc(item.get("name"))}"></td>
          <td><input class="tiny" name="reg_{i}_unit" value="{esc(item.get("unit", ""))}"></td>
          <td>
            <select name="reg_{i}_function">
              <option value="holding" {selected(item.get("function"), "holding")}>holding / FC03</option>
              <option value="input" {selected(item.get("function"), "input")}>input / FC04</option>
              <option value="coil" {selected(item.get("function"), "coil")}>coil / FC01</option>
              <option value="discrete" {selected(item.get("function"), "discrete")}>discrete / FC02</option>
            </select>
          </td>
          <td><input class="mini" type="number" name="reg_{i}_address" value="{esc(item.get("address", 0))}"></td>
          <td>
            <select name="reg_{i}_data_type">
              <option value="uint16" {selected(item.get("data_type"), "uint16")}>uint16</option>
              <option value="int16" {selected(item.get("data_type"), "int16")}>int16</option>
              <option value="uint32" {selected(item.get("data_type"), "uint32")}>uint32</option>
              <option value="int32" {selected(item.get("data_type"), "int32")}>int32</option>
              <option value="float32" {selected(item.get("data_type"), "float32")}>float32</option>
              <option value="raw" {selected(item.get("data_type"), "raw")}>raw</option>
            </select>
          </td>
          <td><input class="tiny" type="number" name="reg_{i}_count" value="{esc(item.get("count", 1))}"></td>
          <td><input class="mini" type="number" step="any" name="reg_{i}_scale" value="{esc(item.get("scale", 1))}"></td>
          <td><input class="mini" type="number" step="any" name="reg_{i}_offset" value="{esc(item.get("offset", 0))}"></td>
          <td><input class="tiny" type="number" name="reg_{i}_round" value="{esc(item.get("round", 2))}"></td>
          <td><input class="tiny" type="number" name="reg_{i}_unit_id" value="{esc(item.get("unit_id", 1))}"></td>
          <td>
            <select name="reg_{i}_byte_order">
              <option value="big" {selected(item.get("byte_order"), "big")}>big</option>
              <option value="little" {selected(item.get("byte_order"), "little")}>little</option>
            </select>
          </td>
          <td>
            <select name="reg_{i}_word_order">
              <option value="big" {selected(item.get("word_order"), "big")}>big</option>
              <option value="little" {selected(item.get("word_order"), "little")}>little</option>
            </select>
          </td>
        </tr>
        """)

    return "\n".join(rows)


def render_results(last_test, registers):
    if not last_test:
        return '<div class="empty">ยังไม่มีผลทดสอบ กด <strong>Test Modbus Read</strong> เพื่ออ่านค่าแล้วแสดงผลตรงนี้</div>'

    if not last_test.get("ok"):
        return f"""
        <div class="notice danger" style="margin-bottom:12px;">Test Failed: {esc(last_test.get("error") or last_test.get("raw_output") or "Unknown error")}</div>
        <pre>{esc(json.dumps(last_test, ensure_ascii=False, indent=2))}</pre>
        """

    metrics = last_test.get("metrics", {})
    by_key = {item.get("metric_key"): item for item in registers}
    items = []

    for i in range(1, 21):
        key = f"metric_{i}"
        value = metrics.get(key, "-")
        item = by_key.get(key, {})
        name = item.get("name", key)
        unit = item.get("unit", "")

        items.append(f"""
        <div class="result-item">
          <span>{esc(key)}</span>
          <strong>{esc(name)}</strong>
          <div class="result-value">{esc(value)} {esc(unit)}</div>
        </div>
        """)

    return f"""
    <div class="hint" style="margin-bottom:12px;">Last test: {esc(last_test.get("time", ""))}</div>
    <div class="result-list">{''.join(items)}</div>
    """


def modbus_page(message="", message_type="info"):
    cfg = read_env()
    modbus = read_modbus_config()
    registers = modbus.get("registers", [])
    last_test = read_last_test()

    content = f"""
    <section class="grid">
      <form class="card" method="POST" action="/modbus/save-table">
        <div class="card-header">
          <h2>Easy Modbus Mapping</h2>
          <p>ตั้งค่าอ่านค่า Modbus ได้สูงสุด 20 ค่า โดยไม่ต้องแก้ JSON เอง</p>
        </div>
        <div class="card-body">
          <div class="block">
            <div class="block-title">Connection</div>
            <div class="form-grid">
              <div class="field">
                <label>Enable Modbus</label>
                <select name="enabled">
                  <option value="false" {selected(str(modbus.get("enabled")).lower(), "false")}>Disabled</option>
                  <option value="true" {selected(str(modbus.get("enabled")).lower(), "true")}>Enabled</option>
                </select>
              </div>
              <div class="field">
                <label>Mode</label>
                <select name="mode">
                  <option value="tcp" {selected(modbus.get("mode"), "tcp")}>Modbus TCP</option>
                  <option value="rtu" {selected(modbus.get("mode"), "rtu")}>Modbus RTU</option>
                </select>
              </div>
              <div class="field">
                <label>Default Unit ID</label>
                <input name="unit_id" type="number" value="{esc(modbus.get("unit_id", 1))}">
              </div>
              <div class="field">
                <label>Agent Source</label>
                <select name="sensor_source">
                  <option value="dummy" {selected(cfg.get("SENSOR_SOURCE"), "dummy")}>Dummy</option>
                  <option value="modbus" {selected(cfg.get("SENSOR_SOURCE"), "modbus")}>Modbus</option>
                </select>
              </div>
              <div class="field">
                <label>TCP Host</label>
                <input name="tcp_host" value="{esc(modbus.get("tcp", {}).get("host", "192.168.1.22"))}">
              </div>
              <div class="field">
                <label>TCP Port</label>
                <input name="tcp_port" type="number" value="{esc(modbus.get("tcp", {}).get("port", 502))}">
              </div>
              <div class="field">
                <label>TCP Timeout</label>
                <input name="tcp_timeout" type="number" step="0.1" value="{esc(modbus.get("tcp", {}).get("timeout", 3))}">
              </div>
              <div class="field">
                <label>RTU Port</label>
                <input name="rtu_port" value="{esc(modbus.get("rtu", {}).get("port", "/dev/ttyUSB0"))}">
              </div>
              <div class="field">
                <label>Baudrate</label>
                <input name="rtu_baudrate" type="number" value="{esc(modbus.get("rtu", {}).get("baudrate", 9600))}">
              </div>
              <div class="field">
                <label>Parity</label>
                <select name="rtu_parity">
                  <option value="N" {selected(modbus.get("rtu", {}).get("parity"), "N")}>N</option>
                  <option value="E" {selected(modbus.get("rtu", {}).get("parity"), "E")}>E</option>
                  <option value="O" {selected(modbus.get("rtu", {}).get("parity"), "O")}>O</option>
                </select>
              </div>
              <div class="field">
                <label>Stopbits</label>
                <input name="rtu_stopbits" type="number" value="{esc(modbus.get("rtu", {}).get("stopbits", 1))}">
              </div>
              <div class="field">
                <label>RTU Timeout</label>
                <input name="rtu_timeout" type="number" step="0.1" value="{esc(modbus.get("rtu", {}).get("timeout", 3))}">
              </div>
            </div>
          </div>

          <div class="block">
            <div class="block-title">20 Data Mapping</div>
            <div class="hint" style="margin-bottom:12px;">แนะนำเริ่มจาก Enable ทีละ 1 ค่า แล้วกด Test Read ถ้าผ่านค่อยเปิดเพิ่ม</div>
            <div class="map-table-wrap">
              <table class="map-table">
                <thead>
                  <tr>
                    <th>On</th>
                    <th>Metric</th>
                    <th>Name</th>
                    <th>Unit</th>
                    <th>Function</th>
                    <th>Addr</th>
                    <th>Type</th>
                    <th>Cnt</th>
                    <th>Scale</th>
                    <th>Offset</th>
                    <th>Round</th>
                    <th>ID</th>
                    <th>Byte</th>
                    <th>Word</th>
                  </tr>
                </thead>
                <tbody>
                  {render_register_rows(registers)}
                </tbody>
              </table>
            </div>
          </div>

          <div class="actions">
            <button type="submit">Save Mapping</button>
            <button class="secondary" type="submit" name="action" value="save_and_test">Save & Test Read</button>
          </div>
        </div>
      </form>

      <aside class="card">
        <div class="card-header">
          <h2>Live Test Result</h2>
          <p>แสดงผลอ่านค่า metric_1 ถึง metric_20 หลังทดสอบ</p>
        </div>
        <div class="card-body">
          <form class="actions" method="POST" action="/modbus/install">
            <button class="secondary" type="submit">Install Dependencies</button>
          </form>
          <form class="actions" method="POST" action="/modbus/test">
            <button class="warning" type="submit">Test Modbus Read</button>
          </form>
          <form class="actions" method="POST" action="/restart-agent">
            <button type="submit">Restart Agent</button>
          </form>
          <div style="height:16px;"></div>
          {render_results(last_test, registers)}
        </div>
      </aside>
    </section>
    """
    return shell(content, "modbus", message, message_type)


def parse_register(form, i):
    data_type = form.get(f"reg_{i}_data_type", "uint16")
    default_count = 2 if data_type in ("float32", "int32", "uint32") else 1

    return {
        "enabled": form.get(f"reg_{i}_enabled") == "true",
        "metric_key": f"metric_{i + 1}",
        "name": form.get(f"reg_{i}_name", f"Metric {i + 1}").strip(),
        "unit": form.get(f"reg_{i}_unit", "").strip(),
        "function": form.get(f"reg_{i}_function", "holding"),
        "address": int(form.get(f"reg_{i}_address", i) or i),
        "data_type": data_type,
        "count": int(form.get(f"reg_{i}_count", default_count) or default_count),
        "scale": float(form.get(f"reg_{i}_scale", 1) or 1),
        "offset": float(form.get(f"reg_{i}_offset", 0) or 0),
        "round": int(form.get(f"reg_{i}_round", 2) or 2),
        "unit_id": int(form.get(f"reg_{i}_unit_id", 1) or 1),
        "byte_order": form.get(f"reg_{i}_byte_order", "big"),
        "word_order": form.get(f"reg_{i}_word_order", "big"),
    }


def logout_page():
    return f"""<!doctype html><html><head><meta charset="utf-8">{STYLE}</head><body><main class="main" style="max-width:760px;margin:0 auto;"><section class="card"><div class="card-header"><h2>Logged out</h2></div><div class="card-body"><div class="notice warning">บาง browser จะจำ Basic Auth ไว้จนกว่าจะปิดแท็บหรือปิด browser</div><a class="button-link secondary" href="/">Login again</a></div></section></main></body></html>""".encode("utf-8")


class Handler(BaseHTTPRequestHandler):
    server_version = f"dotWatchPiConfig/{APP_VERSION}"

    def is_authorized(self):
        cfg = read_env()
        username = cfg.get("CONFIG_UI_USERNAME", "admin")
        password = cfg.get("CONFIG_UI_PASSWORD", "change-this-config-password")
        header = self.headers.get("Authorization", "")

        if not header.startswith("Basic "):
            return False

        try:
            decoded = base64.b64decode(header.split(" ", 1)[1].strip()).decode("utf-8")
            supplied_username, supplied_password = decoded.split(":", 1)
            return supplied_username == username and supplied_password == password
        except Exception:
            return False

    def require_auth(self):
        self.send_response(401)
        self.send_header("WWW-Authenticate", 'Basic realm="dotWatch Pi Config"')
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()
        self.wfile.write("Authentication required".encode("utf-8"))

    def send_html(self, page="modbus", message="", message_type="info"):
        if not self.is_authorized():
            self.require_auth()
            return

        pages = {"settings": settings_page, "status": status_page, "network": network_page, "modbus": modbus_page}
        body = pages.get(page, modbus_page)(message, message_type)

        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(body)

    def read_form(self):
        length = int(self.headers.get("Content-Length", "0") or "0")
        body = self.rfile.read(length).decode("utf-8")
        parsed = parse_qs(body)
        return {key: values[0] if values else "" for key, values in parsed.items()}

    def do_GET(self):
        if self.path == "/health":
            body = json.dumps({"ok": True, "version": APP_VERSION}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(body)
            return

        if self.path == "/logout":
            self.send_response(401)
            self.send_header("WWW-Authenticate", f'Basic realm="dotWatch Pi Config Logout {int(time.time())}"')
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(logout_page())
            return

        if self.path == "/" or self.path.startswith("/?"):
            self.send_html("settings")
            return
        if self.path.startswith("/status"):
            self.send_html("status")
            return
        if self.path.startswith("/network"):
            self.send_html("network")
            return
        if self.path.startswith("/modbus"):
            self.send_html("modbus")
            return

        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        if not self.is_authorized():
            self.require_auth()
            return

        if self.path == "/save":
            form = self.read_form()
            cfg = read_env()
            cfg.update(form)
            cfg["MODBUS_CONFIG_PATH"] = cfg.get("MODBUS_CONFIG_PATH") or str(MODBUS_CONFIG_PATH)
            write_env(cfg)
            self.send_html("settings", "Saved settings successfully.", "success")
            return

        if self.path == "/restart-agent":
            result = run_cmd(["sudo", "-n", "systemctl", "restart", "dotwatch-pi-agent"], timeout=12)
            self.send_html("modbus", "Agent restarted successfully." if result["ok"] else "Restart failed: " + result["output"], "success" if result["ok"] else "danger")
            return

        if self.path == "/modbus/install":
            ok, output = install_requirements()
            self.send_html("modbus", ("Install success: " if ok else "Install failed: ") + output[:1200], "success" if ok else "danger")
            return

        if self.path == "/modbus/test":
            ok, output = test_modbus()
            self.send_html("modbus", ("Modbus test success." if ok else "Modbus test failed."), "success" if ok else "danger")
            return

        if self.path == "/modbus/save-table":
            form = self.read_form()

            try:
                config = {
                    "enabled": form.get("enabled") == "true",
                    "mode": form.get("mode", "tcp"),
                    "unit_id": int(form.get("unit_id", 1)),
                    "tcp": {
                        "host": form.get("tcp_host", "192.168.1.22"),
                        "port": int(form.get("tcp_port", 502)),
                        "timeout": float(form.get("tcp_timeout", 3)),
                    },
                    "rtu": {
                        "port": form.get("rtu_port", "/dev/ttyUSB0"),
                        "baudrate": int(form.get("rtu_baudrate", 9600)),
                        "parity": form.get("rtu_parity", "N"),
                        "stopbits": int(form.get("rtu_stopbits", 1)),
                        "bytesize": 8,
                        "timeout": float(form.get("rtu_timeout", 3)),
                    },
                    "registers": [parse_register(form, i) for i in range(20)],
                }

                write_modbus_config(config)

                cfg = read_env()
                cfg["SENSOR_SOURCE"] = form.get("sensor_source", "dummy")
                cfg["MODBUS_CONFIG_PATH"] = str(MODBUS_CONFIG_PATH)
                write_env(cfg)

                if form.get("action") == "save_and_test":
                    ok, output = test_modbus()
                    self.send_html("modbus", "Saved mapping and test success." if ok else "Saved mapping but test failed.", "success" if ok else "danger")
                else:
                    self.send_html("modbus", "Saved 20-value Modbus mapping successfully.", "success")

            except Exception as error:
                self.send_html("modbus", "Save failed: " + str(error), "danger")
            return

        self.send_response(404)
        self.end_headers()


def main():
    print(f"dotWatch Pi Config UI started on http://{HOST}:{PORT}")
    print(f"Version: {APP_VERSION}")
    print(f"Project dir: {PROJECT_DIR}")
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    server.serve_forever()


if __name__ == "__main__":
    main()
