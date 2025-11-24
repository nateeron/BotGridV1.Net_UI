import React, { useMemo, useState } from 'react'

const tabs = [
  { key: 'report', label: 'Report', icon: '📊' },
  { key: 'orders', label: 'Orders', icon: '📦' },
  { key: 'bot', label: 'Bot', icon: '🤖' },
  { key: 'settings', label: 'Setting', icon: '⚙️' },
]

const orderSubTabs = [
  { key: 'overview', label: 'Overview' },
  { key: 'bySetting', label: 'By Setting' },
  { key: 'delete', label: 'Delete' },
]

const prettify = (value) => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  return JSON.stringify(value, null, 2)
}

const buildUrl = (base, endpoint) => {
  const cleanBase = base.replace(/\/+$/, '')
  const cleanEndpoint = endpoint.replace(/^\/+/, '')
  return `${cleanBase}/${cleanEndpoint}`
}

const ResponsePanel = ({ title, payload, error }) => {
  if (!payload && !error) return null
  return (
    <section className="panel card">
      <header>
        <h4>{title || 'ผลลัพธ์ล่าสุด'}</h4>
      </header>
      {payload && (
        <div className="panel-body">
          <span className="badge success">HTTP {payload.status}</span>
          <pre>{prettify(payload.data)}</pre>
        </div>
      )}
      {error && (
        <div className="panel-body">
          <span className="badge danger">ผิดพลาด</span>
          <pre>{prettify(error)}</pre>
        </div>
      )}
    </section>
  )
}

export default function App() {
  const [activeTab, setActiveTab] = useState('report')
  const [orderTab, setOrderTab] = useState('overview')
  const [apiBase, setApiBase] = useState('http://139.180.128.104:5081/api')
  const [reportPayload, setReportPayload] = useState({ ConfigId: 1, Period: '1M' })
  const [orderSettingId, setOrderSettingId] = useState(1)
  const [orderDeleteId, setOrderDeleteId] = useState('')
  const [orderDeleteIds, setOrderDeleteIds] = useState('2,1')
  const [workerConfigId, setWorkerConfigId] = useState(1)
  const [settingCreate, setSettingCreate] = useState({
    Config_Version: 3,
    API_KEY: '',
    API_SECRET: '',
    DisCord_Hook1: '',
    DisCord_Hook2: '',
    SYMBOL: 'XRPUSDT',
    PERCEN_BUY: 0.4,
    PERCEN_SELL: 0.4,
    buyAmountUSD: 10,
  })
  const [settingUpdate, setSettingUpdate] = useState({
    id: 1,
    Config_Version: 1,
    API_KEY: '',
    API_SECRET: '',
    DisCord_Hook1: '',
    DisCord_Hook2: '',
    SYMBOL: 'BTCUSDT',
    PERCEN_BUY: 1.25,
    PERCEN_SELL: 1.4,
    buyAmountUSD: 10,
  })
  const [settingDeleteId, setSettingDeleteId] = useState('')
  const [lastResponse, setLastResponse] = useState(null)
  const [errorResponse, setErrorResponse] = useState(null)
  const [loadingKey, setLoadingKey] = useState(null)

  const headers = useMemo(
    () => ({
      'Content-Type': 'application/json',
    }),
    []
  )

  const runRequest = async (key, endpoint, { method = 'POST', payload } = {}) => {
    const url = buildUrl(apiBase, endpoint)
    setLoadingKey(key)
    setErrorResponse(null)
    try {
      const response = await fetch(url, {
        method,
        headers: method === 'GET' ? undefined : headers,
        body: method === 'GET' ? undefined : payload ? JSON.stringify(payload) : null,
      })
      const contentType = response.headers.get('content-type') || ''
      const data = contentType.includes('application/json')
        ? await response.json()
        : await response.text()

      if (!response.ok) {
        throw {
          status: response.status,
          endpoint,
          data,
        }
      }

      setLastResponse({ key, status: response.status, data })
    } catch (err) {
      setErrorResponse(err)
    } finally {
      setLoadingKey(null)
    }
  }

  const renderReport = () => (
    <section className="card">
      <header>
        <div>
          <p className="eyebrow">Binace Spot</p>
          <h3>Portfolio Snapshot</h3>
        </div>
      </header>
      <div className="form-grid">
        <label>
          Config ID
          <input
            type="number"
            value={reportPayload.ConfigId}
            onChange={(e) => setReportPayload((prev) => ({ ...prev, ConfigId: Number(e.target.value) }))}
          />
        </label>
        <label>
          Period
          <select
            value={reportPayload.Period}
            onChange={(e) => setReportPayload((prev) => ({ ...prev, Period: e.target.value }))}
          >
            <option value="1D">1D</option>
            <option value="1W">1W</option>
            <option value="1M">1M</option>
            <option value="2M">2M</option>
            <option value="3M">3M</option>
            <option value="12M">12M</option>
            <option value="1Y">1Y</option>
            <option value="3Y">3Y</option>
          </select>
        </label>
      </div>
      <button
        className="primary"
        onClick={() => runRequest('spotReport', 'Binace/GetSpotReport', { payload: reportPayload })}
        disabled={loadingKey === 'spotReport'}
      >
        {loadingKey === 'spotReport' ? 'Loading...' : 'Call GetSpotReport'}
      </button>
    </section>
  )

  const renderOrders = () => (
    <>
      <div className="sub-tabs">
        {orderSubTabs.map((item) => (
          <button
            key={item.key}
            className={orderTab === item.key ? 'sub-tab active' : 'sub-tab'}
            onClick={() => setOrderTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {orderTab === 'overview' && (
        <section className="card">
          <header>
            <div>
              <p className="eyebrow">Orders</p>
              <h3>Waiting & Sold</h3>
            </div>
          </header>
          <button
            className="primary ghost"
            onClick={() => runRequest('orders', 'SQLite/GetOrders')}
            disabled={loadingKey === 'orders'}
          >
            {loadingKey === 'orders' ? 'Loading...' : 'Load Orders'}
          </button>
        </section>
      )}

      {orderTab === 'bySetting' && (
        <section className="card">
          <header>
            <h3>Filter by Setting</h3>
          </header>
          <label>
            Setting ID
            <input
              type="number"
              value={orderSettingId}
              onChange={(e) => setOrderSettingId(Number(e.target.value))}
            />
          </label>
          <button
            className="primary"
            onClick={() => runRequest('ordersBySetting', 'SQLite/GetOrdersBySettingId', { payload: { id: orderSettingId } })}
            disabled={loadingKey === 'ordersBySetting'}
          >
            {loadingKey === 'ordersBySetting' ? 'Loading...' : 'Load by Setting'}
          </button>
        </section>
      )}

      {orderTab === 'delete' && (
        <section className="card">
          <header>
            <h3>Manage Orders</h3>
          </header>
          <label>
            ลบครั้งละ 1 รายการ
            <input value={orderDeleteId} onChange={(e) => setOrderDeleteId(e.target.value)} placeholder="เช่น 2" />
          </label>
          <button
            className="danger"
            onClick={() => orderDeleteId && runRequest('deleteOrder', 'SQLite/DeleteOrder', { payload: { id: Number(orderDeleteId) } })}
            disabled={loadingKey === 'deleteOrder'}
          >
            {loadingKey === 'deleteOrder' ? 'Deleting...' : 'Delete Order'}
          </button>
          <label>
            ลบหลายรายการ (คั่นด้วย comma)
            <input value={orderDeleteIds} onChange={(e) => setOrderDeleteIds(e.target.value)} placeholder="2,1" />
          </label>
          <button
            className="danger ghost"
            onClick={() => {
              const ids = orderDeleteIds
                .split(',')
                .map((id) => Number(id.trim()))
                .filter(Boolean)
              if (ids.length) {
                runRequest('deleteOrders', 'SQLite/DeleteOrders', { payload: { id: ids } })
              }
            }}
            disabled={loadingKey === 'deleteOrders'}
          >
            {loadingKey === 'deleteOrders' ? 'Deleting...' : 'Delete Multiple'}
          </button>
        </section>
      )}
    </>
  )

  const renderBot = () => (
    <section className="card stack">
      <header>
        <p className="eyebrow">Bot Worker</p>
        <h3>ควบคุมบอท</h3>
      </header>
      <button
        className="secondary"
        onClick={() => runRequest('botStatus', 'BotWorker/CheckStatus')}
        disabled={loadingKey === 'botStatus'}
      >
        {loadingKey === 'botStatus' ? 'Checking...' : 'Get Status'}
      </button>
      <label>
        Config ID
        <input
          type="number"
          value={workerConfigId}
          onChange={(e) => setWorkerConfigId(Number(e.target.value))}
        />
      </label>
      <div className="button-group">
        <button
          className="primary"
          onClick={() => runRequest('botStart', 'BotWorker/Start', { payload: { ConfigId: workerConfigId } })}
          disabled={loadingKey === 'botStart'}
        >
          {loadingKey === 'botStart' ? 'Starting...' : 'Start'}
        </button>
        <button
          className="danger"
          onClick={() => runRequest('botStop', 'BotWorker/Stop')}
          disabled={loadingKey === 'botStop'}
        >
          {loadingKey === 'botStop' ? 'Stopping...' : 'Stop'}
        </button>
      </div>
    </section>
  )

  const renderSettings = () => (
    <>
      <section className="card">
        <header>
          <h3>ฐานข้อมูล & โหลดค่า</h3>
        </header>
        <div className="button-group">
          <button
            className="secondary"
            onClick={() => runRequest('checkDb', 'SQLite/CheckAndCreateDatabase')}
            disabled={loadingKey === 'checkDb'}
          >
            {loadingKey === 'checkDb' ? 'Checking...' : 'Check Database'}
          </button>
          <button
            className="secondary ghost"
            onClick={() => runRequest('getSettings', 'SQLite/GetAll', { method: 'GET' })}
            disabled={loadingKey === 'getSettings'}
          >
            {loadingKey === 'getSettings' ? 'Loading...' : 'Get Settings'}
          </button>
        </div>
      </section>

      <section className="card">
        <header>
          <h3>Create Setting</h3>
        </header>
        <div className="form-grid">
          <label>
            Config Version
            <input
              type="number"
              value={settingCreate.Config_Version}
              onChange={(e) => setSettingCreate((prev) => ({ ...prev, Config_Version: Number(e.target.value) }))}
            />
          </label>
          <label>
            Symbol
            <input value={settingCreate.SYMBOL} onChange={(e) => setSettingCreate((prev) => ({ ...prev, SYMBOL: e.target.value }))} />
          </label>
          <label>
            Percent Buy
            <input
              type="number"
              step="0.01"
              value={settingCreate.PERCEN_BUY}
              onChange={(e) => setSettingCreate((prev) => ({ ...prev, PERCEN_BUY: Number(e.target.value) }))}
            />
          </label>
          <label>
            Percent Sell
            <input
              type="number"
              step="0.01"
              value={settingCreate.PERCEN_SELL}
              onChange={(e) => setSettingCreate((prev) => ({ ...prev, PERCEN_SELL: Number(e.target.value) }))}
            />
          </label>
        </div>
        <label>
          API Key
          <input value={settingCreate.API_KEY} onChange={(e) => setSettingCreate((prev) => ({ ...prev, API_KEY: e.target.value }))} />
        </label>
        <label>
          API Secret
          <input value={settingCreate.API_SECRET} onChange={(e) => setSettingCreate((prev) => ({ ...prev, API_SECRET: e.target.value }))} />
        </label>
        <label>
          Discord Hook 1
          <input value={settingCreate.DisCord_Hook1} onChange={(e) => setSettingCreate((prev) => ({ ...prev, DisCord_Hook1: e.target.value }))} />
        </label>
        <label>
          Discord Hook 2
          <input value={settingCreate.DisCord_Hook2} onChange={(e) => setSettingCreate((prev) => ({ ...prev, DisCord_Hook2: e.target.value }))} />
        </label>
        <label>
          Buy Amount USD
          <input
            type="number"
            step="0.1"
            value={settingCreate.buyAmountUSD}
            onChange={(e) => setSettingCreate((prev) => ({ ...prev, buyAmountUSD: Number(e.target.value) }))}
          />
        </label>
        <button
          className="primary"
          onClick={() => runRequest('createSetting', 'SQLite/CreateSetting', { payload: settingCreate })}
          disabled={loadingKey === 'createSetting'}
        >
          {loadingKey === 'createSetting' ? 'Saving...' : 'Create Setting'}
        </button>
      </section>

      <section className="card">
        <header>
          <h3>Update Setting</h3>
        </header>
        <label>
          Setting ID
          <input
            type="number"
            value={settingUpdate.id}
            onChange={(e) => setSettingUpdate((prev) => ({ ...prev, id: Number(e.target.value) }))}
          />
        </label>
        <div className="form-grid">
          <label>
            Config Version
            <input
              type="number"
              value={settingUpdate.Config_Version}
              onChange={(e) => setSettingUpdate((prev) => ({ ...prev, Config_Version: Number(e.target.value) }))}
            />
          </label>
          <label>
            Symbol
            <input value={settingUpdate.SYMBOL} onChange={(e) => setSettingUpdate((prev) => ({ ...prev, SYMBOL: e.target.value }))} />
          </label>
          <label>
            Percent Buy
            <input
              type="number"
              step="0.01"
              value={settingUpdate.PERCEN_BUY}
              onChange={(e) => setSettingUpdate((prev) => ({ ...prev, PERCEN_BUY: Number(e.target.value) }))}
            />
          </label>
          <label>
            Percent Sell
            <input
              type="number"
              step="0.01"
              value={settingUpdate.PERCEN_SELL}
              onChange={(e) => setSettingUpdate((prev) => ({ ...prev, PERCEN_SELL: Number(e.target.value) }))}
            />
          </label>
        </div>
        <button
          className="primary ghost"
          onClick={() => runRequest('updateSetting', 'SQLite/Update', { payload: settingUpdate })}
          disabled={loadingKey === 'updateSetting'}
        >
          {loadingKey === 'updateSetting' ? 'Updating...' : 'Update'}
        </button>
        <label>
          Delete ID
          <input
            type="number"
            value={settingDeleteId}
            onChange={(e) => setSettingDeleteId(e.target.value)}
            placeholder="เช่น 2"
          />
        </label>
        <button
          className="danger"
          onClick={() =>
            settingDeleteId &&
            runRequest('deleteSetting', 'SQLite/Delete', { payload: { id: Number(settingDeleteId) } })
          }
          disabled={loadingKey === 'deleteSetting'}
        >
          {loadingKey === 'deleteSetting' ? 'Deleting...' : 'Delete Setting'}
        </button>
      </section>
    </>
  )

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <p className="eyebrow">BotGrid Console</p>
          <h1>Mobile Control Center</h1>
        </div>
        <label className="base-url">
          API Base
          <input value={apiBase} onChange={(e) => setApiBase(e.target.value)} placeholder="http://139.180.128.104:5081/api" />
        </label>
      </header>

      <main className="content">
        {activeTab === 'report' && renderReport()}
        {activeTab === 'orders' && renderOrders()}
        {activeTab === 'bot' && renderBot()}
        {activeTab === 'settings' && renderSettings()}
        <ResponsePanel title="ผลลัพธ์ล่าสุด" payload={lastResponse} error={errorResponse} />
      </main>

      <nav className="bottom-nav">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={tab.key === activeTab ? 'nav-item active' : 'nav-item'}
            onClick={() => setActiveTab(tab.key)}
          >
            <span className="icon">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
