# coins-pro

[![Version npm](https://img.shields.io/badge/npm-v1.0.0-blue?logo=npm)](https://www.npmjs.com/package/coins-pro)

coins-pro is an API wrapper for Coins Pro (https://exchange.coins.asia) written in NodeJS

API Documentation: https://exchange.coins.asia/assets/docs/Coins-Pro-API.pdf

Installation:

<pre>
npm i coins-pro
</pre>

Sample Usage:

<pre>
let CoinsProAPI = require("coins-pro");

let agent = new CoinsProAPI();

agent.start({
    "APIKey": "your_api_key",
    "secret": "your_secret",
    "UserId": "your_user_id",
    "AccountId": "your_account_id"
}, (response) => {
    console.log(`===== Client Authenticated =====\n`, response);

    // Ping is used to keep the Websocket connection alive.
    setInterval(() => {
        agent.ping((response) => {
            console.log(`===== PING =====\n`, response);
        });
    }, 40000);

    // Retrieves list of Positions (Balances).
    agent.getAccountPositions((response) => {
        console.log(`===== Account Positions =====\n`, response)
    });

    // Send buy (Side: 0) order for BTCPHP (InstrumentId: 6) 
    // amounting to 0.00002000 Bitcoins (Quantity: 0.00002000).
    agent.sendOrder({
        InstrumentId: 6,
        Quantity: 0.00002000,
        Side: 0 // 0 (buy) or 1 (sell)
    }, (response) => {
        console.log(`===== Send Order =====\n`, response);
    });

    // Retrieves the latest Level 1 Ticker information and Subscribes the user to Level 1 Market Data
    // updates for the specified Instrument. After subscribing, the user will receive periodic
    // Level1UpdateEvent event information until they call UnsubscribeLevel1.
    agent.subscribeLevel1(6, (response) => { 
        console.log(`===== Current Market Data Lv1 [BTC] =====\n`, response) 
    });
});
</pre>
