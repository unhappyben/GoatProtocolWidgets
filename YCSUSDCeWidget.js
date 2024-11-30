
const WALLET_ADDRESS = "0x6833df4E1edB361A04491349833c83A4868ABCdA"
const CONTRACT_ADDRESS = "0x8a1eF3066553275829d1c0F64EE8D5871D5ce9d3"
const STAKING_CONTRACT = ""
const RPC_ENDPOINT = "https://arb1.arbitrum.io/rpc"
const TEXT_COLOR = new Color("#FFFFFF")
const LOGO_URL = "https://i.ibb.co/bB6G6gN/GOAT-Protocol-logo-white-2.png"
const LAST_REFRESH_FILE = "lastRefreshTime_usdce.txt"
const LAST_BLOCK_FILE = "lastBlockScanned_usdce.txt"
const TRANSACTIONS_FILE = "strategyTransactions_usdce.json"
const ACCENT_COLOR = new Color("#C678E5")

// Event signatures
const DEPOSIT_EVENT = "0xdcbc1c05240f31ff3ad067ef1ee35ce4997762752e3a095284754544f4c709d7"
const WITHDRAW_EVENT = "0xfbde797d201c681b91056529119e0b02407c7bb96a4a2c75c01fc9667232c8db"

async function initializeFiles() {
    const fm = FileManager.local()
    
    // Initialize transactions file
    const txPath = fm.joinPath(fm.documentsDirectory(), TRANSACTIONS_FILE)
    if (!fm.fileExists(txPath)) {
        fm.writeString(txPath, JSON.stringify([]))
        console.log("Created new transactions file")
    }
    
    // Set correct starting block
    const blockPath = fm.joinPath(fm.documentsDirectory(), LAST_BLOCK_FILE)
    const startBlock = "267480446"  // First block when strategy was available
    fm.writeString(blockPath, startBlock)
    console.log("Set starting block to:", startBlock)
}

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
                [DEPOSIT_EVENT, WITHDRAW_EVENT],  // Listen for both events
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
        
        return response.result.map(log => ({
            type: log.topics[0].toLowerCase() === DEPOSIT_EVENT.toLowerCase() ? 'deposit' : 'withdraw',
            amount: Number(BigInt("0x" + log.data.slice(2, 66))) / 1e6,
            blockNumber: parseInt(log.blockNumber, 16),
            transactionHash: log.transactionHash
        }))
    } catch (error) {
        console.error("Error fetching events:", error)
        return []
    }
}

function saveTransactions(newTransactions) {
    const fm = FileManager.local()
    const path = fm.joinPath(fm.documentsDirectory(), TRANSACTIONS_FILE)
    let existingTransactions = []
    
    if (fm.fileExists(path)) {
        existingTransactions = JSON.parse(fm.readString(path))
    }
    
    // Create a Set of existing transaction hashes
    const existingTxHashes = new Set(
        existingTransactions.map(tx => tx.transactionHash)
    )
    
    // Only add transactions we haven't seen before
    const uniqueNewTransactions = newTransactions.filter(tx => 
        !existingTxHashes.has(tx.transactionHash)
    )
    
    existingTransactions.push(...uniqueNewTransactions)
    fm.writeString(path, JSON.stringify(existingTransactions))
}



async function calculateProfit(currentBalance) {
    const fm = FileManager.local();
    const path = fm.joinPath(fm.documentsDirectory(), TRANSACTIONS_FILE);
    if (!fm.fileExists(path)) return 0;
    
    try {
        const transactions = JSON.parse(fm.readString(path));
        let totalDeposited = 0;
        let totalWithdrawn = 0;
        
        transactions.forEach(tx => {
            if (tx.type === 'deposit') {
                totalDeposited += tx.amount;
            } else if (tx.type === 'withdraw') {
                totalWithdrawn += tx.amount;
            }
        });
        
        const netDeposits = totalDeposited - totalWithdrawn;
        return currentBalance - netDeposits;
    } catch (e) {
        console.error("Error calculating profit:", e);
        return 0;
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
async function getPricePerShare() {
    const req = new Request(RPC_ENDPOINT)
    req.method = "POST"
    req.headers = { "Content-Type": "application/json" }
    req.body = JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_call",
        params: [{
            to: CONTRACT_ADDRESS,
            data: "0x99530b06"  // pricePerShare() function signature
        }, "latest"],
        id: 1
    })
    
    try {
        const response = await req.loadJSON()
        if (response.error) return 1
        return parseInt(response.result, 16) / 1e18
    } catch (error) {
        return 1
    }
}

function formatDisplayBalance(value) {
    if (value >= 1000000) {
        return (value / 1000000).toFixed(2) + 'M';
    } else if (value >= 1000) {
        return (value / 1000).toFixed(2) + 'K';
    }
    return value.toFixed(2);
}

async function getBalance() {
    const shares = await getShares()
    const pps = await getPricePerShare()
    const usdceValue = (shares * pps)
    return usdceValue
}

async function getShares() {
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
        if (response.error) return 0
        return parseInt(response.result, 16) / 1e6
    } catch (error) {
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
  
  const balance = await getBalance();
    const balanceText = balanceStack.addText(formatDisplayBalance(balance));
    balanceText.textColor = TEXT_COLOR;
    balanceText.font = getFont(16, "bold");
  
  const crvUSDtext = balanceStack.addText("USDCe")
  crvUSDtext.textColor = ACCENT_COLOR
  crvUSDtext.font = getFont(15, "bold")
  
  // Profit display
  widget.addSpacer(4)
  const profitStack = widget.addStack()
  profitStack.layoutHorizontally()
  
  const profit = await calculateProfit(parseFloat(balance))
  
  if (!isNaN(profit)) {
    const prefix = profit > 0 ? "+" : ""
    const profitText = profitStack.addText(`${prefix}${profit.toFixed(2)} USDCe`)
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
        let totalDeposited = 0
        let totalWithdrawn = 0
        
        console.log("\nTransaction History:")
        transactions.forEach(tx => {
            console.log(`${tx.type}: ${tx.amount} ETH`)
            if (tx.type === 'deposit') totalDeposited += tx.amount
            if (tx.type === 'withdraw') totalWithdrawn += tx.amount
        })
        
        console.log("\nTotal Deposited:", totalDeposited)
        console.log("Total Withdrawn:", totalWithdrawn)
        console.log("Net Deposits:", totalDeposited - totalWithdrawn)
        
        const balance = await getBalance()
        console.log("Current Balance:", balance)
        const profit = await calculateProfit(parseFloat(balance))
        console.log("Calculated Profit:", profit)
    }
}

async function detailedDebug() {
    const shares = await getShares()
    const pps = await getPricePerShare()
    const balance = await getBalance()
    console.log({
        shares,
        pricePerShare: pps,
        rawBalance: shares * pps,
        formattedBalance: balance
    })
    
    const fm = FileManager.local()
    const txPath = fm.joinPath(fm.documentsDirectory(), TRANSACTIONS_FILE)
    const transactions = JSON.parse(fm.readString(txPath))
    console.log("Raw transactions:", transactions)
}



async function verifyEvents() {
    const lastBlock = await getLastScannedBlock()
    const currentBlock = await getCurrentBlock()
    console.log(`Scanning blocks ${lastBlock} to ${currentBlock}`)
    
    const events = await getContractEvents(lastBlock, currentBlock)
    console.log(`Found ${events.length} events:`)
    events.forEach(event => {
        console.log(`${event.type}: ${event.amount} crvUSD (tx: ${event.transactionHash})`)
    })
}




// Main execution
async function main() {
    const widget = await createWidget()
    if (config.runsInWidget) {
        Script.setWidget(widget)
    } else {
        widget.presentSmall()
        await debugAll()
        await detailedDebug() // Add this line
        await verifyEvents()
    }
    saveLastRefreshTime()
}


await initializeFiles()
await main()
Script.complete()
