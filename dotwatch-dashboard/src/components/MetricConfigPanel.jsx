import { useMemo, useState } from 'react'
import { Edit3, Plus, RotateCcw, Save, Trash2, X } from 'lucide-react'
import { useDeviceMetrics } from '../hooks/useDeviceMetrics'
import { createBlankMetric } from '../utils/metricDisplayConfig'
import { METRIC_ICON_OPTIONS, MetricIcon } from '../utils/metricIcons'

const OPERATORS = ['>', '>=', '<', '<=', '=']
const SEVERITIES = ['warning', 'critical']

function updateMetricList(metrics = [], metricIndex, key, value) {
  return metrics.map((metric, index) => {
    if (index !== metricIndex) return metric
    return {
      ...metric,
      [key]: value,
    }
  })
}

function reindexMetrics(metrics = []) {
  return metrics.map((metric, index) => ({
    ...metric,
    metric_key: metric.metric_key || `metric_${index + 1}`,
    sort_order: index,
  }))
}

function formatThreshold(value, unit = '') {
  if (value == null || value === '') return '--'
  const numberValue = Number(value)
  const displayValue = Number.isInteger(numberValue)
    ? String(numberValue)
    : numberValue.toFixed(1)

  return `${displayValue}${unit ? ` ${unit}` : ''}`
}

function getMetricLabel(metrics, metricKey) {
  const metric = metrics.find((item) => item.metric_key === metricKey)
  return metric?.metric_name || metricKey || '--'
}

function getMetricUnit(metrics, metricKey) {
  const metric = metrics.find((item) => item.metric_key === metricKey)
  return metric?.unit || ''
}

export default function MetricConfigPanel({
  deviceId,
  alarmRules = [],
  onCreateAlarm,
  onUpdateAlarm,
  onDeleteAlarm,
}) {
  const {
    draftMetrics = [],
    setDraftMetrics,
    loading,
    saving,
    message,
    saveDraftMetrics,
    resetMetrics,
  } = useDeviceMetrics(deviceId)

  const visibleMetrics = useMemo(
    () => draftMetrics.filter((metric) => metric.visible !== false),
    [draftMetrics]
  )

  const [alarmDraft, setAlarmDraft] = useState({
    metric: '',
    operator: '>',
    threshold: '',
    severity: 'warning',
  })

  const [editingRuleId, setEditingRuleId] = useState(null)
  const [editingRule, setEditingRule] = useState(null)

  function addMetric() {
    setDraftMetrics((currentMetrics = []) =>
      reindexMetrics([
        ...currentMetrics,
        createBlankMetric(currentMetrics.length),
      ])
    )
  }

  function removeMetric(indexToRemove) {
    setDraftMetrics((currentMetrics = []) =>
      reindexMetrics(
        currentMetrics.filter((_, index) => index !== indexToRemove)
      )
    )
  }

  function updateMetric(index, key, value) {
    setDraftMetrics((currentMetrics = []) =>
      updateMetricList(currentMetrics, index, key, value)
    )
  }

  async function handleReset() {
    await resetMetrics()

    window.dispatchEvent(
      new CustomEvent('dotwatchMetricConfigChanged', {
        detail: { deviceId },
      })
    )
  }

  async function handleSave() {
    const success = await saveDraftMetrics(reindexMetrics(draftMetrics))

    if (success !== false) {
      window.dispatchEvent(
        new CustomEvent('dotwatchMetricConfigChanged', {
          detail: { deviceId },
        })
      )
    }

    return success
  }

  async function handleCreateAlarm() {
    const metricKey = alarmDraft.metric || visibleMetrics[0]?.metric_key

    if (!metricKey) {
      alert('กรุณาเพิ่ม Metric ก่อนตั้ง Alarm')
      return
    }

    if (
      alarmDraft.threshold === '' ||
      Number.isNaN(Number(alarmDraft.threshold))
    ) {
      alert('กรุณากรอก Threshold ให้ถูกต้อง')
      return
    }

    await onCreateAlarm?.(metricKey, {
      metric: metricKey,
      operator: alarmDraft.operator || '>',
      threshold: Number(alarmDraft.threshold),
      severity: alarmDraft.severity || 'warning',
      is_active: true,
    })

    setAlarmDraft({
      metric: metricKey,
      operator: '>',
      threshold: '',
      severity: 'warning',
    })
  }

  function startEditRule(rule) {
    setEditingRuleId(rule.id)
    setEditingRule({
      ...rule,
      threshold: rule.threshold ?? '',
      is_active: rule.is_active !== false,
    })
  }

  async function saveEditRule() {
    if (!editingRule) return

    if (
      editingRule.threshold === '' ||
      Number.isNaN(Number(editingRule.threshold))
    ) {
      alert('กรุณากรอก Threshold ให้ถูกต้อง')
      return
    }

    await onUpdateAlarm?.(editingRule.id, {
      ...editingRule,
      threshold: Number(editingRule.threshold),
      is_active: editingRule.is_active !== false,
    })

    setEditingRuleId(null)
    setEditingRule(null)
  }

  return (
    <section className="metric-config-panel metric-config-panel-v2">
      <div className="metric-config-header">
        <div>
          <h4>Metric Display</h4>
          <p>
            ตั้งชื่อ หน่วย และไอคอนของค่าที่จะแสดงใน Dashboard และ Device Detail
          </p>
        </div>
      </div>

      {message && <div className="metric-config-message">{message}</div>}

      <div className="metric-config-table metric-config-table-v2">
        <div className="metric-config-table-head metric-config-table-head-v2">
          <span>Metric Name</span>
          <span>Unit</span>
          <span>Icon</span>
          <span>Visible</span>
          <span />
        </div>

        {draftMetrics.map((metric, index) => (
          <div
            className="metric-config-row metric-config-row-v2"
            key={metric.id ? `metric-${metric.id}` : `metric-${index}`}
          >
            <input
              value={metric.metric_name || ''}
              placeholder={`เช่น ${index === 0 ? 'Supply Air' : 'Metric Name'}`}
              onChange={(event) =>
                updateMetric(index, 'metric_name', event.target.value)
              }
              disabled={loading || saving}
            />

            <input
              value={metric.unit || ''}
              placeholder="เช่น °C, %, kWh"
              onChange={(event) =>
                updateMetric(index, 'unit', event.target.value)
              }
              disabled={loading || saving}
            />

            <select
              value={metric.icon || 'Activity'}
              onChange={(event) =>
                updateMetric(index, 'icon', event.target.value)
              }
              disabled={loading || saving}
            >
              {METRIC_ICON_OPTIONS.map((icon) => (
                <option key={icon} value={icon}>
                  {icon}
                </option>
              ))}
            </select>

            <label className="metric-visible-toggle">
              <input
                type="checkbox"
                checked={metric.visible !== false}
                onChange={(event) =>
                  updateMetric(index, 'visible', event.target.checked)
                }
                disabled={loading || saving}
              />
              Show
            </label>

            <button
              type="button"
              className="delete-btn square"
              onClick={() => removeMetric(index)}
              disabled={loading || saving}
              title="Delete metric"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      <div className="metric-config-actions">
        <button
          type="button"
          className="ghost-button"
          onClick={handleReset}
          disabled={loading || saving}
        >
          <RotateCcw size={16} />
          Reset
        </button>

        <button
          type="button"
          className="save-btn metric-save-btn"
          onClick={handleSave}
          disabled={loading || saving}
        >
          <Save size={16} />
          {saving ? 'Saving...' : 'Save Display'}
        </button>
      </div>

      <div className="alarm-rules-panel-v2">
        <div className="alarm-rules-header-v2">
          <div>
            <h4>Alarm Rules</h4>
            <p>ตั้ง Alarm เฉพาะ Device นี้จาก Metric จริง</p>
          </div>
        </div>

        <div className="alarm-rule-create-row alarm-rule-create-row-v2">
          <select
            value={alarmDraft.metric || visibleMetrics[0]?.metric_key || ''}
            onChange={(event) =>
              setAlarmDraft((current) => ({
                ...current,
                metric: event.target.value,
              }))
            }
            disabled={saving || visibleMetrics.length === 0}
          >
            {visibleMetrics.map((metric) => (
              <option key={metric.metric_key} value={metric.metric_key}>
                {metric.metric_name || metric.metric_key}
              </option>
            ))}
          </select>

          <select
            value={alarmDraft.operator}
            onChange={(event) =>
              setAlarmDraft((current) => ({
                ...current,
                operator: event.target.value,
              }))
            }
            disabled={saving}
          >
            {OPERATORS.map((operator) => (
              <option key={operator} value={operator}>
                {operator}
              </option>
            ))}
          </select>

          <input
            type="number"
            value={alarmDraft.threshold}
            placeholder="Threshold"
            onChange={(event) =>
              setAlarmDraft((current) => ({
                ...current,
                threshold: event.target.value,
              }))
            }
            disabled={saving}
          />

          <select
            value={alarmDraft.severity}
            onChange={(event) =>
              setAlarmDraft((current) => ({
                ...current,
                severity: event.target.value,
              }))
            }
            disabled={saving}
          >
            {SEVERITIES.map((severity) => (
              <option key={severity} value={severity}>
                {severity === 'critical' ? 'Critical' : 'Warning'}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="save-btn"
            onClick={handleCreateAlarm}
            disabled={saving || visibleMetrics.length === 0}
          >
            Add Rule
          </button>
        </div>

        {alarmRules.length === 0 ? (
          <div className="alarm-rule-empty">
            ยังไม่มี Alarm Rule สำหรับ Device นี้
          </div>
        ) : (
          <div className="device-alarm-rule-list device-alarm-rule-list-v2">
            {alarmRules.map((rule) => {
              const isEditing = editingRuleId === rule.id
              const metricUnit = getMetricUnit(draftMetrics, rule.metric)

              if (isEditing && editingRule) {
                return (
                  <div
                    key={rule.id}
                    className="device-alarm-rule-item alarm-rule-edit-row-v2"
                  >
                    <select
                      value={editingRule.metric}
                      onChange={(event) =>
                        setEditingRule((current) => ({
                          ...current,
                          metric: event.target.value,
                        }))
                      }
                    >
                      {visibleMetrics.map((metric) => (
                        <option
                          key={metric.metric_key}
                          value={metric.metric_key}
                        >
                          {metric.metric_name || metric.metric_key}
                        </option>
                      ))}
                    </select>

                    <select
                      value={editingRule.operator || '>'}
                      onChange={(event) =>
                        setEditingRule((current) => ({
                          ...current,
                          operator: event.target.value,
                        }))
                      }
                    >
                      {OPERATORS.map((operator) => (
                        <option key={operator} value={operator}>
                          {operator}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      value={editingRule.threshold}
                      onChange={(event) =>
                        setEditingRule((current) => ({
                          ...current,
                          threshold: event.target.value,
                        }))
                      }
                    />

                    <select
                      value={editingRule.severity || 'warning'}
                      onChange={(event) =>
                        setEditingRule((current) => ({
                          ...current,
                          severity: event.target.value,
                        }))
                      }
                    >
                      {SEVERITIES.map((severity) => (
                        <option key={severity} value={severity}>
                          {severity === 'critical' ? 'Critical' : 'Warning'}
                        </option>
                      ))}
                    </select>

                    <label className="metric-visible-toggle">
                      <input
                        type="checkbox"
                        checked={editingRule.is_active !== false}
                        onChange={(event) =>
                          setEditingRule((current) => ({
                            ...current,
                            is_active: event.target.checked,
                          }))
                        }
                      />
                      Active
                    </label>

                    <div className="alarm-rule-actions">
                      <button
                        type="button"
                        className="save-btn"
                        onClick={saveEditRule}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => {
                          setEditingRuleId(null)
                          setEditingRule(null)
                        }}
                      >
                        <X size={15} />
                        Cancel
                      </button>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={rule.id}
                  className="device-alarm-rule-item device-alarm-rule-item-v2"
                >
                  <div className="alarm-rule-summary-v2">
                    <strong>
                      {getMetricLabel(draftMetrics, rule.metric)}{' '}
                      {rule.operator}{' '}
                      {formatThreshold(rule.threshold, metricUnit)}
                    </strong>
                    <span>{rule.metric}</span>
                  </div>

                  <span className={`status ${rule.severity || 'warning'}`}>
                    {rule.severity || 'warning'}
                  </span>

                  <span
                    className={
                      rule.is_active !== false
                        ? 'status online'
                        : 'status offline'
                    }
                  >
                    {rule.is_active !== false ? 'Active' : 'Disabled'}
                  </span>

                  <div className="alarm-rule-actions">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => startEditRule(rule)}
                    >
                      <Edit3 size={15} />
                      Edit
                    </button>

                    <button
                      type="button"
                      className="delete-btn"
                      onClick={() => onDeleteAlarm?.(rule.id)}
                    >
                      <Trash2 size={15} />
                      Delete
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
