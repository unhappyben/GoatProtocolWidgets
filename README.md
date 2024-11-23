# Goat FI Yield Chasing Silo ETH Strategy
An iOS widget that tracks your YCSETH strategy performance including balance, profits, and transaction history on Arbitrum.

# Requirements
- Download Scriptable from the iOS App Store
- Arbitrum wallet address with strategy deposits

# Features
- Real-time ETH balance tracking
- Profit/loss calculation
- Transaction history monitoring
- Automatic balance updates

# Widget Display
![YCSETH](https://github.com/user-attachments/assets/36455067-58c8-4282-bc23-ec5a7a46b7b3)

- Current ETH balance
- Profit/loss indicator (green for profit, red for loss)
- Last refresh timestamp

# Setup Instructions
1. Install Scriptable from the iOS App Store
2. Create a new script in Scriptable
3. Copy the script code
4. Update the following constants with your information:

      ```javascriptCopyconst WALLET_ADDRESS = ""```
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
