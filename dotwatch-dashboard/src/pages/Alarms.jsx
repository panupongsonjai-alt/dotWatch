import { useEffect, useMemo, useState } from 'react'
import { acknowledgeAlarm, getAlarms } from '../services/api'
import { useAlarm } from '../context/AlarmContext'

function Alarms() {
  const [alarms, setAlarms] = useState([])
  const { acknowledgeAlarmLocal } = useAlarm()
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('active')

  async function loadAlarms() {
    try {
      setLoading(true)

      const data = await getAlarms()

      setAlarms(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error(error)
      alert('โหลดข้อมูล Alarm ไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  async function handleAcknowledge(id) {
  try {
    await acknowledgeAlarm(id)

    acknowledgeAlarmLocal(id)

    await loadAlarms()
  } catch (error) {
    console.error(error)
    alert('Acknowledge Alarm ไม่สำเร็จ')
  }
}

  useEffect(() => {
    loadAlarms()

    const timer = setInterval(loadAlarms, 10000)

    return () => clearInterval(timer)
  }, [])

  const filteredAlarms = useMemo(() => {
    if (filter === 'all') return alarms

    return alarms.filter(
      (alarm) => alarm.status === filter
    )
  }, [alarms, filter])

  const activeCount = alarms.filter(
    (alarm) => alarm.status === 'active'
  ).length

  const acknowledgedCount = alarms.filter(
    (alarm) => alarm.status === 'acknowledged'
  ).length

  return (
    <div className="page">
      <section className="panel">

        <div className="section-title">
          <h2>Alarm Center</h2>
          <p>
            Active {activeCount} • Acknowledged {acknowledgedCount}
          </p>
        </div>

        <div className="alarm-filter-row">

          <button
            className={filter === 'active'
              ? 'primary-button'
              : 'secondary-button'}
            onClick={() => setFilter('active')}
          >
            Active ({activeCount})
          </button>

          <button
            className={filter === 'acknowledged'
              ? 'primary-button'
              : 'secondary-button'}
            onClick={() => setFilter('acknowledged')}
          >
            Acknowledged ({acknowledgedCount})
          </button>

          <button
            className={filter === 'all'
              ? 'primary-button'
              : 'secondary-button'}
            onClick={() => setFilter('all')}
          >
            All ({alarms.length})
          </button>

        </div>

        {loading ? (
          <div className="empty-device">
            กำลังโหลด Alarm...
          </div>
        ) : filteredAlarms.length === 0 ? (
          <div className="empty-device">
            ไม่พบ Alarm
          </div>
        ) : (
          <div className="alarm-list">

            {filteredAlarms.map((alarm) => (
              <div
                key={alarm.id}
                className={`alarm-card ${alarm.severity}`}
              >

                <div className="alarm-info">

                  <strong>
                    {alarm.device_name ||
                      alarm.device_code ||
                      'Unknown Device'}
                  </strong>

                  <div>
                    Metric:
                    {' '}
                    {alarm.metric}
                  </div>

                  <div>
                    Value:
                    {' '}
                    {alarm.value}
                  </div>

                  <div>
                    Threshold:
                    {' '}
                    {alarm.operator}
                    {' '}
                    {alarm.threshold}
                  </div>

                  <div>
                    Severity:
                    {' '}
                    {alarm.severity}
                  </div>

                  <small>
                    {new Date(
                      alarm.triggered_at
                    ).toLocaleString('th-TH')}
                  </small>

                </div>

                <div className="alarm-actions">

                  <span
                    className={`status ${
                      alarm.status === 'active'
                        ? 'offline'
                        : 'online'
                    }`}
                  >
                    {alarm.status}
                  </span>

                  {alarm.status === 'active' && (
                    <button
                      className="save-btn"
                      onClick={() =>
                        handleAcknowledge(alarm.id)
                      }
                    >
                      Acknowledge
                    </button>
                  )}

                </div>

              </div>
            ))}

          </div>
        )}

      </section>
    </div>
  )
}

export default Alarms