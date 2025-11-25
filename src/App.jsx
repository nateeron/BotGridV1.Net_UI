import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as signalR from '@microsoft/signalr'

const tabs = [
  { key: 'orders', label: 'Orders', icon: '📦' },
  { key: 'report', label: 'Report', icon: '📊' },
  { key: 'binaceOrders', label: 'Binace Order', icon: '📋' },
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

const safeJSONParse = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

const loadState = (key, fallback) => {
  if (typeof window === 'undefined') return fallback
  const stored = sessionStorage.getItem(key)
  if (stored === null) return fallback
  return safeJSONParse(stored, fallback)
}

const loadPrimitiveState = (key, fallback) => {
  if (typeof window === 'undefined') return fallback
  const stored = sessionStorage.getItem(key)
  if (stored === null) return fallback
  try {
    return JSON.parse(stored)
  } catch {
    return stored
  }
}

const loadObjectState = (key, fallback) => {
  const stored = loadState(key, null)
  if (stored && typeof stored === 'object') {
    return { ...fallback, ...stored }
  }
  return fallback
}

const trimZeros = (value, decimals = 8) => {
  if (value === null || value === undefined || value === '') return '-'
  const num = Number(value)
  if (Number.isNaN(num)) return value
  const fixed = num.toFixed(decimals)
  return fixed.replace(/\.?0+$/, '')
}

const defaultTradeForm = {
  ConfigId: 1,
  Symbol: 'BTCUSDT',
  Side: 'BUY',
  OrderType: 'MARKET',
  Price: '',
  CoinQuantity: '',
  UsdAmount: '',
  PortfolioPercent: '',
  TimeInForce: 'GTC',
}

const defaultBuyNowForm = {
  ConfigId: 1,
  BuyAmountUSD: '',
  Symbol: '',
}

const defaultFilledOrdersForm = {
  Symbol: '',
  OrderSide: '',
  StartTime: '',
  Limit: 50,
}

export default function App() {
  const [activeTab, setActiveTab] = useState(() => loadPrimitiveState('activeTab', 'orders'))
  const [apiBase, setApiBase] = useState('http://139.180.128.104:5081/api')
  //const [apiBase, setApiBase] = useState('http://localhost:5081/api')
  const [loadingKey, setLoadingKey] = useState(null)
  const [orders, setOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersError, setOrdersError] = useState(null)
  const [orderFilter, setOrderFilter] = useState(() => loadPrimitiveState('orderFilter', 'all')) // 'all', 'SOLD', 'WAITING_SELL'
  const [buyPauseStatus, setBuyPauseStatus] = useState({ isPaused: false, loading: false, message: '' })
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
  const [viewMode, setViewMode] = useState(() => loadPrimitiveState('viewMode', 'chart')) // 'chart', 'calculate', 'trade'
  const [cal1, setCal1] = useState(() => loadPrimitiveState('cal1', ''))
  const [cal2, setCal2] = useState(() => loadPrimitiveState('cal2', ''))
  const [percentInput, setPercentInput] = useState(() => loadPrimitiveState('percentInput', ''))
  const [tradeForm, setTradeForm] = useState(() => loadObjectState('tradeForm', defaultTradeForm))
  const [tradeLoading, setTradeLoading] = useState(false)
  const [isTradeVerificationOpen, setIsTradeVerificationOpen] = useState(false)
  const [verificationKey, setVerificationKey] = useState('')
  const [verificationInput, setVerificationInput] = useState('')
  const [pendingTradePayload, setPendingTradePayload] = useState(null)
  const [isSellNowVerificationOpen, setIsSellNowVerificationOpen] = useState(false)
  const [sellNowVerificationKey, setSellNowVerificationKey] = useState('')
  const [sellNowVerificationInput, setSellNowVerificationInput] = useState('')
  const [pendingSellNowOrder, setPendingSellNowOrder] = useState(null)
  const [sellNowLoading, setSellNowLoading] = useState(false)
  const [isBuyNowVerificationOpen, setIsBuyNowVerificationOpen] = useState(false)
  const [isBuyNowFormOpen, setIsBuyNowFormOpen] = useState(false)
  const [buyNowVerificationKey, setBuyNowVerificationKey] = useState('')
  const [buyNowVerificationInput, setBuyNowVerificationInput] = useState('')
  const [buyNowForm, setBuyNowForm] = useState(() => loadObjectState('buyNowForm', defaultBuyNowForm))
  const [buyNowLoading, setBuyNowLoading] = useState(false)
  const [spotReport, setSpotReport] = useState(null)
  const [spotReportLoading, setSpotReportLoading] = useState(false)
  const [spotReportError, setSpotReportError] = useState(null)
  const [reportConfigId, setReportConfigId] = useState(() => {
    const stored = loadPrimitiveState('reportConfigId', null)
    return stored !== null ? Number(stored) : null
  })
  const [reportPeriod, setReportPeriod] = useState(() => loadPrimitiveState('reportPeriod', '1M'))
  const [allCoinsData, setAllCoinsData] = useState({
    coins: [],
    totalValueUSD: 0,
    count: 0,
  })
  const [allCoinsLoading, setAllCoinsLoading] = useState(false)
  const [allCoinsError, setAllCoinsError] = useState(null)
  const [filledOrders, setFilledOrders] = useState([])
  const [filledOrdersSort, setFilledOrdersSort] = useState({
    field: 'orderId',
    direction: 'desc',
  })
  const [filledOrdersLoading, setFilledOrdersLoading] = useState(false)
  const [filledOrdersError, setFilledOrdersError] = useState(null)
  const [filledOrdersForm, setFilledOrdersForm] = useState(() =>
    loadObjectState('filledOrdersForm', defaultFilledOrdersForm)
  )
  const [serverTimeData, setServerTimeData] = useState(null)
  const [serverTimeLoading, setServerTimeLoading] = useState(false)
  const [serverTimeError, setServerTimeError] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [alertLogs, setAlertLogs] = useState([])
  const [alertLogsLoading, setAlertLogsLoading] = useState(false)
  const [alertLogsError, setAlertLogsError] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [alertFilters, setAlertFilters] = useState({
    Limit: null,
    Offset: 0,
    Type: '',
    Level: '',
    ConfigId: '',
    FromDate: null,
    ToDate: null,
    IsRead: null,
  })
  const [showAlertLogs, setShowAlertLogs] = useState(false)
  const [backupImportMode, setBackupImportMode] = useState('file') // 'file' or 'text'
  const [backupFile, setBackupFile] = useState(null)
  const [backupJsonText, setBackupJsonText] = useState('')
  const [backupReplaceExisting, setBackupReplaceExisting] = useState(true)
  const [backupLoading, setBackupLoading] = useState(false)
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

  const fetchBuyPauseStatus = async () => {
    setBuyPauseStatus(prev => ({ ...prev, loading: true }))
    try {
      await runRequest('buyPauseStatus', 'BotWorker/GetBuyPauseStatus', {
        method: 'POST',
        payload: {},
        onSuccess: (payload) => {
          setBuyPauseStatus({
            isPaused: payload?.isPaused ?? false,
            loading: false,
            message: payload?.message ?? '',
          })
        },
        onError: (err) => {
          setBuyPauseStatus(prev => ({ ...prev, loading: false }))
        },
      })
    } catch (err) {
      setBuyPauseStatus(prev => ({ ...prev, loading: false }))
    }
  }

  const setBuyPauseState = async (pause) => {
    setBuyPauseStatus(prev => ({ ...prev, loading: true }))
    try {
      await runRequest('buyPauseState', 'BotWorker/SetBuyPauseState', {
        method: 'POST',
        payload: { pause },
        onSuccess: (payload) => {
          setBuyPauseStatus({
            isPaused: payload?.isPaused ?? pause,
            loading: false,
            message: payload?.message ?? '',
          })
        },
        onError: (err) => {
          setBuyPauseStatus(prev => ({ ...prev, loading: false }))
        },
      })
    } catch (err) {
      setBuyPauseStatus(prev => ({ ...prev, loading: false }))
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
          }
          if (!reportConfigId && items.length > 0) {
            setReportConfigId(items[0].id)
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

  const fetchAlertLogs = async () => {
    setAlertLogsLoading(true)
    setAlertLogsError(null)
    try {
      await runRequest('alertLogs', 'Alert/GetLogs', {
        payload: alertFilters,
        onSuccess: (payload) => {
          const logs = payload?.data?.logs || []
          setAlertLogs(logs)
        },
        onError: (err) => {
          setAlertLogsError(err)
        },
      })
    } finally {
      setAlertLogsLoading(false)
    }
  }

  const markAlertAsRead = async (alertId) => {
    await runRequest(`markRead-${alertId}`, 'Alert/MarkAsRead', {
      payload: { AlertId: alertId },
      onSuccess: () => {
        // Update local state
        setAlertLogs((prev) =>
          prev.map((log) => (log.id === alertId ? { ...log, isRead: true, readAt: new Date() } : log))
        )
        // Refresh unread count
        fetchUnreadCount()
      },
    })
  }

  const fetchUnreadCount = async () => {
    try {
      await runRequest('unreadCount', 'Alert/GetUnreadCount', {
        payload: { ConfigId: null },
        onSuccess: (payload) => {
          setUnreadCount(payload?.count || 0)
        },
      })
    } catch (err) {
      console.error('Error fetching unread count:', err)
    }
  }

  const clearLogs = async () => {
    const confirmed = window.confirm('ต้องการลบ logs ทั้งหมดหรือไม่?')
    if (!confirmed) return
    await runRequest('clearLogs', 'Alert/ClearLogs', {
      payload: {},
      onSuccess: () => {
        fetchAlertLogs()
        fetchUnreadCount()
      },
    })
  }

  const fetchSpotReport = async () => {
    if (!reportConfigId) return
    setSpotReportLoading(true)
    setSpotReportError(null)
    try {
      await runRequest('spotReport', 'Binace/GetSpotReport', {
        payload: {
          ConfigId: reportConfigId,
          Period: reportPeriod,
        },
        onSuccess: (data) => {
          setSpotReport(data)
        },
        onError: (err) => {
          setSpotReportError(err)
        },
      })
    } finally {
      setSpotReportLoading(false)
    }
  }

  const fetchAllCoins = async () => {
    if (!reportConfigId) return
    setAllCoinsLoading(true)
    setAllCoinsError(null)
    try {
      await runRequest('allCoins', 'Binace/GetAllCoins', {
        payload: { ConfigId: reportConfigId },
        onSuccess: (data) => {
          setAllCoinsData({
            coins: data?.coins || [],
            totalValueUSD: data?.totalValueUSD || 0,
            count: data?.count || 0,
          })
        },
        onError: (err) => {
          setAllCoinsError(err)
        },
      })
    } finally {
      setAllCoinsLoading(false)
    }
  }

  const fetchFilledOrders = async () => {
    if (!reportConfigId) {
      alert('กรุณาเลือก Config ID ในแท็บ Report ก่อน')
      return
    }
    setFilledOrdersLoading(true)
    setFilledOrdersError(null)
    try {
      const payload = {
        ConfigId: Number(reportConfigId || 1),
        Limit: Number(filledOrdersForm.Limit) || 50,
      }
      if (filledOrdersForm.Symbol) payload.Symbol = filledOrdersForm.Symbol.toUpperCase()
      if (filledOrdersForm.OrderSide) payload.OrderSide = filledOrdersForm.OrderSide
      if (filledOrdersForm.StartTime) {
        // Convert datetime-local to ISO format
        const date = new Date(filledOrdersForm.StartTime)
        payload.StartTime = date.toISOString()
      }

      await runRequest('filledOrders', 'Binace/GetFilledOrders', {
        payload,
        onSuccess: (data) => {
          const items = data?.orders || []
          setFilledOrders(sortFilledOrders(items, filledOrdersSort.field, filledOrdersSort.direction))
        },
        onError: (err) => {
          setFilledOrdersError(err)
        },
      })
    } finally {
      setFilledOrdersLoading(false)
    }
  }

  const fetchServerTime = async () => {
    if (!selectedSettingId) {
      alert('กรุณาเลือก Setting ก่อน')
      return
    }
    setServerTimeLoading(true)
    setServerTimeError(null)
    try {
      await runRequest('serverTime', 'Binace/GetServerTime', {
        payload: { ConfigId: selectedSettingId },
        onSuccess: (data) => {
          setServerTimeData(data)
        },
        onError: (err) => {
          setServerTimeError(err)
        },
      })
    } finally {
      setServerTimeLoading(false)
    }
  }
 
  const sortFilledOrders = (items, field, direction) => {
    const sorted = [...items].sort((a, b) => {
      const valueA = a[field]
      const valueB = b[field]
      if (valueA === undefined || valueA === null) return 1
      if (valueB === undefined || valueB === null) return -1
      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return valueA - valueB
      }
      if (field.toLowerCase().includes('time')) {
        return new Date(valueA) - new Date(valueB)
      }
      return String(valueA).localeCompare(String(valueB))
    })
    return direction === 'asc' ? sorted : sorted.reverse()
  }

  useEffect(() => {
    fetchOrders()
    fetchSettings()
    fetchBotStatus()
    fetchUnreadCount()

    // Refresh unread count every 30 seconds
    const unreadInterval = setInterval(() => {
      fetchUnreadCount()
    }, 30000)

    return () => clearInterval(unreadInterval)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    sessionStorage.setItem('activeTab', activeTab)
  }, [activeTab])

  useEffect(() => {
    if (typeof window === 'undefined') return
    sessionStorage.setItem('viewMode', viewMode)
  }, [viewMode])

  useEffect(() => {
    if (typeof window === 'undefined') return
    sessionStorage.setItem('cal1', cal1)
  }, [cal1])

  useEffect(() => {
    if (typeof window === 'undefined') return
    sessionStorage.setItem('cal2', cal2)
  }, [cal2])

  useEffect(() => {
    if (typeof window === 'undefined') return
    sessionStorage.setItem('percentInput', percentInput)
  }, [percentInput])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (reportConfigId !== null && reportConfigId !== undefined) {
      sessionStorage.setItem('reportConfigId', String(reportConfigId))
    } else {
      sessionStorage.removeItem('reportConfigId')
    }
  }, [reportConfigId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    sessionStorage.setItem('reportPeriod', reportPeriod)
  }, [reportPeriod])

  useEffect(() => {
    if (typeof window === 'undefined') return
    sessionStorage.setItem('tradeForm', JSON.stringify(tradeForm))
  }, [tradeForm])

  useEffect(() => {
    if (typeof window === 'undefined') return
    sessionStorage.setItem('buyNowForm', JSON.stringify(buyNowForm))
  }, [buyNowForm])

  useEffect(() => {
    if (typeof window === 'undefined') return
    sessionStorage.setItem('filledOrdersForm', JSON.stringify(filledOrdersForm))
  }, [filledOrdersForm])

  useEffect(() => {
    if (!reportConfigId) return
    fetchAllCoins()
  }, [reportConfigId])

  useEffect(() => {
    if (!reportConfigId) return
    fetchSpotReport()
  }, [reportConfigId, reportPeriod])

  useEffect(() => {
    if (activeTab === 'binaceOrders') {
      fetchFilledOrders()
    }
  }, [activeTab])

  useEffect(() => {
    if (activeTab === 'orders') {
      fetchBuyPauseStatus()
    }
  }, [activeTab])

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

  // SignalR connection for alerts
  useEffect(() => {
    const baseUrl = apiBase.replace('/api', '')
    const alertConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${baseUrl}/hubs/alerts`)
      .withAutomaticReconnect()
      .build()

    alertConnection
      .start()
      .then(() => {
        console.log('SignalR Alerts Connected')
        // Join all alerts group
        alertConnection.invoke('JoinAllAlerts').catch((err) => {
          console.error('Error joining alerts group:', err)
        })
      })
      .catch((err) => {
        console.error('SignalR Alerts Connection Error:', err)
      })

    // Listen for alerts
    alertConnection.on('NewAlert', (alert) => {
      console.log('New alert:', alert)
      // Add alert to state with unique ID and timestamp
      const newAlert = {
        id: Date.now() + Math.random(),
        ...alert,
        timestamp: new Date(),
      }
      setAlerts((prev) => [newAlert, ...prev].slice(0, 10)) // Keep last 10 alerts

      // Refresh unread count
      fetchUnreadCount()

      // Show browser notification if permission granted
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(alert.title || 'New Alert', {
          body: alert.message || JSON.stringify(alert),
          icon: '/favicon.ico',
        })
      }
    })

    // Request notification permission on mount
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    // Cleanup on unmount
    return () => {
      alertConnection.stop().catch((err) => {
        console.error('Error stopping SignalR alerts connection:', err)
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
    if (!order?.id) return
    
    // Generate verification key and show modal
    const key = generateVerificationKey()
    setSellNowVerificationKey(key)
    setSellNowVerificationInput('')
    setPendingSellNowOrder(order)
    setIsSellNowVerificationOpen(true)
  }

  const closeSellModal = () => {
    setSellModalData(null)
    setIsSellNowVerificationOpen(false)
    setSellNowVerificationInput('')
    setSellNowVerificationKey('')
    setPendingSellNowOrder(null)
  }

  const confirmSellNow = async () => {
    if (!pendingSellNowOrder) return

    if (sellNowVerificationInput !== sellNowVerificationKey) {
      alert('รหัสยืนยันไม่ถูกต้อง กรุณาลองอีกครั้ง')
      setSellNowVerificationInput('')
      return
    }

    setIsSellNowVerificationOpen(false)
    setSellNowLoading(true)
    try {
      const payload = {
        OrderId: Number(pendingSellNowOrder.id),
      }

      // Add ConfigId if available
      if (pendingSellNowOrder.setting_ID || pendingSellNowOrder.settingId || pendingSellNowOrder.settingID) {
        payload.ConfigId = Number(
          pendingSellNowOrder.setting_ID || pendingSellNowOrder.settingId || pendingSellNowOrder.settingID
        )
      }

      await runRequest(`sellNow-${pendingSellNowOrder.id}`, 'BotWorker/SellNow', {
        payload,
        onSuccess: (data) => {
          alert('Sell Now executed successfully!')
          // Reload orders to see the updated order
          fetchOrders()
          closeSellModal()
        },
        onError: (err) => {
          alert(`Sell Now failed: ${err.message || JSON.stringify(err)}`)
        },
      })
    } catch (err) {
      console.error('Sell Now error:', err)
      alert(`Sell Now failed: ${err.message}`)
    } finally {
      setSellNowLoading(false)
      setPendingSellNowOrder(null)
      setSellNowVerificationKey('')
      setSellNowVerificationInput('')
    }
  }

  const openBuyNowForm = () => {
    // Set default ConfigId from selectedSettingId if available
    if (selectedSettingId) {
      setBuyNowForm((prev) => ({ ...prev, ConfigId: selectedSettingId }))
    }
    setIsBuyNowFormOpen(true)
  }

  const executeBuyNow = () => {
    if (!buyNowForm.ConfigId) {
      alert('กรุณาเลือก Config ID')
      return
    }

    // Close form modal and show verification modal
    setIsBuyNowFormOpen(false)
    
    // Generate verification key and show modal
    const key = generateVerificationKey()
    setBuyNowVerificationKey(key)
    setBuyNowVerificationInput('')
    setIsBuyNowVerificationOpen(true)
  }

  const closeBuyNowForm = () => {
    setIsBuyNowFormOpen(false)
  }

  const confirmBuyNow = async () => {
    if (buyNowVerificationInput !== buyNowVerificationKey) {
      alert('รหัสยืนยันไม่ถูกต้อง กรุณาลองอีกครั้ง')
      setBuyNowVerificationInput('')
      return
    }

    setIsBuyNowVerificationOpen(false)
    setBuyNowLoading(true)
    try {
      const payload = {
        ConfigId: Number(buyNowForm.ConfigId),
      }

      // Add optional fields only if they have values
      if (buyNowForm.BuyAmountUSD) {
        payload.BuyAmountUSD = Number(buyNowForm.BuyAmountUSD)
      }
      if (buyNowForm.Symbol) {
        payload.Symbol = buyNowForm.Symbol.toUpperCase()
      }

      await runRequest('buyNow', 'BotWorker/BuyNow', {
        payload,
        onSuccess: (data) => {
          alert('Buy Now executed successfully!')
          // Reload orders to see the new order
          fetchOrders()
          // Reset form
          setBuyNowForm((prev) => ({
            ...defaultBuyNowForm,
            ConfigId: prev?.ConfigId ?? defaultBuyNowForm.ConfigId,
          }))
        },
        onError: (err) => {
          alert(`Buy Now failed: ${err.message || JSON.stringify(err)}`)
        },
      })
    } catch (err) {
      console.error('Buy Now error:', err)
      alert(`Buy Now failed: ${err.message}`)
    } finally {
      setBuyNowLoading(false)
      setBuyNowVerificationKey('')
      setBuyNowVerificationInput('')
    }
  }

  const closeBuyNowVerification = () => {
    setIsBuyNowVerificationOpen(false)
    setBuyNowVerificationInput('')
    setBuyNowVerificationKey('')
  }

  const handleFilledOrdersSort = (field) => {
    const direction =
      filledOrdersSort.field === field && filledOrdersSort.direction === 'asc' ? 'desc' : 'asc'
    setFilledOrdersSort({ field, direction })
    setFilledOrders(sortFilledOrders(filledOrders, field, direction))
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

  const exportBackup = async () => {
    setBackupLoading(true)
    try {
      const url = buildUrl(apiBase, 'SQLite/BackupExport')
      const response = await fetch(url, {
        method: 'GET',
      })

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`)
      }

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = 'backup.json'
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i)
        if (filenameMatch) {
          filename = filenameMatch[1]
        }
      }

      // Download file
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
    } catch (err) {
      console.error('Export error:', err)
      alert(`Export failed: ${err.message}`)
    } finally {
      setBackupLoading(false)
    }
  }

  const importBackup = async () => {
    if (backupImportMode === 'file' && !backupFile) {
      alert('กรุณาเลือกไฟล์ JSON')
      return
    }
    if (backupImportMode === 'text' && !backupJsonText.trim()) {
      alert('กรุณาใส่ JSON text')
      return
    }

    const confirmed = window.confirm(
      `ยืนยัน Import backup? ${backupReplaceExisting ? '(จะแทนที่ข้อมูลเดิม)' : '(จะเพิ่มข้อมูลใหม่)'}`
    )
    if (!confirmed) return

    setBackupLoading(true)
    try {
      const url = buildUrl(apiBase, 'SQLite/BackupImport')
      const formData = new FormData()

      if (backupImportMode === 'file') {
        formData.append('BackupFile', backupFile)
      } else {
        // For text mode, send as BackupJson
        formData.append('BackupJson', backupJsonText)
        // Optionally create a file from text for BackupFile field
        const blob = new Blob([backupJsonText], { type: 'application/json' })
        const file = new File([blob], 'backup.json', { type: 'application/json' })
        formData.append('BackupFile', file)
      }

      formData.append('ReplaceExisting', backupReplaceExisting)

      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || `Import failed: ${response.statusText}`)
      }

      alert('Import สำเร็จ! กำลัง reload ข้อมูล...')
      // Reload all data
      fetchSettings()
      fetchOrders()
      fetchBotStatus()

      // Reset form
      setBackupFile(null)
      setBackupJsonText('')
    } catch (err) {
      console.error('Import error:', err)
      alert(`Import failed: ${err.message}`)
    } finally {
      setBackupLoading(false)
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
        alert('กรุณาเลือกไฟล์ JSON เท่านั้น')
        return
      }
      setBackupFile(file)
    }
  }

  const generateVerificationKey = () => {
    // Generate random 4-digit number
    return Math.floor(1000 + Math.random() * 9000).toString()
  }

  const executeTrade = async () => {
    if (!tradeForm.Symbol || !tradeForm.Side || !tradeForm.OrderType) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน')
      return
    }

    // Validate that at least one quantity field is provided
    const hasQuantity =
      tradeForm.CoinQuantity || tradeForm.UsdAmount || tradeForm.PortfolioPercent
    if (!hasQuantity) {
      alert('กรุณาระบุจำนวน: CoinQuantity, UsdAmount หรือ PortfolioPercent')
      return
    }

    // Validate Price for LIMIT orders
    if (tradeForm.OrderType === 'LIMIT' && !tradeForm.Price) {
      alert('กรุณาระบุราคาสำหรับ LIMIT order')
      return
    }

    // Build payload - only include fields that have values
    const payload = {
      ConfigId: tradeForm.ConfigId || null,
      Symbol: tradeForm.Symbol,
      Side: tradeForm.Side,
      OrderType: tradeForm.OrderType,
    }

    // Add optional fields only if they have values
    if (tradeForm.Price) payload.Price = Number(tradeForm.Price)
    if (tradeForm.CoinQuantity) payload.CoinQuantity = Number(tradeForm.CoinQuantity)
    if (tradeForm.UsdAmount) payload.UsdAmount = Number(tradeForm.UsdAmount)
    if (tradeForm.PortfolioPercent) payload.PortfolioPercent = Number(tradeForm.PortfolioPercent)
    if (tradeForm.OrderType === 'LIMIT' && tradeForm.TimeInForce) {
      payload.TimeInForce = tradeForm.TimeInForce
    }

    // Generate verification key and show modal
    const key = generateVerificationKey()
    setVerificationKey(key)
    setVerificationInput('')
    setPendingTradePayload(payload)
    setIsTradeVerificationOpen(true)
  }

  const confirmTrade = async () => {
    if (verificationInput !== verificationKey) {
      alert('รหัสยืนยันไม่ถูกต้อง กรุณาลองอีกครั้ง')
      setVerificationInput('')
      return
    }

    setIsTradeVerificationOpen(false)
    setTradeLoading(true)
    try {
      await runRequest('trade', 'Binace/Trade', {
        payload: pendingTradePayload,
        onSuccess: (data) => {
          alert('Trade executed successfully!')
          // Reload orders to see the new trade
          fetchOrders()
          // Reset form
          setTradeForm((prev) => ({
            ...defaultTradeForm,
            ConfigId: prev?.ConfigId ?? defaultTradeForm.ConfigId,
          }))
        },
        onError: (err) => {
          alert(`Trade failed: ${err.message || JSON.stringify(err)}`)
        },
      })
    } catch (err) {
      console.error('Trade error:', err)
      alert(`Trade failed: ${err.message}`)
    } finally {
      setTradeLoading(false)
      setPendingTradePayload(null)
      setVerificationKey('')
      setVerificationInput('')
    }
  }

  const closeTradeVerification = () => {
    setIsTradeVerificationOpen(false)
    setVerificationInput('')
    setVerificationKey('')
    setPendingTradePayload(null)
  }

  // Calculate functions
  const calculateSum1 = () => {
    const num1 = Number(cal1)
    const num2 = Number(cal2)
    if (!cal1 || !cal2 || isNaN(num1) || isNaN(num2)) return '-'
    const percent = ((num2 - num1) / num1) * 100
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(4)}%`
  }

  const calculateSum2 = () => {
    const num1 = Number(cal1)
    const num2 = Number(cal2)
    if (!cal1 || !cal2 || isNaN(num1) || isNaN(num2)) return '-'
    const percent = (num1 / num2) * 100
    return `${percent.toFixed(4)}%`
  }

  const calculateSum3 = () => {
    const num1 = Number(cal1)
    const percent = Number(percentInput)
    if (!cal1 || isNaN(num1) || !percentInput || isNaN(percent)) return { minus: '-', plus: '-' }
    const minus = num1 - (num1 * percent) / 100
    const plus = num1 + (num1 * percent) / 100
    return {
      minus: minus.toFixed(4),
      plus: plus.toFixed(4),
    }
  }

  const calculateSum4 = () => {
    const num1 = Number(cal1)
    const percent = Number(percentInput)
    if (!cal1 || isNaN(num1) || !percentInput || isNaN(percent)) return '-'
    const result = (num1 * percent) / 100
    return result.toFixed(4)
  }

  const handleSetValueFromOrder = (value, target) => {
    if (target === 'cal1') {
      setCal1(String(value || ''))
    } else if (target === 'cal2') {
      setCal2(String(value || ''))
    }
  }

  const removeAlert = (alertId) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== alertId))
  }

  const clearAllAlerts = () => {
    setAlerts([])
  }

  const renderCalculate = () => (
    <section className="card">
      <header>
        <div>
          <p className="eyebrow">Calculator</p>
          <h3>Calculate Percentage</h3>
        </div>
      </header>
      <div className="form-grid">
        <label>
          Cal 1
          <input
            type="number"
            step="0.0001"
            value={cal1}
            onChange={(e) => setCal1(e.target.value)}
            placeholder="Enter value"
          />
        </label>
        <label>
          Cal 2
          <input
            type="number"
            step="0.0001"
            value={cal2}
            onChange={(e) => setCal2(e.target.value)}
            placeholder="Enter value"
          />
        </label>
      </div>

      <div className="calculate-results">
        <div className="result-item">
          <span className="result-label">Sum 1 - Cal1 to Cal2 = ? %</span>
          <span className="result-value">{calculateSum1()}</span>
        </div>
        <div className="result-item">
          <span className="result-label">Sum 2 - Cal1 as % of Cal2 = ? %</span>
          <span className="result-value">{calculateSum2()}</span>
        </div>
        <div className="result-item">
          <label>
            % (0-100)
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={percentInput}
              onChange={(e) => setPercentInput(e.target.value)}
              placeholder="0-100"
            />
          </label>
        </div>
        <div className="result-item">
          <span className="result-label">Sum 3 - Cal1 - % = ?</span>
          <span className="result-value">{calculateSum3().minus}</span>
        </div>
        <div className="result-item">
          <span className="result-label">Sum 3 - Cal1 + % = ?</span>
          <span className="result-value">{calculateSum3().plus}</span>
        </div>
        <div className="result-item">
          <span className="result-label">Sum 4 - % of Cal1 = ?</span>
          <span className="result-value">{calculateSum4()}</span>
        </div>
      </div>
    </section>
  )

  const renderTrade = () => (
    <section className="card">
      <header>
        <div>
          <p className="eyebrow">Binance Trade</p>
          <h3>Execute Trade Order</h3>
        </div>
      </header>

      <div className="trade-form">
        <div className="form-grid">
          <label>
            Config ID
            <select
              value={tradeForm.ConfigId || ''}
              onChange={(e) => setTradeForm((prev) => ({ ...prev, ConfigId: Number(e.target.value) || null }))}
              disabled={settings.length === 0}
            >
              {settings.length === 0 && <option value="">No settings</option>}
              {settings.map((setting) => (
                <option key={setting.id} value={setting.id}>
                  #{setting.id} — {setting.symbol || setting.SYMBOL || 'N/A'}
                </option>
              ))}
            </select>
          </label>
          <label>
            Symbol
            <input
              type="text"
              value={tradeForm.Symbol}
              onChange={(e) => setTradeForm((prev) => ({ ...prev, Symbol: e.target.value.toUpperCase() }))}
              placeholder="BTCUSDT"
            />
          </label>
        </div>

        <div className="form-grid">
          <label>
            Side
            <select
              value={tradeForm.Side}
              onChange={(e) => setTradeForm((prev) => ({ ...prev, Side: e.target.value }))}
            >
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
          </label>
          <label>
            Order Type
            <select
              value={tradeForm.OrderType}
              onChange={(e) => setTradeForm((prev) => ({ ...prev, OrderType: e.target.value }))}
            >
              <option value="MARKET">MARKET</option>
              <option value="LIMIT">LIMIT</option>
            </select>
          </label>
        </div>

        {tradeForm.OrderType === 'LIMIT' && (
          <div className="form-grid">
            <label>
              Price
              <input
                type="number"
                step="0.0001"
                value={tradeForm.Price}
                onChange={(e) => setTradeForm((prev) => ({ ...prev, Price: e.target.value }))}
                placeholder="Required for LIMIT"
              />
            </label>
            <label>
              Time In Force
              <select
                value={tradeForm.TimeInForce}
                onChange={(e) => setTradeForm((prev) => ({ ...prev, TimeInForce: e.target.value }))}
              >
                <option value="GTC">GTC (Good Till Cancel)</option>
                <option value="IOC">IOC (Immediate Or Cancel)</option>
                <option value="FOK">FOK (Fill Or Kill)</option>
              </select>
            </label>
          </div>
        )}

        <div className="trade-quantity-section">
          <p className="trade-section-title">Quantity (เลือกอย่างใดอย่างหนึ่ง)</p>
          <div className="form-grid">
            <label>
              Coin Quantity
              <input
                type="number"
                step="0.0001"
                value={tradeForm.CoinQuantity}
                onChange={(e) => setTradeForm((prev) => ({ ...prev, CoinQuantity: e.target.value }))}
                placeholder="e.g. 100"
              />
            </label>
            <label>
              USD Amount
              <input
                type="number"
                step="0.01"
                value={tradeForm.UsdAmount}
                onChange={(e) => setTradeForm((prev) => ({ ...prev, UsdAmount: e.target.value }))}
                placeholder="e.g. 100"
              />
            </label>
            <label>
              Portfolio Percent (%)
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={tradeForm.PortfolioPercent}
                onChange={(e) => setTradeForm((prev) => ({ ...prev, PortfolioPercent: e.target.value }))}
                placeholder="e.g. 10"
              />
            </label>
          </div>
        </div>

        <div className="trade-examples">
          <p className="trade-section-title">Examples:</p>
          <div className="example-item">
            <strong>Market Buy:</strong> Symbol: BTCUSDT, Side: BUY, OrderType: MARKET, UsdAmount: 100
          </div>
          <div className="example-item">
            <strong>Market Sell:</strong> Symbol: XRPUSDT, Side: SELL, OrderType: MARKET, CoinQuantity: 100
          </div>
          <div className="example-item">
            <strong>Limit Buy:</strong> Symbol: ETHUSDT, Side: BUY, OrderType: LIMIT, Price: 2500, PortfolioPercent: 10
          </div>
        </div>

        <button className="primary" onClick={executeTrade} disabled={tradeLoading}>
          {tradeLoading ? 'Executing...' : '🚀 Execute Trade'}
        </button>
      </div>
    </section>
  )

  const renderAlertLogs = () => (
    <section className="card alert-logs-card">
      <header>
        <div>
          <p className="eyebrow">Alert Logs</p>
          <h3>System Logs & Alerts</h3>
        </div>
        <div className="button-group">
          <button className="secondary ghost" onClick={fetchAlertLogs} disabled={alertLogsLoading}>
            {alertLogsLoading ? 'Loading...' : 'Refresh'}
          </button>
          <button className="danger ghost" onClick={clearLogs} title="Clear all logs">
            🗑 Clear Logs
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="alert-filters">
        <div className="form-grid">
          <label>
            Type
            <select
              value={alertFilters.Type}
              onChange={(e) => setAlertFilters((prev) => ({ ...prev, Type: e.target.value }))}
            >
              <option value="">All</option>
              <option value="LOG">LOG</option>
              <option value="DISCORD">DISCORD</option>
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
              <option value="START">START</option>
              <option value="STOP">STOP</option>
            </select>
          </label>
          <label>
            Level
            <select
              value={alertFilters.Level}
              onChange={(e) => setAlertFilters((prev) => ({ ...prev, Level: e.target.value }))}
            >
              <option value="">All</option>
              <option value="Information">Information</option>
              <option value="Warning">Warning</option>
              <option value="Error">Error</option>
            </select>
          </label>
          <label>
            Read Status
            <select
              value={alertFilters.IsRead === null ? '' : alertFilters.IsRead ? 'read' : 'unread'}
              onChange={(e) => {
                const value = e.target.value
                setAlertFilters((prev) => ({
                  ...prev,
                  IsRead: value === '' ? null : value === 'read',
                }))
              }}
            >
              <option value="">All</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
            </select>
          </label>
        </div>
        <button className="primary" onClick={fetchAlertLogs} disabled={alertLogsLoading}>
          Apply Filters
        </button>
      </div>

      {/* Logs List */}
      <div className="alert-logs-list">
        {alertLogsLoading && <div className="state-block">กำลังโหลด logs...</div>}
        {!alertLogsLoading && alertLogsError && (
          <div className="state-block error">โหลด logs ไม่ได้: {prettify(alertLogsError)}</div>
        )}
        {!alertLogsLoading && !alertLogsError && alertLogs.length === 0 && (
          <div className="state-block empty">ยังไม่มี logs</div>
        )}
        {!alertLogsLoading && !alertLogsError && alertLogs.length > 0 && (
          <div className="alert-logs-items">
            {alertLogs.map((log) => {
              const levelClass = log.level?.toLowerCase() || 'info'
              const typeClass = log.type?.toLowerCase() || 'log'
              const isUnread = !log.isRead
              return (
                <article key={log.id} className={`alert-log-item ${isUnread ? 'unread' : ''} level-${levelClass}`}>
                  <div className="alert-log-item__header">
                    <div className="alert-log-item__meta">
                      <span className={`alert-log-type type-${typeClass}`}>{log.type || 'LOG'}</span>
                      <span className={`alert-log-level level-${levelClass}`}>{log.level || 'Info'}</span>
                      {log.symbol && <span className="alert-log-symbol">{log.symbol}</span>}
                      {log.configId && <span className="alert-log-config">Config #{log.configId}</span>}
                    </div>
                    <div className="alert-log-item__actions">
                      {isUnread && (
                        <button
                          className="secondary ghost small"
                          onClick={() => markAlertAsRead(log.id)}
                          title="Mark as read"
                        >
                          ✓ Read
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="alert-log-item__content">
                    <h4 className="alert-log-item__title">{log.title || 'No Title'}</h4>
                    <p className="alert-log-item__message">{log.message || 'No message'}</p>
                    {log.details && <p className="alert-log-item__details">{log.details}</p>}
                    {log.fields && (
                      <div className="alert-log-item__fields">
                        {Object.entries(log.fields).map(([key, value]) => (
                          <div key={key} className="field-item">
                            <span className="field-key">{key}:</span>
                            <span className="field-value">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="alert-log-item__footer">
                      <span className="alert-log-item__time">{formatDateTime(log.timestamp)}</span>
                      {log.readAt && (
                        <span className="alert-log-item__read-time">Read: {formatDateTime(log.readAt)}</span>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )

  const filteredOrders = useMemo(() => {
    if (orderFilter === 'all') return orders
    return orders.filter((order) => order?.status === orderFilter)
  }, [orders, orderFilter])

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

      {/* Menu Bar with Filters and BuyPause Controls */}
      <div className="order-menu-bar" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '1rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        gap: '1rem',
        flexWrap: 'wrap'
      }}>
        {/* Filter Buttons */}
        <div className="filter-buttons" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ marginRight: '0.5rem', opacity: 0.7 }}>Filter:</span>
          <button
            className={`secondary ${orderFilter === 'all' ? '' : 'ghost'}`}
            onClick={() => {
              setOrderFilter('all')
              sessionStorage.setItem('orderFilter', JSON.stringify('all'))
            }}
            style={{ fontSize: '0.875rem' }}
          >
            All
          </button>
          <button
            className={`secondary ${orderFilter === 'SOLD' ? '' : 'ghost'}`}
            onClick={() => {
              setOrderFilter('SOLD')
              sessionStorage.setItem('orderFilter', JSON.stringify('SOLD'))
            }}
            style={{ fontSize: '0.875rem' }}
          >
            SOLD
          </button>
          <button
            className={`secondary ${orderFilter === 'WAITING_SELL' ? '' : 'ghost'}`}
            onClick={() => {
              setOrderFilter('WAITING_SELL')
              sessionStorage.setItem('orderFilter', JSON.stringify('WAITING_SELL'))
            }}
            style={{ fontSize: '0.875rem' }}
          >
            WAITING_SELL
          </button>
        </div>

        {/* BuyPause Status and Control */}
        <div className="buy-pause-control" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', opacity: 0.7 }}>BuyPause:</span>
            <span
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: buyPauseStatus.isPaused ? '#ff4444' : '#44ff44',
                display: 'inline-block',
                boxShadow: buyPauseStatus.isPaused 
                  ? '0 0 8px rgba(255, 68, 68, 0.6)' 
                  : '0 0 8px rgba(68, 255, 68, 0.6)',
              }}
              title={buyPauseStatus.message || (buyPauseStatus.isPaused ? 'Buy logic is paused' : 'Buy logic is active')}
            />
            <span style={{ fontSize: '0.875rem', opacity: 0.9 }}>
              {buyPauseStatus.isPaused ? 'Paused' : 'Active'}
            </span>
          </div>
          <button
            className={buyPauseStatus.isPaused ? 'primary' : 'secondary'}
            onClick={() => setBuyPauseState(!buyPauseStatus.isPaused)}
            disabled={buyPauseStatus.loading}
            style={{ fontSize: '0.875rem', minWidth: '80px' }}
          >
            {buyPauseStatus.loading ? '...' : buyPauseStatus.isPaused ? 'Resume' : 'Pause'}
          </button>
        </div>
      </div>

      <div className="order-list">
        {ordersLoading && <div className="state-block">กำลังโหลดคำสั่งซื้อ...</div>}

        {!ordersLoading && ordersError && <div className="state-block error">โหลดข้อมูลไม่ได้: {prettify(ordersError)}</div>}

        {!ordersLoading && !ordersError && orders.length === 0 && (
          <div className="state-block empty">ยังไม่มีคำสั่งซื้อ</div>
        )}

        {!ordersLoading && !ordersError && orders.length > 0 && filteredOrders.length === 0 && (
          <div className="state-block empty">ไม่มีคำสั่งซื้อที่ตรงกับตัวกรอง</div>
        )}

        {!ordersLoading && !ordersError && filteredOrders.length > 0 && (
          <div className="order-grid">
            {filteredOrders.map((order) => {
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
                  <div className="order-card__calc-buttons">
                    <div className="calc-button-row">
                      <button
                        className="secondary ghost small"
                        type="button"
                        onClick={() => handleSetValueFromOrder(order?.priceBuy, 'cal1')}
                        title="Set Price Buy to Cal1"
                      >
                        → Cal1
                      </button>
                      <button
                        className="secondary ghost small"
                        type="button"
                        onClick={() => handleSetValueFromOrder(order?.priceWaitSell, 'cal2')}
                        title="Set Wait Sell Price to Cal2"
                      >
                        → Cal2
                      </button>
                      <button
                        className="secondary ghost small"
                        type="button"
                        onClick={() => handleSetValueFromOrder(order?.priceSellActual, 'cal2')}
                        title="Set Sell Price to Cal2"
                      >
                        Sell→Cal2
                      </button>
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

  const renderBackupCard = () => (
    <section className="card">
      <header>
        <div>
          <p className="eyebrow">Backup Data</p>
          <h3>Export & Import</h3>
        </div>
      </header>

      <div className="backup-section">
        <div className="backup-export">
          <h4>Export Backup</h4>
          <p className="backup-description">ดาวน์โหลดข้อมูลทั้งหมดเป็นไฟล์ JSON</p>
          <button className="primary" onClick={exportBackup} disabled={backupLoading}>
            {backupLoading ? 'Exporting...' : '📥 Export'}
          </button>
        </div>

        <div className="backup-divider"></div>

        <div className="backup-import">
          <h4>Import Backup</h4>
          <p className="backup-description">นำเข้าข้อมูลจากไฟล์ JSON หรือ text</p>

          <div className="backup-import-mode">
            <label className="radio-label">
              <input
                type="radio"
                name="importMode"
                value="file"
                checked={backupImportMode === 'file'}
                onChange={(e) => setBackupImportMode(e.target.value)}
              />
              <span>Upload File</span>
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="importMode"
                value="text"
                checked={backupImportMode === 'text'}
                onChange={(e) => setBackupImportMode(e.target.value)}
              />
              <span>Paste JSON Text</span>
            </label>
          </div>

          {backupImportMode === 'file' ? (
            <label className="file-input-label">
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <span className="file-input-button">
                {backupFile ? `📄 ${backupFile.name}` : '📁 เลือกไฟล์ JSON'}
              </span>
            </label>
          ) : (
            <label>
              JSON Text
              <textarea
                value={backupJsonText}
                onChange={(e) => setBackupJsonText(e.target.value)}
                placeholder="วาง JSON text ที่นี่..."
                rows="6"
                className="backup-textarea"
              />
            </label>
          )}

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={backupReplaceExisting}
              onChange={(e) => setBackupReplaceExisting(e.target.checked)}
            />
            <span>Replace Existing Data (แทนที่ข้อมูลเดิม)</span>
          </label>

          <button className="primary" onClick={importBackup} disabled={backupLoading}>
            {backupLoading ? 'Importing...' : '📤 Import'}
          </button>
        </div>
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
            <button className="secondary" onClick={fetchServerTime} disabled={serverTimeLoading || !selectedSettingId}>
              {serverTimeLoading ? 'Checking...' : 'Get Server Time'}
            </button>
          </div>
        </header>
        {serverTimeError && <div className="state-block error">โหลด Server time ไม่ได้: {prettify(serverTimeError)}</div>}
        {serverTimeData && (
          <div className="server-time-card">
            <h4>Server Time</h4>
            <div className="server-time-grid">
              <div>
                <span className="label">Server Time</span>
                <span className="value">{formatDateTime(serverTimeData.serverTime)}</span>
              </div>
              <div>
                <span className="label">Local Time</span>
                <span className="value">{formatDateTime(serverTimeData.localTime)}</span>
              </div>
              <div>
                <span className="label">Difference (ms)</span>
                <span className="value">{serverTimeData.timeDifferenceMs}</span>
              </div>
              <div>
                <span className="label">Status</span>
                <span className={`value ${serverTimeData.isSynchronized ? 'positive' : 'negative'}`}>
                  {serverTimeData.isSynchronized ? 'Synchronized' : 'Not synced'}
                </span>
              </div>
            </div>
            {serverTimeData.recommendation && <p className="server-time-note">{serverTimeData.recommendation}</p>}
          </div>
        )}
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

  const renderReport = () => (
    <section className="card">
      <header>
        <div>
          <p className="eyebrow">Portfolio Overview</p>
          <h3>Report & Coins</h3>
        </div>
        <div className="button-group">
          <button className="secondary ghost" onClick={fetchSpotReport} disabled={spotReportLoading}>
            {spotReportLoading ? 'Report...' : 'Refresh Report'}
          </button>
          <button className="secondary ghost" onClick={fetchAllCoins} disabled={allCoinsLoading}>
            {allCoinsLoading ? 'Coins...' : 'Refresh Coins'}
          </button>
        </div>
      </header>
      <div className="form-grid">
        <label>
          Setting
          <select
            value={reportConfigId || ''}
            onChange={(e) => setReportConfigId(Number(e.target.value) || null)}
          >
            {!reportConfigId && <option value="">เลือก Setting</option>}
            {settings.map((setting) => (
              <option key={setting.id} value={setting.id}>
                #{setting.id} — {setting.symbol || setting.SYMBOL || 'N/A'}
              </option>
            ))}
          </select>
        </label>
        <label>
          Period
          <select value={reportPeriod} onChange={(e) => setReportPeriod(e.target.value)}>
            <option value="1D">1D</option>
            <option value="1W">1W</option>
            <option value="1M">1M</option>
            <option value="3Y">3Y</option>
          </select>
        </label>
      </div>
      {!settings.length && <div className="state-block empty">ยังไม่มี Setting สำหรับรายงาน</div>}

      {spotReportError && <div className="state-block error">โหลด Report ไม่ได้: {prettify(spotReportError)}</div>}
      {spotReportLoading && <div className="state-block">กำลังโหลด Report...</div>}
      {!spotReportLoading && spotReport && (
        <div className="report-content">
          <div className="report-summary">
            <div className="report-item highlight">
              <span className="report-label">Portfolio Value</span>
              <span className="report-value">{Number(spotReport.portfolioValue || 0).toFixed(4)}</span>
            </div>
            <div className="report-item">
              <span className="report-label">Orders Success</span>
              <span className="report-value">{spotReport.ordersSuccess || 0}</span>
            </div>
            <div className="report-item">
              <span className="report-label">Orders Waiting</span>
              <span className="report-value">{spotReport.ordersWaiting || 0}</span>
            </div>
            <div className="report-item">
              <span className="report-label">Period</span>
              <span className="report-value">{spotReport.period || '-'}</span>
            </div>
          </div>
          {spotReport.additionalData && (
            <div className="report-table">
              <h4>Additional Data</h4>
              <table className="data-table">
                <tbody>
                  {Object.entries(spotReport.additionalData).map(([key, value]) => (
                    <tr key={key}>
                      <td className="table-key">{key}</td>
                      <td className="table-value">{String(value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {allCoinsError && <div className="state-block error">โหลด Coins ไม่ได้: {prettify(allCoinsError)}</div>}
      {allCoinsLoading && <div className="state-block">กำลังโหลด Coins...</div>}
      {!allCoinsLoading && (
        <div className="coins-content">
          <div className="coins-summary">
            <div className="summary-item">
              <span className="summary-label">Total Value USD</span>
              <span className="summary-value">{Number(allCoinsData.totalValueUSD || 0).toFixed(4)}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Count</span>
              <span className="summary-value">{allCoinsData.count || allCoinsData.coins.length}</span>
            </div>
          </div>
          {allCoinsData.coins.length > 0 ? (
            <div className="coins-list">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Coin</th>
                    <th>Quantity</th>
                    <th>Latest Price</th>
                    <th>Value in USDT</th>
                  </tr>
                </thead>
                <tbody>
                  {allCoinsData.coins.map((coin, index) => (
                    <tr key={index}>
                      <td className="table-key">{coin.coin}</td>
                      <td className="table-value">{Number(coin.quantity || 0).toFixed(8)}</td>
                      <td className="table-value">{Number(coin.latestPrice || 0).toFixed(4)}</td>
                      <td className="table-value">{Number(coin.valueInUSDT || 0).toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="state-block empty">ยังไม่มีข้อมูล Coins</div>
          )}
        </div>
      )}
    </section>
  )

  const renderBinaceOrders = () => (
    <section className="card">
      <header>
        <div>
          <p className="eyebrow">Binance Filled Orders</p>
          <h3>Order History</h3>
        </div>
        <button className="secondary ghost" onClick={fetchFilledOrders} disabled={filledOrdersLoading}>
          {filledOrdersLoading ? 'Loading...' : 'Refresh'}
        </button>
      </header>

      <div className="filled-orders-filters">
        {!reportConfigId && <div className="state-block">กรุณาเลือก Setting ในแท็บ Report เพื่อกำหนด Config ID</div>}
        <div className="form-grid">
          <div className="info-pill">
            ใช้ Config ID จาก Report: <strong>{reportConfigId || '-'}</strong>
          </div>
          <label>
            Symbol (Optional)
            <input
              type="text"
              value={filledOrdersForm.Symbol}
              onChange={(e) => setFilledOrdersForm((prev) => ({ ...prev, Symbol: e.target.value.toUpperCase() }))}
              placeholder="XRPUSDT"
            />
          </label>
          <label>
            Order Side (Optional)
            <select
              value={filledOrdersForm.OrderSide}
              onChange={(e) => setFilledOrdersForm((prev) => ({ ...prev, OrderSide: e.target.value }))}
            >
              <option value="">All</option>
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
          </label>
          <label>
            Start Time (Optional)
            <input
              type="datetime-local"
              value={filledOrdersForm.StartTime}
              onChange={(e) => setFilledOrdersForm((prev) => ({ ...prev, StartTime: e.target.value }))}
            />
          </label>
          <label>
            Limit
            <input
              type="number"
              value={filledOrdersForm.Limit || 50}
              onChange={(e) => setFilledOrdersForm((prev) => ({ ...prev, Limit: Number(e.target.value) || 50 }))}
              min="1"
              max="100"
            />
          </label>
        </div>
      </div>

      {filledOrdersError && <div className="state-block error">โหลด Orders ไม่ได้: {prettify(filledOrdersError)}</div>}
      {filledOrdersLoading && <div className="state-block">กำลังโหลด Orders...</div>}
      {!filledOrdersLoading && filledOrders.length > 0 && (
        <div className="filled-orders-table">
          <table className="data-table">
            <thead>
              <tr>
                {[
                  { key: 'orderId', label: 'Order ID' },
                  { key: 'symbol', label: 'Symbol' },
                  { key: 'side', label: 'Side' },
                  { key: 'type', label: 'Type' },
                  { key: 'quantity', label: 'Quantity' },
                  { key: 'price', label: 'Price' },
                  { key: 'quoteQuantity', label: 'Quote Qty' },
                  { key: 'quantityFilled', label: 'Filled Qty' },
                  { key: 'quoteQuantityFilled', label: 'Filled Quote' },
                  { key: 'createTime', label: 'Create Time' },
                  { key: 'status', label: 'Status' },
                ].map((column) => (
                  <th key={column.key} onClick={() => handleFilledOrdersSort(column.key)}>
                    {column.label}
                    {filledOrdersSort.field === column.key && (
                      <span className="sort-indicator">{filledOrdersSort.direction === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filledOrders.map((order) => (
                <tr
                  key={order.orderId}
                  className={
                    order.side?.toLowerCase() === 'buy'
                      ? 'order-row buy'
                      : order.side?.toLowerCase() === 'sell'
                      ? 'order-row sell'
                      : ''
                  }
                >
                  <td className="table-value mono">{order.orderId}</td>
                  <td className="table-key">{order.symbol}</td>
                  <td
                    className={
                      order.side?.toLowerCase() === 'buy'
                        ? 'table-value side-buy'
                        : order.side?.toLowerCase() === 'sell'
                        ? 'table-value side-sell'
                        : 'table-value'
                    }
                  >
                    {order.side}
                  </td>
                  <td className="table-value">{order.type}</td>
                  <td className="table-value">{trimZeros(order.quantity)}</td>
                  <td className="table-value">{trimZeros(order.price)}</td>
                  <td className="table-value">{trimZeros(order.quoteQuantity)}</td>
                  <td className="table-value">{trimZeros(order.quantityFilled)}</td>
                  <td className="table-value">{trimZeros(order.quoteQuantityFilled)}</td>
                  <td className="table-value">{trimZeros(order.quoteQuantityFilled)}</td>
                  <td className="table-value">{formatDateTime(order.createTime)}</td>
                  <td className="table-value">{order.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )

  return (
    <div className="app">
      {/* Alert Notifications */}
      <div className="alert-notifications">
        {alerts.length > 0 && (
          <div className="alert-notifications__header">
            <span className="alert-count">Alerts ({alerts.length})</span>
            <button className="secondary ghost small" onClick={clearAllAlerts}>
              Clear All
            </button>
          </div>
        )}
        <div className="alert-list">
          {alerts.map((alert) => {
            const alertType = alert.type || alert.severity || 'info'
            const alertMessage = alert.message || (typeof alert === 'string' ? alert : JSON.stringify(alert))
            return (
              <div key={alert.id} className={`alert-item alert-${alertType}`}>
                <div className="alert-item__content">
                  <div className="alert-item__header">
                    <span className="alert-item__title">{alert.title || 'Alert'}</span>
                    <button
                      className="alert-item__close"
                      onClick={() => removeAlert(alert.id)}
                      aria-label="Close alert"
                    >
                      ×
                    </button>
                  </div>
                  <div className="alert-item__message">{alertMessage}</div>
                  {alert.timestamp && (
                    <div className="alert-item__time">
                      {formatDateTime(alert.timestamp)}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Top Right Controls */}
      <div className="top-right-controls">
        <button
          className="top-control-btn"
          onClick={() => {
            setShowAlertLogs(!showAlertLogs)
            if (!showAlertLogs) {
              fetchAlertLogs()
            }
          }}
          title="Alert Logs"
        >
          🔔
          {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}
        </button>
        <button className="top-control-btn" onClick={clearLogs} title="Clear All Logs">
          🗑
        </button>
      </div>

      <main className="content">
        {showAlertLogs && renderAlertLogs()}
        {activeTab === 'orders' && (
          <>
            {viewMode === 'chart' && (
              <div className="tradingview-full-width">
                <TradingViewWidget />
              </div>
            )}
            {viewMode === 'calculate' && renderCalculate()}
            {viewMode === 'trade' && renderTrade()}
            <div className="chart-menu-bar">
              <button
                className={viewMode === 'chart' ? 'menu-btn active' : 'menu-btn'}
                onClick={() => setViewMode('chart')}
              >
                Chart
              </button>
              <button
                className={viewMode === 'calculate' ? 'menu-btn active' : 'menu-btn'}
                onClick={() => setViewMode('calculate')}
              >
                Calculate
              </button>
              <button
                className={viewMode === 'trade' ? 'menu-btn active' : 'menu-btn'}
                onClick={() => setViewMode('trade')}
              >
                Trad
              </button>
              <button
                className="menu-btn create-order-btn"
                onClick={openBuyNowForm}
                disabled={buyNowLoading}
                title="Create Order"
              >
                ➕
              </button>
            </div>
          </>
        )}
        {activeTab === 'orders' && renderOrders()}
        {activeTab === 'report' && renderReport()}
        {activeTab === 'binaceOrders' && renderBinaceOrders()}
        {activeTab === 'bot' && (
          <>
            {renderBot()}
            {renderBackupCard()}
          </>
        )}
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

      {/* Sell Now Verification Modal */}
      {isSellNowVerificationOpen && pendingSellNowOrder && (
        <div className="modal-backdrop" onClick={closeSellModal}>
          <div className="modal trade-verification-modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <h3>ยืนยันการขายทันที</h3>
            </header>
            <div className="verification-content">
              <div className="verification-info">
                <p>
                  <strong>Order ID:</strong> #{pendingSellNowOrder.id}
                </p>
                <p>
                  <strong>Symbol:</strong> {pendingSellNowOrder.symbol || '—'}
                </p>
                <p>
                  <strong>Quantity:</strong> {pendingSellNowOrder.coinQuantity ?? pendingSellNowOrder.quantity ?? '—'}
                </p>
                <p>
                  <strong>Buy Price:</strong> {pendingSellNowOrder.priceBuy ?? '—'}
                </p>
                <p>
                  <strong>Wait Sell Price:</strong> {pendingSellNowOrder.priceWaitSell ?? '—'}
                </p>
                {pendingSellNowOrder.setting_ID && (
                  <p>
                    <strong>Config ID:</strong> {pendingSellNowOrder.setting_ID}
                  </p>
                )}
              </div>
              <div className="verification-key-section">
                <p className="verification-instruction">
                  กรุณากรอกรหัสยืนยันด้านล่างเพื่อดำเนินการขาย:
                </p>
                <div className="verification-key-display">
                  <span className="verification-key-label">รหัสยืนยัน:</span>
                  <span className="verification-key-value">{sellNowVerificationKey}</span>
                </div>
                <label>
                  กรอกรหัสยืนยัน
                  <input
                    type="text"
                    value={sellNowVerificationInput}
                    onChange={(e) => setSellNowVerificationInput(e.target.value)}
                    placeholder="กรอกรหัสยืนยัน"
                    autoFocus
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        confirmSellNow()
                      }
                    }}
                  />
                </label>
              </div>
            </div>
            <div className="button-group">
              <button className="secondary ghost" type="button" onClick={closeSellModal}>
                Cancel
              </button>
              <button
                className="primary"
                type="button"
                onClick={confirmSellNow}
                disabled={sellNowVerificationInput !== sellNowVerificationKey || sellNowLoading}
              >
                {sellNowLoading ? 'Processing...' : 'ยืนยันขาย'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Buy Now Form Modal */}
      {isBuyNowFormOpen && (
        <div className="modal-backdrop" onClick={closeBuyNowForm}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <h3>Create Order (Buy Now)</h3>
            </header>
            <div className="form-grid">
              <label>
                Config ID *
                <input
                  type="number"
                  value={buyNowForm.ConfigId || ''}
                  onChange={(e) => setBuyNowForm((prev) => ({ ...prev, ConfigId: Number(e.target.value) || null }))}
                  placeholder="1"
                  required
                />
              </label>
            </div>
            <label>
              Buy Amount USD (Optional - override config)
              <input
                type="number"
                step="0.01"
                value={buyNowForm.BuyAmountUSD}
                onChange={(e) => setBuyNowForm((prev) => ({ ...prev, BuyAmountUSD: e.target.value }))}
                placeholder="0.00"
              />
            </label>
            <label>
              Symbol (Optional - override config)
              <input
                type="text"
                value={buyNowForm.Symbol}
                onChange={(e) => setBuyNowForm((prev) => ({ ...prev, Symbol: e.target.value.toUpperCase() }))}
                placeholder="XRPUSDT"
              />
            </label>
            <div className="button-group">
              <button className="secondary ghost" type="button" onClick={closeBuyNowForm}>
                Cancel
              </button>
              <button className="primary" type="button" onClick={executeBuyNow}>
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Buy Now Verification Modal */}
      {isBuyNowVerificationOpen && (
        <div className="modal-backdrop" onClick={closeBuyNowVerification}>
          <div className="modal trade-verification-modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <h3>ยืนยันการสร้าง Order</h3>
            </header>
            <div className="verification-content">
              <div className="verification-info">
                <p>
                  <strong>Config ID:</strong> {buyNowForm.ConfigId}
                </p>
                {buyNowForm.BuyAmountUSD && (
                  <p>
                    <strong>Buy Amount USD:</strong> {buyNowForm.BuyAmountUSD}
                  </p>
                )}
                {buyNowForm.Symbol && (
                  <p>
                    <strong>Symbol:</strong> {buyNowForm.Symbol}
                  </p>
                )}
              </div>
              <div className="verification-key-section">
                <p className="verification-instruction">
                  กรุณากรอกรหัสยืนยันด้านล่างเพื่อดำเนินการ:
                </p>
                <div className="verification-key-display">
                  <span className="verification-key-label">รหัสยืนยัน:</span>
                  <span className="verification-key-value">{buyNowVerificationKey}</span>
                </div>
                <label>
                  กรอกรหัสยืนยัน
                  <input
                    type="text"
                    value={buyNowVerificationInput}
                    onChange={(e) => setBuyNowVerificationInput(e.target.value)}
                    placeholder="กรอกรหัสยืนยัน"
                    autoFocus
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        confirmBuyNow()
                      }
                    }}
                  />
                </label>
              </div>
            </div>
            <div className="button-group">
              <button className="secondary ghost" type="button" onClick={closeBuyNowVerification}>
                Cancel
              </button>
              <button
                className="primary"
                type="button"
                onClick={confirmBuyNow}
                disabled={buyNowVerificationInput !== buyNowVerificationKey || buyNowLoading}
              >
                {buyNowLoading ? 'Processing...' : 'ยืนยัน'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trade Verification Modal */}
      {isTradeVerificationOpen && pendingTradePayload && (
        <div className="modal-backdrop" onClick={closeTradeVerification}>
          <div className="modal trade-verification-modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <h3>ยืนยันการซื้อ/ขาย</h3>
            </header>
            <div className="verification-content">
              <div className="verification-info">
                <p>
                  <strong>Symbol:</strong> {pendingTradePayload.Symbol}
                </p>
                <p>
                  <strong>Side:</strong> {pendingTradePayload.Side}
                </p>
                <p>
                  <strong>Order Type:</strong> {pendingTradePayload.OrderType}
                </p>
                {pendingTradePayload.Price && (
                  <p>
                    <strong>Price:</strong> {pendingTradePayload.Price}
                  </p>
                )}
                {pendingTradePayload.UsdAmount && (
                  <p>
                    <strong>USD Amount:</strong> {pendingTradePayload.UsdAmount}
                  </p>
                )}
                {pendingTradePayload.CoinQuantity && (
                  <p>
                    <strong>Coin Quantity:</strong> {pendingTradePayload.CoinQuantity}
                  </p>
                )}
                {pendingTradePayload.PortfolioPercent && (
                  <p>
                    <strong>Portfolio Percent:</strong> {pendingTradePayload.PortfolioPercent}%
                  </p>
                )}
              </div>
              <div className="verification-key-section">
                <p className="verification-instruction">
                  กรุณากรอกรหัสยืนยันด้านล่างเพื่อดำเนินการ:
                </p>
                <div className="verification-key-display">
                  <span className="verification-key-label">รหัสยืนยัน:</span>
                  <span className="verification-key-value">{verificationKey}</span>
                </div>
                <label>
                  กรอกรหัสยืนยัน
                  <input
                    type="text"
                    value={verificationInput}
                    onChange={(e) => setVerificationInput(e.target.value)}
                    placeholder="กรอกรหัสยืนยัน"
                    autoFocus
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        confirmTrade()
                      }
                    }}
                  />
                </label>
              </div>
            </div>
            <div className="button-group">
              <button className="secondary ghost" type="button" onClick={closeTradeVerification}>
                Cancel
              </button>
              <button
                className="primary"
                type="button"
                onClick={confirmTrade}
                disabled={verificationInput !== verificationKey || tradeLoading}
              >
                {tradeLoading ? 'Processing...' : 'ยืนยัน'}
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
