import { AlertTriangle, CheckCircle2, HelpCircle, WifiOff } from 'lucide-react'

function getHealthMeta(status = 'offline') {
  if (status === 'healthy') {
    return {
      label: 'Healthy',
      tone: 'healthy',
      icon: <CheckCircle2 size={18} />,
    }
  }

  if (status === 'warning') {
    return {
      label: 'Warning',
      tone: 'warning',
      icon: <AlertTriangle size={18} />,
    }
  }

  if (status === 'critical') {
    return {
      label: 'Critical',
      tone: 'critical',
      icon: <AlertTriangle size={18} />,
    }
  }

  return {
    label: 'Offline',
    tone: 'offline',
    icon: <WifiOff size={18} />,
  }
}

function DeviceHealthCard({ device }) {
  const healthStatus = device?.health_status || 'offline'
  const meta = getHealthMeta(healthStatus)

  return (
    <article className={`device-health-card ${meta.tone}`}>
      <div className="device-health-icon">{meta.icon || <HelpCircle size={18} />}</div>

      <div>
        <strong>{device?.name || device?.device_code || 'Unnamed Device'}</strong>
        <span>{meta.label}</span>
        <p>{device?.health_reason || 'No health detail'}</p>
      </div>
    </article>
  )
}

export default DeviceHealthCard
