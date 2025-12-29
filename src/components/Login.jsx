import React, { useState } from 'react'

// Helper functions
const buildUrl = (base, endpoint) => {
  const cleanBase = base.replace(/\/+$/, '')
  const cleanEndpoint = endpoint.replace(/^\/+/, '')
  return `${cleanBase}/${cleanEndpoint}`
}

const setCookie = (name, value, days = 7) => {
  if (typeof document === 'undefined') return
  const expires = new Date()
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`
}

const Login = ({ apiBase, onLoginSuccess }) => {
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleLogin = async (e) => {
    e?.preventDefault()
    setLoginError('')
    setLoginLoading(true)

    try {
      const url = buildUrl(apiBase, 'Login/Login')
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          Username: loginForm.username,
          Password: loginForm.password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Login failed')
      }

      // Store tokens in cookies
      if (data.token) {
        setCookie('authToken', data.token, 7)
      }
      if (data.refreshToken) {
        setCookie('refreshToken', data.refreshToken, 7)
      }
      if (data.expireAt) {
        setCookie('tokenExpireAt', data.expireAt, 7)
      }

      // Notify parent component
      onLoginSuccess()
      setLoginError('')
    } catch (err) {
      setLoginError(err.message || 'Login failed. Please try again.')
      console.error('Login error:', err)
    } finally {
      setLoginLoading(false)
    }
  }

  return (
    <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="card" style={{ maxWidth: '400px', width: '100%', padding: '32px' }}>
        <header style={{ marginBottom: '24px', textAlign: 'center' }}>
          <h3>Login</h3>
          <p className="eyebrow" style={{ marginTop: '8px' }}>Please enter your credentials</p>
        </header>
        
        <form onSubmit={handleLogin}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <label>
              Username
              <input
                type="text"
                value={loginForm.username}
                onChange={(e) => setLoginForm((prev) => ({ ...prev, username: e.target.value }))}
                placeholder="Enter username"
                required
                style={{ marginTop: '8px' }}
              />
            </label>
            
            <label>
              Password
              <div style={{ position: 'relative', marginTop: '8px' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={loginForm.password}
                  onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="Enter password"
                  required
                  style={{ width: '100%', paddingRight: '45px', boxSizing: 'border-box' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    color: '#00d1ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'opacity 0.2s',
                    width: '24px',
                    height: '24px',
                  }}
                  onMouseEnter={(e) => e.target.style.opacity = '0.7'}
                  onMouseLeave={(e) => e.target.style.opacity = '1'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </button>
              </div>
            </label>
            
            {loginError && (
              <div className="state-block error" style={{ marginTop: '8px' }}>
                {loginError}
              </div>
            )}
            
            <button 
              type="submit" 
              className="primary" 
              disabled={loginLoading}
              style={{ marginTop: '8px' }}
            >
              {loginLoading ? 'Logging in...' : 'Login'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Login

