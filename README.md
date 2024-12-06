# Goat FI Yield Chasing Strategy Widgets
An iOS widget that tracks your ETH, crvUSD or USDCe yield chasing strategy performance including balance, profits, and transaction history on Arbitrum.

# Requirements
- Download Scriptable from the iOS App Store
- Arbitrum wallet address with strategy deposits

# Features
- Real-time balance tracking
- Profit/loss calculation
- Transaction history monitoring
- Automatic balance updates

# Widget Display
![YCSETH](https://i.ibb.co/Jjqswmy/IMG-3450.jpg)
![YCScrvUSD](https://i.ibb.co/7XvLdfn/IMG-3448.jpg)
![YCSUSDCe](https://i.ibb.co/yWSjtBF/IMG-3449.jpg)

- Current  balance
- Profit/loss indicator
- Last refresh timestamp

# Setup Instructions
1. Install Scriptable from the iOS App Store
2. Create a new script in Scriptable
3. Copy the script code
4. Update the following constants with your information:

      ```const WALLET_ADDRESS = ""```
5. Add the widget to your home screen:

      - Long press your home screen
      - Tap the + button
      - Search for "Scriptable"
      - Choose the widget size (small recommended)
      - Select your script

# Technical Details
- Uses Arbitrum RPC for blockchain interactions
- Tracks deposits and withdrawals via event logs
- Calculates profits based on transaction history
- Supports both strategy and staking contract balances
- Automatically updates last scanned block
- Stores transaction history locally
