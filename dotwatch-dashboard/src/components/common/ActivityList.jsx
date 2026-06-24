import {
  Activity,
  Bell,
  CheckCircle2,
  CircleAlert,
  Radio,
  Wifi,
  WifiOff,
} from 'lucide-react'
import EmptyState from './EmptyState.jsx'

function formatActivityTime(value) {
  if (!value) return '--'

  try {
    return new Date(value).toLocaleString('th-TH', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return '--'
  }
}

function getActivityIcon(type, severity) {
  if (type === 'device.online') return Wifi
  if (type === 'device.offline') return WifiOff
  if (type === 'alarm.triggered') return CircleAlert
  if (type === 'alarm.acknowledged') return CheckCircle2
  if (type === 'reading.received') return Radio
  if (severity === 'warning' || severity === 'critical') return Bell
  return Activity
}

function getActivityTone(item) {
  if (item.severity === 'critical' || item.severity === 'danger') return 'danger'
  if (item.severity === 'warning') return 'warning'
  if (item.severity === 'success') return 'success'
  return 'info'
}

function normalizeItems(items = []) {
  return Array.isArray(items) ? items.filter(Boolean) : []
}

function ActivityList({
  items,
  loading = false,
  compact = false,
  emptyTitle = 'No activity yet',
  emptyDescription = 'New device, alarm, and system events will appear here.',
}) {
  const activityItems = normalizeItems(items)

  if (loading) {
    return (
      <div className={`dw-activity-list ${compact ? 'compact' : ''}`}>
        {[1, 2, 3].map((item) => (
          <div key={item} className="dw-activity-item loading">
            <span className="dw-activity-icon" />
            <div>
              <strong>Loading activity...</strong>
              <p>กำลังโหลดเหตุการณ์ล่าสุด</p>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (activityItems.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
      />
    )
  }

  return (
    <div className={`dw-activity-list ${compact ? 'compact' : ''}`}>
      {activityItems.map((item) => {
        const Icon = getActivityIcon(item.activity_type, item.severity)
        const tone = getActivityTone(item)

        return (
          <article key={item.id || `${item.activity_type}-${item.created_at}`} className={`dw-activity-item ${tone}`}>
            <span className="dw-activity-icon">
              <Icon size={17} />
            </span>

            <div className="dw-activity-copy">
              <div className="dw-activity-title-row">
                <strong>{item.title || item.activity_type || 'Activity'}</strong>
                <time>{formatActivityTime(item.created_at)}</time>
              </div>

              {item.description && <p>{item.description}</p>}

              <div className="dw-activity-meta">
                {item.device_name && <span>{item.device_name}</span>}
                {item.device_code && <span>{item.device_code}</span>}
                {item.activity_type && <span>{item.activity_type}</span>}
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}

export default ActivityList
