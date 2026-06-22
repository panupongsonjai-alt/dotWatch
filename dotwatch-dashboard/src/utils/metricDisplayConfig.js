const STORAGE_KEY = 'dotwatch_metric_display'

export function getMetricConfig(deviceId) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)

    if (!raw) {
      return []
    }

    const allConfigs = JSON.parse(raw)

    return allConfigs[deviceId] || []
  } catch (error) {
    console.error('Load metric config error:', error)
    return []
  }
}

export function saveMetricConfig(deviceId, metrics) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)

    const allConfigs = raw ? JSON.parse(raw) : {}

    allConfigs[deviceId] = metrics

    localStorage.setItem(STORAGE_KEY, JSON.stringify(allConfigs))

    return true
  } catch (error) {
    console.error('Save metric config error:', error)
    return false
  }
}

export function getMetricByName(deviceId, metricName) {
  const metrics = getMetricConfig(deviceId)

  return metrics.find((metric) => metric.name === metricName)
}

export function getDisplayLabel(deviceId, metricName, fallback = '') {
  const metric = getMetricByName(deviceId, metricName)

  return metric?.name || fallback || metricName
}

export function getDisplayUnit(deviceId, metricName, fallback = '') {
  const metric = getMetricByName(deviceId, metricName)

  return metric?.unit || fallback
}

export function getDisplayIcon(deviceId, metricName, fallback = 'Activity') {
  const metric = getMetricByName(deviceId, metricName)

  return metric?.icon || fallback
}

export function removeMetricConfig(deviceId) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)

    if (!raw) {
      return
    }

    const allConfigs = JSON.parse(raw)

    delete allConfigs[deviceId]

    localStorage.setItem(STORAGE_KEY, JSON.stringify(allConfigs))
  } catch (error) {
    console.error(error)
  }
}

export function exportMetricConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)

    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function importMetricConfig(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))

    return true
  } catch {
    return false
  }
}
