# coins-pro

[![Version npm](https://img.shields.io/badge/npm-v1.1.2-blue?logo=npm)](https://www.npmjs.com/package/coins-pro)

coins-pro is an API wrapper for Coins Pro [https://exchange.coins.asia](https://exchange.coins.asia) written in NodeJS

API Documentation: https://exchange.coins.asia/assets/docs/Coins-Pro-API.pdf

## Table of Contents

- [Installation](#installation)
- [Getting Started](#getting-started)
- [CoinsProAPI Methods](#coinsproapi-methods)
  - [Unauthenticated Endpoints](#unauthenticated-endpoints)
    - [getProducts](#getproducts)
    - [getInstruments](#getinstruments)
  - [API Keys](#api-keys)
    - [getUserAPIKeys](#getuserapikeys)
    - [addUserAPIKey](#adduserapikey)
    - [removeUserAPIKey](#removeuserapikey)
  - [User Account](#user-account)
    - [getUserAccounts](#getuseraccounts)
    - [getAccountTransactions](#getaccounttransactions)
    - [getAccountPositions](#getaccountpositions)
    - [getAccountTrades](#getaccounttrades)
  - [Orders](#orders)
    - [sendOrder](#sendorder)
    - [cancelOrder](#cancelorder)
    - [getOrderStatus](#getorderstatus)
    - [getOrderFee](#getorderfee)
    - [getOrderHistory](#getorderhistory)
    - [getOpenOrders](#getopenorders)
  - [Deposits](#deposits)
    - [getDepositTickets](#getdeposittickets)
  - [Withdrawals](#withdrawals)
    - [createWithdrawTicket](#createwithdrawticket)
    - [getWithdrawTicket](#getwithdrawticket)
    - [getWithdrawTickets](#getwithdrawtickets)
  - [Market Data](#market-data)
    - [subscribeLevel1](#subscribelevel1)
    - [unsubscribeLevel1](#unsubscribelevel1)
    - [subscribeLevel2](#subscribelevel2)
    - [unsubscribeLevel2](#unsubscribelevel2)
    - [subscribeTrades](#subscribetrades)
    - [unsubscribeTrades](#unsubscribetrades)
  - [Account Events](#account-events)
    - [subscribeAccountEvents](#subscribeaccountevents)
  - [Ping](#ping)
- [FAQ](#faq)
  - [How to Get API Key and Secret](#how-to-get-api-key-and-secret)
  - [How to Get UserId?](#how-to-get-userid)
- [License](#license)

## Installation

<pre>
npm i coins-pro
</pre>

## Getting Started

```javascript

// Firstly, import the CoinsProAPI class from the library.
const CoinsProAPI = require("coins-pro");

// Secondly, instantiate the CoinsProAPI class.
let agent = new CoinsProAPI();

// Thirdly, invoke the method start and pass an object which contains
// your APIKey, secret, and UserId for the first parameter.
// The second second parameter accepts a callback function which will
// execute after you are successfully authenticated and
// connected to the Coins Pro websocket server.
agent.start({
  "APIKey": "your_api_key",
  "secret": "your_secret",
  "UserId": "your_user_id"
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

  // Subscribe to BTC market data.
  agent.subscribeLevel1(6, (response) => { 
      console.log(`===== Current Market Data Lv1 [BTC] =====\n`, response) 
  });
});
```

## CoinsProAPI Methods

After successfully authenticating & connecting to the Coins Pro websocket by using the method start as described in the [Getting Started](#getting-started) section, you can now send messages to the websocket server (take note some methods do not require authentication such as <code>getProducts</code> and <code>getInstruments</code>). 
  
All of the methods accepts various arguments depending on what data is required in sending the websocket message, but all of them accepts a callback function which has 1 parameter. This parameter contains the message that Coins Pro has sent in response to your message pertaining to the specific method which was invoked to send the websocket message. So for example, if you invoke <code>getProducts</code>, Coins Pro will send you the list of Products available and this data will be accessible through the aforementioned parameter of the callback function.

### Unauthenticated Endpoints 

#### getProducts
<p>Requests a list of available Products from the API.</p>
<p><span>CoinsProAPI.getProducts(callback?: Function)</span></p>
<table>
  <tr>
    <td>callback</td>
    <td>Function to be executed when the server responds to your request</td>
  </tr>
</table>

```javascript
agent.getProducts((response) => { 
  console.log(`===== Get Products =====\n`, response) 
});
```

#### getInstruments
<p>Requests a list of available instruments from the API.</p>
<p><span>CoinsProAPI.getInstruments(callback?: Function)</span></p>
<table>
  <tr>
    <td>callback</td>
    <td>Function to be executed when the server responds to your request</td>
  </tr>
</table>

```javascript
agent.getInstruments((response) => { 
  console.log(`===== Get Instruments =====\n`, response) 
});
```

### API Keys 

#### getUserAPIKeys
<p>The endpoint will return existing APIKeys with assigned permissions. APISecret field will not be returned.</p>
<p><span>CoinsProAPI.getUserAPIKeys(callback?: Function)</span></p>
<table>
  <tr>
    <td>callback</td>
    <td>Function to be executed when the server responds to your request</td>
  </tr>
</table>

```javascript
agent.getUserAPIKeys((response) => {
  console.log(`===== Get APIKey =====\n`, response);
});
```

#### addUserAPIKey
<p>In order to authenticate using an API key, you will need to create an ApiKey and ApiSecret
using this endpoint. Your UserId will be needed along with the permissions you wish to
enable in payload.</p>

<p>The endpoint will return a UserAPIKey class type json string containing the APIKey and
APISecret.</p>

<p>Note: Please save the APIKey and APISecret values returned in a secure location. Both of
these values are needed for authentication and signature generation.</p>
<p><span>CoinsProAPI.addUserAPIKey(permissions: string[], callback?: Function)</span></p>
<table>
  <tr>
    <td>permissions</td>
    <td>Possible values for permissions: ["Deposit", "Withdraw", "Trading"]</td>
  </tr>
  <tr>
    <td>callback</td>
    <td>Function to be executed when the server responds to your request</td>
  </tr>
</table>

```javascript
agent.addUserAPIKey(["Deposit", "Withdraw"], (response) => {
  console.log(`===== Add APIKey =====\n`, response);
});
```

#### removeUserAPIKey
<p>Removes API Key from the user's account.</p>
<p><span>CoinsProAPI.removeUserAPIKey(ApiKey: string, callback?: Function)</span></p>
<table>
  <tr>
    <td>ApiKey</td>
    <td>API Key to be removed from the account</td>
  </tr>
  <tr>
    <td>callback</td>
    <td>Function to be executed when the server responds to your request</td>
  </tr>
</table>

```javascript
agent.removeUserAPIKey("a841099374d1fb6162553075b1f8065b", (response) => {
  console.log(`===== Remove APIKey =====\n`, response);
});
```

### User Account 

#### getUserAccounts
<p>Retrieves a list of account IDs for the current user. The Request should have an empty string
as the payload. Typically, each user is assigned one account</p>
<p><span>CoinsProAPI.getUserAccounts(callback?: Function)</span></p>
<table>
  <tr>
    <td>callback</td>
    <td>Function to be executed when the server responds to your request</td>
  </tr>
</table>

```javascript
agent.getUserAccounts((response) => {
  console.log(`===== User Accounts =====\n`, response);
});
```

#### getAccountTransactions
<p>Retrieves a list of recent transactions from your account.</p>
<p><span>
CoinsProAPI.getAccountTransactions({ StartIndex, Count }: {<br>
&nbsp;&nbsp;StartIndex: number;<br>
&nbsp;&nbsp;Count: number;<br>
}, callback?: Function)
</span></p>
<table>
  <tr>
    <td>StartIndex</td>
    <td>Index of when to start counting from</td>
  </tr>
  <tr>
    <td>Count</td>
    <td>Number of transactions API should retrieve with StartIndex as the starting index</td>
  </tr>
  <tr>
    <td>callback</td>
    <td>Function to be executed when the server responds to your request</td>
  </tr>
</table>

```javascript
agent.getAccountTransactions({
  StartIndex: 0,
  Count: 5
}, (response) => {
  console.log(`===== Account Transactions =====\n`, response);
});
```

#### getAccountPositions
<p>Retrieves a list of Positions(Balances) on a specific account.</p>
<p><span>CoinsProAPI.getAccountPositions(callback?: Function)</span></p>
<table>
  <tr>
    <td>callback</td>
    <td>Function to be executed when the server responds to your request</td>
  </tr>
</table>

```javascript
agent.getAccountPositions((response) => {
  console.log(`===== Account Positions =====\n`, response);
});
```

#### getAccountTrades
<p>Retrieves Trade History for a specific account.</p>
<p><span>
CoinsProAPI.getAccountTrades({ StartIndex, Count }: {<br>
&nbsp;&nbsp;StartIndex: number;<br>
&nbsp;&nbsp;Count: number;<br>
}, callback?: Function)
</span></p>
<table>
  <tr>
    <td>StartIndex</td>
    <td>Index of when to start counting from</td>
  </tr>
  <tr>
    <td>Count</td>
    <td>Number of trades the API should retrieve with StartIndex as the starting index</td>
  </tr>
  <tr>
    <td>callback</td>
    <td>Function to be executed when the server responds to your request</td>
  </tr>
</table>

```javascript
agent.getAccountTrades({
  StartIndex: 0,
  Count: 5
}, (response) => {
  console.log(`===== Account Trades =====\n`, response);
});
```

### Orders 

#### sendOrder
<p>Sends a new order through the API. It is important that you are subscribed to Account Actions
(SubscribeAccountEvents) in order to receive updated status events for entered orders.
Alternatively, you can also call GetOpenOrders and/or GetOrderHistory to check order status.</p>
<p><span>
CoinsProAPI.sendOrder(obj?: {<br>
&nbsp;&nbsp;InstrumentId: number;<br>
&nbsp;&nbsp;Quantity: number;<br>
&nbsp;&nbsp;Side: number;<br>
&nbsp;&nbsp;OrderType: number;<br>
&nbsp;&nbsp;ClientOrderId: number;<br>
&nbsp;&nbsp;DisplayQuantity: number;<br>
&nbsp;&nbsp;UseDisplayQuantity: boolean;<br>
&nbsp;&nbsp;TimeInForce: number;<br>
&nbsp;&nbsp;LimitPrice: number;<br>
&nbsp;&nbsp;LimitOffset: number;<br>
&nbsp;&nbsp;OrderIdOCO: number;<br>
&nbsp;&nbsp;PegPriceType: number;<br>
&nbsp;&nbsp;TrailingAmount: number;<br>
&nbsp;&nbsp;StopPrice: number;<br>
}, callback?: Function)
</span></p>
<table>
  <tr>
    <td>InstrumentId</td>
    <td>For example InstrumentId 6 is BTCPHP which means buy/sell X Quantity of BTC in exchange for PHP</td>
  </tr>
  <tr>
    <td>Quantity</td>
    <td>amount to buy/sell. for example, as of this writing: 10 pesos = 0.00001740 BTC. Therefore, if you wanted to buy/sell 10 pesos worth of BTC, pass 0.00001740 as Quantity</td>
  </tr>
  <tr>
    <td>Side</td>
    <td>0 (Buy) or 1 (Sell)</td>
  </tr>
  <tr>
    <td>OrderType</td>
    <td>The type of order. 1 (Market) or 2 (Limit) or 3 (StopMarket)</td>
  </tr>
  <tr>
    <td>ClientOrderId</td>
    <td>Set this to your own id if you wish to use one. It will be useful for recognizing future order states related to this call. [64 bit Integer]</td>
  </tr>
  <tr>
    <td>DisplayQuantity</td>
    <td>Quantity of an order to display publicly on the order book. If you have an order for 1,000 and you want the order book to reflect a quantity of only 100 at any one time, set this to 100. This functionality can only be used for limit orders. Set to 0 to display all. [Decimal]</td>
  </tr>
  <tr>
    <td>UseDisplayQuantity</td>
    <td>[Boolean] If you enter a Limit order with a reserve, you must set UseDisplayQuantity to true.</td>
  </tr>
  <tr>
    <td>TimeInForce</td>
    <td>1 (Good until Canceled) or 3 (Immediate or Cancel) or 4 (Fill or Kill)</td>
  </tr>
  <tr>
    <td>LimitPrice</td>
    <td>The limit price for this order. [Decimal]</td>
  </tr>
  <tr>
    <td>LimitOffset</td>
    <td>When entering a Trailing Limit order, this specifies the distance from activation price to your limit order price. [Decimal]</td>
  </tr>
  <tr>
    <td>OrderIdOCO</td>
    <td>If you would like to have this order cancel another on execution, set this field to the other order's server order id. Omit or set to 0 if no OCO is required. [64 Bit Integer]</td>
  </tr>
  <tr>
    <td>PegPriceType</td>
    <td>When entering a Stop/Trailing order, set this to the type of price you would like to peg the Stop to. [Integer] 1 (Last) or 2 (Bid) or 3 (Ask)</td>
  </tr>
  <tr>
    <td>TrailingAmount</td>
    <td>When entering a Trailing order, set this to the quantity required, which the trigger price will trail the market by. [Decimal]</td>
  </tr>
  <tr>
    <td>StopPrice</td>
    <td>The Stop Price for this order, if it is a stop order. Otherwise you may omit this field. [Decimal]</td>
  </tr>
  <tr>
    <td>callback</td>
    <td>Function to be executed when the server responds to your request</td>
  </tr>
</table>

```javascript
agent.sendOrder({
  InstrumentId: 6,
  Quantity: 0.00002000,
  Side: 0
}, (response) => {
  console.log(`===== Send Order =====\n`, response);
})
```

#### cancelOrder
<p>Cancels an open order, by either specifying the OrderId returned when the order was created, or by specifying both the ClientOrderId and AccountId of the order. If AccountId is not specified, the default user account will be used.</p>
<p><span>CoinsProAPI.cancelOrder(OrderId: any, callback?: Function)</span></p>
<table>
  <tr>
    <td>OrderId</td>
    <td>Order ID of the order to be cancelled</td>
  </tr>
  <tr>
    <td>callback</td>
    <td>Function to be executed when the server responds to your request</td>
  </tr>
</table>

```javascript
agent.cancelOrder(17509100, (response) => {
  console.log(`===== Cancel Order =====\n`, response);
});
```

#### getOrderStatus
<p>Gets the current operating status of an order submitted to the Order Management System.</p>
<p><span>CoinsProAPI.getOrderStatus(OrderId: any, callback?: Function)</span></p>
<table>
  <tr>
    <td>OrderId</td>
    <td>Order ID of the order to be cancelled</td>
  </tr>
  <tr>
    <td>callback</td>
    <td>Function to be executed when the server responds to your request</td>
  </tr>
</table>

```javascript
agent.getOrderStatus(17509100, (response) => {
  console.log(`===== Order Status =====\n`, response);
});
```

#### getOrderFee
<p>Returns an estimate of the fee for a specific order and order type.</p>
<p><span>
CoinsProAPI.getOrderFee({ InstrumentId, ProductId, Amount, OrderType, MakerTaker }: {<br>
&nbsp;&nbsp;InstrumentId: number;<br>
&nbsp;&nbsp;ProductId: number;<br>
&nbsp;&nbsp;Amount: number;<br>
&nbsp;&nbsp;OrderType: string<br>
&nbsp;&nbsp;MakerTaker: string;<br>
}, callback?: Function)
</span></p>
<table>
  <tr>
    <td>InstrumentId</td>
    <td>Instrument's Identifier</td>
  </tr>
  <tr>
    <td>ProductId</td>
    <td>Product's Identifier</td>
  </tr>
    <tr>
    <td>Amount</td>
    <td>amount to order in decimal</td>
  </tr>
    <tr>
    <td>OrderType</td>
    <td>"Market", "Limit", or "StopMarket"</td>
  </tr>
    <tr>
    <td>MakerTaker</td>
    <td>Whether the order is expected to execute instantly against existing orders in the order book ("Taker") or rest in the order book as an open order ("Maker")</td>
  </tr>
  <tr>
    <td>callback</td>
    <td>Function to be executed when the server responds to your request</td>
  </tr>
</table>

```javascript
agent.getOrderFee({
  InstrumentId: 6,
  ProductId: 7,
  Amount: 500,
  OrderType: "Market",
  MakerTaker: "Maker"
}, (response) => {
  console.log(`===== Order Fee =====\n`, response);
});
```

#### getOrderHistory
<p>Retrieves a list of the last n=Depth orders placed on your account.</p>
<p><span>CoinsProAPI.getOrderHistory(Depth: number, callback?: Function)</span></p>
<table>
  <tr>
    <td>Depth</td>
    <td>indicate how many records are to be returned</td>
  </tr>
  <tr>
    <td>callback</td>
    <td>Function to be executed when the server responds to your request</td>
  </tr>
</table>

```javascript
agent.getOrderHistory(30, (response) => {
  console.log(`===== Order History =====\n`, response);
});
```

#### getOpenOrders
<p>Retrieves the Open Orders for a specified account of the current user. Keep in mind that if
your order is no longer in a working state, you will not find it using GetOpenOrders.</p>
<p><span>CoinsProAPI.getOpenOrders(callback?: Function)</span></p>
<table>
  <tr>
    <td>callback</td>
    <td>Function to be executed when the server responds to your request</td>
  </tr>
</table>

```javascript
agent.getOpenOrders((response) => {
  console.log(`===== Open Orders =====\n`, response);
});
```

### Deposits 

#### getDepositTickets
<p>Get a list of deposits for an account.</p>
<p><span>
CoinsProAPI.getDepositTickets({ Limit, OperatorId, StartIndex }?: {<br>
&nbsp;&nbsp;Limit: any;<br>
&nbsp;&nbsp;OperatorId?: number;<br>
&nbsp;&nbsp;StartIndex?: number;<br>
}, callback?: Function)
</span></p>
<table>
  <tr>
    <td>Limit</td>
    <td>Number of last deposits to fetch [Integer]</td>
  </tr>
  <tr>
    <td>OperatorId</td>
    <td>Always 1</td>
  </tr>
  <tr>
    <td>StartIndex</td>
    <td>Offset in deposits list [Integer]</td>
  </tr>
  <tr>
    <td>callback</td>
    <td>Function to be executed when the server responds to your request</td>
  </tr>
</table>

```javascript
agent.getDepositTickets({
  Limit: 100
}, (response) => {
  console.log(`===== Deposit Tickets =====\n`, response);
});
```

### Withdrawals 

#### createWithdrawTicket
<p>Creates a withdrawal ticket to send funds from Coins Pro to the user’s Coins.ph wallet</p>
<p><span>
CoinsProAPI.createWithdrawTicket({ ProductId, Amount }: {<br>
&nbsp;&nbsp;ProductId: any;<br>
&nbsp;&nbsp;Amount: any;<br>
}, callback?: Function)
</span></p>
<table>
  <tr>
    <td>ProductId</td>
    <td>ID of the product which will be withdrawn [Integer]</td>
  </tr>
  <tr>
    <td>Amount</td>
    <td>Amount for withdrawal [Decimal]</td>
  </tr>
  <tr>
    <td>callback</td>
    <td>Function to be executed when the server responds to your request</td>
  </tr>
</table>

```javascript
agent.createWithdrawTicket({
  ProductId: 7,
  Amount: 100
}, (response) => {
  console.log(`===== Create Withdraw Ticket =====\n`, response);
});
```

#### getWithdrawTicket
<p>Gets the current operating status of a Withdraw Ticket.</p>
<p><span>
CoinsProAPI.getWithdrawTicket(RequestCode: any, callback?: Function)
</span></p>
<table>
  <tr>
    <td>RequestCode</td>
    <td>Request code of withdrawal, this ID is a
        common reference between Coins.ph and
        Coins Pro APIs and can be used to track
        transactions between the two systems [String]
    </td>
  </tr>
  <tr>
    <td>callback</td>
    <td>Function to be executed when the server responds to your request</td>
  </tr>
</table>

```javascript
agent.getWithdrawTicket("aca9f8d2-229f-4234-b032-69f0fd413e04", (response) => {
  console.log(`===== Withdraw Ticket =====`, response);
});
```

#### getWithdrawTickets
<p>Get a list of withdrawals for an account.</p>
<p><span>
CoinsProAPI.getWithdrawTickets({ Limit, StartIndex, OperatorId }?: <br>
&nbsp;&nbsp;Limit: any;<br>
&nbsp;&nbsp;StartIndex?: number;<br>
&nbsp;&nbsp;OperatorId?: number;<br>
}, callback?: Function)
</span></p>
<table>
  <tr>
    <td>Limit</td>
    <td>Number of last deposits to fetch [Integer]</td>
  </tr>
  <tr>
    <td>StartIndex</td>
    <td>Offset in withdrawals list [Integer]</td>
  </tr>
  <tr>
    <td>OperatorId</td>
    <td>Always 1</td>
  </tr>
  <tr>
    <td>callback</td>
    <td>Function to be executed when the server responds to your request</td>
  </tr>
</table>

```javascript
agent.getWithdrawTickets({
  Limit: 100,
  StartIndex: 0
}, (response) => {
  console.log(`===== Withdraw Tickets =====`, response);
});
```

### Market Data 

#### subscribeLevel1
<p>Retrieves the latest Level 1 Ticker information and Subscribes the user to Level 1 Market Data
updates for the specified Instrument. After subscribing, the user will receive periodic
Level1UpdateEvent event information until they call UnsubscribeLevel1.</p>
<p><span>CoinsProAPI.subscribeLevel1(InstrumentId: any, callback?: Function)</span></p>
<table>
  <tr>
    <td>InstrumentId</td>
    <td>Instrument's Identifier [Integer]</td>
  </tr>
  <tr>
    <td>callback</td>
    <td>Function to be executed when the server responds to your request</td>
  </tr>
</table>

```javascript
agent.subscribeLevel1(6, (response) => {
  console.log(`===== Current Market Data Lv1 [BTC] =====\n`, response);
});
```

#### unsubscribeLevel1
<p>Unsubscribes the user from receiving Level 1 Market Data updates for the specified
Instrument.</p>
<p><span>CoinsProAPI.unsubscribeLevel1(InstrumentId: any, callback?: Function)</span></p>
<table>
  <tr>
    <td>InstrumentId</td>
    <td>Instrument's Identifier [Integer]</td>
  </tr>
  <tr>
    <td>callback</td>
    <td>Function to be executed when the server responds to your request</td>
  </tr>
</table>

```javascript
agent.unsubscribeLevel1(6, (response) => {
  console.log(`===== Unsubscribe Market Data Lv1 [BTC] =====\n`, response);
});
```

#### subscribeLevel2
<p>Retrieves the latest Level 2 Snapshot and Subscribes user to Level 2 Market Data updates for
the specified Instrument.</p>
<p><span>CoinsProAPI.subscribeLevel2({ InstrumentId, Depth }: {<br>
&nbsp;&nbsp;InstrumentId: number;<br>
&nbsp;&nbsp;Depth: number;<br>
}, callback?: Function)</span></p>
<table>
  <tr>
    <td>InstrumentId</td>
    <td>Instrument's Identifier [Integer]</td>
  </tr>
  <tr>
    <td>Depth</td>
    <td>The Depth of the book to subscribe to
        updates for. In this example, you would
        receive 10 price levels on each side of the
        market. [Integer]
    </td>
  </tr>
  <tr>
    <td>callback</td>
    <td>Function to be executed when the server responds to your request</td>
  </tr>
</table>

```javascript
agent.subscribeLevel2({
  InstrumentId: 6,
  Depth: 2
}, (response) => {
  console.log(`===== Current Market Data Lv2 [BTC] =====\n`, response);
});
```

#### unsubscribeLevel2
<p>Unsubscribes from Level 2 Market Data updates for the specified Instrument.</p>
<p><span>CoinsProAPI.unsubscribeLevel2(InstrumentId: any, callback?: Function)</span></p>
<table>
  <tr>
    <td>InstrumentId</td>
    <td>Instrument's Identifier [Integer]</td>
  </tr>
  <tr>
    <td>callback</td>
    <td>Function to be executed when the server responds to your request</td>
  </tr>
</table>

```javascript
agent.unsubscribeLevel2(6, (response) => {
  console.log(`===== Unsubscribe Market Data Lv2 [BTC] =====\n`, response);
});
```

#### subscribeTrades
<p>Retrieves the latest public market trades and Subscribes User to Trade updates for the
specified Instrument.</p>
<p><span>CoinsProAPI.subscribeTrades({ InstrumentId, IncludeLastCount }: {<br>
&nbsp;&nbsp;InstrumentId: number;<br>
&nbsp;&nbsp;IncludeLastCount: number;<br>
}, callback?: Function)</span></p>
<table>
  <tr>
    <td>InstrumentId</td>
    <td>Instrument's Identifier [Integer]</td>
  </tr>
  <tr>
    <td>IncludeLastCount</td>
    <td>Specifies the number of previous trades to retrieve in the immediate snapshot. Default is 100. [Integer]</td>
  </tr>
  <tr>
    <td>callback</td>
    <td>Function to be executed when the server responds to your request</td>
  </tr>
</table>

```javascript
agent.subscribeTrades({
  InstrumentId: 6,
  IncludeLastCount: 2
}, (response) => {
  console.log(`===== Public Trades Market Data [BTC] =====\n`, response);
});
```

#### unsubscribeTrades
<p>Unsubscribes the user from Trades Market Data Feed.</p>
<p><span>CoinsProAPI.unsubscribeTrades(InstrumentId: any, callback?: Function)</span></p>
<table>
  <tr>
    <td>InstrumentId</td>
    <td>Instrument's Identifier [Integer]</td>
  </tr>
  <tr>
    <td>callback</td>
    <td>Function to be executed when the server responds to your request</td>
  </tr>
</table>

```javascript
agent.unsubscribeTrades(6, (response) => {
  console.log(`===== Unsubscribe Public Trades =====\n`, response);
});
```

### Account Events 

#### subscribeAccountEvents
<p>Subscribe to account-level events, such as orders, trades, deposits and withdraws.Coins Pro recommends that you use this subscription to track your order states.</p>
<p><span>CoinsProAPI.subscribeAccountEvents(callback?: Function)</span></p>
<table>
  <tr>
    <td>callback</td>
    <td>Function to be executed when the server responds to your request</td>
  </tr>
</table>

```javascript
agent.subscribeAccountEvents((response) => {
  console.log(`===== Account Event ===== \n`, response);
});
```

### Ping 
<p>Used to keep a connection alive.</p>
<p><span>CoinsProAPI.ping(callback?: Function)</span></p>
<table>
  <tr>
    <td>callback</td>
    <td>Function to be executed when the server responds to your request</td>
  </tr>
</table>

```javascript
setInterval(() => {
  agent.ping((response) => {
    console.log(`===== Ping =====\n`, response);
  });
}, 40000);
```

## FAQ

### How to Get API Key and Secret?
1. Login to the Coins Pro website at [https://exchange.coins.asia/](https://exchange.coins.asia/)
2. Go to [API Key Management](https://exchange.coins.asia/keys). This can also be accessed via the website hamburger menu.
3. From the API Key Management, you can create new API Keys which will generate your API Key & Secret. This webpage also displays your existing API Keys.

### How to Get UserId?
1. Login to the Coins Pro website at [https://exchange.coins.asia/](https://exchange.coins.asia/)
2. Go to [API Key Management](https://exchange.coins.asia/keys). This can also be accessed via the website hamburger menu.
3. From the API Key Management webpage, your UserId should be displayed.

## License
[MIT](https://github.com/JSON-G/coins-pro/blob/master/LICENSE)
