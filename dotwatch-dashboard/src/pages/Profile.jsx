import React, { useEffect, useState } from 'react'
import { sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '../services/firebase'
import {
  addProfileActivity,
  clearProfileActivities,
  getBrowserName,
  getOperatingSystem,
  getProfileActivities,
  getProfileLanguage,
  getProfileNotifications,
  getProfileRole,
  getProfileTheme,
  saveProfileLanguage,
  saveProfileNotifications,
  saveProfileRole,
  saveProfileTheme,
} from '../utils/profileStorage'

function Profile() {
  const user = auth.currentUser

  const [role, setRole] = useState('Admin')
  const [theme, setTheme] = useState('dark')
  const [language, setLanguage] = useState('th')
  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    offlineAlerts: true,
    criticalAlerts: true,
    weeklyReport: false,
  })

  const [activities, setActivities] = useState([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [sendingReset, setSendingReset] = useState(false)
  const [sendingVerify, setSendingVerify] = useState(false)

  const displayName = user?.displayName || 'dotWatch User'
  const email = user?.email || '-'
  const uid = user?.uid || '-'
  const providerId = user?.providerData?.[0]?.providerId || 'password'

  const browserName = getBrowserName()
  const operatingSystem = getOperatingSystem()
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const securityScore = user?.emailVerified ? '85%' : '65%'

  const createdAt = user?.metadata?.creationTime
    ? new Date(user.metadata.creationTime).toLocaleString('th-TH')
    : '-'

  const lastLoginAt = user?.metadata?.lastSignInTime
    ? new Date(user.metadata.lastSignInTime).toLocaleString('th-TH')
    : '-'

  const firstLetter =
    displayName?.charAt(0).toUpperCase() ||
    email?.charAt(0).toUpperCase() ||
    'U'

  useEffect(() => {
    setRole(getProfileRole())
    setTheme(getProfileTheme())
    setLanguage(getProfileLanguage())
    setNotifications(getProfileNotifications())
    setActivities(addProfileActivity('เปิดหน้า Profile'))
  }, [])

  function handleRoleChange(value) {
    setRole(value)
    saveProfileRole(value)
    setActivities(addProfileActivity(`เปลี่ยนบทบาทผู้ใช้เป็น ${value}`))
  }

  function handleThemeChange(value) {
    setTheme(value)
    saveProfileTheme(value)
    setActivities(addProfileActivity(`เปลี่ยน Theme เป็น ${value}`))
  }

  function handleLanguageChange(value) {
    setLanguage(value)
    saveProfileLanguage(value)
    setActivities(addProfileActivity(`เปลี่ยนภาษาเป็น ${value}`))
  }

  function handleNotificationChange(key) {
    const next = {
      ...notifications,
      [key]: !notifications[key],
    }

    setNotifications(next)
    saveProfileNotifications(next)
    setActivities(addProfileActivity('อัปเดตการตั้งค่าการแจ้งเตือน'))
  }

  async function handleResetPassword() {
    if (!user?.email) {
      setError('ไม่พบอีเมลผู้ใช้งาน')
      return
    }

    try {
      setSendingReset(true)
      setMessage('')
      setError('')

      await sendPasswordResetEmail(auth, user.email)

      setMessage('ส่งอีเมลสำหรับเปลี่ยนรหัสผ่านเรียบร้อย')
      setActivities(addProfileActivity('ส่งอีเมลเปลี่ยนรหัสผ่าน'))
    } catch (err) {
      console.error(err)
      setError('ไม่สามารถส่งอีเมลเปลี่ยนรหัสผ่านได้')
    } finally {
      setSendingReset(false)
    }
  }

  async function handleSendVerifyEmail() {
    if (!user) {
      setError('ไม่พบข้อมูลผู้ใช้งาน')
      return
    }

    try {
      setSendingVerify(true)
      setMessage('')
      setError('')

      await sendEmailVerification(user)

      setMessage('ส่งอีเมลยืนยันตัวตนเรียบร้อย กรุณาตรวจสอบกล่องอีเมล')
      setActivities(addProfileActivity('ส่งอีเมลยืนยันตัวตน'))
    } catch (err) {
      console.error(err)
      setError('ไม่สามารถส่งอีเมลยืนยันตัวตนได้')
    } finally {
      setSendingVerify(false)
    }
  }

  function handleClearActivities() {
    setActivities(clearProfileActivities())
  }

  return (
    <div className="page">
      <section className="panel">
        <div className="section-title">
          <h2>Profile</h2>
          <p>ข้อมูลบัญชี บทบาท ความปลอดภัย และการตั้งค่าส่วนตัว</p>
        </div>

        <div className="profile-dashboard">
          <aside className="profile-preview-card">
            <div className="profile-avatar large">{firstLetter}</div>

            <h3>{displayName}</h3>
            <p>{email}</p>

            <div className="profile-meta">
              <span className={`role-badge ${role.toLowerCase()}`}>{role}</span>

              <span
                className={
                  user?.emailVerified
                    ? 'email-badge verified'
                    : 'email-badge not-verified'
                }
              >
                {user?.emailVerified ? 'Email Verified' : 'Not Verified'}
              </span>
            </div>

            <div className="profile-summary">
              <div>
                <strong>{role}</strong>
                <span>Permission</span>
              </div>

              <div>
                <strong>{providerId}</strong>
                <span>Provider</span>
              </div>

              <div>
                <strong>{user?.emailVerified ? 'Active' : 'Pending'}</strong>
                <span>Status</span>
              </div>
            </div>
          </aside>

          <div className="profile-content">
            {message && <div className="auth-success">{message}</div>}
            {error && <div className="auth-error">{error}</div>}

            <div className="profile-section">
              <h3>Account Information</h3>

              <div className="profile-info-grid">
                <label>
                  Display Name
                  <input value={displayName} disabled />
                </label>

                <label>
                  Email
                  <input value={email} disabled />
                </label>

                <label>
                  Role
                  <select
                    value={role}
                    onChange={(e) => handleRoleChange(e.target.value)}
                  >
                    <option value="Admin">Admin</option>
                    <option value="Operator">Operator</option>
                  </select>
                </label>

                <label>
                  Email Status
                  <input
                    value={user?.emailVerified ? 'Verified' : 'Not Verified'}
                    disabled
                  />
                </label>

                <label>
                  Account Created
                  <input value={createdAt} disabled />
                </label>

                <label>
                  Last Login
                  <input value={lastLoginAt} disabled />
                </label>

                <label>
                  Project Name
                  <input
                    value={localStorage.getItem('projectName') || 'dotWatch'}
                    disabled
                  />
                </label>

                <label>
                  Organization
                  <input
                    value={
                      localStorage.getItem('organization') || 'Personal Account'
                    }
                    disabled
                  />
                </label>

                <label>
                  Timezone
                  <input value={timezone} disabled />
                </label>

                <label>
                  Language
                  <input
                    value={language === 'th' ? 'Thai' : 'English'}
                    disabled
                  />
                </label>

                <label>
                  Account Type
                  <input value="Standard" disabled />
                </label>

                <label>
                  Device Access
                  <input value="All Devices" disabled />
                </label>
              </div>
            </div>

            <div className="profile-section security-section">
              <div className="security-title">
                <div className="security-icon">🛡️</div>
                <div>
                  <h3>Security</h3>
                  <p>
                    จัดการรหัสผ่าน การยืนยันอีเมล
                    และความปลอดภัยของบัญชีผู้ใช้งาน
                  </p>
                </div>
              </div>

              <div className="security-score-card clean">
                <div className="security-score-main clean">
                  <strong>{securityScore}</strong>
                  <span>Security Score</span>
                  <small>{user?.emailVerified ? 'Good' : 'Needs Review'}</small>
                </div>

                <div className="security-check-list clean">
                  <div className="security-check success">
                    <span>✓</span>
                    <div>
                      <strong>Email verified</strong>
                      <p>อีเมลของคุณได้รับการยืนยันแล้ว</p>
                    </div>
                    <em>Secure</em>
                  </div>

                  <div className="security-check success">
                    <span>✓</span>
                    <div>
                      <strong>Password reset available</strong>
                      <p>คุณสามารถรีเซ็ตรหัสผ่านได้</p>
                    </div>
                    <em>Secure</em>
                  </div>

                  <div className="security-check success">
                    <span>✓</span>
                    <div>
                      <strong>Account active</strong>
                      <p>บัญชีของคุณใช้งานได้ปกติ</p>
                    </div>
                    <em>Secure</em>
                  </div>

                  <div className="security-check warning">
                    <span>!</span>
                    <div>
                      <strong>Two-Factor Authentication not enabled</strong>
                      <p>แนะนำให้เปิดใช้งาน 2FA เพื่อเพิ่มความปลอดภัย</p>
                    </div>
                    <em>Improve</em>
                  </div>
                </div>
              </div>

              <div className="security-action-grid">
                <button
                  type="button"
                  className="security-action primary"
                  onClick={handleResetPassword}
                  disabled={sendingReset}
                >
                  <span>✉️</span>
                  <div>
                    <strong>
                      {sendingReset
                        ? 'Sending...'
                        : 'Send Password Reset Email'}
                    </strong>
                    <small>ส่งอีเมลสำหรับเปลี่ยนรหัสผ่าน</small>
                  </div>
                  <b>›</b>
                </button>

                {!user?.emailVerified ? (
                  <button
                    type="button"
                    className="security-action"
                    onClick={handleSendVerifyEmail}
                    disabled={sendingVerify}
                  >
                    <span>📧</span>
                    <div>
                      <strong>
                        {sendingVerify
                          ? 'Sending...'
                          : 'Send Email Verification'}
                      </strong>
                      <small>ส่งอีเมลยืนยันตัวตน</small>
                    </div>
                    <b>›</b>
                  </button>
                ) : (
                  <div className="security-action verified">
                    <span>✓</span>
                    <div>
                      <strong>Email Verified</strong>
                      <small>บัญชีนี้ยืนยันอีเมลแล้ว</small>
                    </div>
                  </div>
                )}
              </div>

              <div className="current-session-card clean">
                <h4>Current Session</h4>

                <div className="session-grid clean">
                  <div>
                    <span>Browser</span>
                    <strong>{browserName}</strong>
                  </div>

                  <div>
                    <span>Operating System</span>
                    <strong>{operatingSystem}</strong>
                  </div>

                  <div>
                    <span>Timezone</span>
                    <strong>{timezone}</strong>
                  </div>

                  <div>
                    <span>Language</span>
                    <strong>{language === 'th' ? 'Thai' : 'English'}</strong>
                  </div>
                </div>
              </div>

              <div className="two-factor-card clean">
                <div>
                  <h4>Two-Factor Authentication</h4>
                  <p>เพิ่มความปลอดภัยให้บัญชีด้วยการยืนยันตัวตน 2 ขั้นตอน</p>
                </div>

                <div className="two-factor-status">
                  <span>Disabled</span>
                  <button type="button" className="secondary-button" disabled>
                    Enable 2FA
                  </button>
                </div>
              </div>
            </div>

            <div className="profile-section">
              <h3>Notification Settings</h3>

              <div className="profile-toggle-list">
                {Object.entries({
                  emailAlerts: 'Email Alerts',
                  offlineAlerts: 'Device Offline Alerts',
                  criticalAlerts: 'Critical Alarm Alerts',
                  weeklyReport: 'Weekly Report',
                }).map(([key, label]) => (
                  <label key={key}>
                    <span>{label}</span>
                    <input
                      type="checkbox"
                      checked={notifications[key]}
                      onChange={() => handleNotificationChange(key)}
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="profile-section">
              <h3>Preferences</h3>

              <div className="profile-info-grid">
                <label>
                  Theme
                  <select
                    value={theme}
                    onChange={(e) => handleThemeChange(e.target.value)}
                  >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                  </select>
                </label>

                <label>
                  Language
                  <select
                    value={language}
                    onChange={(e) => handleLanguageChange(e.target.value)}
                  >
                    <option value="th">Thai</option>
                    <option value="en">English</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="profile-section">
              <div className="profile-section-header">
                <h3>Recent Activity</h3>

                {activities.length > 0 && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={handleClearActivities}
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="activity-list">
                {activities.length === 0 ? (
                  <p className="profile-help-text">ยังไม่มีกิจกรรมล่าสุด</p>
                ) : (
                  activities.map((activity) => (
                    <div className="activity-item" key={activity.id}>
                      <span className="activity-dot" />
                      <div>
                        <strong>{activity.text}</strong>
                        <small>
                          {new Date(activity.time).toLocaleString('th-TH')}
                        </small>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="profile-section">
              <h3>System Information</h3>

              <div className="profile-info-grid">
                <label>
                  User ID
                  <input value={uid} disabled />
                </label>

                <label>
                  Provider
                  <input value={providerId} disabled />
                </label>
              </div>
            </div>

            <div className="profile-section danger-zone">
              <h3>Danger Zone</h3>

              <p>
                ส่วนนี้เตรียมไว้สำหรับอนาคต เช่น ลบบัญชี ลบอุปกรณ์ทั้งหมด
                หรือลบประวัติการใช้งาน
              </p>

              <button type="button" className="danger-button" disabled>
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Profile
