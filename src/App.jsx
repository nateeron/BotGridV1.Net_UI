import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as signalR from '@microsoft/signalr'
import iconBTC from './icon/XTVCBTC--big.svg'
import iconSOL from './icon/XTVCSOL--big.svg'
import iconUSDT from './icon/XTVCUSDT--big.svg'
import iconXRP from './icon/XTVCXRP--big.svg'
import alertSound from './sound/sound-Buy-Sell.mp3'
import config from '../config.json'
import Login from './components/Login'

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

export default App

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

// Cookie helper functions
const setCookie = (name, value, days = 7) => {
  if (typeof document === 'undefined') return
  const expires = new Date()
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`
}

const getCookie = (name) => {
  if (typeof document === 'undefined') return null
  const nameEQ = name + '='
  const ca = document.cookie.split(';')
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i]
    while (c.charAt(0) === ' ') c = c.substring(1, c.length)
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length)
  }
  return null
}

const deleteCookie = (name) => {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`
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

const formatNumber = (value, decimals = 2) => {
  if (value === null || value === undefined || value === '') return '0.00'
  const num = Number(value)
  if (Number.isNaN(num)) return '0.00'
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num)
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
  Limit: 25,
}

const LIGHTWEIGHT_CHARTS_CDN =
  'https://unpkg.com/lightweight-charts@4.1.1/dist/lightweight-charts.standalone.production.js'

let lightweightChartsLibPromise = null
const loadedScripts = new Set()

const loadExternalScriptOnce = (src) => {
  if (typeof document === 'undefined') return Promise.resolve()
  if (loadedScripts.has(src)) return Promise.resolve()
  loadedScripts.add(src)

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-src="${src}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', reject)
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.dataset.src = src
    script.onload = () => resolve()
    script.onerror = (err) => reject(err)
    document.head.appendChild(script)
  })
}

const loadLightweightChartsModule = async () => {
  if (typeof window !== 'undefined') {
    if (window.LightweightCharts) {
      return window.LightweightCharts
    }
    await loadExternalScriptOnce(LIGHTWEIGHT_CHARTS_CDN)
    if (window.LightweightCharts) {
      return window.LightweightCharts
    }
  }

  if (!lightweightChartsLibPromise) {
    lightweightChartsLibPromise = (async () => {
      try {
        const mod = await import('lightweight-charts')
        if (typeof mod === 'function') {
          return {
            createChart: mod,
          }
        }
        if (mod?.createChart) return mod
        if (mod?.default?.createChart) return mod.default
      } catch (err) {
      }
      throw new Error('lightweight-charts is not available in this environment')
    })()
  }

  return lightweightChartsLibPromise
}

const toLineSeriesData = (items = []) =>
  (Array.isArray(items) ? items : [])
    .map((item) => ({
      time: item.time,
      value: Number(item.close ?? item.value ?? item.price ?? 0),
    }))
    .filter((entry) => entry.time && Number.isFinite(entry.value))

const parseTimestamp = (value) => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    if (value > 1e12) return Math.floor(value)
    if (value > 1e9) return Math.floor(value * 1000)
    return Math.floor(value * 1000)
  }
  const numeric = Number(value)
  if (!Number.isNaN(numeric)) {
    if (numeric > 1e12) return Math.floor(numeric)
    if (numeric > 1e9) return Math.floor(numeric * 1000)
    return Math.floor(numeric * 1000)
  }
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return null
  return parsed
}

const normalizeTimeSec = (value) => {
  const ms = parseTimestamp(value)
  if (!ms) return null
  return Math.floor(ms / 1000)
}

const toCandle = (raw) => {
  if (!Array.isArray(raw) || raw.length < 5) return null
  const time = Number(raw[0])
  const open = Number(raw[1])
  const high = Number(raw[2])
  const low = Number(raw[3])
  const close = Number(raw[4])

  if ([time, open, high, low, close].some((v) => Number.isNaN(v))) return null

  // Add 7 hours (25200 seconds) to convert UTC to GMT+7 (Thailand time)
  const timeInSeconds = Math.floor(time / 1000)
  const thailandTimeOffset = 7 * 60 * 60 // 7 hours in seconds

  return {
    time: timeInSeconds + thailandTimeOffset,
    open,
    high,
    low,
    close,
  }
}

const fetchBinanceKlines = async ({ symbol, interval = '1m', endTime } = {}) => {
  const url = new URL('https://api.binance.com/api/v3/klines')
  url.searchParams.set('symbol', (symbol || 'XRPUSDT').toUpperCase())
  url.searchParams.set('interval', interval)
  url.searchParams.set('limit', '1000')

  if (endTime) {
    url.searchParams.set('endTime', String(endTime))
  }

  const response = await fetch(url.toString())
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'Failed to fetch Binance klines')
  }

  const json = await response.json()
  return Array.isArray(json) ? json : []
}

const buildTradesFromOrders = (orders = []) => {
  if (!Array.isArray(orders)) return []
  return orders
    .map((order) => {
      if (!order) return null
      const entryMs =
        parseTimestamp(order.dateBuy) ??
        parseTimestamp(order.buyTime) ??
        parseTimestamp(order.timeBuy) ??
        parseTimestamp(order.createTime) ??
        parseTimestamp(order.timestamp)
      const exitMs =
        parseTimestamp(order.dateSell) ??
        parseTimestamp(order.sellTime) ??
        parseTimestamp(order.doneTime) ??
        parseTimestamp(order.updateTime)
      const entryPrice = Number(order.priceBuy ?? order.entryPrice ?? order.price)

      if (!entryMs || !Number.isFinite(entryPrice) || entryPrice <= 0) return null

      const rawSide = String(order.side ?? order.orderSide ?? order.status ?? '').toUpperCase()
      const side = rawSide.includes('SELL') ? 'SELL' : 'BUY'
      const exitPrice = Number(order.priceSellActual ?? order.exitPrice ?? order.sellPrice)
      const tp = Number(order.priceWaitSell ?? order.takeProfit ?? order.tp)
      const sl = Number(order.priceCutloss ?? order.cutLossPrice ?? order.stopLoss ?? order.sl)

      return {
        id: order.id ?? order.orderId ?? order.orderBuyID ?? `${order.symbol || 'ORD'}-${entryMs}`,
        time: entryMs,
        price: entryPrice,
        side,
        tp: Number.isFinite(tp) && tp > 0 ? tp : null,
        sl: Number.isFinite(sl) && sl > 0 ? sl : null,
        exitTime: exitMs || null,
        exitPrice: Number.isFinite(exitPrice) && exitPrice > 0 ? exitPrice : null,
      }
    })
    .filter(Boolean)
}

const buildHorizontalLinesFromOrders = (orders = []) => {
  if (!Array.isArray(orders)) return []
  return orders
    .filter((order) => Number(order?.priceWaitSell) > 0)
    .map((order) => {
      const timestamp =
        parseTimestamp(order.dateBuy) ??
        parseTimestamp(order.buyTime) ??
        parseTimestamp(order.createTime) ??
        Date.now()
      return {
        timestamp,
        price: Number(order.priceWaitSell),
        side: String(order.side ?? order.orderSide ?? order.status ?? '').toUpperCase().includes('SELL') ? 'SELL' : 'BUY',
        lineStyle: order.status === 'WAITING_SELL' ? 'dashed' : 'dotted',
      }
    })
    .filter((line) => line.timestamp && Number.isFinite(line.price))
}

function App() {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const token = getCookie('authToken')
    return !!token
  })

  const [activeTab, setActiveTab] = useState(() => loadPrimitiveState('activeTab', 'orders'))
  //const [apiBase, setApiBase] = useState('http://139.180.128.104:5081/api')
  const getApiBaseUrl = () => {
    const mode = import.meta.env.MODE
    if (mode === 'development' || mode === 'dev') {
      return config.API_BASE_URL_Development || 'https://api.cayoshibot.com/api'
    } else if (mode === 'production') {
      return config.API_BASE_URL_Production || 'https://api.cayoshibot.com/api'
    }
    return config.API_BASE_URL_Production || 'https://api.cayoshibot.com/api'
  }
  const [apiBase, setApiBase] = useState(getApiBaseUrl())
  //const [apiBase, setApiBase] = useState('http://localhost:5081/api')
  const [loadingKey, setLoadingKey] = useState(null)
  const [orders, setOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersError, setOrdersError] = useState(null)
  const [orderReport, setOrderReport] = useState(null)
  const [orderReportLoading, setOrderReportLoading] = useState(false)
  const [orderReportError, setOrderReportError] = useState(null)
  const [orderFilter, setOrderFilter] = useState(() => loadPrimitiveState('orderFilter', 'all')) // 'all', 'SOLD', 'WAITING_SELL'
  const [ordersPage, setOrdersPage] = useState(1)
  const [ordersPageSize, setOrdersPageSize] = useState(() => loadPrimitiveState('ordersPageSize', 100))
  const [ordersTotal, setOrdersTotal] = useState(0)
  const [orderViewMode, setOrderViewMode] = useState(() => loadPrimitiveState('orderViewMode', 'card')) // 'card' or 'table'
  const [ordersSort, setOrdersSort] = useState({
    field: 'dateBuy',
    direction: 'desc',
  })
  const [buyPauseStatus, setBuyPauseStatus] = useState({ isPaused: false, loading: false, message: '' })
  const [settings, setSettings] = useState([])
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [settingsError, setSettingsError] = useState(null)
  const [selectedSettingId, setSelectedSettingId] = useState(null)
  const selectedSetting = useMemo(() => {
    if (!selectedSettingId) return null
    return settings.find((item) => item.id === selectedSettingId) || null
  }, [settings, selectedSettingId])
  const [modalSetting, setModalSetting] = useState(null)
  const [isSettingModalOpen, setIsSettingModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('edit')
  const [botStatuses, setBotStatuses] = useState({})
  const [botStatusLoading, setBotStatusLoading] = useState(false)
  const [botStatusError, setBotStatusError] = useState(null)
  const [orderModalData, setOrderModalData] = useState(null)
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false)
  const [sellModalData, setSellModalData] = useState(null)
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)
  const [viewMode, setViewMode] = useState(() => loadPrimitiveState('viewMode', 'priceChart')) // 'chart', 'calculate', 'trade', 'priceChart'
  const [priceChartInterval, setPriceChartInterval] = useState(() =>
    loadPrimitiveState('priceChartInterval', '1m')
  )
  const [customChartSymbol, setCustomChartSymbol] = useState(() =>
    loadPrimitiveState('customChartSymbol', 'XRPUSDT')
  )
  const [priceChartData, setPriceChartData] = useState([])
  const [priceChartLoading, setPriceChartLoading] = useState(false)
  const [priceChartError, setPriceChartError] = useState(null)
  const [nextBuyPrice, setNextBuyPrice] = useState(null)
  const [priceScaleMargins, setPriceScaleMargins] = useState({ top: 0.1, bottom: 0.1 })
  const [priceChartHeight, setPriceChartHeight] = useState(() => {
    const saved = localStorage.getItem('priceChartHeight')
    return saved ? parseInt(saved, 10) : 420
  })
  const [isPriceChartFullscreen, setIsPriceChartFullscreen] = useState(false)
  const priceChartContainerRef = useRef(null)
  const priceChartResizerRef = useRef(null)
  const priceChartFullscreenRef = useRef(null)
  const isResizingRef = useRef(false)
  const priceChartInstanceRef = useRef(null)
  const priceSeriesRef = useRef(null)
  const priceChartEngineRef = useRef({
    interval: priceChartInterval,
    ws: null,
    allData: [],
    earliestTimeMs: null,
    loadingMore: false,
    tradePriceLines: [],
    tradeOverlays: [],
    lineOverlays: [],
    seriesType: 'candlestick',
    chart: null,
    series: null,
    markersData: [], // Store markers data for re-application
    nextEntryPriceLine: null, // Store NextEntry price line reference for real-time updates
  })
  const ordersRef = useRef([])
  const priceChartIntervalInitializedRef = useRef(false)
  const priceChartInitRetryRef = useRef(0)
  const priceChartIntervalOptions = useMemo(
    () => [
      { value: '1m', label: '1m' },
      { value: '3m', label: '3m' },
      { value: '5m', label: '5m' },
      { value: '15m', label: '15m' },
      { value: '1h', label: '1h' },
      { value: '4h', label: '4h' },
      { value: '1d', label: '1D mini' },
    ],
    []
  )
  const [cal1, setCal1] = useState(() => loadPrimitiveState('cal1', ''))
  const [cal2, setCal2] = useState(() => loadPrimitiveState('cal2', ''))
  const [percentInput, setPercentInput] = useState(() => loadPrimitiveState('percentInput', '100'))
  const [calculateMode, setCalculateMode] = useState(() => loadPrimitiveState('calculateMode', 'basic')) // 'basic', 'percentage' or 'order'
  const [percentPerStep, setPercentPerStep] = useState(() => loadPrimitiveState('percentPerStep', '0.29125'))
  const [steps, setSteps] = useState(() => loadPrimitiveState('steps', '24'))
  const [totalPercentResult, setTotalPercentResult] = useState('')
  const [percentPerStep2, setPercentPerStep2] = useState(() => loadPrimitiveState('percentPerStep2', '0.29125'))
  const [targetPercent, setTargetPercent] = useState(() => loadPrimitiveState('targetPercent', '90'))
  const [stepsResult, setStepsResult] = useState('')
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
  const [orderChartView, setOrderChartView] = useState(() => loadPrimitiveState('orderChartView', 'day')) // 'day' or 'month'
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
  const alertSoundRef = useRef(null)
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
  const [isTradeLineSettingsModalOpen, setIsTradeLineSettingsModalOpen] = useState(false)
  const [tradeLineSettings, setTradeLineSettings] = useState(() =>
    loadObjectState('tradeLineSettings', {
      buttons: {
        toggleAllLines: true,
        toggleWaitSell: true,
        toggleBuy: true,
        toggleNextEntry: true,
        toggleNextSell: true,
        toggleLastAction: true,
      },
      styleOptions: ['lineSeries', 'lineSolid', 'dot', 'markers'],
      lines: {
        'buy-Sell': {
          visible: true,
          type: 'lineSeries',
          colorBuy: '#0066FF', // ฟ้า
          colorSell: '#FF55AA', // ชมพู
          limit: 200, // Limit number of buy/sell plots to show
          timeOffset: 14, // Time offset in hours (+14 hours)
        },
        waitSell: {
          visible: true,
          type: 'dot',
          color: '#FFA500',
        },
        nextEntry: {
          visible: true,
          type: 'dot',
          color: '#0066FF',
          formula: {
            WAITING_SELL: 'Buy - (Buy * 0.4 / 100)',
            SOLD: 'Sell - (Sell * 0.4 / 100)',
          },
        },
        nextSell: {
          visible: true,
          type: 'dot',
          color: '#FF55AA',
          formula: 'WaitSellPrice',
        },
        lastAction: {
          visible: true,
          type: 'dot',
          color: '#808080', // สีเทา
        },
      },
    })
  )
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

  useEffect(() => {
    ordersRef.current = orders
  }, [orders])

  useEffect(() => {
    priceChartEngineRef.current.interval = priceChartInterval || '1m'
  }, [priceChartInterval])

  // Check and refresh token on app load if authenticated
  useEffect(() => {
    if (isAuthenticated && isTokenExpired()) {
      refreshToken().catch((err) => {
        // Token refresh failed, user will need to login again
      })
    }
  }, []) // Only run on mount

  // Auto check and refresh token periodically
  useEffect(() => {
    if (!isAuthenticated) return

    const checkAndRefreshToken = async () => {
      if (isTokenExpired()) {
        try {
          await refreshToken()
        } catch (err) {
          // Token refresh failed, user will need to login again
        }
      }
    }

    // Check every 1 minute
    const interval = setInterval(checkAndRefreshToken, 60 * 1000)

    // Also check immediately
    checkAndRefreshToken()

    return () => clearInterval(interval)
  }, [isAuthenticated])

  // Fetch order report on mount and when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchOrderReport()
    }
  }, [isAuthenticated])

  // Get headers with current token
  const getHeaders = () => {
    const token = getCookie('authToken')
    const baseHeaders = {
      'Content-Type': 'application/json',
    }
    if (token) {
      baseHeaders['Authorization'] = `Bearer ${token}`
    }
    return baseHeaders
  }

  const headers = useMemo(() => getHeaders(), [isAuthenticated])

  const usdtCoinData = useMemo(
    () => (allCoinsData?.coins || []).find((coin) => (coin?.coin || '').toUpperCase() === 'USDT') || null,
    [allCoinsData]
  )

  const xrpCoinData = useMemo(
    () => (allCoinsData?.coins || []).find((coin) => (coin?.coin || '').toUpperCase() === 'XRP') || null,
    [allCoinsData]
  )

  const portfolioValueFromCoins = useMemo(
    () => (usdtCoinData ? Number(usdtCoinData.quantity || 0) : null),
    [usdtCoinData]
  )

  const xrpValuePerAmount = useMemo(() => {
    if (!xrpCoinData || !selectedSetting?.buyAmountUSD) return null
    const amount = Number(selectedSetting.buyAmountUSD || 1)
    if (amount === 0) return null
    return Number(xrpCoinData.valueInUSDT || 0) / amount
  }, [xrpCoinData, selectedSetting?.buyAmountUSD])

  // Token refresh function
  const refreshToken = async () => {
    const refreshTokenValue = getCookie('refreshToken')
    if (!refreshTokenValue) {
      throw new Error('No refresh token available')
    }

    try {
      const url = buildUrl(apiBase, 'Login/RefreshToken')
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ RefreshToken: refreshTokenValue }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Token refresh failed')
      }

      // Update tokens in cookies
      setCookie('authToken', data.token, 7)
      setCookie('refreshToken', data.refreshToken, 7)
      if (data.expireAt) {
        setCookie('tokenExpireAt', data.expireAt, 7)
      }

      return data.token
    } catch (err) {
      // If refresh fails, clear auth and redirect to login
      deleteCookie('authToken')
      deleteCookie('refreshToken')
      deleteCookie('tokenExpireAt')
      setIsAuthenticated(false)
      throw err
    }
  }

  // Check if token is expired
  const isTokenExpired = () => {
    const expireAt = getCookie('tokenExpireAt')
    if (!expireAt) return true

    try {
      const expireDate = new Date(expireAt)
      const now = new Date()
      // Add 5 minute buffer before actual expiration
      const bufferTime = 5 * 60 * 1000 // 5 minutes in milliseconds
      return now.getTime() >= (expireDate.getTime() - bufferTime)
    } catch (err) {
      return true
    }
  }

  // Login success handler
  const handleLoginSuccess = async () => {
    setIsAuthenticated(true)
    // Load all data after login success
    try {
      // Load settings first (needed for other data including reportConfigId)
      await fetchSettings('settingsAfterLogin')
      
      // Load other data in parallel (after settings are loaded)
      await Promise.all([
        fetchOrders('ordersAfterLogin', ordersPage, ordersPageSize, orderFilter),
        fetchBotStatus('botStatusAfterLogin'),
        fetchBuyPauseStatus(),
        fetchOrderReport(),
        fetchUnreadCount(),
        fetchNextBuyPrice(),
      ])
      
      // Load report data after settings are loaded (needs reportConfigId from settings)
      // reportConfigId will be set by fetchSettings if available
      const currentReportConfigId = reportConfigId || (settings.length > 0 ? settings[0].id : null)
      if (currentReportConfigId) {
        await Promise.all([
          fetchSpotReport(),
          fetchAllCoins(),
        ])
      }
    } catch (err) {
      // Silently handle errors - data will be loaded by useEffect hooks
    }
  }

  // Logout handler - show confirmation dialog
  const handleLogout = () => {
    setIsLogoutConfirmOpen(true)
  }

  // Confirm logout - actually perform logout
  const confirmLogout = async () => {
    const refreshTokenValue = getCookie('refreshToken')
    
    try {
      if (refreshTokenValue) {
        const url = buildUrl(apiBase, 'Login/LogoutDevice')
        await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            RefreshToken: refreshTokenValue,
          }),
        })
      }
    } catch (err) {
      // Continue with logout even if API call fails
    } finally {
      // Clear all auth cookies
      deleteCookie('authToken')
      deleteCookie('refreshToken')
      deleteCookie('tokenExpireAt')
      setIsAuthenticated(false)
      setLoginForm({ username: '', password: '' })
    }
  }

  // Cancel logout
  const cancelLogout = () => {
    setIsLogoutConfirmOpen(false)
  }

  const runRequest = async (key, endpoint, { method = 'POST', payload, onSuccess, onError } = {}) => {
    // Check and refresh token if needed before making request
    if (isAuthenticated && isTokenExpired()) {
      try {
        await refreshToken()
      } catch (err) {
        // If refresh fails, the refreshToken function already handles logout
        onError?.(err)
        return
      }
    }

    const url = buildUrl(apiBase, endpoint)
    setLoadingKey(key)
    try {
      // Get fresh headers with updated token
      const token = getCookie('authToken')
      const requestHeaders = {
        'Content-Type': 'application/json',
      }
      if (token) {
        requestHeaders['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(url, {
        method,
        headers: method === 'GET' ? undefined : requestHeaders,
        body: method === 'GET' ? undefined : payload ? JSON.stringify(payload) : null,
      })

      // If 401, try to refresh token once and retry
      if (response.status === 401 && isAuthenticated) {
        try {
          await refreshToken()
          // Retry with new token
          const newToken = getCookie('authToken')
          const retryHeaders = {
            'Content-Type': 'application/json',
          }
          if (newToken) {
            retryHeaders['Authorization'] = `Bearer ${newToken}`
          }
          const retryResponse = await fetch(url, {
            method,
            headers: method === 'GET' ? undefined : retryHeaders,
            body: method === 'GET' ? undefined : payload ? JSON.stringify(payload) : null,
          })
          const contentType = retryResponse.headers.get('content-type') || ''
          const data = contentType.includes('application/json')
            ? await retryResponse.json()
            : await retryResponse.text()

          if (!retryResponse.ok) {
            throw {
              status: retryResponse.status,
              endpoint,
              data,
            }
          }

          onSuccess?.(data, { key, status: retryResponse.status })
          return data
        } catch (refreshErr) {
          throw {
            status: 401,
            endpoint,
            data: { message: 'Authentication failed' },
          }
        }
      }

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

  const fetchOrders = async (key = 'ordersAuto', page = ordersPage, pageSize = ordersPageSize, filter = orderFilter) => {
    setOrdersLoading(true)
    setOrdersError(null)
    try {
      // Map filter values: 'all' -> 'All', 'SOLD' -> 'SOLD', 'WAITING_SELL' -> 'WAITING_SELL'
      const apiFilter = filter === 'all' ? 'All' : filter
      
      await runRequest(key, 'SQLite/GetOrdersByPage', {
        method: 'POST',
        payload: {
          page: page,
          pageSize: pageSize,
          filter: apiFilter,
        },
        onSuccess: (payload) => {
          const items = Array.isArray(payload?.data) ? payload.data : []
          setOrders(items)
          setOrdersTotal(payload?.total || 0)
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

  const fetchOrderReport = async () => {
    setOrderReportLoading(true)
    setOrderReportError(null)
    try {
      await runRequest('orderReport', 'Report/GetOrderReport', {
        method: 'POST',
        onSuccess: (payload) => {
          if (payload?.success && payload?.data) {
            setOrderReport(payload.data)
            setOrderReportError(null)
          } else {
            throw new Error(payload?.message || 'Failed to fetch order report')
          }
        },
        onError: (err) => {
          setOrderReportError(err)
        },
      })
    } finally {
      setOrderReportLoading(false)
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
        Limit: Number(filledOrdersForm.Limit) || 25,
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
    fetchOrders('ordersAuto', ordersPage, ordersPageSize, orderFilter)
    fetchOrderReport()
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
    sessionStorage.setItem('priceChartInterval', priceChartInterval)
  }, [priceChartInterval])

  useEffect(() => {
    if (typeof window === 'undefined') return
    sessionStorage.setItem('customChartSymbol', customChartSymbol)
  }, [customChartSymbol])

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
    sessionStorage.setItem('calculateMode', calculateMode)
  }, [calculateMode])

  useEffect(() => {
    if (typeof window === 'undefined') return
    sessionStorage.setItem('percentPerStep', percentPerStep)
  }, [percentPerStep])

  useEffect(() => {
    if (typeof window === 'undefined') return
    sessionStorage.setItem('steps', steps)
  }, [steps])

  useEffect(() => {
    if (typeof window === 'undefined') return
    sessionStorage.setItem('percentPerStep2', percentPerStep2)
  }, [percentPerStep2])

  useEffect(() => {
    if (typeof window === 'undefined') return
    sessionStorage.setItem('targetPercent', targetPercent)
  }, [targetPercent])

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
    sessionStorage.setItem('orderChartView', orderChartView)
  }, [orderChartView])

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
    if (typeof window === 'undefined') return
    sessionStorage.setItem('orderViewMode', orderViewMode)
  }, [orderViewMode])

  useEffect(() => {
    if (typeof window === 'undefined') return
    sessionStorage.setItem('tradeLineSettings', JSON.stringify(tradeLineSettings))
  }, [tradeLineSettings])

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
    let connection = null
    let isMounted = true

    const connectOrders = async () => {
      try {
        const baseUrl = apiBase.endsWith('/api') ? apiBase.slice(0, -4) : apiBase
        connection = new signalR.HubConnectionBuilder()
          .withUrl(`${baseUrl}/hubs/orders`)
          .withAutomaticReconnect({
            nextRetryDelayInMilliseconds: (retryContext) => {
              // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
              return Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 30000)
            },
          })
          .build()

        // Listen for order updates before starting connection
        connection.on('OrderUpdated', (data) => {
          if (!isMounted) return
          // Reload/update UI
          fetchOrders('ordersSignalR')
        })

        // Start connection
        await connection.start()
        
        if (!isMounted) {
          await connection.stop()
          return
        }

        
        // Join group for config ID "1" (can be made dynamic based on selectedSettingId)
        await connection.invoke('JoinOrderGroup', '1')
      } catch (err) {
        if (isMounted) {
        }
      }
    }

    connectOrders()

    // Cleanup on unmount
    return () => {
      isMounted = false
      if (connection) {
        connection.stop().catch((err) => {
          // Ignore errors during cleanup
        })
      }
    }
  }, [apiBase])

  // Play alert sound
  const playAlertSound = useCallback(() => {
    try {
      if (alertSoundRef.current) {
        alertSoundRef.current.currentTime = 0 // Reset to start
        alertSoundRef.current.play().catch((err) => {
          // User interaction may be required for autoplay
        })
      }
    } catch (err) {
    }
  }, [])

  // SignalR connection for alerts
  useEffect(() => {
    let alertConnection = null
    let isMounted = true

    const connectAlerts = async () => {
      try {
        const baseUrl = apiBase.endsWith('/api') ? apiBase.slice(0, -4) : apiBase
        alertConnection = new signalR.HubConnectionBuilder()
          .withUrl(`${baseUrl}/hubs/alerts`)
          .withAutomaticReconnect({
            nextRetryDelayInMilliseconds: (retryContext) => {
              // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
              return Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 30000)
            },
          })
          .build()

        // Listen for alerts before starting connection
        alertConnection.on('NewAlert', (alert) => {
          if (!isMounted) return
          
          // Add alert to state with unique ID and timestamp
          const newAlert = {
            id: Date.now() + Math.random(),
            ...alert,
            timestamp: new Date(),
          }
          setAlerts((prev) => [newAlert, ...prev].slice(0, 10)) // Keep last 10 alerts

          // Play alert sound
          playAlertSound()

          // Check if this is an Order Buy or Sell alert
          const alertTitle = (alert.title || '').toLowerCase()
          const alertMessage = (alert.message || '').toLowerCase()
          const alertType = (alert.type || '').toLowerCase()
          
          const isOrderAlert = 
            alertTitle.includes('order') || 
            alertMessage.includes('order') ||
            alertType.includes('order') ||
            alertTitle.includes('buy') ||
            alertMessage.includes('buy') ||
            alertTitle.includes('sell') ||
            alertMessage.includes('sell') ||
            alertType.includes('buy') ||
            alertType.includes('sell')

          // If it's an Order Buy/Sell alert, refresh orders
          if (isOrderAlert) {
            fetchOrders('ordersSignalRAlert', ordersPage, ordersPageSize, orderFilter)
          }

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

        // Start connection
        await alertConnection.start()
        
        if (!isMounted) {
          await alertConnection.stop()
          return
        }

        
        // Join all alerts group
        await alertConnection.invoke('JoinAllAlerts')
      } catch (err) {
        if (isMounted) {
        }
      }
    }

    // Request notification permission on mount
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    connectAlerts()

    // Cleanup on unmount
    return () => {
      isMounted = false
      if (alertConnection) {
        alertConnection.stop().catch((err) => {
          // Ignore errors during cleanup
        })
      }
    }
  }, [apiBase, playAlertSound, fetchOrders, fetchUnreadCount])

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

  const formatDateTimeWithOffset = (value, offsetHours = 7) => {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    // Add offset hours to convert UTC to GMT+7 (Thailand time)
    const offsetDate = new Date(date.getTime() + offsetHours * 60 * 60 * 1000)
    // Format without timezone (since we already added the offset)
    return new Intl.DateTimeFormat('th-TH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(offsetDate)
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

  const handleSettingSelect = (id) => {
    setSelectedSettingId(id)
  }

  const getStatusForSetting = (id) => {
    if (!id) return botStatuses.global || null
    return botStatuses[id] || botStatuses[String(id)] || botStatuses.global || null
  }

  const ordersForChart = useMemo(() => {
    if (!reportConfigId) return []
    const targetId = Number(reportConfigId)
    if (!Number.isFinite(targetId)) return []
    return (orders || []).filter((order) => {
      const orderConfigId = Number(
        order?.setting_ID ??
          order?.settingId ??
          order?.settingID ??
          order?.ConfigId ??
          order?.configId ??
          order?.configID ??
          order?.config_id ??
          order?.settingID_PK ??
          order?.SettingId
      )
      if (!Number.isFinite(orderConfigId)) return false
      return orderConfigId === targetId
    })
  }, [orders, reportConfigId])

  const processOrdersForChart = useMemo(() => {
    if (!Array.isArray(ordersForChart) || ordersForChart.length === 0) return []
    
    const chartData = {}
    const isMonthly = orderChartView === 'month'
    const timeOffsetHours = 7
    const timeOffsetMs = timeOffsetHours * 60 * 60 * 1000 // Convert hours to milliseconds
    
    ordersForChart.forEach((order) => {
      // Process Buy orders
      if (order.dateBuy) {
        const buyTimestamp = parseTimestamp(order.dateBuy)
        if (buyTimestamp) {
          const date = new Date(buyTimestamp + timeOffsetMs)
          const key = isMonthly 
            ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
            : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
          
          if (!chartData[key]) {
            chartData[key] = { date: key, buy: 0, sell: 0 }
          }
          chartData[key].buy += 1
        }
      }
      
      // Process Sell orders
      if (order.dateSell) {
        const sellTimestamp = parseTimestamp(order.dateSell)
        if (sellTimestamp) {
          const date = new Date(sellTimestamp + timeOffsetMs)
          const key = isMonthly 
            ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
            : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
          
          if (!chartData[key]) {
            chartData[key] = { date: key, buy: 0, sell: 0 }
          }
          chartData[key].sell += 1
        }
      }
    })
    
    // Convert to array and sort by date
    return Object.values(chartData)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30) // Show last 30 periods
  }, [ordersForChart, orderChartView])

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
        fetchOrders('ordersAfterUpdate', ordersPage, ordersPageSize, orderFilter)
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
      onSuccess: () => fetchOrders('ordersAfterDelete', ordersPage, ordersPageSize, orderFilter),
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
          fetchOrders('ordersAuto', ordersPage, ordersPageSize, orderFilter)
          closeSellModal()
        },
        onError: (err) => {
          alert(`Sell Now failed: ${err.message || JSON.stringify(err)}`)
        },
      })
    } catch (err) {
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
          fetchOrders('ordersAuto', ordersPage, ordersPageSize, orderFilter)
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

  const handleOrdersSort = (field) => {
    const direction =
      ordersSort.field === field && ordersSort.direction === 'asc' ? 'desc' : 'asc'
    setOrdersSort({ field, direction })
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
        // Load next buy price after bot start/stop
        if (action === 'start') {
          // Delay 2 seconds before fetching next buy price after start
          setTimeout(() => {
            fetchNextBuyPrice()
          }, 2000)
        } else {
          // Fetch immediately for stop
          fetchNextBuyPrice()
        }
      },
    })
  }

  const exportBackup = async () => {
    // Check and refresh token if needed
    if (isAuthenticated && isTokenExpired()) {
      try {
        await refreshToken()
      } catch (err) {
        alert('Session expired. Please login again.')
        return
      }
    }

    setBackupLoading(true)
    try {
      const token = getCookie('authToken')
      const requestHeaders = {}
      if (token) {
        requestHeaders['Authorization'] = `Bearer ${token}`
      }

      const url = buildUrl(apiBase, 'SQLite/BackupExport')
      const response = await fetch(url, {
        method: 'GET',
        headers: requestHeaders,
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

      // Check and refresh token if needed
      if (isAuthenticated && isTokenExpired()) {
        try {
          await refreshToken()
        } catch (err) {
          alert('Session expired. Please login again.')
          return
        }
      }

      const token = getCookie('authToken')
      const requestHeaders = {}
      if (token) {
        requestHeaders['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: requestHeaders,
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
          fetchOrders('ordersAuto', ordersPage, ordersPageSize, orderFilter)
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

  // Calculate Total Percent from steps
  const calcTotalPercent = () => {
    const perStep = parseFloat(percentPerStep || '0')
    const stepsNum = parseFloat(steps || '0')
    const totalPercent = perStep * stepsNum
    const resultText = `เปอร์เซ็นต์ต่อไม้: ${perStep.toFixed(5)} %\nจำนวนไม้: ${stepsNum}\nเปอร์เซ็นต์รวม ≈ ${totalPercent.toFixed(4)} %`
    setTotalPercentResult(resultText)
  }

  // Calculate Steps from target percent
  const calcSteps = () => {
    const perStep = parseFloat(percentPerStep2 || '0')
    const target = parseFloat(targetPercent || '0')
    if (perStep === 0) {
      setStepsResult('กรุณาใส่เปอร์เซ็นต์ต่อไม้มากกว่า 0')
      return
    }
    const stepsNum = target / perStep
    const resultText = `เปอร์เซ็นต์ต่อไม้: ${perStep.toFixed(5)} %\nต้องการเปอร์เซ็นต์รวม: ${target.toFixed(2)} %\nจำนวนไม้ที่ต้องใช้ (ทฤษฎี) ≈ ${stepsNum.toFixed(2)} ไม้\nปัดขึ้นเป็นจำนวนเต็ม: ${Math.ceil(stepsNum)} ไม้`
    setStepsResult(resultText)
  }

  const removeAlert = (alertId) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== alertId))
  }

  const clearAllAlerts = () => {
    setAlerts([])
  }

  const priceChartSymbolOptions = useMemo(
    () => [
      { value: 'XRPUSDT', label: 'XRPUSDT' },
      { value: 'SOLUSDT', label: 'SOLUSDT' },
      { value: 'BNBUSDT', label: 'BNBUSDT' },
      { value: 'BTCUSDT', label: 'BTCUSDT' },
    ],
    []
  )

  // Price scale precision configuration per symbol
  const getPriceScalePrecision = useCallback((symbol) => {
    const symbolUpper = (symbol || '').toUpperCase()
    const priceScaleMap = {
      'XRPUSDT': 4,
      'SOLUSDT': 2,
      'BNBUSDT': 2,
      'BTCUSDT': 2,
    }
    return priceScaleMap[symbolUpper] ?? 4 // Default to 4 decimals
  }, [])

  const resolvedChartSymbol = useMemo(() => {
    if (customChartSymbol) {
      return customChartSymbol.toUpperCase()
    }
    if (orders.length > 0) {
      return orders[0]?.symbol || 'XRPUSDT'
    }
    if (settings.length > 0) {
      const setting = settings.find((s) => s.id === selectedSettingId) || settings[0]
      return setting?.symbol || setting?.SYMBOL || 'XRPUSDT'
    }
    return 'XRPUSDT'
  }, [orders, settings, selectedSettingId])

  // Get symbol from orders or settings
  const getChartSymbol = () => resolvedChartSymbol

  // Get icon path for coin symbol
  const getCoinIcon = useCallback((coinSymbol) => {
    if (!coinSymbol) return null
    const symbolUpper = coinSymbol.toUpperCase()
    // Handle both full symbols (e.g., BTCUSDT) and base symbols (e.g., BTC)
    const baseSymbol = symbolUpper.replace(/USDT$/, '').replace(/USDC$/, '').replace(/USD$/, '')
    
    const iconMap = {
      'BTC': iconBTC,
      'SOL': iconSOL,
      'USDT': iconUSDT,
      'XRP': iconXRP,
      'BNB': 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
    }
    
    return iconMap[baseSymbol] || iconMap[symbolUpper] || null
  }, [])

  const applySeriesData = useCallback((data) => {
    if (!priceSeriesRef.current || !Array.isArray(data)) return
    const engine = priceChartEngineRef.current
    if (engine.seriesType === 'candlestick') {
      priceSeriesRef.current.setData(data)
    } else {
      priceSeriesRef.current.setData(toLineSeriesData(data))
    }
    // Re-apply markers after data update to ensure they stay visible
    if (engine.markersData && engine.markersData.length > 0) {
      try {
        priceSeriesRef.current.setMarkers(engine.markersData)
      } catch {
        // ignore errors
      }
    }
  }, [])

  // Fetch next buy price from API
  const fetchNextBuyPrice = useCallback(async () => {
    try {
      await runRequest('nextBuyPrice', 'BotWorker/GetNextBuyPrice', {
        method: 'POST',
        payload: {},
        onSuccess: (data) => {
          if (data?.success && data?.nextBuyPrice !== null && data?.nextBuyPrice !== undefined) {
            setNextBuyPrice(Number(data.nextBuyPrice))
          } else {
            setNextBuyPrice(null)
          }
        },
        onError: (err) => {
          setNextBuyPrice(null)
        },
      })
    } catch (err) {
      setNextBuyPrice(null)
    }
  }, [])

  const calculateNextEntry = useCallback((orders) => {
    // Use API value if available
    if (nextBuyPrice !== null && nextBuyPrice !== undefined && nextBuyPrice > 0) {
      return nextBuyPrice
    }
    
    // Fallback to calculation if API value not available
    if (!Array.isArray(orders) || orders.length === 0) return null

    // Find last order (most recent)
    const sortedOrders = [...orders].sort((a, b) => {
      const timeA = parseTimestamp(a.dateSell ?? a.dateBuy)
      const timeB = parseTimestamp(b.dateSell ?? b.dateBuy)
      return (timeB || 0) - (timeA || 0)
    })
    const lastOrder = sortedOrders[0]
    if (!lastOrder) return null

    // Get PERCEN_BUY from settings
    const orderSettingId = lastOrder.setting_ID ?? lastOrder.settingId ?? lastOrder.settingID
    const relatedSetting = settings.find((s) => s.id === orderSettingId || s.id === String(orderSettingId))
    const percenBuy = relatedSetting
      ? Number(relatedSetting.perceN_BUY ?? relatedSetting.PERCEN_BUY ?? 0)
      : Number(settings[0]?.perceN_BUY ?? settings[0]?.PERCEN_BUY ?? 0.4) || 0.4
    const percenSell = relatedSetting
      ? Number(relatedSetting.perceN_SELL ?? relatedSetting.PERCEN_SELL ?? 0)
      : Number(settings[0]?.perceN_SELL ?? settings[0]?.PERCEN_SELL ?? 0.4) || 0.4

    const status = String(lastOrder.status || '').toUpperCase()
    const buyPrice = Number(lastOrder.priceBuy ?? 0)
    const sellPrice = Number(lastOrder.priceSellActual ?? 0)

    if (status === 'WAITING_SELL') {
      // nextEntry = BuyPrice - (BuyPrice * PERCEN_BUY / 100)
      if (buyPrice > 0) {
        return buyPrice - (buyPrice * percenBuy / 100)
      }
    } else if (status === 'SOLD') {
      // nextEntry = SellPrice - (SellPrice * PERCEN_SELL / 100)
      if (sellPrice > 0) {
        return sellPrice - (sellPrice * percenBuy / 100)
        //return sellPrice - (sellPrice * percenSell / 100)
      }
    }

    return null
  }, [settings, nextBuyPrice])

  // Function to update NextEntry line title with real-time percentage
  const updateNextEntryLine = useCallback(() => {
    const engine = priceChartEngineRef.current
    const candleSeries = priceSeriesRef.current
    if (!candleSeries || !engine.nextEntryPriceLine) return

    const lineSettings = tradeLineSettings || {}
    const lines = lineSettings.lines || {}
    const buttons = lineSettings.buttons || {}
    
    // Check if NextEntry should be shown
    if (!buttons.toggleNextEntry || !lines.nextEntry?.visible) return

    // Get current orders to calculate nextEntryPrice
    const currentOrders = ordersRef.current || []
    const nextEntryPrice = currentOrders.length > 0 ? calculateNextEntry(currentOrders) : null
    if (nextEntryPrice === null) return

    // Get real-time last price from chart data
    const chartData = engine.allData || []
    const lastDataPoint = chartData.length > 0 ? chartData[chartData.length - 1] : null
    if (!lastDataPoint) return

    const realTimeLastPrice = Number(lastDataPoint.close ?? lastDataPoint.value ?? lastDataPoint.price ?? 0)
    if (!realTimeLastPrice || !Number.isFinite(realTimeLastPrice) || realTimeLastPrice <= 0) return

    // Calculate percentage: x% = (B - A) / A * 100
    const percent = ((realTimeLastPrice - nextEntryPrice) / nextEntryPrice) * 100
    const percentText = ` ${percent.toFixed(3)}%`
    const baseText = `NextEntry ${nextEntryPrice.toFixed(4)}`
    const fullText = baseText + percentText

    // Update NextEntry line by removing old and creating new
    try {
      candleSeries.removePriceLine(engine.nextEntryPriceLine)
      const lineConfig = lines.nextEntry
      const lineType = lineConfig?.type || 'dot'
      const lineColor = (nextBuyPrice === null || nextBuyPrice === undefined) 
        ? '#eaf2ff' 
        : (lineConfig?.color || '#0066FF')
      
      const newPriceLine = candleSeries.createPriceLine({
        price: nextEntryPrice,
        color: lineColor,
        lineWidth: lineType === 'lineSolid' ? 2 : 1,
        lineStyle: lineType === 'lineSolid' ? 0 : 1, // 0 = solid, 1 = dotted
        axisLabelVisible: true,
        title: fullText,
      })
      
      // Replace in tradePriceLines array
      const index = engine.tradePriceLines.indexOf(engine.nextEntryPriceLine)
      if (index !== -1) {
        engine.tradePriceLines[index] = newPriceLine
      } else {
        engine.tradePriceLines.push(newPriceLine)
      }
      engine.nextEntryPriceLine = newPriceLine
    } catch (err) {
    }
  }, [tradeLineSettings, calculateNextEntry, nextBuyPrice])

  const updateSeriesPoint = useCallback((point) => {
    if (!priceSeriesRef.current || !point) return
    const engine = priceChartEngineRef.current
    if (engine.seriesType === 'candlestick') {
      priceSeriesRef.current.update(point)
    } else {
      priceSeriesRef.current.update({
        time: point.time,
        value: Number(point.close ?? point.value ?? point.price ?? 0),
      })
    }
    // Re-apply markers after point update to ensure they stay visible
    if (engine.markersData && engine.markersData.length > 0) {
      try {
        priceSeriesRef.current.setMarkers(engine.markersData)
      } catch {
        // ignore errors
      }
    }
    // Update NextEntry line with real-time percentage
    updateNextEntryLine()
  }, [updateNextEntryLine])

  const loadInitialCandles = useCallback(
    async (symbol, { silent = false } = {}) => {
      if (!symbol) return
      const engine = priceChartEngineRef.current
      if (!silent) {
        setPriceChartLoading(true)
      }
      setPriceChartError(null)
      try {
        const klines = await fetchBinanceKlines({ symbol, interval: engine.interval })
        const candles = klines.map(toCandle).filter(Boolean).sort((a, b) => a.time - b.time)
        engine.allData = candles
        engine.earliestTimeMs = candles.length ? candles[0].time * 1000 : null
        applySeriesData(candles)
        setPriceChartData(candles)
      } catch (err) {
        setPriceChartError(err)
        if (!priceChartEngineRef.current.allData.length) {
          const now = Math.floor(Date.now() / 1000)
          const thailandTimeOffset = 7 * 60 * 60 // 7 hours in seconds
          const fallback = []
          let lastClose = 2
          for (let i = 59; i >= 0; i -= 1) {
            const time = now - i * 60 + thailandTimeOffset
            const open = lastClose
            const close = open * (1 + (Math.random() - 0.5) * 0.02)
            const high = Math.max(open, close) * (1 + Math.random() * 0.01)
            const low = Math.min(open, close) * (1 - Math.random() * 0.01)
            fallback.push({
              time,
              open: Number(open.toFixed(4)),
              high: Number(high.toFixed(4)),
              low: Number(low.toFixed(4)),
              close: Number(close.toFixed(4)),
            })
            lastClose = close
          }
          priceChartEngineRef.current.allData = fallback
          priceChartEngineRef.current.earliestTimeMs = fallback[0]?.time ? fallback[0].time * 1000 : null
          applySeriesData(fallback)
          setPriceChartData(fallback)
        }
      } finally {
        if (!silent) {
          setPriceChartLoading(false)
        }
      }
    },
    [applySeriesData]
  )

  const loadMoreCandles = useCallback(
    async (symbol) => {
      if (!symbol) return
      const engine = priceChartEngineRef.current
      if (engine.loadingMore || !engine.earliestTimeMs) return
      engine.loadingMore = true
      try {
        const klines = await fetchBinanceKlines({
          symbol,
          interval: engine.interval,
          endTime: engine.earliestTimeMs - 1,
        })
        const candles = klines.map(toCandle).filter(Boolean).sort((a, b) => a.time - b.time)
        if (!candles.length) return

        const oldestTime = engine.allData[0]?.time ?? null
        const olderOnly = oldestTime ? candles.filter((candle) => candle.time < oldestTime) : candles
        if (olderOnly.length) {
          engine.allData = [...olderOnly, ...engine.allData]
          engine.earliestTimeMs = engine.allData[0].time * 1000
          applySeriesData(engine.allData)
          setPriceChartData([...engine.allData])
        }
      } catch (err) {
      } finally {
        engine.loadingMore = false
      }
    },
    [applySeriesData]
  )

  const stopRealtimeFeed = useCallback(() => {
    const engine = priceChartEngineRef.current
    if (engine.ws) {
      try {
        engine.ws.close()
      } catch (err) {
      }
      engine.ws = null
    }
  }, [])

  const startRealtimeFeed = useCallback(
    (symbol) => {
      if (!symbol) return
      const engine = priceChartEngineRef.current
      if (engine.ws) {
        try {
          engine.ws.close()
        } catch {
          // ignore
        }
      }
      const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${engine.interval}`)
      engine.ws = ws
      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data)
          const kline = payload?.k
          if (!kline) return
          // Add 7 hours (25200 seconds) to convert UTC to GMT+7 (Thailand time)
          const timeInSeconds = Math.floor(Number(kline.t) / 1000)
          const thailandTimeOffset = 7 * 60 * 60 // 7 hours in seconds
          const candle = {
            time: timeInSeconds + thailandTimeOffset,
            open: Number(kline.o),
            high: Number(kline.h),
            low: Number(kline.l),
            close: Number(kline.c),
          }

          const data = engine.allData
          const last = data[data.length - 1]
          if (last && candle.time === last.time) {
            data[data.length - 1] = candle
          } else if (!last || candle.time > last.time) {
            data.push(candle)
          }
          engine.allData = data
          updateSeriesPoint(candle)
          setPriceChartData([...engine.allData])
        } catch (err) {
        }
      }
      ws.onerror = (err) => {
      }
    },
    [updateSeriesPoint]
  )

  useEffect(() => {
    if (viewMode !== 'priceChart' || activeTab !== 'orders') return
    if (!resolvedChartSymbol) return
    if (!priceChartIntervalInitializedRef.current) {
      priceChartIntervalInitializedRef.current = true
      return
    }
    const reload = async () => {
      stopRealtimeFeed()
      await loadInitialCandles(resolvedChartSymbol)
      startRealtimeFeed(resolvedChartSymbol)
    }
    reload()
  }, [
    activeTab,
    priceChartInterval,
    loadInitialCandles,
    resolvedChartSymbol,
    startRealtimeFeed,
    stopRealtimeFeed,
    viewMode,
  ])

  const resetPriceChartDecorations = useCallback(() => {
    const engine = priceChartEngineRef.current
    const candleSeries = priceSeriesRef.current
    if (candleSeries && engine.tradePriceLines.length) {
      engine.tradePriceLines.forEach((line) => {
        try {
          candleSeries.removePriceLine(line)
        } catch {
          // ignore
        }
      })
    }
    engine.tradePriceLines = []

    if (engine.chart && engine.tradeOverlays.length) {
      engine.tradeOverlays.forEach((series) => {
        try {
          engine.chart.removeSeries(series)
        } catch {
          // ignore
        }
      })
    }
    engine.tradeOverlays = []

    if (engine.chart && engine.lineOverlays.length) {
      engine.lineOverlays.forEach((series) => {
        try {
          engine.chart.removeSeries(series)
        } catch {
          // ignore
        }
      })
    }
    engine.lineOverlays = []

    // Clear markers
    if (candleSeries) {
      try {
        candleSeries.setMarkers([])
      } catch {
        // ignore
      }
    }
    engine.markersData = []

    // Clear NextEntry price line
    if (candleSeries && engine.nextEntryPriceLine) {
      try {
        candleSeries.removePriceLine(engine.nextEntryPriceLine)
      } catch {
        // ignore
      }
    }
    engine.nextEntryPriceLine = null
  }, [])

  const applyTradeDecorations = useCallback((orders) => {
    const engine = priceChartEngineRef.current
    const candleSeries = priceSeriesRef.current
    const chart = priceChartInstanceRef.current
    if (!candleSeries || !chart) return

    const lineSettings = tradeLineSettings || {}
    const lines = lineSettings.lines || {}
    const buttons = lineSettings.buttons || {}
    // Use engine.allData instead of priceChartData to avoid dependency issues
    // engine.allData is updated with latest chart data
    const chartData = engine.allData || []

    // Clear all existing price lines
    if (engine.tradePriceLines.length) {
      engine.tradePriceLines.forEach((line) => {
        try {
          candleSeries.removePriceLine(line)
        } catch {
          // ignore
        }
      })
      engine.tradePriceLines = []
    }

    // Clear all existing trade overlays
    if (engine.tradeOverlays.length) {
      engine.tradeOverlays.forEach((series) => {
        try {
          chart.removeSeries(series)
        } catch {
          // ignore
        }
      })
      engine.tradeOverlays = []
    }

    // Clear all markers first
    candleSeries.setMarkers([])

    // Check if all lines are toggled off
    if (!buttons.toggleAllLines) return

    const markers = []
    const hasOrders = Array.isArray(orders) && orders.length > 0
    const waitSellOrders = hasOrders ? orders.filter((o) => String(o?.status || '').toUpperCase() === 'WAITING_SELL') : []
    const nextEntryPrice = hasOrders ? calculateNextEntry(orders) : null

    // Plot Buy-Sell markers/lines
    if (buttons.toggleBuy && lines['buy-Sell']?.visible && hasOrders) {
      const lineConfig = lines['buy-Sell'] || {}
      const limit = lineConfig.limit ?? 10
      const timeOffsetHours = lineConfig.timeOffset ?? 7
      const timeOffsetSeconds = timeOffsetHours * 60 * 60 // Convert hours to seconds
    
      // Sort orders by most recent first (by buy time or create time)
      const sortedOrders = [...orders].sort((a, b) => {
        const timeA = normalizeTimeSec(a.dateSell ??a.dateBuy) || 0
        const timeB = normalizeTimeSec(b.dateSell ??b.dateBuy) || 0
        return timeB - timeA // Most recent first
      })
      
      // Take only the last N orders
      const limitedOrders = sortedOrders.slice(0, limit)
      
      limitedOrders.forEach((order) => {
        const buyPrice = Number(order.priceBuy ?? 0)
        const sellPrice = Number(order.priceSellActual ?? 0)
        let buyTime = normalizeTimeSec(order.dateBuy ?? order.createTime)
        let sellTime = normalizeTimeSec(order.dateSell ?? order.updateTime)
        
        // Apply time offset
        if (buyTime) buyTime = buyTime + timeOffsetSeconds
        if (sellTime) sellTime = sellTime + timeOffsetSeconds

        if (buyPrice > 0 && buyTime) {
          const lineType = lineConfig?.type || 'markers'
          const buyColor = lineConfig?.colorBuy || '#0066FF' // ฟ้า
          const orderId = order?.id || order?.orderBuyID || ''
          const orderIdText = orderId ? ` #${orderId}` : ''

          if (lineType === 'markers') {
            markers.push({
              time: buyTime,
              position: 'belowBar',
              color: buyColor,
              shape: 'arrowUp',
              text: `BUY ${buyPrice.toFixed(4)}${orderIdText}`,
            })
          } else if (lineType === 'arrow') {
            markers.push({
              time: buyTime,
              position: 'belowBar',
              color: buyColor,
              shape: 'arrowUp',
              text: '',
            })
          } else if (lineType === 'arrowUpDown') {
            markers.push({
              time: buyTime,
              position: 'belowBar',
              color: buyColor,
              shape: 'text',
              text: '↑',
            })
          } else if (lineType === 'triangleUpDown') {
            markers.push({
              time: buyTime,
              position: 'belowBar',
              color: buyColor,
              shape: 'text',
              text: '▲',
            })
          } else if (lineType === 'point') {
            markers.push({
              time: buyTime,
              position: 'belowBar',
              color: buyColor,
              shape: 'circle',
              text: '',
            })
          } else if (lineType === 'lineSolid') {
            // เส้นทึบแนวนอนเต็ม
            const priceLine = candleSeries.createPriceLine({
              price: buyPrice,
              color: buyColor,
              lineWidth: 2,
              lineStyle: 0, // solid
              axisLabelVisible: true,
              title: `BUY ${buyPrice.toFixed(4)}${orderIdText}`,
            })
            engine.tradePriceLines.push(priceLine)
          } else if (lineType === 'lineSeries') {
            const lineSeries = chart.addLineSeries({
              color: buyColor,
              lineWidth: 2,
              priceLineVisible: false,
              lineStyle: 0, // solid line (เส้นทึบ)
            })
            const timeSpan = 5 * 60 // 5 minutes
            lineSeries.setData([
              { time: buyTime, value: buyPrice },
              { time: buyTime + timeSpan, value: buyPrice },
            ])
            engine.tradeOverlays.push(lineSeries)
          } else if (lineType === 'dot') {
            // เส้นจุดแนวนอนเต็ม
            const priceLine = candleSeries.createPriceLine({
              price: buyPrice,
              color: buyColor,
              lineWidth: 1,
              lineStyle: 1, // dotted
              axisLabelVisible: true,
              title: `BUY ${buyPrice.toFixed(4)}${orderIdText}`,
            })
            engine.tradePriceLines.push(priceLine)
          }
        }

        if (sellPrice > 0 && sellTime) {
          const lineType = lineConfig?.type || 'markers'
          const sellColor = lineConfig?.colorSell || '#FF55AA' // ชมพู
          const orderId = order?.id || order?.orderBuyID || ''
          const orderIdText = orderId ? ` #${orderId}` : ''

          if (lineType === 'markers') {
            markers.push({
              time: sellTime,
              position: 'aboveBar',
              color: sellColor,
              shape: 'arrowDown',
              text: `SELL ${sellPrice.toFixed(4)}${orderIdText}`,
            })
          } else if (lineType === 'arrow') {
            markers.push({
              time: sellTime,
              position: 'aboveBar',
              color: sellColor,
              shape: 'arrowDown',
              text: '',
            })
          } else if (lineType === 'arrowUpDown') {
            markers.push({
              time: sellTime,
              position: 'aboveBar',
              color: sellColor,
              shape: 'text',
              text: '↓',
            })
          } else if (lineType === 'triangleUpDown') {
            markers.push({
              time: sellTime,
              position: 'aboveBar',
              color: sellColor,
              shape: 'text',
              text: '▼',
            })
          } else if (lineType === 'point') {
            markers.push({
              time: sellTime,
              position: 'aboveBar',
              color: sellColor,
              shape: 'circle',
              text: '',
            })
          } else if (lineType === 'lineSolid') {
            // เส้นทึบแนวนอนเต็ม
            const priceLine = candleSeries.createPriceLine({
              price: sellPrice,
              color: sellColor,
              lineWidth: 2,
              lineStyle: 0, // solid
              axisLabelVisible: true,
              title: `SELL ${sellPrice.toFixed(4)}${orderIdText}`,
            })
            engine.tradePriceLines.push(priceLine)
          } else if (lineType === 'lineSeries') {
            const lineSeries = chart.addLineSeries({
              color: sellColor,
              lineWidth: 2,
              priceLineVisible: false,
              lineStyle: 0, // solid line (เส้นทึบ)
            })
            const timeSpan = 5 * 60 // 5 minutes
            lineSeries.setData([
              { time: sellTime, value: sellPrice },
              { time: sellTime + timeSpan, value: sellPrice },
            ])
            engine.tradeOverlays.push(lineSeries)
          } else if (lineType === 'dot') {
            // เส้นจุดแนวนอนเต็ม
            const priceLine = candleSeries.createPriceLine({
              price: sellPrice,
              color: sellColor,
              lineWidth: 1,
              lineStyle: 1, // dotted
              axisLabelVisible: true,
              title: `SELL ${sellPrice.toFixed(4)}${orderIdText}`,
            })
            engine.tradePriceLines.push(priceLine)
          }
        }
      })
    }

    // Plot WaitSell lines
    if (buttons.toggleWaitSell && lines.waitSell?.visible) {
      // Calculate min price (A) from all waitSellOrders
      const allWaitSellPrices = waitSellOrders
        .map((o) => Number(o.priceWaitSell ?? 0))
        .filter((p) => p > 0)
      //const minPrice = allWaitSellPrices.length > 0 ? Math.min(...allWaitSellPrices) : null
      const waitSellOrders_Sorted = waitSellOrders.sort((a, b) => a.priceWaitSell - b.priceWaitSell)
      waitSellOrders_Sorted.forEach((order , index) => {
        const _minPrice = order.priceWaitSell
        const waitSellPrice = Number(order.priceWaitSell ?? 0)
        const buyTime = normalizeTimeSec(order.dateBuy ?? order.createTime)
        if (_minPrice > 0 && buyTime) {
          const lineConfig = lines.waitSell
          const lineType = lineConfig?.type || 'dot'
          const lineColor = lineConfig?.color || '#FFA500'
          const orderId = order?.id || order?.orderBuyID || ''
          const orderIdText = orderId ? `#${orderId} ` : ''

          // Calculate percentage: x% = (B - A) / A * 100
          // A = min price, B = next high price (if exists)
          let percentText = ''
          if (_minPrice !== null && _minPrice > 0) {
            // Find next high price (B) - price higher than current waitSellPrice
            //const nextHighPrices = allWaitSellPrices.filter((p) => p > waitSellPrice)
            //const nextHighPrice = nextHighPrices.length > 0 ? Math.min(...nextHighPrices) : null
            const nextHighPrice = waitSellOrders[index + 1]?.priceWaitSell ?? 0
            if (nextHighPrice !== null && nextHighPrice > 0) {
              // x% = (B - A) / A * 100
              const percent = ((nextHighPrice - _minPrice) / _minPrice) * 100
              percentText = ` ${percent.toFixed(3)}%`
            } else {
              // No next price, set x% = 0
              percentText = ' 0.000%'
            }
          }
          const baseText = `${orderIdText}WaitSell ${waitSellPrice.toFixed(4)}`
          const fullText = baseText + percentText

          if (lineType === 'markers') {
            markers.push({
              time: buyTime,
              position: 'aboveBar',
              color: lineColor,
              shape: 'circle',
              text: fullText,
            })
          } else if (lineType === 'lineSolid') {
            // เส้นทึบแนวนอนเต็ม
            const priceLine = candleSeries.createPriceLine({
              price: waitSellPrice,
              color: lineColor,
              lineWidth: 2,
              lineStyle: 0, // solid
              axisLabelVisible: true,
              title: fullText,
            })
            engine.tradePriceLines.push(priceLine)
          } else if (lineType === 'dot') {
            // เส้นจุดแนวนอนเต็ม
            const priceLine = candleSeries.createPriceLine({
              price: waitSellPrice,
              color: lineColor,
              lineWidth: 1,
              lineStyle: 1, // dotted
              axisLabelVisible: true,
              title: fullText,
            })
            engine.tradePriceLines.push(priceLine)
          } else if (lineType === 'lineSeries') {
            const timeSpan = 60 * 60 * 24 // 24 hours
            const lineSeries = chart.addLineSeries({
              color: lineColor,
              lineWidth: 2,
              priceLineVisible: false,
              lineStyle: 1,
            })
            lineSeries.setData([
              { time: buyTime, value: waitSellPrice },
              { time: buyTime + timeSpan, value: waitSellPrice },
            ])
            engine.tradeOverlays.push(lineSeries)
          }
        }
      })
    }

    // Plot NextEntry
    if (buttons.toggleNextEntry && lines.nextEntry?.visible && nextEntryPrice !== null) {
      const lineConfig = lines.nextEntry
      const lineType = lineConfig?.type || 'dot'
      const lineColor = (nextBuyPrice === null || nextBuyPrice === undefined) 
        ? '#eaf2ff' 
        : (lineConfig?.color || '#0066FF')
      const currentTime = Math.floor(Date.now() / 1000)
      const timeSpan = 60 * 60 * 24 // 24 hours

      // Calculate percentage: x% = (B - A) / A * 100
      // A = nextEntryPrice, B = RealTime last price (last close price from chart data)
      let percentText = ''
      const lastDataPoint = chartData.length > 0 ? chartData[chartData.length - 1] : null
      if (lastDataPoint) {
        const realTimeLastPrice = Number(lastDataPoint.close ?? lastDataPoint.value ?? lastDataPoint.price ?? 0)
        if (realTimeLastPrice > 0 && Number.isFinite(realTimeLastPrice) && nextEntryPrice > 0) {
          // x% = (B - A) / A * 100
          const percent = ((realTimeLastPrice - nextEntryPrice) / nextEntryPrice) * 100
          percentText = ` ${percent.toFixed(3)}%`
        }
      }

      const baseText = `NextEntry ${nextEntryPrice.toFixed(4)}`
      const fullText = baseText + percentText

      if (lineType === 'markers') {
        markers.push({
          time: currentTime,
          position: 'belowBar',
          color: lineColor,
          shape: 'circle',
          text: fullText,
        })
      } else if (lineType === 'lineSolid') {
        // เส้นทึบแนวนอนเต็ม
        // Remove old NextEntry line if exists
        if (engine.nextEntryPriceLine) {
          try {
            candleSeries.removePriceLine(engine.nextEntryPriceLine)
          } catch {
            // ignore
          }
        }
        const priceLine = candleSeries.createPriceLine({
          price: nextEntryPrice,
          color: lineColor,
          lineWidth: 2,
          lineStyle: 0, // solid
          axisLabelVisible: true,
          title: fullText,
        })
        engine.tradePriceLines.push(priceLine)
        engine.nextEntryPriceLine = priceLine // Store reference for real-time updates
      } else if (lineType === 'dot') {
        // เส้นจุดแนวนอนเต็ม
        // Remove old NextEntry line if exists
        if (engine.nextEntryPriceLine) {
          try {
            candleSeries.removePriceLine(engine.nextEntryPriceLine)
          } catch {
            // ignore
          }
        }
        const priceLine = candleSeries.createPriceLine({
          price: nextEntryPrice,
          color: lineColor,
          lineWidth: 1,
          lineStyle: 1, // dotted
          axisLabelVisible: true,
          title: fullText,
        })
        engine.tradePriceLines.push(priceLine)
        engine.nextEntryPriceLine = priceLine // Store reference for real-time updates
      } else if (lineType === 'lineSeries') {
        const lineSeries = chart.addLineSeries({
          color: lineColor,
          lineWidth: 2,
          priceLineVisible: false,
          lineStyle: 1,
        })
        lineSeries.setData([
          { time: currentTime, value: nextEntryPrice },
          { time: currentTime + timeSpan, value: nextEntryPrice },
        ])
        engine.tradeOverlays.push(lineSeries)
      }
    }

    // Plot NextSell (WaitSellPrice from WAITING_SELL orders)
    if (buttons.toggleNextSell && lines.nextSell?.visible) {
      // Find the WAITING_SELL order with minimum Wait Sell Price
      const sortedWaitSellOrders = [...waitSellOrders]
        .filter((o) => Number(o.priceWaitSell ?? 0) > 0)
        .sort((a, b) => {
          const priceA = Number(a.priceWaitSell ?? 0)
          const priceB = Number(b.priceWaitSell ?? 0)
          return priceA - priceB // sort ascending (น้อยสุดก่อน)
        })
      const lastWaitSellOrder = sortedWaitSellOrders[0] // order ที่มี priceWaitSell น้อยที่สุด
      if (lastWaitSellOrder) {
        const waitSellPrice = Number(lastWaitSellOrder.priceWaitSell ?? 0)
        if (waitSellPrice > 0) {
          const lineConfig = lines.nextSell
          const lineType = lineConfig?.type || 'dot'
          const lineColor = lineConfig?.color || '#FF55AA'
          const buyTime = normalizeTimeSec(lastWaitSellOrder.dateBuy ?? lastWaitSellOrder.createTime) || Math.floor(Date.now() / 1000)
          const timeSpan = 60 * 60 * 24 // 24 hours

          if (lineType === 'markers') {
            markers.push({
              time: buyTime,
              position: 'aboveBar',
              color: lineColor,
              shape: 'circle',
              text: `NextSell ${waitSellPrice.toFixed(4)}`,
            })
          } else if (lineType === 'lineSolid') {
            // เส้นทึบแนวนอนเต็ม
            const priceLine = candleSeries.createPriceLine({
              price: waitSellPrice,
              color: lineColor,
              lineWidth: 2,
              lineStyle: 0, // solid
              axisLabelVisible: true,
              title: `NextSell ${waitSellPrice.toFixed(4)}`,
            })
            engine.tradePriceLines.push(priceLine)
          } else if (lineType === 'dot') {
            // เส้นจุดแนวนอนเต็ม
            const priceLine = candleSeries.createPriceLine({
              price: waitSellPrice,
              color: lineColor,
              lineWidth: 1,
              lineStyle: 1, // dotted
              axisLabelVisible: true,
              title: `NextSell ${waitSellPrice.toFixed(4)}`,
            })
            engine.tradePriceLines.push(priceLine)
          } else if (lineType === 'lineSeries') {
            const lineSeries = chart.addLineSeries({
              color: lineColor,
              lineWidth: 2,
              priceLineVisible: false,
              lineStyle: 1,
            })
            lineSeries.setData([
              { time: buyTime, value: waitSellPrice },
              { time: buyTime + timeSpan, value: waitSellPrice },
            ])
            engine.tradeOverlays.push(lineSeries)
          }
        }
      }
    }

    // Plot Last Action line (gray dotted line showing last price from latest order)
    // Check both toggleLastAction and visible (default to true if not set)
    const shouldShowLastAction = (buttons.toggleLastAction !== false) && (lines.lastAction?.visible !== false)
    if (shouldShowLastAction) {
      let lastActionPrice = null
      let priceSource = 'none'
      // Find last order (most recent) - same logic as calculateNextEntry
      if (hasOrders && Array.isArray(orders) && orders.length > 0) {
        const sortedOrders = [...orders].sort((a, b) => {
          const timeA = parseTimestamp( a.dateSell ??a.dateBuy)
          const timeB = parseTimestamp( b.dateSell ??b.dateBuy)
          return (timeB || 0) - (timeA || 0)
        })
        const lastOrder = sortedOrders[0]
        
        if (lastOrder) {
          const status = String(lastOrder.status || '').trim().toUpperCase()
          
          // ถ้าเป็น WAITING_SELL ใช้ราคา Buy, ถ้าเป็น SOLD ใช้ราคา Sell
          if (status === 'WAITING_SELL') {
            lastActionPrice = Number(lastOrder.priceBuy ?? 0)
            priceSource = 'order_buy'
          } else if (status === 'SOLD') {
            lastActionPrice = Number(lastOrder.priceSellActual ?? 0)
            priceSource = 'order_sell'
          }
        }
      }
      
      // Fallback: ถ้าไม่มี order หรือราคาไม่ถูกต้อง ให้ใช้ราคาจาก chart data
      if (!lastActionPrice || !Number.isFinite(lastActionPrice) || lastActionPrice <= 0) {
        const lastDataPoint = chartData.length > 0 ? chartData[chartData.length - 1] : null
        if (lastDataPoint) {
          lastActionPrice = Number(lastDataPoint.close ?? lastDataPoint.value ?? lastDataPoint.price ?? 0)
          priceSource = 'chart_data'
        }
      }

     

      if (lastActionPrice !== null && Number.isFinite(lastActionPrice) && lastActionPrice > 0) {
        const lineConfig = lines.lastAction
        const lineType = lineConfig?.type || 'dot'
        const lineColor = lineConfig?.color || '#808080' // สีเทา

      
        try {
          if (lineType === 'dot') {
            // เส้นจุดแนวนอนเต็ม (gray dotted line)
            const priceLine = candleSeries.createPriceLine({
              price: lastActionPrice,
              color: lineColor,
              lineWidth: 1,
              lineStyle: 1, // dotted
              axisLabelVisible: true,
              title: `Last Action ${lastActionPrice.toFixed(4)}`,
            })
            engine.tradePriceLines.push(priceLine)
          } else if (lineType === 'lineSolid') {
            // เส้นทึบแนวนอนเต็ม
            const priceLine = candleSeries.createPriceLine({
              price: lastActionPrice,
              color: lineColor,
              lineWidth: 2,
              lineStyle: 0, // solid
              axisLabelVisible: true,
              title: `Last Action ${lastActionPrice.toFixed(4)}`,
            })
            engine.tradePriceLines.push(priceLine)
          } else if (lineType === 'lineSeries') {
            const currentTime = Math.floor(Date.now() / 1000)
            const timeSpan = 60 * 60 * 24 // 24 hours
            const lineSeries = chart.addLineSeries({
              color: lineColor,
              lineWidth: 2,
              priceLineVisible: false,
              lineStyle: 1, // dotted
            })
            lineSeries.setData([
              { time: currentTime - timeSpan, value: lastActionPrice },
              { time: currentTime + timeSpan, value: lastActionPrice },
            ])
            engine.tradeOverlays.push(lineSeries)
          } else if (lineType === 'markers') {
            const currentTime = Math.floor(Date.now() / 1000)
            markers.push({
              time: currentTime,
              position: 'inBar',
              color: lineColor,
              shape: 'circle',
              text: `Last Action ${lastActionPrice.toFixed(4)}`,
            })
          }
        } catch (err) {
        }
      } else {
      }
    } else {
      // Debug: log เพื่อตรวจสอบว่าทำไมไม่แสดง
      if (buttons.toggleLastAction === false) {
      }
      if (lines.lastAction?.visible === false) {
      }
    }

    // Store markers data for re-application when range changes
    engine.markersData = markers

    // Apply markers
    if (markers.length > 0) {
      candleSeries.setMarkers(markers)
    }
  }, [tradeLineSettings, calculateNextEntry, nextBuyPrice])

  const plotHorizontalLines = useCallback((linesData) => {
    const engine = priceChartEngineRef.current
    const chart = priceChartInstanceRef.current
    if (!chart) return

    // Clear all existing horizontal lines
    if (engine.lineOverlays.length) {
      engine.lineOverlays.forEach((series) => {
        try {
          chart.removeSeries(series)
        } catch {
          // ignore
        }
      })
      engine.lineOverlays = []
    }

    // Don't create any new horizontal lines - all lines are disabled
  }, [])

  const fetchPriceData = useCallback(async () => {
    if (viewMode !== 'priceChart' || activeTab !== 'orders') return
    if (!resolvedChartSymbol) return
    stopRealtimeFeed()
    await loadInitialCandles(resolvedChartSymbol)
    startRealtimeFeed(resolvedChartSymbol)
  }, [activeTab, loadInitialCandles, resolvedChartSymbol, startRealtimeFeed, stopRealtimeFeed, viewMode])

  useEffect(() => {
    if (viewMode !== 'priceChart' || activeTab !== 'orders') {
      stopRealtimeFeed()
      return
    }
    if (!priceChartContainerRef.current) return

    let isMounted = true
    let resizeHandler = null
    let chart = null
    let handleRangeChange = null
    const engine = priceChartEngineRef.current

    const initChart = async () => {
      try {
        let chartsModule = null
        let createChart = null
        let ColorType = {}
        let CrosshairMode = {}

        const ensureModule = async () => {
          chartsModule = await loadLightweightChartsModule()
          createChart =
            typeof chartsModule === 'function'
              ? chartsModule
              : typeof chartsModule?.createChart === 'function'
              ? chartsModule.createChart
              : typeof chartsModule?.default === 'function'
              ? chartsModule.default
              : typeof chartsModule?.default?.createChart === 'function'
              ? chartsModule.default.createChart
              : null
          ColorType =
            chartsModule?.ColorType ||
            chartsModule?.enums?.ColorType ||
            chartsModule?.default?.ColorType ||
            {}
          CrosshairMode =
            chartsModule?.CrosshairMode ||
            chartsModule?.enums?.CrosshairMode ||
            chartsModule?.default?.CrosshairMode ||
            {}
        }

        await ensureModule()
        if (typeof createChart !== 'function' && typeof window !== 'undefined') {
          // Force-load CDN if dynamic import produced placeholder
          lightweightChartsLibPromise = null
          await loadExternalScriptOnce(LIGHTWEIGHT_CHARTS_CDN)
          await ensureModule()
        }

        if (typeof createChart !== 'function') {
          throw new Error('lightweight-charts: createChart not available')
        }
        if (!isMounted || !priceChartContainerRef.current) return

        const container = priceChartContainerRef.current
        chart = createChart(container, {
          layout: {
            background: { type: ColorType.Solid || 'solid', color: '#0d1524' },
            textColor: '#eaf2ff',
          },
          grid: {
            vertLines: { color: 'rgba(0, 209, 255, 0.1)' },
            horzLines: { color: 'rgba(0, 209, 255, 0.1)' },
          },
          crosshair: {
            mode: CrosshairMode.Normal ?? 0,
          },
          timeScale: {
            timeVisible: true,
            secondsVisible: false,
            rightOffset: 12,
          },
          localization: {
            timezone: 'Asia/Bangkok',
          },
          width: container.clientWidth,
          height: priceChartHeight,
        })

        const ensureSeriesSupport = () => {
          const methods = [
            'addCandlestickSeries',
            'addAreaSeries',
            'addLineSeries',
            'addBaselineSeries',
          ]
          return methods.some((method) => typeof chart[method] === 'function')
        }

        if (!ensureSeriesSupport()) {
          priceChartInitRetryRef.current += 1
          if (priceChartInitRetryRef.current <= 5) {
            try {
              chart.remove()
            } catch {
              // ignore
            }
            setTimeout(() => {
              if (!isMounted) return
              initChart()
            }, 200 * priceChartInitRetryRef.current)
            return
          }
          setPriceChartError(new Error('Chart API not ready'))
          return
        }
        priceChartInitRetryRef.current = 0

        let primarySeries = null
        let seriesType = 'candlestick'
        const precision = getPriceScalePrecision(resolvedChartSymbol)
        // Price format for XRPUSDT: #.#### (4 decimal places)
        const priceFormat = {
          type: 'price',
          precision: precision,
          minMove: precision === 4 ? 0.0001 : precision === 2 ? 0.01 : 0.0001,
        }
        const createSeries = () => {
          if (typeof chart.addCandlestickSeries === 'function') {
            return {
              type: 'candlestick',
              series: chart.addCandlestickSeries({
                upColor: '#26a69a',
                downColor: '#ef5350',
                borderVisible: false,
                wickUpColor: '#26a69a',
                wickDownColor: '#ef5350',
                priceFormat: priceFormat,
              }),
            }
          }
          if (typeof chart.addAreaSeries === 'function') {
            return {
              type: 'area',
              series: chart.addAreaSeries({
                lineColor: '#00d1ff',
                topColor: 'rgba(0, 209, 255, 0.15)',
                bottomColor: 'rgba(0, 209, 255, 0.02)',
                lineWidth: 2,
                priceFormat: priceFormat,
              }),
            }
          }
          if (typeof chart.addLineSeries === 'function') {
            return {
              type: 'line',
              series: chart.addLineSeries({
                color: '#00d1ff',
                lineWidth: 2,
                priceFormat: priceFormat,
              }),
            }
          }
          if (typeof chart.addBaselineSeries === 'function') {
            return {
              type: 'line',
              series: chart.addBaselineSeries({
                baseValue: { type: 'price', price: 0 },
                topLineColor: '#00d1ff',
                bottomLineColor: '#00d1ff',
                topFillColor1: 'rgba(0, 209, 255, 0.2)',
                bottomFillColor1: 'rgba(0, 209, 255, 0.2)',
                priceFormat: priceFormat,
              }),
            }
          }
          return null
        }

        const createdSeries = createSeries()
        if (!createdSeries) {
          try {
            chart.remove()
          } catch {
            // ignore
          }
          const fallbackLineSeries = chart.addLineSeries
            ? chart.addLineSeries({
                color: '#00d1ff',
                lineWidth: 2,
                priceFormat: priceFormat,
              })
            : null
          if (!fallbackLineSeries) {
            setPriceChartError(new Error('No compatible series method found on chart instance'))
            return
          }
          primarySeries = fallbackLineSeries
          seriesType = 'line'
        } else {
          primarySeries = createdSeries.series
          seriesType = createdSeries.type
        }

        priceChartInstanceRef.current = chart
        priceSeriesRef.current = primarySeries
        engine.chart = chart
        engine.series = primarySeries
        engine.seriesType = seriesType
        engine.allData = []
        engine.earliestTimeMs = null

        // Apply price scale precision based on symbol
        // For XRPUSDT, format is set to #.#### (4 decimal places)
        try {
          // Set on the series price scale
          if (primarySeries && typeof primarySeries.priceScale === 'function') {
            primarySeries.priceScale().applyOptions({
              precision: precision,
            })
          }
          // Also set on the chart's right price scale
          if (chart && typeof chart.rightPriceScale === 'function') {
            chart.rightPriceScale().applyOptions({
              precision: precision,
            })
          }
        } catch (err) {
        }

        await loadInitialCandles(resolvedChartSymbol)
        applyTradeDecorations(ordersRef.current)
        plotHorizontalLines(buildHorizontalLinesFromOrders(ordersRef.current))
        startRealtimeFeed(resolvedChartSymbol)

        handleRangeChange = async (logicalRange) => {
          if (!logicalRange || logicalRange.from == null) return
          if (logicalRange.from < 5) {
            await loadMoreCandles(resolvedChartSymbol)
          }
          // Re-apply markers when range changes to fix disappearing markers issue
          const candleSeries = priceSeriesRef.current
          if (candleSeries && engine.markersData && engine.markersData.length > 0) {
            // Re-apply markers to ensure they stay visible after zoom/pan
            candleSeries.setMarkers(engine.markersData)
          }
        }

        chart.timeScale().subscribeVisibleLogicalRangeChange(handleRangeChange)

        resizeHandler = () => {
          if (priceChartContainerRef.current && chart) {
            chart.applyOptions({ width: priceChartContainerRef.current.clientWidth })
          }
        }
        window.addEventListener('resize', resizeHandler)
      } catch (err) {
        setPriceChartError(err)
      }
    }

    initChart()

    return () => {
      isMounted = false
      stopRealtimeFeed()
      if (chart && handleRangeChange) {
        try {
          chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleRangeChange)
        } catch {
          // ignore
        }
      }
      if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler)
      }
      if (priceChartInstanceRef.current) {
        try {
          priceChartInstanceRef.current.remove()
        } catch {
          // ignore
        }
      }
      priceChartInstanceRef.current = null
      priceSeriesRef.current = null
      engine.chart = null
      engine.series = null
      engine.seriesType = 'candlestick'
      resetPriceChartDecorations()
    }
  }, [
    activeTab,
    applyTradeDecorations,
    getPriceScalePrecision,
    loadInitialCandles,
    loadMoreCandles,
    plotHorizontalLines,
    resolvedChartSymbol,
    startRealtimeFeed,
    stopRealtimeFeed,
    viewMode,
    resetPriceChartDecorations,
  ])

  // Fetch next buy price when chart is active
  useEffect(() => {
    if (viewMode !== 'priceChart' || activeTab !== 'orders') return
    if (!isAuthenticated) return
    fetchNextBuyPrice()
  }, [viewMode, activeTab, isAuthenticated, fetchNextBuyPrice])

  // Refresh next buy price when orders change
  useEffect(() => {
    if (viewMode !== 'priceChart' || activeTab !== 'orders') return
    if (!isAuthenticated) return
    fetchNextBuyPrice()
  }, [orders, viewMode, activeTab, isAuthenticated, fetchNextBuyPrice])

  useEffect(() => {
    if (viewMode !== 'priceChart' || activeTab !== 'orders') return
    if (!priceSeriesRef.current || !priceChartInstanceRef.current) return
    applyTradeDecorations(orders)
    plotHorizontalLines(buildHorizontalLinesFromOrders(orders))
  }, [activeTab, applyTradeDecorations, orders, plotHorizontalLines, viewMode, tradeLineSettings])

  // Update price scale precision when symbol changes
  // For XRPUSDT, format is set to #.#### (4 decimal places)
  useEffect(() => {
    if (viewMode !== 'priceChart' || activeTab !== 'orders') return
    const series = priceSeriesRef.current
    const chart = priceChartInstanceRef.current
    if (!series) return
    
    const precision = getPriceScalePrecision(resolvedChartSymbol)
    try {
      // Update series price scale
      if (typeof series.priceScale === 'function') {
        series.priceScale().applyOptions({
          precision: precision,
        })
      }
      // Also update chart's right price scale
      if (chart && typeof chart.rightPriceScale === 'function') {
        chart.rightPriceScale().applyOptions({
          precision: precision,
        })
      }
      // Update series price format
      if (typeof series.applyOptions === 'function') {
        series.applyOptions({
          priceFormat: {
            type: 'price',
            precision: precision,
            minMove: precision === 4 ? 0.0001 : precision === 2 ? 0.01 : 0.0001,
          },
        })
      }
    } catch (err) {
    }
  }, [activeTab, resolvedChartSymbol, viewMode, getPriceScalePrecision])

  // Update NextEntry line percentage when price changes
  useEffect(() => {
    if (viewMode !== 'priceChart' || activeTab !== 'orders') return
    if (!priceSeriesRef.current || !priceChartInstanceRef.current) return
    updateNextEntryLine()
  }, [activeTab, priceChartData, updateNextEntryLine, viewMode])

  // Save chart height to localStorage
  useEffect(() => {
    localStorage.setItem('priceChartHeight', priceChartHeight.toString())
  }, [priceChartHeight])

  // Update chart height when priceChartHeight or fullscreen changes
  useEffect(() => {
    if (!priceChartInstanceRef.current) return
    try {
      const calculateHeight = () => {
        if (isPriceChartFullscreen) {
          const header = priceChartFullscreenRef.current?.querySelector('.price-chart-header')
          const headerHeight = header ? header.offsetHeight : 60
          return window.innerHeight - headerHeight - 8
        }
        return priceChartHeight
      }
      const chartHeight = calculateHeight()
      priceChartInstanceRef.current.applyOptions({ height: chartHeight })
    } catch (err) {
    }
  }, [priceChartHeight, isPriceChartFullscreen])

  // Handle window resize in fullscreen mode
  useEffect(() => {
    if (!isPriceChartFullscreen) return

    const handleResize = () => {
      if (!priceChartInstanceRef.current) return
      try {
        const header = priceChartFullscreenRef.current?.querySelector('.price-chart-header')
        const headerHeight = header ? header.offsetHeight : 60
        const chartHeight = window.innerHeight - headerHeight - 8
        priceChartInstanceRef.current.applyOptions({ 
          width: window.innerWidth,
          height: chartHeight 
        })
      } catch (err) {
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isPriceChartFullscreen])

  // Handle chart resizer drag
  const handleResizerMouseDown = useCallback((e) => {
    e.preventDefault()
    isResizingRef.current = true
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'

    const handleMouseMove = (moveEvent) => {
      if (!isResizingRef.current) return
      moveEvent.preventDefault()
      const container = priceChartContainerRef.current
      if (!container) return
      
      const containerRect = container.getBoundingClientRect()
      const newHeight = moveEvent.clientY - containerRect.top
      const minHeight = 200
      const maxHeight = 800
      const clampedHeight = Math.max(minHeight, Math.min(maxHeight, newHeight))
      setPriceChartHeight(clampedHeight)
    }

    const handleMouseUp = () => {
      isResizingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [])

  const handlePriceChartIntervalChange = (value) => {
    if (!value || value === priceChartInterval) return
    setPriceChartInterval(value)
  }

  const handlePriceChartSymbolChange = useCallback(
    (value) => {
      if (!value) return
      const next = value.toUpperCase()
      if (next === customChartSymbol) return
      setCustomChartSymbol(next)
      if (viewMode === 'priceChart') {
        stopRealtimeFeed()
        loadInitialCandles(next, { silent: true }).then(() => startRealtimeFeed(next))
      }
    },
    [customChartSymbol, loadInitialCandles, startRealtimeFeed, stopRealtimeFeed, viewMode]
  )

  const handlePriceScaleZoomIn = useCallback(() => {
    const series = priceSeriesRef.current
    if (!series || typeof series.priceScale !== 'function') return
    
    try {
      const newMargins = {
        top: Math.max(0, priceScaleMargins.top - 0.05),
        bottom: Math.max(0, priceScaleMargins.bottom - 0.05),
      }
      setPriceScaleMargins(newMargins)
      const priceScale = series.priceScale()
      priceScale.applyOptions({
        scaleMargins: newMargins,
        autoScale: false,
      })
    } catch (err) {
    }
  }, [priceScaleMargins])

  const handlePriceScaleZoomOut = useCallback(() => {
    const series = priceSeriesRef.current
    if (!series || typeof series.priceScale !== 'function') return
    
    try {
      const newMargins = {
        top: Math.min(0.5, priceScaleMargins.top + 0.05),
        bottom: Math.min(0.5, priceScaleMargins.bottom + 0.05),
      }
      setPriceScaleMargins(newMargins)
      const priceScale = series.priceScale()
      priceScale.applyOptions({
        scaleMargins: newMargins,
        autoScale: false,
      })
    } catch (err) {
    }
  }, [priceScaleMargins])

  const handlePriceScaleReset = useCallback(() => {
    const series = priceSeriesRef.current
    if (!series || typeof series.priceScale !== 'function') return
    
    try {
      const defaultMargins = { top: 0.1, bottom: 0.1 }
      setPriceScaleMargins(defaultMargins)
      const priceScale = series.priceScale()
      priceScale.applyOptions({
        scaleMargins: defaultMargins,
        autoScale: true,
      })
    } catch (err) {
    }
  }, [])

  const handlePriceChartFullscreen = useCallback(() => {
    setIsPriceChartFullscreen((prev) => !prev)
  }, [])

  const handlePriceChartExitFullscreen = useCallback(() => {
    setIsPriceChartFullscreen(false)
  }, [])

  // Handle ESC key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isPriceChartFullscreen) {
        handlePriceChartExitFullscreen()
      }
    }

    if (isPriceChartFullscreen) {
      document.addEventListener('keydown', handleKeyDown)
      // Prevent body scroll when in fullscreen
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isPriceChartFullscreen, handlePriceChartExitFullscreen])

  const renderPriceChart = () => {
    const lastDataPoint = priceChartData.length > 0 ? priceChartData[priceChartData.length - 1] : null
    const numericLastPrice = lastDataPoint
      ? Number(lastDataPoint.close ?? lastDataPoint.value ?? lastDataPoint.price ?? 0)
      : null
    const lastPrice =
      numericLastPrice !== null && Number.isFinite(numericLastPrice) ? numericLastPrice.toFixed(4) : null
    
    // Calculate LastAction price (same logic as in applyTradeDecorations)
    let lastActionPrice = null
    if (Array.isArray(orders) && orders.length > 0) {
      const sortedOrders = [...orders].sort((a, b) => {
        const timeA = parseTimestamp(a.dateSell ?? a.dateBuy)
        const timeB = parseTimestamp(b.dateSell ?? b.dateBuy)
        return (timeB || 0) - (timeA || 0)
      })
      const lastOrder = sortedOrders[0]
      if (lastOrder) {
        const status = String(lastOrder.status || '').trim().toUpperCase()
        if (status === 'WAITING_SELL') {
          lastActionPrice = Number(lastOrder.priceBuy ?? 0)
        } else if (status === 'SOLD') {
          lastActionPrice = Number(lastOrder.priceSellActual ?? 0)
        }
      }
    }
    // Fallback to chart data if no valid order price
    if (!lastActionPrice || !Number.isFinite(lastActionPrice) || lastActionPrice <= 0) {
      lastActionPrice = numericLastPrice
    }
    
    // Calculate NextSell price (min waitSell price from WAITING_SELL orders)
    let nextSellPrice = null
    if (Array.isArray(orders) && orders.length > 0) {
      const waitSellOrders = orders.filter((o) => String(o?.status || '').toUpperCase() === 'WAITING_SELL')
      const waitSellPrices = waitSellOrders
        .map((o) => Number(o.priceWaitSell ?? 0))
        .filter((p) => p > 0)
      if (waitSellPrices.length > 0) {
        nextSellPrice = Math.min(...waitSellPrices)
      }
    }
    
    // Calculate percentages
    let nextBuyToNextSellPercent = null
    if (nextBuyPrice !== null && nextBuyPrice !== undefined && nextBuyPrice > 0 && 
        nextSellPrice !== null && nextSellPrice > 0) {
      nextBuyToNextSellPercent = ((nextSellPrice - nextBuyPrice) / nextBuyPrice) * 100
    }
    
    let lastActionToNextBuyPercent = null
    if (lastActionPrice !== null && lastActionPrice > 0 && 
        nextBuyPrice !== null && nextBuyPrice !== undefined && nextBuyPrice > 0) {
      lastActionToNextBuyPercent = ((nextBuyPrice - lastActionPrice) / lastActionPrice) * 100
    }
    
    const fullscreenStyle = isPriceChartFullscreen
      ? {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 9999,
          backgroundColor: '#0d1524',
          margin: 0,
          borderRadius: 0,
        }
      : {}

    // Calculate chart height - use window height in fullscreen, otherwise use saved height
    const getChartHeight = () => {
      if (isPriceChartFullscreen) {
        const header = priceChartFullscreenRef.current?.querySelector('.price-chart-header')
        const headerHeight = header ? header.offsetHeight : 60
        return window.innerHeight - headerHeight - 8 // Subtract header and some padding
      }
      return priceChartHeight
    }
    const chartHeight = getChartHeight()

    return (
      <div 
        className="price-chart-full-width" 
        ref={priceChartFullscreenRef}
        style={fullscreenStyle}
      >
        <section className="card price-chart-card" style={fullscreenStyle}>
          <header className="price-chart-header">
            <div>
              <p className="eyebrow">Price Chart</p>
              <div className="price-chart-symbol-row">
                <h3>{getChartSymbol()} - Real-time</h3>
                <select
                  className="price-chart-symbol-select"
                  value={customChartSymbol}
                  onChange={(e) => handlePriceChartSymbolChange(e.target.value)}
                >
                  {priceChartSymbolOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              {lastPrice && (
                <p className="eyebrow mono" style={{ marginTop: '4px' }}>
                  Last Close: {lastPrice}
                  {nextBuyToNextSellPercent !== null && (
                    <span style={{ marginLeft: '8px', color: '#00AEFF' }}>
                      | NextBuy→NextSell: {nextBuyToNextSellPercent >= 0 ? '+' : ''}{nextBuyToNextSellPercent.toFixed(3)}%
                    </span>
                  )}
                  {lastActionToNextBuyPercent !== null && (
                    <span style={{ marginLeft: '8px', color: '#808080' }}>
                      | LastAction→NextBuy: {lastActionToNextBuyPercent >= 0 ? '+' : ''}{lastActionToNextBuyPercent.toFixed(3)}%
                    </span>
                  )}
                </p>
              )}
            </div>
            <div className="price-chart-header-actions">
              <div className="price-chart-toolbar" role="group" aria-label="Timeframes">
                {priceChartIntervalOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`toolbar-chip ${priceChartInterval === option.value ? 'active' : ''}`}
                    onClick={() => handlePriceChartIntervalChange(option.value)}
                    aria-pressed={priceChartInterval === option.value}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  className={`secondary small ${tradeLineSettings?.buttons?.toggleAllLines ? '' : 'ghost'}`}
                  onClick={() =>
                    setTradeLineSettings((prev) => ({
                      ...prev,
                      buttons: { ...prev?.buttons, toggleAllLines: !prev?.buttons?.toggleAllLines },
                    }))
                  }
                  title="Toggle All Lines Visibility"
                  style={{ fontSize: '12px', padding: '4px 8px' }}
                >
                  👁️ All
                </button>
                <button
                  className={`secondary small ${tradeLineSettings?.buttons?.toggleBuy ? '' : 'ghost'}`}
                  onClick={() =>
                    setTradeLineSettings((prev) => ({
                      ...prev,
                      buttons: { ...prev?.buttons, toggleBuy: !prev?.buttons?.toggleBuy },
                    }))
                  }
                  title="Toggle Buy-Sell Lines"
                  style={{ fontSize: '12px', padding: '4px 8px' }}
                >
                  Buy-Sell
                </button>
                <button
                  className={`secondary small ${tradeLineSettings?.buttons?.toggleWaitSell ? '' : 'ghost'}`}
                  onClick={() =>
                    setTradeLineSettings((prev) => ({
                      ...prev,
                      buttons: { ...prev?.buttons, toggleWaitSell: !prev?.buttons?.toggleWaitSell },
                    }))
                  }
                  title="Toggle Wait Sell Lines"
                  style={{ fontSize: '12px', padding: '4px 8px' }}
                >
                  WaitSell
                </button>
                <button
                  className={`secondary small ${tradeLineSettings?.buttons?.toggleNextEntry ? '' : 'ghost'}`}
                  onClick={() =>
                    setTradeLineSettings((prev) => ({
                      ...prev,
                      buttons: { ...prev?.buttons, toggleNextEntry: !prev?.buttons?.toggleNextEntry },
                    }))
                  }
                  title="Toggle Next Entry Line"
                  style={{ fontSize: '12px', padding: '4px 8px' }}
                >
                  NextEntry
                </button>
                <button
                  className={`secondary small ${tradeLineSettings?.buttons?.toggleNextSell ? '' : 'ghost'}`}
                  onClick={() =>
                    setTradeLineSettings((prev) => ({
                      ...prev,
                      buttons: { ...prev?.buttons, toggleNextSell: !prev?.buttons?.toggleNextSell },
                    }))
                  }
                  title="Toggle Next Sell Line"
                  style={{ fontSize: '12px', padding: '4px 8px' }}
                >
                  NextSell
                </button>
                <button
                  className={`secondary small ${tradeLineSettings?.buttons?.toggleLastAction ? '' : 'ghost'}`}
                  onClick={() =>
                    setTradeLineSettings((prev) => ({
                      ...prev,
                      buttons: { ...prev?.buttons, toggleLastAction: !prev?.buttons?.toggleLastAction },
                    }))
                  }
                  title="Toggle Last Action Line"
                  style={{ fontSize: '12px', padding: '4px 8px' }}
                >
                  Last Action
                </button>
              </div>
              <button
                className="secondary ghost"
                onClick={() => setIsTradeLineSettingsModalOpen(true)}
                title="Trade Line Settings"
              >
                ⚙
              </button>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center', borderLeft: '1px solid var(--border)', paddingLeft: '8px', marginLeft: '8px' }}>
                <button
                  className="secondary small"
                  onClick={handlePriceScaleZoomOut}
                  title="Zoom Out Scale (ปรับ scale ลง)"
                  style={{ fontSize: '12px', padding: '4px 8px' }}
                >
                  ➖
                </button>
                <button
                  className="secondary small"
                  onClick={handlePriceScaleReset}
                  title="Reset Scale (รีเซ็ต scale)"
                  style={{ fontSize: '12px', padding: '4px 8px' }}
                >
                  ↺
                </button>
                <button
                  className="secondary small"
                  onClick={handlePriceScaleZoomIn}
                  title="Zoom In Scale (ปรับ scale ขึ้น)"
                  style={{ fontSize: '12px', padding: '4px 8px' }}
                >
                  ➕
                </button>
              </div>
              <button className="secondary ghost" onClick={fetchPriceData} disabled={priceChartLoading}>
                {priceChartLoading ? 'Loading...' : 'Refresh'}
              </button>
              <button
                className="secondary ghost"
                onClick={isPriceChartFullscreen ? handlePriceChartExitFullscreen : handlePriceChartFullscreen}
                title={isPriceChartFullscreen ? 'Exit Fullscreen (ESC)' : 'Fullscreen (ขยายเต็มหน้าจอ)'}
              >
                {isPriceChartFullscreen ? '⤓' : '⤢'}
              </button>
            </div>
          </header>
          {priceChartError && (
            <div className="state-block error">
              ไม่สามารถโหลดกราฟได้: {priceChartError.message || String(priceChartError)}
            </div>
          )}
          <div
            ref={priceChartContainerRef}
            className="price-chart-canvas"
            style={{
              width: '100%',
              height: `${chartHeight}px`,
              position: 'relative',
            }}
          />
          {!isPriceChartFullscreen && (
            <div
              ref={priceChartResizerRef}
              onMouseDown={handleResizerMouseDown}
              style={{
                width: '100%',
                height: '8px',
                cursor: 'row-resize',
                backgroundColor: 'var(--border)',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--primary)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--border)'
              }}
              title="ลากเพื่อปรับขนาดชาร์ต (Drag to resize chart)"
            >
              <div
                style={{
                  width: '40px',
                  height: '3px',
                  backgroundColor: 'var(--text-secondary)',
                  borderRadius: '2px',
                }}
              />
            </div>
          )}
        </section>
      </div>
    )
  }

  const renderCalculate = () => (
    <section className="card">
      <header>
        <div>
          <p className="eyebrow">Calculator</p>
          <h3>Calculate</h3>
        </div>
      </header>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '8px', flexWrap: 'wrap' }}>
        <button
          className={`secondary ${calculateMode === 'basic' ? '' : 'ghost'}`}
          onClick={() => setCalculateMode('basic')}
          style={{ fontSize: '14px', padding: '8px 16px' }}
        >
          Basic Calculate
        </button>
        <button
          className={`secondary ${calculateMode === 'percentage' ? '' : 'ghost'}`}
          onClick={() => setCalculateMode('percentage')}
          style={{ fontSize: '14px', padding: '8px 16px' }}
        >
          Calculate Percentage
        </button>
        <button
          className={`secondary ${calculateMode === 'order' ? '' : 'ghost'}`}
          onClick={() => setCalculateMode('order')}
          style={{ fontSize: '14px', padding: '8px 16px' }}
        >
          Calculate Order
        </button>
      </div>

      {/* Tab Content: Basic Calculate (เดิม) */}
      {calculateMode === 'basic' && (
        <div>
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
              <span className="result-label">Cal1 to Cal2 = ? %</span>
              <span className="result-value">{calculateSum1()}</span>
            </div>
            <div className="result-item">
              <span className="result-label">Cal1 as % of Cal2 = ? %</span>
              <span className="result-value">{calculateSum2()}</span>
            </div>
            <div className="result-item">
              <label>
                <div style={{ minWidth: '120px' }}> % (0-100)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                  <div className="range-slider-container" style={{ flex: 1 }}>
                    <input
                      type="range"
                      min="0"
                      max="10000"
                      step="1"
                      value={percentInput ? Math.round(Number(percentInput) * 100) : 0}
                      onChange={(e) => {
                        const value = Number(e.target.value) / 100
                        setPercentInput(value.toFixed(2))
                      }}
                      className="range-slider"
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={percentInput || ''}
                      onChange={(e) => {
                        let value = e.target.value
                        if (value === '') {
                          setPercentInput('')
                          return
                        }
                        const numValue = Number(value)
                        if (!isNaN(numValue)) {
                          if (numValue < 0) {
                            setPercentInput('0')
                          } else if (numValue > 100) {
                            setPercentInput('100')
                          } else {
                            setPercentInput(value)
                          }
                        }
                      }}
                      onBlur={(e) => {
                        const numValue = Number(e.target.value)
                        if (!isNaN(numValue) && e.target.value !== '') {
                          setPercentInput(numValue.toFixed(2))
                        } else if (e.target.value === '') {
                          setPercentInput('100')
                        }
                      }}
                      placeholder="0-100"
                      style={{
                        width: '80px',
                        padding: '6px 8px',
                        borderRadius: 'var(--radius)',
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: 'var(--text)',
                        fontSize: '13px',
                        textAlign: 'center'
                      }}
                    />
                    <span style={{ 
                      fontSize: '13px', 
                      color: 'var(--text-muted)',
                      minWidth: '30px'
                    }}>
                      {percentInput ? Number(percentInput).toFixed(2) : '0.00'}%
                    </span>
                  </div>
                </div>
              </label>
            </div>
            <div className="result-item">
              <span className="result-label">Cal1 - % = ?</span>
              <span className="result-value">{calculateSum3().minus}</span>
            </div>
            <div className="result-item">
              <span className="result-label">Cal1 + % = ?</span>
              <span className="result-value">{calculateSum3().plus}</span>
            </div>
            <div className="result-item">
              <span className="result-label">% of Cal1 = ?</span>
              <span className="result-value">{calculateSum4()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: Calculate Percentage */}
      {calculateMode === 'percentage' && (
        <div>
          <h3 style={{ marginBottom: '16px', fontSize: '16px' }}>1) คิด % รวมจาก จำนวนไม้</h3>
          <div className="form-grid">
            <label>
              เปอร์เซ็นต์ต่อไม้ (% ต่อ 1 ไม้)
              <input
                type="number"
                step="0.00001"
                value={percentPerStep}
                onChange={(e) => setPercentPerStep(e.target.value)}
                placeholder="0.29125"
              />
            </label>
            <label>
              จำนวนไม้
              <input
                type="number"
                step="1"
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
                placeholder="24"
              />
            </label>
          </div>
          <button className="primary" onClick={calcTotalPercent} style={{ marginTop: '12px' }}>
            คำนวณเปอร์เซ็นต์รวม
          </button>
          {totalPercentResult && (
            <div className="state-block" style={{ marginTop: '16px', whiteSpace: 'pre-line', padding: '12px' }}>
              {totalPercentResult}
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Calculate Order */}
      {calculateMode === 'order' && (
        <div>
          <h3 style={{ marginBottom: '16px', fontSize: '16px' }}>2) คิด จำนวนไม้ จาก % รวมที่ต้องการ</h3>
          <div className="form-grid">
            <label>
              เปอร์เซ็นต์ต่อไม้ (% ต่อ 1 ไม้)
              <input
                type="number"
                step="0.00001"
                value={percentPerStep2}
                onChange={(e) => setPercentPerStep2(e.target.value)}
                placeholder="0.29125"
              />
            </label>
            <label>
              เปอร์เซ็นต์รวมที่ต้องการ (%)
              <input
                type="number"
                step="0.01"
                value={targetPercent}
                onChange={(e) => setTargetPercent(e.target.value)}
                placeholder="90"
              />
            </label>
          </div>
          <button className="primary" onClick={calcSteps} style={{ marginTop: '12px' }}>
            คำนวณจำนวนไม้ที่ต้องใช้
          </button>
          {stepsResult && (
            <div className="state-block" style={{ marginTop: '16px', whiteSpace: 'pre-line', padding: '12px' }}>
              {stepsResult}
            </div>
          )}
        </div>
      )}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                <div className="range-slider-container" style={{ flex: 1 }}>
                  <input
                    type="range"
                    min="0"
                    max="10000"
                    step="1"
                    value={tradeForm.PortfolioPercent ? Math.round(Number(tradeForm.PortfolioPercent) * 100) : 0}
                    onChange={(e) => {
                      const value = Number(e.target.value) / 100
                      setTradeForm((prev) => ({ ...prev, PortfolioPercent: value.toFixed(2) }))
                    }}
                    className="range-slider"
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={tradeForm.PortfolioPercent || ''}
                    onChange={(e) => {
                      let value = e.target.value
                      if (value === '') {
                        setTradeForm((prev) => ({ ...prev, PortfolioPercent: '' }))
                        return
                      }
                      const numValue = Number(value)
                      if (!isNaN(numValue)) {
                        if (numValue < 0) {
                          setTradeForm((prev) => ({ ...prev, PortfolioPercent: '0' }))
                        } else if (numValue > 100) {
                          setTradeForm((prev) => ({ ...prev, PortfolioPercent: '100' }))
                        } else {
                          setTradeForm((prev) => ({ ...prev, PortfolioPercent: value }))
                        }
                      }
                    }}
                    onBlur={(e) => {
                      const numValue = Number(e.target.value)
                      if (!isNaN(numValue) && e.target.value !== '') {
                        setTradeForm((prev) => ({ ...prev, PortfolioPercent: numValue.toFixed(2) }))
                      } else if (e.target.value === '') {
                        setTradeForm((prev) => ({ ...prev, PortfolioPercent: '' }))
                      }
                    }}
                    placeholder="0-100"
                    style={{
                      width: '80px',
                      padding: '6px 8px',
                      borderRadius: 'var(--radius)',
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--text)',
                      fontSize: '13px',
                      textAlign: 'center'
                    }}
                  />
                  <span style={{ 
                    fontSize: '13px', 
                    color: 'var(--text-muted)',
                    minWidth: '30px'
                  }}>
                    {tradeForm.PortfolioPercent ? Number(tradeForm.PortfolioPercent).toFixed(2) : '0.00'}%
                  </span>
                </div>
              </div>
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
    <div className="alert-logs-content">
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
          <button className="secondary ghost" type="button" onClick={() => setShowAlertLogs(false)}>
            Close
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
                      <span className="alert-log-item__time">{formatDateTimeWithOffset(log.timestamp, 7)}</span>
                      {log.readAt && (
                        <span className="alert-log-item__read-time">Read: {formatDateTimeWithOffset(log.readAt, 7)}</span>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )

  const sortOrders = (items, field, direction) => {
    const sorted = [...items].sort((a, b) => {
      let valueA, valueB
      
      // Handle field mappings
      if (field === 'dateBuy') {
        valueA = parseTimestamp(a.dateBuy ?? a.createTime)
        valueB = parseTimestamp(b.dateBuy ?? b.createTime)
      } else if (field === 'dateSell') {
        valueA = parseTimestamp(a.dateSell ?? a.updateTime)
        valueB = parseTimestamp(b.dateSell ?? b.updateTime)
      } else {
        valueA = a[field]
        valueB = b[field]
      }
      
      if (valueA === undefined || valueA === null) return 1
      if (valueB === undefined || valueB === null) return -1
      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return valueA - valueB
      }
      if (field.toLowerCase().includes('date') || field.toLowerCase().includes('time')) {
        const dateA = valueA ? new Date(valueA) : null
        const dateB = valueB ? new Date(valueB) : null
        if (!dateA && !dateB) return 0
        if (!dateA) return 1
        if (!dateB) return -1
        return dateA.getTime() - dateB.getTime()
      }
      return String(valueA).localeCompare(String(valueB))
    })
    return direction === 'asc' ? sorted : sorted.reverse()
  }

  const filteredOrders = useMemo(() => {
    let filtered = orderFilter === 'all' ? orders : orders.filter((order) => order?.status === orderFilter)
    if (orderViewMode === 'table') {
      return sortOrders(filtered, ordersSort.field, ordersSort.direction)
    }
    return filtered
  }, [orders, orderFilter, orderViewMode, ordersSort])

  const orderCounts = useMemo(() => {
    // Use API data if available, otherwise fallback to orders calculation
    if (orderReport) {
      return {
        all: orderReport.totalOrderAll || 0,
        sold: orderReport.orderSold || 0,
        waiting: orderReport.orderWaiting || 0,
      }
    }
    // Fallback to orders calculation
    const all = orders.length
    const sold = orders.filter((o) => o?.status === 'SOLD').length
    const waiting = orders.filter((o) => o?.status === 'WAITING_SELL').length
    return { all, sold, waiting }
  }, [orderReport, orders])

  const orderTotals = useMemo(() => {
    // Calculate waitingCoinQtyTotal from orders (API doesn't provide this)
    const waitingOrders = orders.filter((o) => o?.status === 'WAITING_SELL')
    const waitingCoinQtyTotal = waitingOrders.reduce((sum, order) => {
      const qty = Number(order?.coinQuantity ?? order?.quantity ?? 0)
      return sum + qty
    }, 0)
    
    // Use API data for soldProfitLoss if available, otherwise fallback to orders calculation
    if (orderReport?.soldProfitLoss) {
      return {
        waitingCoinQtyTotal,
        soldProfitLossTotal: orderReport.soldProfitLoss.usdt || 0,
        soldProfitLossTHB: orderReport.soldProfitLoss.thb || 0,
        exchangeRate: orderReport.soldProfitLoss.exchangeRate || 0,
      }
    }
    
    // Fallback to orders calculation for soldProfitLoss
    const soldOrders = orders.filter((o) => o?.status === 'SOLD')
    const soldProfitLossTotal = soldOrders.reduce((sum, order) => {
      const profit = Number(order?.profitLoss ?? 0)
      return sum + profit
    }, 0)
    
    return {
      waitingCoinQtyTotal,
      soldProfitLossTotal,
    }
  }, [orderReport, orders])

  // Get bot status for Orders tab (same logic as Tab Bot)
  const ordersBotStatus = useMemo(() => {
    const status = getStatusForSetting(selectedSettingId || 1)
    if (!status) return null
    const statusText = status?.status || 'Unknown'
    const isRunning = statusText.toLowerCase() === 'running' || statusText.toLowerCase() === 'online'
    return {
      ...status,
      statusText,
      isRunning,
    }
  }, [botStatuses, selectedSettingId])

  const renderOrders = () => (
    <section className="card">
      <header>
        <div>
          <p className="eyebrow">Orders</p>
          <h3>Waiting & Sold</h3>
        </div>
        <div className="button-group">
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <button
              className={`secondary small ${orderViewMode === 'card' ? '' : 'ghost'}`}
              onClick={() => setOrderViewMode('card')}
              title="Card View"
              style={{ fontSize: '12px', padding: '4px 8px' }}
            >
              📋 Card
            </button>
            <button
              className={`secondary small ${orderViewMode === 'table' ? '' : 'ghost'}`}
              onClick={() => setOrderViewMode('table')}
              title="Table View"
              style={{ fontSize: '12px', padding: '4px 8px' }}
            >
              📊 Table
            </button>
          </div>
          <button 
            className="secondary ghost" 
            onClick={() => {
              fetchOrders('ordersManual', ordersPage, ordersPageSize, orderFilter)
              fetchOrderReport()
            }} 
            disabled={ordersLoading || orderReportLoading}
          >
            {ordersLoading || orderReportLoading ? 'Loading...' : 'Refresh'}
          </button>
          <button
            className="primary"
            onClick={openBuyNowForm}
            disabled={buyNowLoading}
            title="Create Order"
          >
            Create Order +
          </button>
        </div>
      </header>

      {/* Filter Buttons */}
      <div className="order-filter-bar" style={{ 
        display: 'flex', 
        gap: '0.5rem', 
        alignItems: 'center', 
        padding: '1rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        flexWrap: 'wrap'
      }}>
        <span style={{ marginRight: '0.5rem', opacity: 0.7 }}>Filter:</span>
        <button
          className={`secondary ${orderFilter === 'all' ? '' : 'ghost'}`}
          onClick={() => {
            setOrderFilter('all')
            setOrdersPage(1) // Reset to page 1 when filter changes
            sessionStorage.setItem('orderFilter', JSON.stringify('all'))
            fetchOrders('ordersFilterChange', 1, ordersPageSize, 'all')
          }}
          style={{ fontSize: '0.875rem' }}
        >
          All
        </button>
        <button
          className={`secondary ${orderFilter === 'SOLD' ? '' : 'ghost'}`}
          onClick={() => {
            setOrderFilter('SOLD')
            setOrdersPage(1) // Reset to page 1 when filter changes
            sessionStorage.setItem('orderFilter', JSON.stringify('SOLD'))
            fetchOrders('ordersFilterChange', 1, ordersPageSize, 'SOLD')
          }}
          style={{ fontSize: '0.875rem' }}
        >
          SOLD
        </button>
        <button
          className={`secondary ${orderFilter === 'WAITING_SELL' ? '' : 'ghost'}`}
          onClick={() => {
            setOrderFilter('WAITING_SELL')
            setOrdersPage(1) // Reset to page 1 when filter changes
            sessionStorage.setItem('orderFilter', JSON.stringify('WAITING_SELL'))
            fetchOrders('ordersFilterChange', 1, ordersPageSize, 'WAITING_SELL')
          }}
          style={{ fontSize: '0.875rem' }}
        >
          WAITING
        </button>
      </div>

      {/* Pagination Controls */}
      <div style={{ 
        display: 'flex', 
        gap: '1rem', 
        alignItems: 'center', 
        padding: '1rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        flexWrap: 'wrap',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ opacity: 0.7, fontSize: '0.875rem' }}>Total:</span>
            <input
              type="text"
              value={ordersTotal}
              readOnly
              style={{
                padding: '4px 8px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '0.875rem',
                width: '80px',
                textAlign: 'center',
                cursor: 'default'
              }}
            />
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ opacity: 0.7, fontSize: '0.875rem' }}>Page Size:</span>
            <select
              value={ordersPageSize}
              onChange={(e) => {
                const newPageSize = Number(e.target.value)
                setOrdersPageSize(newPageSize)
                setOrdersPage(1) // Reset to page 1 when page size changes
                sessionStorage.setItem('ordersPageSize', JSON.stringify(newPageSize))
                fetchOrders('ordersPageSizeChange', 1, newPageSize, orderFilter)
              }}
              style={{
                padding: '4px 8px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '0.875rem',
                cursor: 'pointer'
              }}
            >
              <option value={20} style={{ background: '#0d1524', color: '#fff' }}>20</option>
              <option value={50} style={{ background: '#0d1524', color: '#fff' }}>50</option>
              <option value={100} style={{ background: '#0d1524', color: '#fff' }}>100</option>
              <option value={200} style={{ background: '#0d1524', color: '#fff' }}>200</option>
            </select>
          </div>
        </div>

        {/* Page Numbers */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {(() => {
            const totalPages = Math.ceil(ordersTotal / ordersPageSize)
            const currentPage = ordersPage
            const pages = []
            
            if (totalPages === 0) {
              return <span style={{ opacity: 0.7 }}>No pages</span>
            }
            
            // Calculate page range to show (max 10 pages)
            let startPage = Math.max(1, currentPage - 4)
            let endPage = Math.min(totalPages, currentPage + 5)
            
            // Adjust if near the start
            if (currentPage <= 5) {
              endPage = Math.min(10, totalPages)
            }
            // Adjust if near the end
            if (currentPage > totalPages - 5) {
              startPage = Math.max(1, totalPages - 9)
            }
            
            // First page button
            if (startPage > 1) {
              pages.push(
                <button
                  key="first"
                  className="secondary small"
                  onClick={() => {
                    setOrdersPage(1)
                    fetchOrders('ordersPageChange', 1, ordersPageSize, orderFilter)
                  }}
                  style={{ fontSize: '0.875rem', padding: '4px 8px' }}
                >
                  1
                </button>
              )
              if (startPage > 2) {
                pages.push(<span key="ellipsis1" style={{ opacity: 0.5 }}>...</span>)
              }
            }
            
            // Page number buttons
            for (let i = startPage; i <= endPage; i++) {
              pages.push(
                <button
                  key={i}
                  className={`secondary small ${i === currentPage ? '' : 'ghost'}`}
                  onClick={() => {
                    setOrdersPage(i)
                    fetchOrders('ordersPageChange', i, ordersPageSize, orderFilter)
                  }}
                  style={{ fontSize: '0.875rem', padding: '4px 8px' }}
                >
                  {i}
                </button>
              )
            }
            
            // Last page button
            if (endPage < totalPages) {
              if (endPage < totalPages - 1) {
                pages.push(<span key="ellipsis2" style={{ opacity: 0.5 }}>...</span>)
              }
              pages.push(
                <button
                  key="last"
                  className="secondary small"
                  onClick={() => {
                    setOrdersPage(totalPages)
                    fetchOrders('ordersPageChange', totalPages, ordersPageSize, orderFilter)
                  }}
                  style={{ fontSize: '0.875rem', padding: '4px 8px' }}
                >
                  {totalPages}
                </button>
              )
            }
            
            return pages
          })()}
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

        {!ordersLoading && !ordersError && filteredOrders.length > 0 && orderViewMode === 'card' && (
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
                      <span className="value">{formatDateTimeWithOffset(order?.dateBuy, 7)}</span>
                    </div>
                    <div>
                      <span className="label">Date Sell</span>
                      <span className="value">{formatDateTimeWithOffset(order?.dateSell, 7)}</span>
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

        {!ordersLoading && !ordersError && filteredOrders.length > 0 && orderViewMode === 'table' && (
          <div className="filled-orders-table">
            <table className="data-table">
              <thead>
                <tr>
                  <th onClick={() => handleOrdersSort('dateBuy')} style={{ cursor: 'pointer' }}>
                    Date Buy
                    {ordersSort.field === 'dateBuy' && (
                      <span className="sort-indicator">{ordersSort.direction === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </th>
                  <th onClick={() => handleOrdersSort('dateSell')} style={{ cursor: 'pointer' }}>
                    Date Sell
                    {ordersSort.field === 'dateSell' && (
                      <span className="sort-indicator">{ordersSort.direction === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </th>
                  <th onClick={() => handleOrdersSort('id')} style={{ cursor: 'pointer' }}>
                    ID
                    {ordersSort.field === 'id' && (
                      <span className="sort-indicator">{ordersSort.direction === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </th>
                  <th onClick={() => handleOrdersSort('symbol')} style={{ cursor: 'pointer' }}>
                    Symbol
                    {ordersSort.field === 'symbol' && (
                      <span className="sort-indicator">{ordersSort.direction === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </th>
                  <th onClick={() => handleOrdersSort('status')} style={{ cursor: 'pointer' }}>
                    Status
                    {ordersSort.field === 'status' && (
                      <span className="sort-indicator">{ordersSort.direction === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </th>
                  <th onClick={() => handleOrdersSort('priceBuy')} style={{ cursor: 'pointer' }}>
                    Buy Price
                    {ordersSort.field === 'priceBuy' && (
                      <span className="sort-indicator">{ordersSort.direction === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </th>
                  <th onClick={() => handleOrdersSort('priceSellActual')} style={{ cursor: 'pointer' }}>
                    Sell Price
                    {ordersSort.field === 'priceSellActual' && (
                      <span className="sort-indicator">{ordersSort.direction === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </th>
                  <th onClick={() => handleOrdersSort('priceWaitSell')} style={{ cursor: 'pointer' }}>
                    Wait Sell Price
                    {ordersSort.field === 'priceWaitSell' && (
                      <span className="sort-indicator">{ordersSort.direction === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </th>
                  <th onClick={() => handleOrdersSort('profitLoss')} style={{ cursor: 'pointer' }}>
                    Profit/Loss
                    {ordersSort.field === 'profitLoss' && (
                      <span className="sort-indicator">{ordersSort.direction === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </th>
                  <th onClick={() => handleOrdersSort('buyAmountUSD')} style={{ cursor: 'pointer' }}>
                    Amount USD
                    {ordersSort.field === 'buyAmountUSD' && (
                      <span className="sort-indicator">{ordersSort.direction === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </th>
                  <th onClick={() => handleOrdersSort('coinQuantity')} style={{ cursor: 'pointer' }}>
                    Coin Qty
                    {ordersSort.field === 'coinQuantity' && (
                      <span className="sort-indicator">{ordersSort.direction === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => {
                  const profit = Number(order?.profitLoss ?? 0)
                  const isGain = profit >= 0
                  return (
                    <tr
                      key={order.id}
                      className={
                        order?.status?.toLowerCase() === 'waiting_sell'
                          ? 'order-row waiting'
                          : order?.status?.toLowerCase() === 'sold'
                          ? 'order-row sold'
                          : ''
                      }
                    >
                      <td className="table-value">{formatDateTimeWithOffset(order?.dateBuy, 7)}</td>
                      <td className="table-value">{formatDateTimeWithOffset(order?.dateSell, 7)}</td>
                      <td className="table-value mono">#{order?.id ?? '—'}</td>
                      <td className="table-key">{order?.symbol || '—'}</td>
                      <td>
                        <span
                          className={`status-badge status-${(order?.status || 'unknown').toLowerCase()} ${
                            order?.status === 'WAITING_SELL' ? 'status-waiting-sell' : ''
                          }`}
                        >
                          {order?.status || 'Unknown'}
                        </span>
                      </td>
                      <td className="table-value">{order?.priceBuy ?? '-'}</td>
                      <td className="table-value">{order?.priceSellActual ?? '-'}</td>
                      <td className="table-value">
                        {order?.priceWaitSell != null ? Number(order.priceWaitSell).toFixed(4) : '-'}
                      </td>
                      <td className={`table-value ${isGain ? 'positive' : 'negative'}`}>
                        {isGain ? '+' : ''}
                        {Number(order?.profitLoss ?? 0).toFixed(4)}
                      </td>
                      <td className="table-value">{order?.buyAmountUSD ?? '-'}</td>
                      <td className="table-value">{order?.coinQuantity ?? order?.quantity ?? '-'}</td>
                      <td>
                        <div className="button-group" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          <button
                            className="secondary small"
                            type="button"
                            onClick={() => openOrderEditModal(order)}
                            title="Edit order"
                          >
                            ✏️
                          </button>
                          {order?.status === 'WAITING_SELL' && (
                            <button
                              className="primary ghost small"
                              type="button"
                              onClick={() => openSellModal(order)}
                              title="Sell now"
                            >
                              ⚡️
                            </button>
                          )}
                          <button
                            className="danger small"
                            type="button"
                            onClick={() => handleDeleteOrder(order)}
                            title="Delete order"
                          >
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
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
              <span className="report-value" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {getCoinIcon('USDT') && (
                  <img 
                    src={getCoinIcon('USDT')} 
                    alt="USDT"
                    style={{ 
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      objectFit: 'cover'
                    }}
                  />
                )}
                {formatNumber(spotReport.portfolioValue || 0, 4)}
              </span>
            </div>
            <div className="report-item highlight">
              <span className="report-label">Convert Price THB</span>
              <span className="report-value">
                {formatNumber((Number(spotReport.portfolioValue || 0)) * ((orderTotals && orderTotals.exchangeRate) || 36), 2)} THB
              </span>
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

      {/* Orders Chart Section */}
      <div style={{ marginTop: '32px', padding: '20px', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
          <h4 style={{ margin: 0, fontSize: '16px', color: '#00d1ff' }}>
            Orders Chart - Buy/Sell Count
          </h4>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className={`secondary small ${orderChartView === 'day' ? '' : 'ghost'}`}
              onClick={() => setOrderChartView('day')}
              style={{ fontSize: '12px', padding: '4px 12px' }}
              disabled={!reportConfigId}
            >
              Day
            </button>
            <button
              className={`secondary small ${orderChartView === 'month' ? '' : 'ghost'}`}
              onClick={() => setOrderChartView('month')}
              style={{ fontSize: '12px', padding: '4px 12px' }}
              disabled={!reportConfigId}
            >
              Month
            </button>
          </div>
        </div>

        {!reportConfigId && (
          <div className="state-block empty" style={{ marginTop: '20px' }}>
            กรุณาเลือก Setting เพื่อแสดงกราฟ Order
          </div>
        )}

        {reportConfigId && ordersLoading && (
          <div className="state-block" style={{ marginTop: '20px' }}>
            กำลังโหลด Orders...
          </div>
        )}

        {reportConfigId && !ordersLoading && (
          <>
            {processOrdersForChart.length > 0 ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                {/* Y-Axis Scale */}
                {(() => {
                  const maxCount = processOrdersForChart.reduce(
                    (max, item) => Math.max(max, item.buy, item.sell),
                    1
                  )
                  const scaleSteps = 5
                  const stepValue = Math.ceil(maxCount / scaleSteps)
                  const roundedMax = stepValue * scaleSteps
                  
                  return (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        height: '260px',
                        padding: '16px 0',
                        minWidth: '40px',
                        fontSize: '10px',
                        color: 'var(--text-muted)',
                        textAlign: 'right',
                      }}
                    >
                      {Array.from({ length: scaleSteps + 1 }, (_, i) => {
                        const value = roundedMax - (i * stepValue)
                        return (
                          <div key={i} style={{ lineHeight: '1' }}>
                            {value}
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
                
                {/* Chart Bars */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: '4px',
                    height: '260px',
                    padding: '16px 0',
                    borderTop: '1px solid var(--border)',
                    borderBottom: '1px solid var(--border)',
                    borderLeft: '1px solid var(--border)',
                    flex: '1',
                    overflowX: 'auto',
                    overflowY: 'visible',
                    position: 'relative',
                  }}
                >
                  {/* Grid Lines */}
                  {(() => {
                    const maxCount = processOrdersForChart.reduce(
                      (max, item) => Math.max(max, item.buy, item.sell),
                      1
                    )
                    const scaleSteps = 5
                    const stepValue = Math.ceil(maxCount / scaleSteps)
                    const roundedMax = stepValue * scaleSteps
                    
                    return (
                      <div
                        style={{
                          position: 'absolute',
                          top: '16px',
                          left: 0,
                          right: 0,
                          bottom: '16px',
                          pointerEvents: 'none',
                        }}
                      >
                        {Array.from({ length: scaleSteps + 1 }, (_, i) => {
                          const percentage = (i / scaleSteps) * 100
                          return (
                            <div
                              key={i}
                              style={{
                                position: 'absolute',
                                left: 0,
                                right: 0,
                                top: `${percentage}%`,
                                borderTop: '1px dashed rgba(255, 255, 255, 0.1)',
                              }}
                            />
                          )
                        })}
                      </div>
                    )
                  })()}
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', width: '100%', position: 'relative', zIndex: 1, height: '228px', padding: '0 4px' }}>
                  {(() => {
                    const maxCount = processOrdersForChart.reduce(
                      (max, item) => Math.max(max, item.buy, item.sell),
                      1
                    )
                    return processOrdersForChart.map((item, index) => {
                      const buyHeight = maxCount > 0 ? (item.buy / maxCount) * 100 : 0
                      const sellHeight = maxCount > 0 ? (item.sell / maxCount) * 100 : 0
                      return (
                        <div
                          key={index}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '4px',
                            minWidth: '42px',
                            flex: '1 1 auto',
                            height: '100%',
                          }}
                        >
                        <div
                          style={{
                            display: 'flex',
                            gap: '4px',
                            alignItems: 'flex-end',
                            justifyContent: 'center',
                            height: '228px',
                            width: '100%',
                          }}
                        >
                          {/* Buy Bar */}
                          <div
                            style={{
                              width: '20px',
                              backgroundColor: 'rgba(0, 102, 255, 0.35)',
                              height: `${buyHeight}%`,
                              minHeight: item.buy > 0 ? '4px' : '0',
                              borderRadius: '999px 999px 0 0',
                              display: 'flex',
                              alignItems: 'flex-start',
                              justifyContent: 'center',
                              paddingTop: '2px',
                              border: '1px solid rgba(0, 102, 255, 0.6)',
                              transition: 'all 0.2s ease',
                            }}
                            title={`Buy: ${item.buy}`}
                          >
                            {item.buy > 0 && (
                              <span
                                style={{
                                  fontSize: '9px',
                                  color: '#fff',
                                  fontWeight: 'bold',
                                  textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                                }}
                              >
                                {item.buy}
                              </span>
                            )}
                          </div>

                          {/* Sell Bar */}
                          <div
                            style={{
                              width: '20px',
                              backgroundColor: 'rgba(255, 85, 170, 0.35)',
                              height: `${sellHeight}%`,
                              minHeight: item.sell > 0 ? '4px' : '0',
                              borderRadius: '999px 999px 0 0',
                              display: 'flex',
                              alignItems: 'flex-start',
                              justifyContent: 'center',
                              paddingTop: '2px',
                              border: '1px solid rgba(255, 85, 170, 0.6)',
                              transition: 'all 0.2s ease',
                            }}
                            title={`Sell: ${item.sell}`}
                          >
                            {item.sell > 0 && (
                              <span
                                style={{
                                  fontSize: '9px',
                                  color: '#fff',
                                  fontWeight: 'bold',
                                  textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                                }}
                              >
                                {item.sell}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Date Label */}
                        <div
                          style={{
                            fontSize: '9px',
                            color: 'var(--text-muted)',
                            textAlign: 'center',
                            whiteSpace: 'nowrap',
                            marginTop: '8px',
                            width: '100%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {orderChartView === 'month'
                            ? item.date.replace(/(\d{4})-(\d{2})/, '$2/$1')
                            : item.date.replace(/(\d{4})-(\d{2})-(\d{2})/, '$3/$2')}
                        </div>
                      </div>
                    )
                  })
                })()}
                  </div>
                </div>
              </div>
            ) : (
              <div className="state-block empty" style={{ marginTop: '20px' }}>
                ไม่มีข้อมูล Order สำหรับแสดงกราฟในช่วงที่เลือก
              </div>
            )}

            {/* Legend */}
            <div
              style={{
                display: 'flex',
                gap: '20px',
                justifyContent: 'center',
                marginTop: '16px',
                fontSize: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    backgroundColor: '#0066FF',
                    borderRadius: '2px',
                  }}
                />
                <span>Buy Orders</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    backgroundColor: '#FF55AA',
                    borderRadius: '2px',
                  }}
                />
                <span>Sell Orders</span>
              </div>
            </div>
          </>
        )}
      </div>

      {allCoinsError && <div className="state-block error">โหลด Coins ไม่ได้: {prettify(allCoinsError)}</div>}
      {allCoinsLoading && <div className="state-block">กำลังโหลด Coins...</div>}
      {!allCoinsLoading && (
        <div className="coins-content">
          <div className="coins-summary">
            <div className="summary-item">
              <span className="summary-label">Total Value USD</span>
              <span className="summary-value">
                {formatNumber(allCoinsData.totalValueUSD || 0, 4)} USDT
                {orderTotals?.exchangeRate && (
                  <span style={{ marginLeft: '8px', opacity: 0.8 }}>
                    ({formatNumber(allCoinsData.totalValueUSD * orderTotals.exchangeRate || 0, 2)} THB)
                  </span>
                )}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Count</span>
              <span className="summary-value">{allCoinsData.count || allCoinsData.coins.length}</span>
            </div>
          </div>
          {allCoinsData.coins.length > 0 ? (
            <>
              {/* Chart Section */}
              <div className="coins-chart-section">
                <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#00d1ff' }}>Portfolio Distribution</h4>
                <div className="coins-chart-vertical">
                  {allCoinsData.coins.map((coin, index) => {
                    const value = Number(coin.valueInUSDT || 0)
                    const totalValue = Number(allCoinsData.totalValueUSD || 1)
                    const percentage = totalValue > 0 ? (value / totalValue) * 100 : 0
                    return (
                      <div key={index} className="chart-bar-item-vertical">
                        {getCoinIcon(coin.coin) && (
                          <img 
                            src={getCoinIcon(coin.coin)} 
                            alt={coin.coin}
                            style={{ 
                              width: '60px',
                              height: '60px',
                              borderRadius: '50%',
                              objectFit: 'cover',
                              marginBottom: '8px',
                              border: '2px solid rgba(0, 209, 255, 0.3)',
                              background: 'rgba(0, 0, 0, 0.3)',
                              padding: '4px',
                              flexShrink: 0
                            }}
                          />
                        )}
                        <span className="chart-bar-percentage-vertical">{percentage.toFixed(1)}%</span>
                        <div className="chart-bar-container-vertical">
                          <div
                            className="chart-bar-vertical"
                            style={{
                              height: `${percentage}%`,
                            }}
                          />
                        </div>
                        <div className="chart-bar-label-vertical">
                          <span className="chart-coin-name">{coin.coin}</span>
                          <span className="chart-coin-value">{value.toFixed(4)} USDT</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Table Section */}
              <div className="coins-list">
                <h4 style={{ margin: '24px 0 12px 0', fontSize: '16px', color: '#00d1ff' }}>Coins Table</h4>
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
                        <td className="table-value">{formatNumber(coin.valueInUSDT || 0, 4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
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
              value={filledOrdersForm.Limit || 25}
              onChange={(e) => setFilledOrdersForm((prev) => ({ ...prev, Limit: Number(e.target.value) || 25 }))}
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
                  { key: 'createTime', label: 'Create Time' },
                  { key: 'orderId', label: 'Order ID' },
                  { key: 'symbol', label: 'Symbol' },
                  { key: 'side', label: 'Side' },
                  { key: 'type', label: 'Type' },
                  { key: 'quantity', label: 'Quantity' },
                  { key: 'price', label: 'Price' },
                  { key: 'quoteQuantity', label: 'Quote Qty' },
                  { key: 'quantityFilled', label: 'Filled Qty' },
                  { key: 'quoteQuantityFilled', label: 'Filled Quote' },
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
                  <td className="table-value">{formatDateTime(order.createTime)}</td>
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
                  <td className="table-value">{order.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )

  // Render Login Page
  if (!isAuthenticated) {
    return <Login apiBase={apiBase} onLoginSuccess={handleLoginSuccess} />
  }

  return (
    <div className="app">
      {/* Hidden audio element for alert sound */}
      <audio ref={alertSoundRef} src={alertSound} preload="auto" />
      
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
                      {formatDateTimeWithOffset(alert.timestamp, 7)}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Top Bar with Orders Info and Controls */}
      <div className="app-top-bar">
        <div className="top-bar-content">
          {/* Orders Info */}
          <div className="top-bar-orders-info" style={{ fontSize: '15px' }}>
            {spotReport?.portfolioValue !== undefined && (
              <>
                <div className="top-bar-item" style={{ borderRight: '1px solid rgba(255, 255, 255, 0.2)', paddingRight: '12px', marginRight: '8px' }}>
                  <span className="top-bar-value" style={{ color: '#00AEFF', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {getCoinIcon('USDT') && (
                      <img 
                        src={getCoinIcon('USDT')} 
                        alt="USDT"
                        style={{ 
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          objectFit: 'cover'
                        }}
                      />
                    )}
                    {formatNumber(spotReport.portfolioValue || 0, 4)} USDT
                  </span>
                </div>
                <div className="top-bar-item" style={{ borderRight: '1px solid rgba(255, 255, 255, 0.2)', paddingRight: '12px', marginRight: '8px' }}>
                  <span className="top-bar-label" style={{ color: '#00AEFF' }}>THB:</span>
                  <span className="top-bar-value" style={{ color: '#00AEFF', fontWeight: 'bold' }}>
                    {formatNumber((Number(spotReport.portfolioValue || 0)) * ((orderTotals && orderTotals.exchangeRate) || 36), 2)} THB
                  </span>
                </div>
              </>
            )}
            <div className="top-bar-item">
              <span className="top-bar-label">Orders:</span>
              <span className="top-bar-value">
                All: {orderCounts.all} | <span style={{ color: '#00ff00' }}>SOLD: {orderCounts.sold}</span> | <span style={{ color: '#ffa500' }}>WAITING: {orderCounts.waiting}</span>
              </span>
            </div>
            <div className="top-bar-item">
              <span className="top-bar-label">Waiting Qty:</span>
              <span className="top-bar-value accent">
                {orderTotals.waitingCoinQtyTotal.toFixed(4)}
              </span>
            </div>
            {orderTotals.exchangeRate && (
              <div className="top-bar-item">
                <span className="top-bar-label">Exchange Rate:</span>
                <span className="top-bar-value">
                  {orderTotals.exchangeRate.toFixed(2)}
                </span>
              </div>
            )}
            <div className="top-bar-item">
              <span className="top-bar-label">Sold P/L:</span>
              <span className={`top-bar-value ${orderTotals.soldProfitLossTotal >= 0 ? 'positive' : 'negative'}`}>
                {orderTotals.soldProfitLossTotal >= 0 ? '+' : ''}
                {orderTotals.soldProfitLossTotal.toFixed(4)} USDT
                {orderTotals.soldProfitLossTHB !== undefined && (
                  <span style={{ marginLeft: '8px', color: 'inherit' }}>
                    ({orderTotals.soldProfitLossTHB >= 0 ? '+' : ''}
                    {orderTotals.soldProfitLossTHB.toFixed(2)} THB)
                  </span>
                )}
              </span>
            </div>
            {portfolioValueFromCoins !== null && (
              <div className="top-bar-item">
                <span className="top-bar-label">Portfolio Value:</span>
                <span className="top-bar-value" style={{ color: '#ffa500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {getCoinIcon('USDT') && (
                    <img 
                      src={getCoinIcon('USDT')} 
                      alt="USDT"
                      style={{ 
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        objectFit: 'cover'
                      }}
                    />
                  )}
                  <span>
                    {formatNumber(portfolioValueFromCoins, 4)} USDT
                    {orderTotals?.exchangeRate && (
                      <span style={{ marginLeft: '8px', color: 'inherit' }}>
                        ({formatNumber(portfolioValueFromCoins * orderTotals.exchangeRate, 2)} THB)
                      </span>
                    )}
                  </span>
                </span>
              </div>
            )}
            {portfolioValueFromCoins !== null && selectedSetting?.buyAmountUSD && (
              <div className="top-bar-item">
                <span className="top-bar-label">ซื้อได้อีก :</span>
                <span className="top-bar-value">
                  {(portfolioValueFromCoins / Number(selectedSetting.buyAmountUSD || 1)).toFixed(2)}
                </span>
                <span className="top-bar-label">ไม้</span>
                </div>
            )}
            {xrpCoinData && (
              <div className="top-bar-item" style={{ borderLeft: '1px solid rgba(255, 136, 0, 0.4)', paddingLeft: '12px' }}>
                <span className="top-bar-label" style={{ color: '#ff8800' }}>XRP Snapshot:</span>
                <span className="top-bar-value" style={{ display: 'block', fontSize: '13px' }}>
                  Qty {formatNumber(xrpCoinData.quantity || 0, 6)} | Value {formatNumber(xrpCoinData.valueInUSDT || 0, 2)} USDT
                </span>
                {xrpValuePerAmount !== null && (
                  <span className="top-bar-value" style={{ display: 'block', fontSize: '13px' }}>
                    จำนวนOrder: {xrpValuePerAmount.toFixed(4)}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* BuyPause and Bot Controls */}
          <div className="top-bar-controls">
            {/* BuyPause Status and Control */}
            <div className="top-bar-control-item">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', opacity: 0.7 }}>BuyPause:</span>
                <span
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: buyPauseStatus.isPaused ? '#ff4444' : '#44ff44',
                    display: 'inline-block',
                    boxShadow: buyPauseStatus.isPaused 
                      ? '0 0 6px rgba(255, 68, 68, 0.6)' 
                      : '0 0 6px rgba(68, 255, 68, 0.6)',
                  }}
                  title={buyPauseStatus.message || (buyPauseStatus.isPaused ? 'Buy logic is paused' : 'Buy logic is active')}
                />
                <span style={{ fontSize: '0.875rem', opacity: 0.9 }}>
                  {buyPauseStatus.isPaused ? 'Paused' : 'Active'}
                </span>
              </div>
              <button
                className={buyPauseStatus.isPaused ? 'primary small' : 'secondary small'}
                onClick={() => setBuyPauseState(!buyPauseStatus.isPaused)}
                disabled={buyPauseStatus.loading}
                style={{ fontSize: '0.75rem', padding: '4px 8px', minWidth: '60px' }}
              >
                {buyPauseStatus.loading ? '...' : buyPauseStatus.isPaused ? 'Resume' : 'Pause'}
              </button>
            </div>

            {/* Bot Status and Control */}
            <div className="top-bar-control-item">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', opacity: 0.7 }}>Bot:</span>
                <span
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: ordersBotStatus?.isRunning ? '#44ff44' : '#ff4444',
                    display: 'inline-block',
                    boxShadow: ordersBotStatus?.isRunning 
                      ? '0 0 6px rgba(68, 255, 68, 0.6)' 
                      : '0 0 6px rgba(255, 68, 68, 0.6)',
                  }}
                  title={ordersBotStatus?.message || (ordersBotStatus?.isRunning ? 'Bot is running' : 'Bot is stopped')}
                />
                <span style={{ fontSize: '0.875rem', opacity: 0.9, fontWeight: 600 }}>
                  {ordersBotStatus?.statusText || 'Unknown'}
                </span>
              </div>
              <button
                className="secondary ghost small"
                onClick={() => handleBotAction(ordersBotStatus?.isRunning ? 'stop' : 'start', selectedSettingId || 1)}
                disabled={botStatusLoading}
                style={{ fontSize: '0.75rem', padding: '4px 8px', minWidth: 'auto' }}
                title={ordersBotStatus?.isRunning ? 'Stop Bot' : 'Start Bot'}
              >
                {ordersBotStatus?.isRunning ? '⏹' : '▶'}
              </button>
            </div>
          </div>

          {/* View Mode Menu */}
          {activeTab === 'orders' && (
            <div className="top-bar-view-menu">
              <button
                className={`view-menu-item ${viewMode === 'chart' ? 'active' : ''}`}
                onClick={() => setViewMode('chart')}
              >
                Chart
              </button>
              <button
                className={`view-menu-item ${viewMode === 'priceChart' ? 'active' : ''}`}
                onClick={() => setViewMode('priceChart')}
              >
                Price Chart
              </button>
              <button
                className={`view-menu-item ${viewMode === 'calculate' ? 'active' : ''}`}
                onClick={() => setViewMode('calculate')}
              >
                Calculate
              </button>
              <button
                className={`view-menu-item ${viewMode === 'trade' ? 'active' : ''}`}
                onClick={() => setViewMode('trade')}
              >
                Trade
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Top Right Controls */}
      <div className="top-right-controls">
        <button
          className="top-control-btn"
          onClick={() => {
            setShowAlertLogs(true)
            fetchAlertLogs()
          }}
          title="Alert Logs"
        >
          🔔
          {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}
        </button>
        <button 
          className="top-control-btn" 
          onClick={playAlertSound} 
          title="Test Alert Sound"
        >
          🔊
        </button>
        <button className="top-control-btn" onClick={clearLogs} title="Clear All Logs">
          🗑
        </button>
        <button 
          className="top-control-btn" 
          onClick={handleLogout} 
          title="Logout"
          style={{ color: '#24A4D6FF',fontSize: '9px' }}
 
        >
          Logout
        </button>
      </div>

      <main className="content">
        {activeTab === 'orders' && (
          <>
            {viewMode === 'chart' && (
              <div className="tradingview-full-width">
                <TradingViewWidget />
              </div>
            )}
            {viewMode === 'priceChart' && renderPriceChart()}
            {viewMode === 'calculate' && renderCalculate()}
            {viewMode === 'trade' && renderTrade()}
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
        <div className="modal-backdrop">
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
        <div className="modal-backdrop">
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
        <div className="modal-backdrop">
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
        <div className="modal-backdrop">
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
        <div className="modal-backdrop">
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
        <div className="modal-backdrop">
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

      {/* Alert Logs Modal */}
      {showAlertLogs && (
        <div className="modal-backdrop">
          <div className="modal alert-logs-modal" onClick={(e) => e.stopPropagation()}>
            {renderAlertLogs()}
          </div>
        </div>
      )}

      {/* Trade Line Settings Modal */}
      {isTradeLineSettingsModalOpen && (
        <div className="modal-backdrop">
          <div 
            className="modal" 
            onClick={(e) => e.stopPropagation()} 
            style={{ 
              maxWidth: '600px', 
              maxHeight: '90vh', 
              overflowY: 'auto',
              background: 'rgb(13 21 36 / 0%)',
              backdropFilter: 'blur(5px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(99, 160, 255, 0.2)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
            }}
          >
            <header>
              <h3>Trade Line Settings</h3>
            </header>
            <div style={{ padding: '16px' }}>
              {/* Toggle All Lines */}
              <div style={{ marginBottom: '24px', padding: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <input
                    type="checkbox"
                    checked={tradeLineSettings?.buttons?.toggleAllLines ?? true}
                    onChange={(e) =>
                      setTradeLineSettings((prev) => ({
                        ...prev,
                        buttons: { ...prev?.buttons, toggleAllLines: e.target.checked },
                      }))
                    }
                  />
                  <strong>Toggle All Lines</strong>
                </label>
              </div>

              {/* Buy-Sell Line */}
              {tradeLineSettings?.buttons?.toggleBuy !== false && (
                <div style={{ marginBottom: '12px', padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <strong style={{ minWidth: '80px', fontSize: '14px' }}>Buy-Sell</strong>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                      <span style={{ fontSize: '11px', opacity: 0.7 }}>Type</span>
                      <select
                        value={tradeLineSettings?.lines?.['buy-Sell']?.type || 'lineSeries'}
                        onChange={(e) =>
                          setTradeLineSettings((prev) => ({
                            ...prev,
                            lines: {
                              ...prev?.lines,
                              'buy-Sell': { ...prev?.lines?.['buy-Sell'], type: e.target.value },
                            },
                          }))
                        }
                        style={{ padding: '4px 8px', fontSize: '12px', minWidth: '100px' }}
                      >
                        <option value="markers">Markers</option>
                        <option value="arrow">Arrow</option>
                        <option value="arrowUpDown">↑↓ Arrow Up/Down</option>
                        <option value="triangleUpDown">▲▼ Triangle Up/Down</option>
                        <option value="point">Point</option>
                        <option value="lineSeries">Line Series</option>
                        <option value="lineSolid">Line Solid</option>
                        <option value="dot">Dot</option>
                      </select>
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                      <span style={{ fontSize: '11px', opacity: 0.7 }}>Buy Color</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            backgroundColor: tradeLineSettings?.lines?.['buy-Sell']?.colorBuy || '#0066FF',
                            border: '2px solid var(--border)',
                            flexShrink: 0,
                          }}
                        />
                        <input
                          type="color"
                          value={tradeLineSettings?.lines?.['buy-Sell']?.colorBuy || '#0066FF'}
                          onChange={(e) =>
                            setTradeLineSettings((prev) => ({
                              ...prev,
                              lines: {
                                ...prev?.lines,
                                'buy-Sell': { ...prev?.lines?.['buy-Sell'], colorBuy: e.target.value },
                              },
                            }))
                          }
                          style={{ width: '40px', height: '28px', cursor: 'pointer' }}
                        />
                      </div>
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                      <span style={{ fontSize: '11px', opacity: 0.7 }}>Sell Color</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            backgroundColor: tradeLineSettings?.lines?.['buy-Sell']?.colorSell || '#FF55AA',
                            border: '2px solid var(--border)',
                            flexShrink: 0,
                          }}
                        />
                        <input
                          type="color"
                          value={tradeLineSettings?.lines?.['buy-Sell']?.colorSell || '#FF55AA'}
                          onChange={(e) =>
                            setTradeLineSettings((prev) => ({
                              ...prev,
                              lines: {
                                ...prev?.lines,
                                'buy-Sell': { ...prev?.lines?.['buy-Sell'], colorSell: e.target.value },
                              },
                            }))
                          }
                          style={{ width: '40px', height: '28px', cursor: 'pointer' }}
                        />
                      </div>
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                      <span style={{ fontSize: '11px', opacity: 0.7 }}>Limit (Last N)</span>
                      <input
                        type="number"
                        min="1"
                        value={tradeLineSettings?.lines?.['buy-Sell']?.limit ?? 200}
                        onChange={(e) =>
                          setTradeLineSettings((prev) => ({
                            ...prev,
                            lines: {
                              ...prev?.lines,
                              'buy-Sell': { ...prev?.lines?.['buy-Sell'], limit: parseInt(e.target.value) || 200 },
                            },
                          }))
                        }
                        style={{ padding: '4px 8px', fontSize: '12px', width: '80px' }}
                      />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                      <span style={{ fontSize: '11px', opacity: 0.7 }}>Time Offset (Hours)</span>
                      <input
                        type="number"
                        value={tradeLineSettings?.lines?.['buy-Sell']?.timeOffset ?? 14}
                        onChange={(e) =>
                          setTradeLineSettings((prev) => ({
                            ...prev,
                            lines: {
                              ...prev?.lines,
                              'buy-Sell': { ...prev?.lines?.['buy-Sell'], timeOffset: parseFloat(e.target.value) || 14 },
                            },
                          }))
                        }
                        style={{ padding: '4px 8px', fontSize: '12px', width: '80px' }}
                      />
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
                      <input
                        type="checkbox"
                        checked={tradeLineSettings?.lines?.['buy-Sell']?.visible ?? true}
                        onChange={(e) =>
                          setTradeLineSettings((prev) => ({
                            ...prev,
                            lines: {
                              ...prev?.lines,
                              'buy-Sell': { ...prev?.lines?.['buy-Sell'], visible: e.target.checked },
                            },
                          }))
                        }
                      />
                      <span style={{ fontSize: '12px' }}>Visible</span>
                    </label>
                  </div>
                </div>
              )}

              {/* WaitSell Line */}
              {tradeLineSettings?.buttons?.toggleWaitSell !== false && (
                <div style={{ marginBottom: '12px', padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <strong style={{ minWidth: '80px', fontSize: '14px' }}>Wait Sell</strong>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                      <span style={{ fontSize: '11px', opacity: 0.7 }}>Type</span>
                      <select
                        value={tradeLineSettings?.lines?.waitSell?.type || 'dot'}
                        onChange={(e) =>
                          setTradeLineSettings((prev) => ({
                            ...prev,
                            lines: {
                              ...prev?.lines,
                              waitSell: { ...prev?.lines?.waitSell, type: e.target.value },
                            },
                          }))
                        }
                        style={{ padding: '4px 8px', fontSize: '12px', minWidth: '100px' }}
                      >
                        <option value="markers">Markers</option>
                        <option value="lineSeries">Line Series</option>
                        <option value="lineSolid">Line Solid</option>
                        <option value="dot">Dot</option>
                      </select>
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                      <span style={{ fontSize: '11px', opacity: 0.7 }}>Color</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            backgroundColor: tradeLineSettings?.lines?.waitSell?.color || '#FFA500',
                            border: '2px solid var(--border)',
                            flexShrink: 0,
                          }}
                        />
                        <input
                          type="color"
                          value={tradeLineSettings?.lines?.waitSell?.color || '#FFA500'}
                          onChange={(e) =>
                            setTradeLineSettings((prev) => ({
                              ...prev,
                              lines: {
                                ...prev?.lines,
                                waitSell: { ...prev?.lines?.waitSell, color: e.target.value },
                              },
                            }))
                          }
                          style={{ width: '40px', height: '28px', cursor: 'pointer' }}
                        />
                      </div>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
                      <input
                        type="checkbox"
                        checked={tradeLineSettings?.lines?.waitSell?.visible ?? true}
                        onChange={(e) =>
                          setTradeLineSettings((prev) => ({
                            ...prev,
                            lines: {
                              ...prev?.lines,
                              waitSell: { ...prev?.lines?.waitSell, visible: e.target.checked },
                            },
                          }))
                        }
                      />
                      <span style={{ fontSize: '12px' }}>Visible</span>
                    </label>
                  </div>
                </div>
              )}

              {/* NextEntry Line */}
              {tradeLineSettings?.buttons?.toggleNextEntry !== false && (
                <div style={{ marginBottom: '12px', padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <strong style={{ minWidth: '80px', fontSize: '14px' }}>Next Entry</strong>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                      <span style={{ fontSize: '11px', opacity: 0.7 }}>Type</span>
                      <select
                        value={tradeLineSettings?.lines?.nextEntry?.type || 'dot'}
                        onChange={(e) =>
                          setTradeLineSettings((prev) => ({
                            ...prev,
                            lines: {
                              ...prev?.lines,
                              nextEntry: { ...prev?.lines?.nextEntry, type: e.target.value },
                            },
                          }))
                        }
                        style={{ padding: '4px 8px', fontSize: '12px', minWidth: '100px' }}
                      >
                        <option value="markers">Markers</option>
                        <option value="lineSeries">Line Series</option>
                        <option value="lineSolid">Line Solid</option>
                        <option value="dot">Dot</option>
                      </select>
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                      <span style={{ fontSize: '11px', opacity: 0.7 }}>Color</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            backgroundColor: tradeLineSettings?.lines?.nextEntry?.color || '#0066FF',
                            border: '2px solid var(--border)',
                            flexShrink: 0,
                          }}
                        />
                        <input
                          type="color"
                          value={tradeLineSettings?.lines?.nextEntry?.color || '#0066FF'}
                          onChange={(e) =>
                            setTradeLineSettings((prev) => ({
                              ...prev,
                              lines: {
                                ...prev?.lines,
                                nextEntry: { ...prev?.lines?.nextEntry, color: e.target.value },
                              },
                            }))
                          }
                          style={{ width: '40px', height: '28px', cursor: 'pointer' }}
                        />
                      </div>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
                      <input
                        type="checkbox"
                        checked={tradeLineSettings?.lines?.nextEntry?.visible ?? true}
                        onChange={(e) =>
                          setTradeLineSettings((prev) => ({
                            ...prev,
                            lines: {
                              ...prev?.lines,
                              nextEntry: { ...prev?.lines?.nextEntry, visible: e.target.checked },
                            },
                          }))
                        }
                      />
                      <span style={{ fontSize: '12px' }}>Visible</span>
                    </label>
                  </div>
                </div>
              )}

              {/* NextSell Line */}
              {tradeLineSettings?.buttons?.toggleNextSell !== false && (
                <div style={{ marginBottom: '12px', padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <strong style={{ minWidth: '80px', fontSize: '14px' }}>Next Sell</strong>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                      <span style={{ fontSize: '11px', opacity: 0.7 }}>Type</span>
                      <select
                        value={tradeLineSettings?.lines?.nextSell?.type || 'dot'}
                        onChange={(e) =>
                          setTradeLineSettings((prev) => ({
                            ...prev,
                            lines: {
                              ...prev?.lines,
                              nextSell: { ...prev?.lines?.nextSell, type: e.target.value },
                            },
                          }))
                        }
                        style={{ padding: '4px 8px', fontSize: '12px', minWidth: '100px' }}
                      >
                        <option value="markers">Markers</option>
                        <option value="lineSeries">Line Series</option>
                        <option value="lineSolid">Line Solid</option>
                        <option value="dot">Dot</option>
                      </select>
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                      <span style={{ fontSize: '11px', opacity: 0.7 }}>Color</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            backgroundColor: tradeLineSettings?.lines?.nextSell?.color || '#FF55AA',
                            border: '2px solid var(--border)',
                            flexShrink: 0,
                          }}
                        />
                        <input
                          type="color"
                          value={tradeLineSettings?.lines?.nextSell?.color || '#FF55AA'}
                          onChange={(e) =>
                            setTradeLineSettings((prev) => ({
                              ...prev,
                              lines: {
                                ...prev?.lines,
                                nextSell: { ...prev?.lines?.nextSell, color: e.target.value },
                              },
                            }))
                          }
                          style={{ width: '40px', height: '28px', cursor: 'pointer' }}
                        />
                      </div>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
                      <input
                        type="checkbox"
                        checked={tradeLineSettings?.lines?.nextSell?.visible ?? true}
                        onChange={(e) =>
                          setTradeLineSettings((prev) => ({
                            ...prev,
                            lines: {
                              ...prev?.lines,
                              nextSell: { ...prev?.lines?.nextSell, visible: e.target.checked },
                            },
                          }))
                        }
                      />
                      <span style={{ fontSize: '12px' }}>Visible</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Last Action Line */}
              {tradeLineSettings?.buttons?.toggleLastAction !== false && (
                <div style={{ marginBottom: '12px', padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <strong style={{ minWidth: '80px', fontSize: '14px' }}>Last Action</strong>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                      <span style={{ fontSize: '11px', opacity: 0.7 }}>Type</span>
                      <select
                        value={tradeLineSettings?.lines?.lastAction?.type || 'dot'}
                        onChange={(e) =>
                          setTradeLineSettings((prev) => ({
                            ...prev,
                            lines: {
                              ...prev?.lines,
                              lastAction: { ...prev?.lines?.lastAction, type: e.target.value },
                            },
                          }))
                        }
                        style={{ padding: '4px 8px', fontSize: '12px', minWidth: '100px' }}
                      >
                        <option value="markers">Markers</option>
                        <option value="lineSeries">Line Series</option>
                        <option value="lineSolid">Line Solid</option>
                        <option value="dot">Dot</option>
                      </select>
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                      <span style={{ fontSize: '11px', opacity: 0.7 }}>Color</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            backgroundColor: tradeLineSettings?.lines?.lastAction?.color || '#808080',
                            border: '2px solid var(--border)',
                            flexShrink: 0,
                          }}
                        />
                        <input
                          type="color"
                          value={tradeLineSettings?.lines?.lastAction?.color || '#808080'}
                          onChange={(e) =>
                            setTradeLineSettings((prev) => ({
                              ...prev,
                              lines: {
                                ...prev?.lines,
                                lastAction: { ...prev?.lines?.lastAction, color: e.target.value },
                              },
                            }))
                          }
                          style={{ width: '40px', height: '28px', cursor: 'pointer' }}
                        />
                      </div>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
                      <input
                        type="checkbox"
                        checked={tradeLineSettings?.lines?.lastAction?.visible ?? true}
                        onChange={(e) =>
                          setTradeLineSettings((prev) => ({
                            ...prev,
                            lines: {
                              ...prev?.lines,
                              lastAction: { ...prev?.lines?.lastAction, visible: e.target.checked },
                            },
                          }))
                        }
                      />
                      <span style={{ fontSize: '12px' }}>Visible</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
            <div className="button-group">
              <button
                className="secondary ghost"
                type="button"
                onClick={() => setIsTradeLineSettingsModalOpen(false)}
              >
                Close
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

      {/* Logout Confirmation Dialog */}
      {isLogoutConfirmOpen && (
        <div className="modal-backdrop">
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <header>
              <h3>Confirm Logout</h3>
            </header>
            <div style={{ padding: '20px 0' }}>
              <p style={{ margin: '0 0 20px 0', color: 'var(--text-muted)' }}>
                Are you sure you want to logout?
              </p>
            </div>
            <div className="button-group">
              <button className="secondary ghost" type="button" onClick={cancelLogout}>
                Cancel
              </button>
              <button className="primary" type="button" onClick={() => {
                setIsLogoutConfirmOpen(false)
                confirmLogout()
              }} style={{ background: '#ff6b8f', borderColor: '#ff6b8f' }}>
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
