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

    agent.subscribe(6, returnData => {
        console.log(`===== Current Market Data [BTC] =====\n`, returnData);
    });
})
</pre>
