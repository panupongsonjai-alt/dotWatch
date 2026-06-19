import { useEffect, useState } from 'react'
import {
  getDemoTemplates,
  createDemoTemplate,
  deleteDemoData,
} from '../services/api'

function DemoTemplatesPanel({ onDone }) {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function loadTemplates() {
    try {
      const data = await getDemoTemplates()
      setTemplates(data)
    } catch (err) {
      console.error(err)
      setError('โหลด Demo Templates ไม่สำเร็จ')
    }
  }

  useEffect(() => {
    loadTemplates()
  }, [])

  async function handleCreate(templateKey) {
    try {
      setLoading(true)
      setError('')
      setMessage('')

      await createDemoTemplate(templateKey)

      setMessage('สร้าง Demo Devices สำเร็จแล้ว')
      onDone?.()
    } catch (err) {
      console.error(err)
      setError('สร้าง Demo Devices ไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteDemo() {
    const confirmed = window.confirm(
      'ต้องการลบ Demo Devices ทั้งหมดใช่ไหม?'
    )

    if (!confirmed) return

    try {
      setLoading(true)
      setError('')
      setMessage('')

      await deleteDemoData()

      setMessage('ลบ Demo Devices สำเร็จแล้ว')
      onDone?.()
    } catch (err) {
      console.error(err)
      setError('ลบ Demo Devices ไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="demo-panel">
      <div className="demo-panel-header">
        <div>
          <h2>Demo Templates</h2>
          <p>สร้างชุดอุปกรณ์ตัวอย่างสำหรับทดสอบหรือพรีเซนต์ลูกค้า</p>
        </div>

        <button
          type="button"
          className="ghost-button"
          onClick={handleDeleteDemo}
          disabled={loading}
        >
          Clear Demo
        </button>
      </div>

      {message && <div className="auth-success">{message}</div>}
      {error && <div className="auth-error">{error}</div>}

      <div className="demo-template-grid">
        {templates.map((template) => (
          <article key={template.key} className="demo-template-card">
            <h3>{template.name}</h3>
            <p>{template.groupName}</p>

            <ul>
              {template.devices.map((device) => (
                <li key={device.name}>
                  <span>{device.name}</span>
                  <small>{device.status}</small>
                </li>
              ))}
            </ul>

            <button
              type="button"
              className="primary-button full"
              onClick={() => handleCreate(template.key)}
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Add Template'}
            </button>
          </article>
        ))}
      </div>
    </section>
  )
}

export default DemoTemplatesPanel