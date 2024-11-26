// Constants
const WALLET_ADDRESS = "" //ADD YOUR WALLET HERE
const CONTRACT_ADDRESS = "0x878b7897C60fA51c2A7bfBdd4E3cB5708D9eEE43"
const STAKING_CONTRACT = "0xDE1aFF6cc38f3dBed0A93b3C268Cf391B68209aF"
const RPC_ENDPOINT = "https://arb1.arbitrum.io/rpc"
const TEXT_COLOR = new Color("#FFFFFF")
const LOGO_URL = "https://i.ibb.co/bB6G6gN/GOAT-Protocol-logo-white-2.png"
const LAST_REFRESH_FILE = "lastRefreshTime.txt"
const LAST_BLOCK_FILE = "lastBlockScanned.txt"
const TRANSACTIONS_FILE = "strategyTransactions.json"
const ACCENT_COLOR = new Color("#C678E5")

// Event signatures
const DEPOSIT_EVENT = "0xdcbc1c05240f31ff3ad067ef1ee35ce4997762752e3a095284754544f4c709d7"
const WITHDRAW_EVENT = "0xfbde797d201c681b91056529119e0b02407c7bb96a4a2c75c01fc9667232c8db"

function getFont(size, weight = "regular") {
  return weight === "bold" ? Font.boldSystemFont(size) : Font.regularSystemFont(size)
}

function createGradientContext(widget) {
  const gradient = new LinearGradient()
  
  const highlightPurple = new Color("#C678E5")    
  const mainPurple = new Color("#52146A")         
  const richPurple = new Color("#4B1D5E")         
  const background = new Color("#1A1A1C")         
  const deepPurple = new Color("#2A1438")         
  const warmGlow = new Color("#3D1F48")           
  const nightPurple = new Color("#231225")        
  const orangeTint = new Color("#4A2038")         
  
  gradient.colors = [
    highlightPurple, mainPurple, background, background,
    deepPurple, warmGlow, orangeTint
  ]
  
  gradient.locations = [0.0, 0.2, 0.4, 0.5, 0.7, 0.85, 1.0]
  gradient.startPoint = new Point(-0.2, -0.2)
  gradient.endPoint = new Point(1.2, 1.2)
  
  widget.backgroundGradient = gradient
}

// Block tracking
async function getLastScannedBlock() {
  const fm = FileManager.local()
  const path = fm.joinPath(fm.documentsDirectory(), LAST_BLOCK_FILE)
  
  if (fm.fileExists(path)) {
    return parseInt(fm.readString(path))
  }
  return 165000000 // Starting block number on Arbitrum
}

async function getCurrentBlock() {
  const req = new Request(RPC_ENDPOINT)
  req.method = "POST"
  req.headers = { "Content-Type": "application/json" }
  req.body = JSON.stringify({
    jsonrpc: "2.0",
    method: "eth_blockNumber",
    params: [],
    id: 1
  })

  try {
    const response = await req.loadJSON()
    return parseInt(response.result, 16)
  } catch (error) {
    console.error("Error getting current block:", error)
    return null
  }
}

async function saveLastScannedBlock(blockNumber) {
  const fm = FileManager.local()
  const path = fm.joinPath(fm.documentsDirectory(), LAST_BLOCK_FILE)
  fm.writeString(path, blockNumber.toString())
}

// Transaction and PPS tracking
async function getContractEvents(fromBlock, toBlock) {
  const req = new Request(RPC_ENDPOINT)
  req.method = "POST"
  req.headers = { "Content-Type": "application/json" }
  
  req.body = JSON.stringify({
    jsonrpc: "2.0",
    method: "eth_getLogs",
    params: [{
      fromBlock: `0x${fromBlock.toString(16)}`,
      toBlock: `0x${toBlock.toString(16)}`,
      address: CONTRACT_ADDRESS,
      topics: [
        null,
        `0x000000000000000000000000${WALLET_ADDRESS.slice(2).toLowerCase()}`
      ]
    }],
    id: 1
  })

  try {
    const response = await req.loadJSON()
    if (response.error) {
      console.error("RPC Error:", response.error)
      return []
    }
    
    return response.result.map(log => {
      const isDeposit = log.topics[0].toLowerCase() === DEPOSIT_EVENT.toLowerCase()
      const data = log.data.slice(2)
      
      const assetsHex = data.slice(0, 64)
      const sharesHex = data.slice(64, 128)
      
      const assets = BigInt("0x" + assetsHex)
      const shares = BigInt("0x" + sharesHex)
      
      const ethAmount = Number(assets) / 1e18
      const sharesAmount = Number(shares) / 1e18
      const pps = ethAmount / sharesAmount
      
      return {
        type: isDeposit ? 'deposit' : 'withdraw',
        amount: ethAmount,
        shares: sharesAmount,
        pps: pps,
        blockNumber: parseInt(log.blockNumber, 16),
        transactionHash: log.transactionHash
      }
    })
  } catch (error) {
    console.error("Error fetching events:", error)
    return []
  }
}

function saveTransactions(newTransactions) {
  const fm = FileManager.local()
  const path = fm.joinPath(fm.documentsDirectory(), TRANSACTIONS_FILE)
  
  let transactions = []
  if (fm.fileExists(path)) {
    try {
      transactions = JSON.parse(fm.readString(path))
    } catch (e) {
      console.error("Error reading transactions:", e)
    }
  }
  
  transactions.push(...newTransactions)
  fm.writeString(path, JSON.stringify(transactions))
}

async function calculateProfit(currentBalance) {
  const fm = FileManager.local()
  const path = fm.joinPath(fm.documentsDirectory(), TRANSACTIONS_FILE)
  
  if (!fm.fileExists(path)) return 0
  
  try {
    const transactions = JSON.parse(fm.readString(path))
    let depositValue = 0
    let currentShares = 0
    
    transactions.forEach(tx => {
      if (tx.type === 'deposit') {
        depositValue += tx.amount
        currentShares += tx.shares
      } else {
        currentShares -= tx.shares
        depositValue -= (tx.amount)
      }
    })
    
    return currentBalance - depositValue
    
  } catch (e) {
    console.error("Error calculating profit:", e)
    return 0
  }
}

async function scanNewTransactions() {
  const lastBlock = await getLastScannedBlock()
  const currentBlock = await getCurrentBlock()
  
  if (!currentBlock) return
  
  const transactions = await getContractEvents(lastBlock, currentBlock)
  
  if (transactions.length > 0) {
    saveTransactions(transactions)
  }
  
  await saveLastScannedBlock(currentBlock)
}

// Balance functions
async function getBalance() {
  const req = new Request(RPC_ENDPOINT)
  req.method = "POST"
  req.headers = { "Content-Type": "application/json" }
  req.body = JSON.stringify({
    jsonrpc: "2.0",
    method: "eth_call",
    params: [{
      to: CONTRACT_ADDRESS,
      data: `0x70a08231000000000000000000000000${WALLET_ADDRESS.slice(2)}`
    }, "latest"],
    id: 1
  })

  try {
    const response = await req.loadJSON()
    if (response.error) {
      console.error("RPC Error:", response.error)
      return "Error"
    }
    const balance = parseInt(response.result, 16)
    const stakingBalance = await getStakingBalance()
    return ((balance + stakingBalance) / 1e18).toFixed(4)
  } catch (error) {
    console.error("Error fetching balance:", error)
    return "Error"
  }
}

async function getStakingBalance() {
  const req = new Request(RPC_ENDPOINT)
  req.method = "POST"
  req.headers = { "Content-Type": "application/json" }
  req.body = JSON.stringify({
    jsonrpc: "2.0",
    method: "eth_call",
    params: [{
      to: STAKING_CONTRACT,
      data: `0x70a08231000000000000000000000000${WALLET_ADDRESS.slice(2)}`
    }, "latest"],
    id: 1
  })

  try {
    const response = await req.loadJSON()
    if (response.error) return 0
    return parseInt(response.result, 16)
  } catch (error) {
    console.error("Error fetching staking balance:", error)
    return 0
  }
}

// Time tracking
function saveLastRefreshTime() {
  const fm = FileManager.local()
  const path = fm.joinPath(fm.documentsDirectory(), LAST_REFRESH_FILE)
  fm.writeString(path, new Date().toISOString())
}

function getLastRefreshTime() {
  const fm = FileManager.local()
  const path = fm.joinPath(fm.documentsDirectory(), LAST_REFRESH_FILE)
  if (fm.fileExists(path)) {
    const dateString = fm.readString(path)
    return new Date(dateString)
  }
  return null
}

function getTimestamp() {
  const lastRefreshTime = getLastRefreshTime()
  if (!lastRefreshTime) return "N/A"
  
  const now = new Date()
  const diff = Math.floor((now - lastRefreshTime) / 1000 / 60)
  return diff < 1 ? "now" : `${diff}m ago`
}

// Image loading
async function loadImage() {
  try {
    return await new Request(LOGO_URL).loadImage()
  } catch (error) {
    console.error("Error loading image:", error)
    return null
  }
}

// Widget creation
async function createWidget() {
  await scanNewTransactions()
  
  const widget = new ListWidget()
  createGradientContext(widget)
  
  // Logo
  const topStack = widget.addStack()
  topStack.layoutHorizontally()
  topStack.centerAlignContent()
  topStack.addSpacer()
  
  const imageSize = new Size(120, 60)
  const image = await loadImage()
  if (image) {
    const imageElement = topStack.addImage(image)
    imageElement.imageSize = imageSize
    imageElement.centerAlignImage()
  }
  
  topStack.addSpacer()
  
  // Balance
  widget.addSpacer(4)
  const balanceStack = widget.addStack()
  balanceStack.layoutHorizontally()
  balanceStack.spacing = 4
  
  const balance = await getBalance()
  const balanceText = balanceStack.addText(balance)
  balanceText.textColor = TEXT_COLOR
  balanceText.font = getFont(20, "bold")
  
  const ethText = balanceStack.addText("ETH")
  ethText.textColor = ACCENT_COLOR
  ethText.font = getFont(20, "bold")
  
  // Profit display
  widget.addSpacer(4)
  const profitStack = widget.addStack()
  profitStack.layoutHorizontally()
  
  const profit = await calculateProfit(parseFloat(balance))
  
  if (!isNaN(profit)) {
    const prefix = profit > 0 ? "+" : ""
    const profitText = profitStack.addText(`${prefix}${profit.toFixed(4)} ETH`)
    profitText.textColor = profit >= 0 ? ACCENT_COLOR : new Color("#FF5252")
    profitText.font = getFont(12, "regular")
  }
  
  // Timestamp
  widget.addSpacer(4)
  const timestampText = widget.addText(getTimestamp())
  timestampText.textColor = TEXT_COLOR
  timestampText.font = getFont(10, "regular")
  
  return widget
}

// Debug function
async function debugAll() {
  console.log("\n=== Debug Info ===")
  
  const fm = FileManager.local()
  const txPath = fm.joinPath(fm.documentsDirectory(), TRANSACTIONS_FILE)
  
  if (fm.fileExists(txPath)) {
    const transactions = JSON.parse(fm.readString(txPath))
    console.log("\nStored Transactions:")
    transactions.forEach(tx => {
      console.log(`${tx.type}: ${tx.amount} ETH (PPS: ${tx.pps})`)
    })
    
    const balance = await getBalance()
    console.log("\nCurrent Balance:", balance)
    
    const profit = await calculateProfit(parseFloat(balance))
    console.log("Calculated Profit:", profit)
  } else {
    console.log("No transaction history found")
  }
}

// Main execution
async function main() {
  const widget = await createWidget()
  
  if (config.runsInWidget) {
    Script.setWidget(widget)
  } else {
    widget.presentSmall()
    await debugAll()
  }
  
  saveLastRefreshTime()
}

await main()
Script.complete()
