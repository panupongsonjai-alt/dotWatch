import { Plus, RotateCcw, Save, Trash2 } from 'lucide-react'
import { useDeviceMetrics } from '../hooks/useDeviceMetrics'
import { createBlankMetric } from '../utils/metricDisplayConfig'
import { METRIC_ICON_OPTIONS, MetricIcon } from '../utils/metricIcons'

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

export default function MetricConfigPanel({ deviceId }) {
  const {
    draftMetrics = [],
    setDraftMetrics,
    loading,
    saving,
    message,
    saveDraftMetrics,
    resetMetrics,
  } = useDeviceMetrics(deviceId)

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

  const previewMetrics = draftMetrics.filter(
    (metric) =>
      metric.visible !== false && String(metric.metric_name || '').trim()
  )

  return (
    <section className="metric-config-panel">
      <div className="metric-config-header">
        <div>
          <h4>Metric Display</h4>
          <p>ตั้งชื่อ หน่วย และไอคอนของค่าที่จะแสดงในทุกหน้า</p>
        </div>

        <button
          type="button"
          className="ghost-button"
          onClick={addMetric}
          disabled={loading || saving}
        >
          <Plus size={16} />
          Add Metric
        </button>
      </div>

      {message && <div className="metric-config-message">{message}</div>}

      <div className="metric-config-table">
        <div className="metric-config-table-head clean">
          <span>Metric Name</span>
          <span>Unit</span>
          <span>Icon</span>
          <span>Show</span>
          <span />
        </div>

        {draftMetrics.map((metric, index) => (
          <div
            className="metric-config-row clean"
            key={metric.id ? `metric-${metric.id}` : `metric-${index}`}
          >
            <label>
              <span>Metric Name</span>
              <input
                value={metric.metric_name || ''}
                placeholder={`Name-${String(index + 1).padStart(2, '0')}`}
                onChange={(event) =>
                  updateMetric(index, 'metric_name', event.target.value)
                }
                disabled={loading || saving}
              />
            </label>

            <label>
              <span>Unit</span>
              <input
                value={metric.unit || ''}
                placeholder="°C, %, kWh"
                onChange={(event) =>
                  updateMetric(index, 'unit', event.target.value)
                }
                disabled={loading || saving}
              />
            </label>

            <label>
              <span>Icon</span>
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
            </label>

            <label className="metric-visible-clean">
              <span>Show</span>
              <input
                type="checkbox"
                checked={metric.visible !== false}
                onChange={(event) =>
                  updateMetric(index, 'visible', event.target.checked)
                }
                disabled={loading || saving}
              />
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

      {previewMetrics.length > 0 && (
        <div className="metric-config-preview">
          {previewMetrics.map((metric, index) => (
            <span
              key={`${metric.metric_key || `metric_${index + 1}`}-${index}`}
            >
              <MetricIcon name={metric.icon} size={14} />
              {metric.metric_name}
              {metric.unit ? ` (${metric.unit})` : ''}
            </span>
          ))}
        </div>
      )}

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
    </section>
  )
}
