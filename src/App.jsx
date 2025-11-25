import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as signalR from '@microsoft/signalr'

const tabs = [
  { key: 'orders', label: 'Orders', icon: '📦' },
  { key: 'bot', label: 'Bot', icon: '🤖' },
  { key: 'settings', label: 'Setting', icon: '⚙️' },
  { key: 'calculate', label: 'Calculate', icon: '🧮', link: 'https://nateeron.github.io/Calculate-Grid-App/', external: true },
]

const TradingViewWidget = () => {
  const containerRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return
    containerRef.current.innerHTML = ''
    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.async = true
    script.innerHTML = JSON.stringify({
      allow_symbol_change: true,
      calendar: false,
      details: false,
      hide_side_toolbar: false,
      hide_top_toolbar: false,
      hide_legend: false,
      hide_volume: true,
      hotlist: false,
      interval: '1',
      locale: 'en',
      save_image: true,
      style: '1',
      symbol: 'BINANCE:XRPUSDT',
      theme: 'dark',
      timezone: 'Asia/Bangkok',
      backgroundColor: '#0F0F0F',
      gridColor: 'rgba(242, 242, 242, 0.06)',
      watchlist: ['BINANCE:ETHUSDT', 'BINANCE:BTCUSDT', 'BINANCE:SOLUSDT', 'BINANCE:XRPUSDT'],
      withdateranges: false,
      compareSymbols: [],
      studies: ['STD;SMA'],
      autosize: true,
    })
    containerRef.current.appendChild(script)
    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
    }
  }, [])

  return (
    <div className="tradingview-widget-container">
      <div className="tradingview-widget-container__widget" ref={containerRef}></div>
     
    </div>
  )
}

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

export default function App() {
  const [activeTab, setActiveTab] = useState('orders')
  const [apiBase, setApiBase] = useState('http://139.180.128.104:5081/api')
  //const [apiBase, setApiBase] = useState('http://localhost:5081/api')
  const [loadingKey, setLoadingKey] = useState(null)
  const [orders, setOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersError, setOrdersError] = useState(null)
  const [settings, setSettings] = useState([])
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [settingsError, setSettingsError] = useState(null)
  const [selectedSettingId, setSelectedSettingId] = useState(null)
  const [modalSetting, setModalSetting] = useState(null)
  const [isSettingModalOpen, setIsSettingModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('edit')
  const [botStatuses, setBotStatuses] = useState({})
  const [botStatusLoading, setBotStatusLoading] = useState(false)
  const [botStatusError, setBotStatusError] = useState(null)
  const [orderModalData, setOrderModalData] = useState(null)
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false)
  const [sellModalData, setSellModalData] = useState(null)
  const emptySettingTemplate = useMemo(
    () => ({
      id: null,
      Config_Version: 1,
      API_KEY: '',
      API_SECRET: '',
      DisCord_Hook1: '',
      DisCord_Hook2: '',
      SYMBOL: 'BTCUSDT',
      PERCEN_BUY: 0.5,
      PERCEN_SELL: 0.5,
      buyAmountUSD: 10,
    }),
    []
  )

  const headers = useMemo(
    () => ({
      'Content-Type': 'application/json',
    }),
    []
  )

  const runRequest = async (key, endpoint, { method = 'POST', payload, onSuccess, onError } = {}) => {
    const url = buildUrl(apiBase, endpoint)
    setLoadingKey(key)
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

      onSuccess?.(data, { key, status: response.status })
      return data
    } catch (err) {
      onError?.(err)
    } finally {
      setLoadingKey(null)
    }
  }

  const fetchOrders = async (key = 'ordersAuto') => {
    setOrdersLoading(true)
    setOrdersError(null)
    try {
      await runRequest(key, 'SQLite/GetOrders', {
        onSuccess: (payload) => {
          const items = Array.isArray(payload?.data) ? payload.data : []
          setOrders(items)
          setOrdersError(null)
        },
        onError: (err) => {
          setOrdersError(err)
        },
      })
    } finally {
      setOrdersLoading(false)
    }
  }

  const fetchSettings = async (key = 'settingsAuto') => {
    setSettingsLoading(true)
    setSettingsError(null)
    try {
      await runRequest(key, 'SQLite/GetAll', {
        method: 'GET',
        onSuccess: (payload) => {
          const raw = payload?.data ?? payload
          const items = Array.isArray(raw) ? raw : raw ? [raw] : []
          setSettings(items)
          if (!selectedSettingId && items.length > 0) {
            setSelectedSettingId(items[0].id)
            setReportPayload((prev) => ({ ...prev, ConfigId: items[0].id }))
          }
        },
        onError: (err) => {
          setSettingsError(err)
        },
      })
    } finally {
      setSettingsLoading(false)
    }
  }

  const normalizeStatusResponse = (payload) => {
    if (!payload) return {}
    const data = payload?.data ?? payload
    if (Array.isArray(data)) {
      return data.reduce((acc, item) => {
        const id = item.ConfigId ?? item.configId ?? item.config_ID ?? item.id
        if (id === undefined || id === null) return acc
        acc[id] = {
          status: item.status ?? item.Status ?? item.state ?? 'Unknown',
          message: item.message ?? item.Message ?? item.detail ?? '',
        }
        return acc
      }, {})
    }
    if (typeof data === 'object') {
      const id = data.ConfigId ?? data.configId ?? data.id ?? 'global'
      return {
        [id]: {
          status: data.status ?? data.Status ?? data.state ?? 'Unknown',
          message: data.message ?? data.Message ?? data.detail ?? '',
        },
      }
    }
    return {}
  }

  const fetchBotStatus = async (key = 'botStatusAuto') => {
    setBotStatusLoading(true)
    setBotStatusError(null)
    try {
      await runRequest(key, 'BotWorker/CheckStatus', {
        onSuccess: (payload) => {
          setBotStatuses(normalizeStatusResponse(payload))
        },
        onError: (err) => {
          setBotStatusError(err)
        },
      })
    } finally {
      setBotStatusLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
    fetchSettings()
    fetchBotStatus()
  }, [])

  // SignalR connection for real-time order updates
  useEffect(() => {
    const baseUrl = apiBase.replace('/api', '')
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${baseUrl}/hubs/orders`)
      .withAutomaticReconnect()
      .build()

    connection
      .start()
      .then(() => {
        console.log('SignalR Connected')
        // Join group for config ID "1" (can be made dynamic based on selectedSettingId)
        connection.invoke('JoinOrderGroup', '1').catch((err) => {
          console.error('Error joining order group:', err)
        })
      })
      .catch((err) => {
        console.error('SignalR Connection Error:', err)
      })

    // Listen for order updates
    connection.on('OrderUpdated', (data) => {
      console.log('Order updated:', data)
      // Reload/update UI
      fetchOrders('ordersSignalR')
    })

    // Cleanup on unmount
    return () => {
      connection.stop().catch((err) => {
        console.error('Error stopping SignalR connection:', err)
      })
    }
  }, [apiBase])

  const formatDateTime = (value) => {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    // Format with Bangkok timezone (+7)
    return new Intl.DateTimeFormat('th-TH', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date)
  }

  const normalizeSettingRecord = (record) => {
    if (!record) return null
    return {
      id: record.id ?? '',
      Config_Version: record.config_Version ?? record.Config_Version ?? 1,
      API_KEY: record.apI_KEY ?? record.API_KEY ?? '',
      API_SECRET: record.apI_SECRET ?? record.API_SECRET ?? '',
      DisCord_Hook1: record.disCord_Hook1 ?? record.DisCord_Hook1 ?? '',
      DisCord_Hook2: record.disCord_Hook2 ?? record.DisCord_Hook2 ?? '',
      SYMBOL: record.symbol ?? record.SYMBOL ?? '',
      PERCEN_BUY: record.perceN_BUY ?? record.PERCEN_BUY ?? 0,
      PERCEN_SELL: record.perceN_SELL ?? record.PERCEN_SELL ?? 0,
      buyAmountUSD: record.buyAmountUSD ?? record.BuyAmountUSD ?? 0,
    }
  }

  const selectedSetting = useMemo(() => {
    if (!selectedSettingId) return null
    return settings.find((item) => item.id === selectedSettingId) || null
  }, [settings, selectedSettingId])

  const handleSettingSelect = (id) => {
    setSelectedSettingId(id)
  }

  const getStatusForSetting = (id) => {
    if (!id) return botStatuses.global || null
    return botStatuses[id] || botStatuses[String(id)] || botStatuses.global || null
  }

  const buildOrderDraft = (order) => {
    if (!order) return null
    return {
      id: order.id ?? '',
      orderBuyID: order.orderBuyID ?? '',
      priceBuy: order.priceBuy ?? 0,
      priceWaitSell: order.priceWaitSell ?? 0,
      orderSellID: order.orderSellID ?? '',
      priceSellActual: order.priceSellActual ?? 0,
      profitLoss: order.profitLoss ?? 0,
      dateBuy: order.dateBuy ?? '',
      dateSell: order.dateSell ?? '',
      setting_ID: order.setting_ID ?? order.settingId ?? order.settingID ?? '',
      status: order.status ?? '',
      symbol: order.symbol ?? '',
      quantity: order.quantity ?? order.coinQuantity ?? 0,
      buyAmountUSD: order.buyAmountUSD ?? 0,
      coinQuantity: order.coinQuantity ?? order.quantity ?? 0,
    }
  }

  const openOrderEditModal = (order) => {
    const draft = buildOrderDraft(order)
    if (!draft) return
    setOrderModalData(draft)
    setIsOrderModalOpen(true)
  }

  const closeOrderModal = () => {
    setIsOrderModalOpen(false)
    setOrderModalData(null)
  }

  const saveOrderModal = async () => {
    if (!orderModalData) return
    const confirmed = window.confirm(`ยืนยันแก้ไข Order #${orderModalData.id}?`)
    if (!confirmed) return
    await runRequest(`updateOrder-${orderModalData.id}`, 'SQLite/UpdateOrder', {
      payload: orderModalData,
      onSuccess: () => {
        fetchOrders('ordersAfterUpdate')
        closeOrderModal()
      },
    })
  }

  const handleDeleteOrder = async (order) => {
    if (!order?.id) return
    const confirmed = window.confirm(`ต้องการลบ Order #${order.id} หรือไม่?`)
    if (!confirmed) return
    await runRequest(`deleteOrder-${order.id}`, 'SQLite/DeleteOrder', {
      payload: { id: Number(order.id) },
      onSuccess: () => fetchOrders('ordersAfterDelete'),
    })
  }

  const openSellModal = (order) => {
    setSellModalData(order || null)
  }

  const closeSellModal = () => {
    setSellModalData(null)
  }

  useEffect(() => {
    if (!isOrderModalOpen || !orderModalData) return
    const buy = Number(orderModalData.priceBuy ?? 0)
    const sell = Number(orderModalData.priceSellActual ?? 0)
    const calculated = Number((sell - buy).toFixed(4))
    if (orderModalData.profitLoss !== calculated) {
      setOrderModalData((prev) => (prev ? { ...prev, profitLoss: calculated } : prev))
    }
  }, [isOrderModalOpen, orderModalData?.priceBuy, orderModalData?.priceSellActual])

  const openSettingModal = (setting) => {
    const normalized = normalizeSettingRecord(setting || selectedSetting)
    if (!normalized) return
    setModalSetting(normalized)
    setModalMode('edit')
    setIsSettingModalOpen(true)
  }

  const openNewSettingModal = () => {
    setModalMode('create')
    setModalSetting({ ...emptySettingTemplate })
    setIsSettingModalOpen(true)
  }

  const closeSettingModal = () => {
    setIsSettingModalOpen(false)
    setModalSetting(null)
    setModalMode('edit')
  }

  const saveSettingModal = async () => {
    if (!modalSetting) return
    const payload = { ...modalSetting }
    if (modalMode === 'create') {
      delete payload.id
      await runRequest('createSettingModal', 'SQLite/CreateSetting', {
        payload,
        onSuccess: () => {
          fetchSettings('settingsAfterSave')
          closeSettingModal()
        },
      })
    } else {
      await runRequest('updateSettingModal', 'SQLite/Update', {
        payload,
        onSuccess: () => {
          fetchSettings('settingsAfterSave')
          closeSettingModal()
        },
      })
    }
  }

  const handleBotAction = async (action, configId) => {
    if (!configId) return
    const endpoint = action === 'start' ? 'BotWorker/Start' : 'BotWorker/Stop'
    const key = `${action}-${configId}`
    await runRequest(key, endpoint, {
      payload: action === 'start' ? { ConfigId: configId } : undefined,
      onSuccess: () => {
        fetchBotStatus(`botStatusAfter${action}`)
      },
    })
  }

  const renderOrders = () => (
    <section className="card">
      <header>
        <div>
          <p className="eyebrow">Orders</p>
          <h3>Waiting & Sold</h3>
        </div>
        <button className="secondary ghost" onClick={() => fetchOrders('ordersManual')} disabled={ordersLoading}>
          {ordersLoading ? 'Loading...' : 'Refresh'}
        </button>
      </header>

      <div className="order-list">
        {ordersLoading && <div className="state-block">กำลังโหลดคำสั่งซื้อ...</div>}

        {!ordersLoading && ordersError && <div className="state-block error">โหลดข้อมูลไม่ได้: {prettify(ordersError)}</div>}

        {!ordersLoading && !ordersError && orders.length === 0 && (
          <div className="state-block empty">ยังไม่มีคำสั่งซื้อ</div>
        )}

        {!ordersLoading && !ordersError && orders.length > 0 && (
          <div className="order-grid">
            {orders.map((order) => {
              const profit = Number(order?.profitLoss ?? 0)
              const isGain = profit >= 0
              return (
                <article key={order.id} className="order-card">
                  <header className="order-card__header">
                    <div className="order-card__info">
                      <strong>{order?.symbol || '—'}</strong>
                      <span className="order-card__id">#{order?.id ?? '—'}</span>
                    </div>
                    <span
                      className={`status-badge status-${(order?.status || 'unknown').toLowerCase()} ${
                        order?.status === 'WAITING_SELL' ? 'status-waiting-sell' : ''
                      }`}
                    >
                      {order?.status || 'Unknown'}
                    </span>
                  </header>
                  <div className="order-card__row">
                    <span className="label">Buy → Sell</span>
                    <span className="value">
                      {order?.priceBuy ?? '-'} → {order?.priceSellActual ?? '-'}
                    </span>
                  </div>
                  <div className="order-card__row">
                    <span className="label">Wait Sell Price</span>
                    <span className="value">
                      {order?.priceWaitSell != null ? Number(order.priceWaitSell).toFixed(4) : '-'}
                    </span>
                  </div>
                  <div className="order-card__row">
                    <span className="label">Profit/Loss</span>
                    <span className={`value ${isGain ? 'positive' : 'negative'}`}>
                      {isGain ? '+' : ''}
                      {Number(order?.profitLoss ?? 0).toFixed(4)}
                    </span>
                  </div>
                  <div className="order-card__grid">
                    <div>
                      <span className="label">Amount USD</span>
                      <span className="value">{order?.buyAmountUSD ?? '-'}</span>
                    </div>
                    <div>
                      <span className="label">Coin Qty</span>
                      <span className="value">{order?.coinQuantity ?? order?.quantity ?? '-'}</span>
                    </div>
                  </div>
                  <div className="order-card__dates">
                    <div>
                      <span className="label">Date Buy</span>
                      <span className="value">{formatDateTime(order?.dateBuy)}</span>
                    </div>
                    <div>
                      <span className="label">Date Sell</span>
                      <span className="value">{formatDateTime(order?.dateSell)}</span>
                    </div>
                  </div>
                  <div className="button-group order-card__actions">
                    <button
                      className="danger"
                      type="button"
                      onClick={() => handleDeleteOrder(order)}
                      aria-label="Delete order"
                      title="Delete order"
                    >
                      🗑
                    </button>
                    <button
                      className="secondary"
                      type="button"
                      onClick={() => openOrderEditModal(order)}
                      aria-label="Edit order"
                      title="Edit order"
                    >
                      ✏️
                    </button>
                    <button
                      className="primary ghost"
                      type="button"
                      onClick={() => openSellModal(order)}
                      aria-label="Sell now"
                      title="Sell now"
                    >
                      ⚡️
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )

  const renderBot = () => (
    <section className="card">
      <header>
        <div>
          <p className="eyebrow">Bot Worker</p>
          <h3>ควบคุมบอท</h3>
        </div>
        <div className="button-group">
          <button className="secondary" onClick={() => fetchBotStatus('botStatusManual')} disabled={botStatusLoading}>
            {botStatusLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </header>
      {botStatusError && <div className="state-block error">เช็คสถานะไม่ได้: {prettify(botStatusError)}</div>}
      {settingsLoading && <div className="state-block">กำลังโหลด Setting...</div>}
      {!settingsLoading && settings.length === 0 && <div className="state-block empty">ยังไม่มี Setting</div>}
      <div className="bot-grid">
        {settings.map((setting) => {
          const buy = setting.perceN_BUY ?? setting.PERCEN_BUY ?? 0
          const sell = setting.perceN_SELL ?? setting.PERCEN_SELL ?? 0
          const amount = setting.buyAmountUSD ?? '-'
          const status = getStatusForSetting(setting.id)
          const statusText = status?.status || 'Unknown'
          const message = status?.message || '—'
          const statusClass =
            statusText.toLowerCase() === 'running' || statusText.toLowerCase() === 'online'
              ? 'status-running'
              : statusText.toLowerCase() === 'stopped'
              ? 'status-stopped'
              : 'status-unknown'
          return (
            <article key={setting.id} className="bot-card">
              <header className="bot-card__header">
                <div>
                  <p className="bot-card__symbol">{setting.symbol || setting.SYMBOL || '-'}</p>
                  <span className="bot-card__id">#{setting.id}</span>
                </div>
                <span className={`status-chip ${statusClass}`}>{statusText}</span>
              </header>
              <div className="bot-card__grid">
                <div>
                  <span className="label">% Buy</span>
                  <span className="value">{buy}</span>
                </div>
                <div>
                  <span className="label">% Sell</span>
                  <span className="value">{sell}</span>
                </div>
                <div>
                  <span className="label">Amount USD</span>
                  <span className="value">{amount}</span>
                </div>
              </div>
              <div className="bot-card__message">
                <span className="label">Message</span>
                <p>{message}</p>
              </div>
              <div className="button-group icon-buttons">
                <button
                  className="primary"
                  type="button"
                  onClick={() => handleBotAction('start', setting.id)}
                  aria-label="Start bot"
                  title="Start bot"
                >
                  ▶
                </button>
                <button
                  className="danger"
                  type="button"
                  onClick={() => handleBotAction('stop', setting.id)}
                  aria-label="Stop bot"
                  title="Stop bot"
                >
                  ⏹
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )

  const renderSettings = () => (
    <>
      <section className="card">
        <header>
          <h3>Settings</h3>
          <div className="button-group">
            <button className="primary" onClick={openNewSettingModal}>
              + Add Setting
            </button>
            <button className="secondary ghost" onClick={() => fetchSettings('settingsManual')} disabled={settingsLoading}>
              {settingsLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </header>
        {settingsError && <div className="state-block error">โหลด Setting ไม่ได้: {prettify(settingsError)}</div>}
        {settingsLoading && <div className="state-block">กำลังโหลด Setting...</div>}
        {!settingsLoading && settings.length === 0 && <div className="state-block empty">ยังไม่มี Setting</div>}
        {!settingsLoading && settings.length > 0 && (
          <div className="setting-grid">
            {settings.map((item) => {
              const buy = item.perceN_BUY ?? item.PERCEN_BUY ?? 0
              const sell = item.perceN_SELL ?? item.PERCEN_SELL ?? 0
              const amount = item.buyAmountUSD ?? '-'
              const apiKey = item.apI_KEY || item.API_KEY || ''
              const apiSnippet = apiKey ? `${apiKey.slice(0, 6)}...` : '-'
              const isActive = selectedSettingId === item.id
              return (
                <article
                  key={item.id}
                  className={isActive ? 'setting-card active' : 'setting-card'}
                  onClick={() => handleSettingSelect(item.id)}
                >
                  <header className="setting-card__header">
                    <div>
                      <p className="setting-card__symbol">{item.symbol || item.SYMBOL || '-'}</p>
                      <span className="setting-card__id">#{item.id}</span>
                    </div>
                    <button
                      className="secondary ghost"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        openSettingModal(item)
                      }}
                    >
                      Edit
                    </button>
                  </header>
                  <div className="setting-card__body">
                    <div>
                      <span className="label">% Buy</span>
                      <span className="value">{buy}</span>
                    </div>
                    <div>
                      <span className="label">% Sell</span>
                      <span className="value">{sell}</span>
                    </div>
                    <div>
                      <span className="label">Amount USD</span>
                      <span className="value">{amount}</span>
                    </div>
                    <div>
                      <span className="label">API Key</span>
                      <span className="value mono">{apiSnippet}</span>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

    </>
  )

  return (
    <div className="app">
      <main className="content">
        {activeTab === 'orders' && (
          <div className="tradingview-full-width">
            <TradingViewWidget />
          </div>
        )}
        {activeTab === 'orders' && renderOrders()}
        {activeTab === 'bot' && renderBot()}
        {activeTab === 'settings' && renderSettings()}
      </main>

      {isSettingModalOpen && modalSetting && (
        <div className="modal-backdrop" onClick={closeSettingModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <h3>{modalMode === 'create' ? 'สร้าง Setting ใหม่' : `แก้ไข Setting #${modalSetting.id}`}</h3>
            </header>
            <div className="form-grid">
              <label>
                Config Version
                <input
                  type="number"
                  value={modalSetting.Config_Version ?? ''}
                  onChange={(e) => setModalSetting((prev) => ({ ...prev, Config_Version: Number(e.target.value) }))}
                />
              </label>
              <label>
                Symbol
                <input value={modalSetting.SYMBOL || ''} onChange={(e) => setModalSetting((prev) => ({ ...prev, SYMBOL: e.target.value }))} />
              </label>
              <label>
                Percent Buy
                <input
                  type="number"
                  step="0.01"
                  value={modalSetting.PERCEN_BUY ?? 0}
                  onChange={(e) => setModalSetting((prev) => ({ ...prev, PERCEN_BUY: Number(e.target.value) }))}
                />
              </label>
              <label>
                Percent Sell
                <input
                  type="number"
                  step="0.01"
                  value={modalSetting.PERCEN_SELL ?? 0}
                  onChange={(e) => setModalSetting((prev) => ({ ...prev, PERCEN_SELL: Number(e.target.value) }))}
                />
              </label>
            </div>
            <label>
              API Key
              <input value={modalSetting.API_KEY || ''} onChange={(e) => setModalSetting((prev) => ({ ...prev, API_KEY: e.target.value }))} />
            </label>
            <label>
              API Secret
              <input value={modalSetting.API_SECRET || ''} onChange={(e) => setModalSetting((prev) => ({ ...prev, API_SECRET: e.target.value }))} />
            </label>
            <label>
              Discord Hook 1
              <input
                value={modalSetting.DisCord_Hook1 || ''}
                onChange={(e) => setModalSetting((prev) => ({ ...prev, DisCord_Hook1: e.target.value }))}
              />
            </label>
            <label>
              Discord Hook 2
              <input
                value={modalSetting.DisCord_Hook2 || ''}
                onChange={(e) => setModalSetting((prev) => ({ ...prev, DisCord_Hook2: e.target.value }))}
              />
            </label>
            <label>
              Buy Amount USD
              <input
                type="number"
                step="0.1"
                value={modalSetting.buyAmountUSD ?? 0}
                onChange={(e) => setModalSetting((prev) => ({ ...prev, buyAmountUSD: Number(e.target.value) }))}
              />
            </label>
            <div className="button-group">
              <button className="secondary ghost" type="button" onClick={closeSettingModal}>
                Cancel
              </button>
              <button className="primary" type="button" onClick={saveSettingModal}>
                {modalMode === 'create' ? 'Create' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isOrderModalOpen && orderModalData && (
        <div className="modal-backdrop" onClick={closeOrderModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <h3>แก้ไข Order #{orderModalData.id}</h3>
            </header>
            <div className="modal-info-grid">
              <div>
                <span className="label">Setting ID</span>
                <span className="value">{orderModalData.setting_ID ?? '-'}</span>
              </div>
              <div>
                <span className="label">Symbol</span>
                <span className="value">{orderModalData.symbol || '-'}</span>
              </div>
            </div>
            <div className="form-grid">
              <label>
                Status
                <input value={orderModalData.status || ''} onChange={(e) => setOrderModalData((prev) => ({ ...prev, status: e.target.value }))} />
              </label>
              <label>
                Quantity
                <input
                  type="number"
                  step="0.0001"
                  value={orderModalData.coinQuantity ?? 0}
                  onChange={(e) =>
                    setOrderModalData((prev) => ({
                      ...prev,
                      coinQuantity: Number(e.target.value),
                      quantity: Number(e.target.value),
                    }))
                  }
                />
              </label>
            </div>
            <div className="form-grid">
              <label>
                Price Buy
                <input
                  type="number"
                  step="0.0001"
                  value={orderModalData.priceBuy ?? 0}
                  onChange={(e) => setOrderModalData((prev) => ({ ...prev, priceBuy: Number(e.target.value) }))}
                />
              </label>
              <label>
                Price Wait Sell
                <input
                  type="number"
                  step="0.0001"
                  value={orderModalData.priceWaitSell ?? 0}
                  onChange={(e) => setOrderModalData((prev) => ({ ...prev, priceWaitSell: Number(e.target.value) }))}
                />
              </label>
              <label>
                Price Sell Actual
                <input
                  type="number"
                  step="0.0001"
                  value={orderModalData.priceSellActual ?? 0}
                  onChange={(e) => setOrderModalData((prev) => ({ ...prev, priceSellActual: Number(e.target.value) }))}
                />
              </label>
              <label>
                Profit/Loss
                <input
                  type="number"
                  step="0.0001"
                  value={orderModalData.profitLoss ?? 0}
                  readOnly
                />
              </label>
            </div>
            <label>
              Buy Amount USD
              <input
                type="number"
                step="0.01"
                value={orderModalData.buyAmountUSD ?? 0}
                onChange={(e) => setOrderModalData((prev) => ({ ...prev, buyAmountUSD: Number(e.target.value) }))}
              />
            </label>
            <div className="button-group">
              <button className="secondary ghost" type="button" onClick={closeOrderModal}>
                Cancel
              </button>
              <button className="primary" type="button" onClick={saveOrderModal}>
                Save Order
              </button>
            </div>
          </div>
        </div>
      )}

      {sellModalData && (
        <div className="modal-backdrop" onClick={closeSellModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <h3>Sell Now #{sellModalData.id}</h3>
            </header>
            <p>ฟังก์ชัน Sell Now ยังไม่มี API เชื่อมต่อในตอนนี้</p>
            <p>
              Order: <strong>{sellModalData.symbol}</strong> จำนวน {sellModalData.coinQuantity ?? sellModalData.quantity ?? '-'} ที่ราคา{' '}
              {sellModalData.priceBuy ?? '-'}
            </p>
            <div className="button-group">
              <button className="secondary" type="button" onClick={closeSellModal}>
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="bottom-nav">
        {tabs.map((tab) => {
          if (tab.external && tab.link) {
            return (
              <a
                key={tab.key}
                href={tab.link}
                target="_blank"
                rel="noopener noreferrer"
                className="nav-item"
              >
                <span className="icon">{tab.icon}</span>
                <span>{tab.label}</span>
              </a>
            )
          }
          return (
            <button
              key={tab.key}
              className={tab.key === activeTab ? 'nav-item active' : 'nav-item'}
              onClick={() => setActiveTab(tab.key)}
            >
              <span className="icon">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
