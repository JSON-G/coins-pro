# coins-pro

coins-pro is an API wrapper for Coins Pro (https://exchange.coins.asia) written in NodeJS

API Documentation: https://exchange.coins.asia/assets/docs/Coins-Pro-API.pdf

Installation:

<pre>
npm i coins-pro
</pre>

Sample Usage:

<pre>
let agent = require("coins-pro");

agent.start({
    "APIKey": "your_api_key",
    "secret": "your_secret",
    "UserId": "your_user_id",
    "AccountId": "your_account_id"
}, (returnData) => {
    console.log(`===== Client Authenticated =====\n`, returnData)

    setInterval(() => {
        agent.ping((returnData) => {
            console.log(`===== PING =====\n`, returnData);
        });
    }, 40000);

    // subscribe to BTC market data
    agent.subscribe(6, returnData => {
        console.log(`===== Current Market Data [BTC] =====\n`, returnData);
    });

    // send sell (Side: 1) order for BTCPHP (InstrumentId: 6)
    agent.sendOrder({
        InstrumentId: 6,
        Quantity: 0.00001743,
        Side: 1 // 0 (buy) or 1 (sell)
    }, (res) => {
        console.log(`===== Sell Order =====\n`, res);
    })
})
</pre>
