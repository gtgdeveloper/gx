# AKIO Burn Script (Render Ready)

This repository contains the automated AKIO burn script for Render Cron Jobs.

## Files

- **burn1.cjs** — main burn script
- **package.json** — Render will use this to install deps

## How to use on Render

1. Push this folder to GitHub.
2. In Render → New → Cron Job:
   - **Build Command:** `npm install`
   - **Start Command:** `node burn1.cjs`
   - **Schedule:** `0 * * * *` (every hour)
3. Add ENV variables (Render → Environment):

```
BURNER_KEY=[...]
RPC_URL=https://api.mainnet-beta.solana.com
TOKEN_MINT=Akiox1GAxohWdggSLaFpChxLyS54vz7P7YaF1tckWEQu
BURN_AMOUNT=1000
TOKEN_DECIMALS=6
TOKEN_PROGRAM=TOKEN
TG_BOT_TOKEN=XXXXXXXX
TG_CHAT_ID=XXXXXXXX
```

4. Deploy.
5. Script will burn hourly and send TG updates.
