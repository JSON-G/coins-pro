// docs: https://exchange.coins.asia/assets/docs/Coins-Pro-API.pdf

const WebSocket = require("ws");

let ws; // websocket object
let OMSId = 1; // OMSId refers to an internal ID of the order management system and should be always 1.
let sequence_number = 0; // "required" by the coins api. The Client-Side sequence number should always be an Even Number, such that your sequence number variable should always be incremented by 2. Also used to map event emitters on-websocket-message-received
let clientInfo = {}; // client info such as APIKey, secret, UserId, and AccountId
let nonce = new Date().getTime().toString(); // current timestamp as a string

const EventEmitter = require('events');
class WebSocketMessageEmitter extends EventEmitter { }
const webSocketMessageEmitter = new WebSocketMessageEmitter();

const testBTCQty = 0.00001740;
const BTCInstrumentId = 6;

/**
 * setup websocket & clientInfo
 * 
 * @param {JSONobject} client_info - JSON (already parsed) object which contains the client information such as APIKey, secret, UserId, and AccountId
 * @param {string} client_info.APIKey
 * @param {string} client_info.secret
 * @param {string} client_info.UserId
 * @param {string} client_info.AccountId
 * @param {Function} callback
 * @returns {Promise}
 */
function start(client_info, callback = function () { }) {
    console.log("connecting to coins-pro-api websocket");

    ws = new WebSocket("wss://api-cx.coins.asia/WSGateway/");

    ws.on("open", function open() {
        console.log("coins-pro-api websocket connection successful");

        clientInfo = client_info;

        ws.on("message", function incoming(data) {
            let { m: _message_type, i: _sequence_number, n: _function_name, o: _payload } = JSON.parse(data);

            emitWebsocketMessage({
                message_type: _message_type,
                sequence_number: _sequence_number,
                function_name: _function_name,
                payload: _payload
            });
        });

        createSignature().then((resolvedData) => {
            authUser({
                UserId: clientInfo.UserId,
                APIKey: clientInfo.APIKey,
                Nonce: nonce,
                Signature: resolvedData,
                callback: callback
            })
        })
    });
}

/**
 * emits the event that pertains to the newest websocket message received from Coins Pro
 * payload coming from Coins Pro will also be passed as parameter on emit
 *
 * @param {Object} obj
 * @param {string|number} obj.message_type - Describes the type of call the message relates to. Supported types: 0 = Request, 1 = Reply, 2 = Subscribe To Event, 3 = Event, 4 = Unsubscribe from Event, 5 = Error
 * @param {number} obj.sequence_number - The same sequence number that was used in sending the websocket a message. Although this will differ in subscriptions - Coins Pro will increment the original sequence number 2 each time a new update is given (i.e., a new websocket message pertaining to the subscription)
 * @param {string} obj.function_name - The same function name that was used in sending the websocket a message
 * @param {JSONstring} obj.payload - This is a JSON-formatted string containing the data that was received from the websocket server
 */
function emitWebsocketMessage({ message_type, sequence_number, function_name, payload }) {

    let json_parsed_payload;

    // attempts to parse the payload and will catch responses that are not in JSON string format
    try {
        json_parsed_payload = JSON.parse(payload);
        json_parsed_payload["machine_time"] = new Date().toString();
    } catch (e) {
        json_parsed_payload = payload;
    }

    const event_mapping = {
        "SubscribeLevel1": "SubscribeLevel1",
        "Level1UpdateEvent": "SubscribeLevel1",

        "SubscribeLevel2": "SubscribeLevel2",
        "Level2UpdateEvent": "SubscribeLevel2",

        "SubscribeTrades": "SubscribeTrades",
        "TradeDataUpdateEvent": "SubscribeTrades",

        "SubscribeAccountEvents": "SubscribeAccountEvents",
        "PendingDepositUpdate": "SubscribeAccountEvents",
        "AccountPositionEvent": "SubscribeAccountEvents",
        "OrderStateEvent": "SubscribeAccountEvents",
        "OrderTradeEvent": "SubscribeAccountEvents",
        "NewOrderRejectEvent": "SubscribeAccountEvents",
        "CancelOrderRejectEvent": "SubscribeAccountEvents",
        "MarketStateUpdate": "SubscribeAccountEvents",
    }

    if (event_mapping[function_name] === "SubscribeLevel1") {
        webSocketMessageEmitter.emit(`SubscribeLevel1-instrument-${json_parsed_payload["InstrumentId"]}`, json_parsed_payload);
    } else if (event_mapping[function_name] === "SubscribeLevel2") {
        let instrument_id = json_parsed_payload[0][7];
        webSocketMessageEmitter.emit(`SubscribeLevel2-instrument-${instrument_id}`, json_parsed_payload);
    } else if (event_mapping[function_name] === "SubscribeTrades") {
        let instrument_id = json_parsed_payload[0][1];
        webSocketMessageEmitter.emit(`SubscribeTrades-instrument-${instrument_id}`, json_parsed_payload);
    } else if (event_mapping[function_name] === "SubscribeAccountEvents") {
        json_parsed_payload["event_type"] = function_name; // emits the function_name as well to enable the subscriber to distinguish/correlate the returned payload
        webSocketMessageEmitter.emit(`std-sub-SubscribeAccountEvents`, json_parsed_payload);
    } else {
        webSocketMessageEmitter.emit(`std-msg-${sequence_number}`, json_parsed_payload);
    }
}

/**
 * create a signature & authenticate the client
 * 
 * only call this as a callback after start() function has completed
 * authentication request will based on given clientInfo/agent_credentials which are set on start() after websocket connection is established
 */
function authenticate(callback = function () { }) {
    createSignature().then((resolvedData) => {
        authUser({
            UserId: clientInfo.UserId,
            APIKey: clientInfo.APIKey,
            Nonce: nonce,
            Signature: resolvedData,
            callback: callback
        })
    })
}

/**
 * send buy order
 * 
 * @param {Object} obj
 * @param {number} obj.InstrumentId - for example InstrumentId 6 is BTCPHP which means buy/sell X Quantity of BTC in exchange for PHP
 * @param {number} obj.Quantity - amount to buy/sell. for example, as of this writing: 10 pesos = 0.00001740 BTC. Therefore, if you wanted to buy/sell 10 pesos worth of BTC, pass 0.00001740 as Quantity
 * @param {number} obj.Side - 0 (buy) or 1 (sell)
 * @param {Function} callback
 */
function sendOrder({ InstrumentId, Quantity, Side, OrderType = 1, ClientOrderId = 0, DisplayQuantity = 0, UseDisplayQuantity = true, TimeInForce = 1, LimitPrice, LimitOffset, OrderIdOCO, PegPriceType, TrailingAmount, StopPrice } = {}, callback = function () { }) {
    sendMessage({
        message_type: 0,
        function_name: "SendOrder",
        payload: JSON.stringify({
            OMSId: OMSId,
            AccountId: clientInfo.AccountId,
            Side: Side, // 0 (buy) or 1 (sell)

            InstrumentId: InstrumentId, // id 6 is BTCPHP
            Quantity: Quantity, // PHP 10 basically in BTC (minimum apparently on their front-end web app)
            OrderType: OrderType,
            ClientOrderId: ClientOrderId, // arbitrary value?
            DisplayQuantity: DisplayQuantity,
            UseDisplayQuantity: UseDisplayQuantity,
            TimeInForce: TimeInForce,

            LimitPrice: LimitPrice, // optional
            LimitOffset: LimitOffset, // optional
            OrderIdOCO: OrderIdOCO, // optional
            PegPriceType: PegPriceType, // optional
            TrailingAmount: TrailingAmount, // optional
            StopPrice: StopPrice, // optional
        }),
        callback: callback
    })
}

/**
 * send buy order
 * 
 * @param {Object} obj
 * @param {number} obj.InstrumentId - for example InstrumentId 6 is BTCPHP which means buy X Quantity of BTC using PHP wallet
 * @param {number} obj.Quantity - amount to buy. for example, as of this writing: 10 pesos = 0.00001740 BTC. Therefore, if you wanted to buy 10 pesos worth of BTC, pass 0.00001740 as Quantity
 * @param {Function} callback
 */
function buy(sendOrder_parameters, callback = function () { }) {
    sendOrder({ ...sendOrder_parameters, Side: 0 }, callback);
}

/**
 * send sell order
 * 
 * @param {Object} obj
 * @param {number} obj.InstrumentId - for example InstrumentId 6 is BTCPHP which means sell X Quantity of BTC for Y PHP. value is volatile
 * @param {number} obj.Quantity - amount to sell
 * @param {Function} callback
 */
function sell(sendOrder_parameters, callback = function () { }) {
    sendOrder({ ...sendOrder_parameters, Side: 1 }, callback);
}

function subscribe(InstrumentId, callback = function () { }, depth = 0) {
    if (depth === 0) {
        subscribeLevel1(InstrumentId, callback);
    } else {
        subscribeLevel2({ InstrumentId: InstrumentId, Depth: depth }, callback);
    }
}

/**
 * send message to the websocket
 * will increment sequence_number by 2 each time message will be sent. take a look at the global variable sequence_number declared for more information
 * 
 * @param {Object} obj
 * @param {string|number} obj.message_type - Describes the type of call the message relates to. Supported types: 0 = Request, 1 = Reply, 2 = Subscribe To Event, 3 = Event, 4 = Unsubscribe from Event, 5 = Error. Users should only use 0 (Request) and 2 to subscribe to data feed.
 * @param {string} obj.function_name - This is the name of the Remote Function that the message type is a Request or Reply to. For instance, if you wish to make a call to the "GetProducts" function, the Request should contain "GetProducts" in this field, and the Reply will also contain "GetProducts" in this field.
 * @param {JSONstring} obj.payload - This is a JSON-formatted string containing the data being sent with the message, either as Parameters in a Request, or as the data in a Reply to a Request. Note: the rest of functions described below, contain only payload description, so we do not include the whole frame in the rest of the documentation. For requests with zero parameters, users should send a “{}” as Payload. Note: OMSId refers to an internal ID of the order management system and should be always 1.
 * @param {Function} obj.callback - executes a callback function when a message is received from the API pertaining to the sequence number (mapped with sequence_number & handled using [NodeJS Events](https://nodejs.org/api/events.html#events_events))
 */
function sendMessage({ message_type, function_name, payload, callback }) {
    var frame = {
        "m": message_type,
        "i": sequence_number,
        "n": function_name,
        "o": payload
    };

    webSocketMessageEmitter.once(`std-msg-${sequence_number}`, (_payload) => {
        callback(_payload);
    });

    ws.send(JSON.stringify(frame));
    sequence_number = sequence_number + 2;
}

/**
 * send message to the websocket and subscribe to some data
 * the difference of this function with sendMessage is that, the emitter listener for the websocket messages will persist throughout the life of the app session
 * will increment sequence_number by 2
 * 
 * @param {Object} obj
 * @param {string|number} obj.message_type - Describes the type of call the message relates to. Supported types: 0 = Request, 1 = Reply, 2 = Subscribe To Event, 3 = Event, 4 = Unsubscribe from Event, 5 = Error. Users should only use 0 (Request) and 2 to subscribe to data feed.
 * @param {string} obj.function_name - This is the name of the Remote Function that the message type is a Request or Reply to. For instance, if you wish to make a call to the "GetProducts" function, the Request should contain "GetProducts" in this field, and the Reply will also contain "GetProducts" in this field.
 * @param {JSONstring} obj.payload - This is a JSON-formatted string containing the data being sent with the message, either as Parameters in a Request, or as the data in a Reply to a Request. Note: the rest of functions described below, contain only payload description, so we do not include the whole frame in the rest of the documentation. For requests with zero parameters, users should send a “{}” as Payload. Note: OMSId refers to an internal ID of the order management system and should be always 1.
 * @param {Function} obj.callback - executes a callback function when a message is received from the API pertaining to the sequence number (mapped with sequence_number & handled using [NodeJS Events](https://nodejs.org/api/events.html#events_events))
 */
function subscribeToData({ message_type, function_name, payload, callback }) {
    var frame = {
        "m": message_type,
        "i": sequence_number,
        "n": function_name,
        "o": payload
    };

    // Coins Pro typically uses a instrument ID to distinguish subscriptions. an example is instrument id 6 for SubscribeLevel1 function - this is the BTCPHP instrument
    let { InstrumentId } = JSON.parse(payload);

    // emitter event name is concatenated with function_name for subscriptions (unless no instrument_id is provided, therefore std-sub-function_name as event name should suffice)
    // the reason for this is, on this day of writing August 23, 2020, the coins pro api increments the sequence number by 2 everytime they message the websocket client
    // therefore, `std-msg-${sequence_number}` implementation like the one on function sendMessage will not work here since the original sequence number upon subscribing has, again, been incremented by coins - hence, the event will not trigger in that setup
    let event_name = InstrumentId !== undefined ? `${function_name}-instrument-${InstrumentId}` : `std-sub-${function_name}`;
    if (webSocketMessageEmitter.eventNames().find(eventName => eventName === event_name) === undefined) {
        webSocketMessageEmitter.on(event_name, (_payload) => {
            callback(_payload);
        });
    } // only add a new subscription event listener if it does not exist

    ws.send(JSON.stringify(frame));
    sequence_number = sequence_number + 2;
}

/**
 * create a HMAC-SHA256 signature with ApiSecret as a key and `nonce + UserId + ApiKey` as a message.
 * https://nodejs.org/api/crypto.html#crypto_class_hmac
 */
function createSignature() {
    const crypto = require("crypto");
    const hmac = crypto.createHmac("sha256", clientInfo.secret);

    return new Promise((resolve, reject) => {
        hmac.on('readable', () => {
            const data = hmac.read();
            if (data) {
                resolve(data.toString('hex'));
            }
        });

        hmac.write(`${nonce}${clientInfo.UserId}${clientInfo.APIKey}`);
        hmac.end();
    })
}

function authUser({ UserId, APIKey, Nonce, Signature, callback }) {
    sendMessage({
        message_type: 0,
        function_name: "AuthenticateUser",
        payload: JSON.stringify({
            UserId: UserId,
            APIKey: APIKey,
            Nonce: Nonce,
            Signature: Signature
        }),
        callback: callback
    })
}

function getInstruments(callback = function () { }) {
    sendMessage({
        message_type: 0,
        function_name: "GetInstruments",
        payload: JSON.stringify({
            "OMSId": OMSId,
        }),
        callback: callback
    })
}

function getProducts(callback = function () { }) {
    sendMessage({
        message_type: 0,
        function_name: "GetProducts",
        payload: JSON.stringify({
            "OMSId": OMSId,
        }),
        callback: callback
    })
}

function getUserAPIKeys(callback = function () { }) {
    sendMessage({
        message_type: 0,
        function_name: "GetUserAPIKeys",
        payload: JSON.stringify({
            UserId: clientInfo.UserId
        }),
        callback: callback
    })
}

/**
 * 
 * @param {Array} permissions - designate the permissions given when using this APIKey. e.g., ["Deposit", "Withdraw", "Trading"] - these are all the possible values
 * @param {Function} callback 
 */
function addUserAPIKey(permissions, callback = function () { }) {
    sendMessage({
        message_type: 0,
        function_name: "AddUserAPIKey",
        payload: JSON.stringify({
            UserId: parseInt(clientInfo.UserId), // as of API docs v0.3.3, this endpoint accepts integer for UserId - passing string will not push the request
            Permissions: permissions
        }),
        callback: callback
    })
}

/**
 * 
 * @param {string} ApiKey - APIKey to be removed from the user account
 * @param {Function} callback 
 */
function removeUserAPIKey(ApiKey, callback = function () { }) {
    sendMessage({
        message_type: 0,
        function_name: "RemoveUserAPIKey",
        payload: JSON.stringify({
            UserId: clientInfo.UserId,
            ApiKey: ApiKey
        }),
        callback: callback
    })
}

/**
 * As of API doc v0.3.3, the docs are not accurate - it is stated there you must pass empty string as payload, & this is not the case: you must still pass OMSId for payload
 * @param {Function} callback 
 */
function getUserAccounts(callback = function () { }) {
    sendMessage({
        message_type: 0,
        function_name: "GetUserAccounts",
        payload: JSON.stringify({
            OMSId: OMSId
        }),
        callback: callback
    })
}

/**
 * As of API doc v0.3.3, the docs are not accurate - it is stated there you must pass Depth as payload where Depth is the number of transaction items to get, & this is not the case: you must pass StartIndex & Count
 * @param {Object} obj
 * @param {number} obj.StartIndex
 * @param {number} obj.Count 
 * @param {Function} callback 
 */
function getAccountTransactions({ StartIndex, Count }, callback = function () { }) {
    sendMessage({
        message_type: 0,
        function_name: "GetAccountTransactions",
        payload: JSON.stringify({
            OMSId: OMSId,
            AccountId: parseInt(clientInfo.AccountId), // As of API doc v0.3.3, this end point accepts integer for AccountId
            // Depth: depth
            StartIndex: StartIndex,
            Count: Count
        }),
        callback: callback
    })
}

function getAccountPositions(callback = function () { }) {
    sendMessage({
        message_type: 0,
        function_name: "GetAccountPositions",
        payload: JSON.stringify({
            OMSId: OMSId,
            AccountId: clientInfo.AccountId
        }),
        callback: callback
    });
}

function getAccountTrades({ StartIndex, Count }, callback = function () { }) {
    sendMessage({
        message_type: 0,
        function_name: "GetAccountTrades",
        payload: JSON.stringify({
            OMSId: OMSId,
            AccountId: parseInt(clientInfo.AccountId), // As of API doc v0.3.3, this end point accepts integer for AccountId
            StartIndex: StartIndex,
            Count: Count
        }),
        callback: callback
    });
}

function cancelOrder(OrderId, callback = function () { }) {
    sendMessage({
        message_type: 0,
        function_name: "CancelOrder",
        payload: JSON.stringify({
            OMSId: OMSId,
            AccountId: clientInfo.AccountId,
            OrderId: OrderId
        }),
        callback: callback
    });
}

function getOrderStatus(OrderId, callback = function () { }) {
    sendMessage({
        message_type: 0,
        function_name: "GetOrderStatus",
        payload: JSON.stringify({
            OMSId: OMSId,
            AccountId: parseInt(clientInfo.AccountId), // as of API doc v0.3.3, this endpoint accept AccountId as integer
            OrderId: OrderId
        }),
        callback: callback
    });
}

/**
 * Returns an estimate of the fee for a specific order and order type.
 * @param {Object} obj
 * @param {number} obj.InstrumentId
 * @param {number} obj.ProductId
 * @param {number} obj.Amount - amount to order in decimal
 * @param {string} obj.OrderType - "Market", "Limit", or "StopMarket"
 * @param {string} obj.MakerTaker - Whether the order is expected to execute instantly against existing orders in the order book ("Taker") or rest in the order book as an open order ("Maker")
 * @param {Function} callback
 */
function getOrderFee({ InstrumentId, ProductId, Amount, OrderType, MakerTaker }, callback = function () { }) {
    sendMessage({
        message_type: 0,
        function_name: "GetOrderFee",
        payload: JSON.stringify({
            OMSId: OMSId,
            AccountId: parseInt(clientInfo.AccountId), // as of API doc v0.3.3, this endpoint accept AccountId as integer
            InstrumentId: InstrumentId,
            ProductId: ProductId,
            Amount: Amount,
            OrderType: OrderType,
            MakerTaker: MakerTaker
        }),
        callback: callback
    });
}

/**
 * As of API doc v0.3.3, the docs are not accurate - you need to pass Depth to indicate how many records are to be returned
 * @param {number} Depth - indicate how many records are to be returned
 * @param {Function} callback 
 */
function getOrderHistory(Depth, callback = function () { }) {
    sendMessage({
        message_type: 0,
        function_name: "GetOrderHistory",
        payload: JSON.stringify({
            OMSId: OMSId,
            AccountId: parseInt(clientInfo.AccountId), // as of API doc v0.3.3, this endpoint accept AccountId as integer
            Depth: Depth
        }),
        callback: callback
    });
}

function getOpenOrders(callback = function () { }) {
    sendMessage({
        message_type: 0,
        function_name: "GetOpenOrders",
        payload: JSON.stringify({
            OMSId: OMSId,
            AccountId: clientInfo.AccountId
        }),
        callback: callback
    });
}

function getDepositTickets({ Limit, OperatorId = 1, StartIndex = 0 } = {}, callback = function () { }) {
    sendMessage({
        message_type: 0,
        function_name: "GetDepositTickets",
        payload: JSON.stringify({
            OMSId: OMSId,
            AccountId: clientInfo.AccountId,
            Limit: Limit,
            OperatorId: OperatorId,
            StartIndex, StartIndex
        }),
        callback: callback
    });
}

function createWithdrawTicket({ ProductId, Amount }, callback = function () { }) {
    sendMessage({
        message_type: 0,
        function_name: "CreateWithdrawTicket",
        payload: JSON.stringify({
            OMSId: OMSId,
            AccountId: clientInfo.AccountId,
            ProductId: ProductId,
            Amount: Amount
        }),
        callback: callback
    });
}

function getWithdrawTicket(RequestCode, callback = function () { }) {
    sendMessage({
        message_type: 0,
        function_name: "GetWithdrawTicket",
        payload: JSON.stringify({
            OMSId: OMSId,
            AccountId: clientInfo.AccountId,
            RequestCode: RequestCode
        }),
        callback: callback
    });
}

function getWithdrawTickets({ Limit, StartIndex = 0, OperatorId = 1 } = {}, callback = function () { }) {
    sendMessage({
        message_type: 0,
        function_name: "GetWithdrawTickets",
        payload: JSON.stringify({
            OMSId: OMSId,
            AccountId: clientInfo.AccountId,
            Limit: Limit,
            StartIndex: StartIndex,
            OperatorId: OperatorId
        }),
        callback: callback
    });
}

function subscribeLevel1(InstrumentId, callback = function () { }) {
    subscribeToData({
        message_type: 0,
        function_name: "SubscribeLevel1",
        payload: JSON.stringify({
            OMSId: OMSId,
            InstrumentId: InstrumentId
        }),
        callback: callback
    })
}

function unsubscribeLevel1(InstrumentId, callback = function () { }) {
    sendMessage({
        message_type: 0,
        function_name: "UnsubscribeLevel1",
        payload: JSON.stringify({
            OMSId: OMSId,
            InstrumentId: InstrumentId
        }),
        callback: callback
    })
}

function subscribeLevel2({ InstrumentId, Depth }, callback = function () { }) {
    subscribeToData({
        message_type: 0,
        function_name: "SubscribeLevel2",
        payload: JSON.stringify({
            OMSId: OMSId,
            InstrumentId: InstrumentId,
            Depth: Depth
        }),
        callback: callback
    })
}

function unsubscribeLevel2(InstrumentId, callback = function () { }) {
    sendMessage({
        message_type: 0,
        function_name: "UnsubscribeLevel2",
        payload: JSON.stringify({
            OMSId: OMSId,
            InstrumentId: InstrumentId
        }),
        callback: callback
    })
}

/**
 * 
 * @param {Object} obj
 * @param {number} obj.InstrumentId
 * @param {number} obj.IncludeLastCount - Specifies the number of previous trades to retrieve in the immediate snapshot. Default is 100. [Integer]
 * @param {Function} callback
 */
function subscribeTrades({ InstrumentId, IncludeLastCount }, callback = function () { }) {
    subscribeToData({
        message_type: 0,
        function_name: "SubscribeTrades",
        payload: JSON.stringify({
            OMSId: OMSId,
            InstrumentId: InstrumentId,
            IncludeLastCount: IncludeLastCount
        }),
        callback: callback
    })
}

function unsubscribeTrades(InstrumentId, callback = function () { }) {
    sendMessage({
        message_type: 0,
        function_name: "UnsubscribeTrades",
        payload: JSON.stringify({
            OMSId: OMSId,
            InstrumentId: InstrumentId
        }),
        callback: callback
    })
}

function subscribeAccountEvents(callback = function () { }) {
    subscribeToData({
        message_type: 0,
        function_name: "SubscribeAccountEvents",
        payload: JSON.stringify({
            OMSId: OMSId,
            AccountId: clientInfo.AccountId
        }),
        callback: callback
    })
}

function ping(callback = function () { }) {
    sendMessage({
        message_type: 0,
        function_name: "Ping",
        payload: {},
        callback: callback
    })
}

exports.start = start;
exports.authenticate = authenticate;
exports.subscribe = subscribe;
exports.ping = ping;
exports.buy = buy;
exports.sell = sell;

// Unauthenticated Calls
exports.getProducts = getProducts;
exports.getInstruments = getInstruments;

// Authentication
exports.getUserAPIKeys = getUserAPIKeys;
exports.addUserAPIKey = addUserAPIKey;
exports.removeUserAPIKey = removeUserAPIKey;

// User Account Calls
exports.getUserAccounts = getUserAccounts;
exports.getAccountTransactions = getAccountTransactions;
exports.getAccountPositions = getAccountPositions;
exports.getAccountTrades = getAccountTrades;

// Order Handling Calls
exports.sendOrder = sendOrder;
exports.cancelOrder = cancelOrder;
exports.getOrderStatus = getOrderStatus;
exports.getOrderFee = getOrderFee;
exports.getOrderHistory = getOrderHistory;
exports.getOpenOrders = getOpenOrders;

// Deposits
exports.getDepositTickets = getDepositTickets;

// Withdrawals
exports.createWithdrawTicket = createWithdrawTicket;
exports.getWithdrawTicket = getWithdrawTicket;
exports.getWithdrawTickets = getWithdrawTickets;

// Market Data
exports.subscribeLevel1 = subscribeLevel1;
exports.unsubscribeLevel1 = unsubscribeLevel1;
exports.subscribeLevel2 = subscribeLevel2;
exports.unsubscribeLevel2 = unsubscribeLevel2;
exports.subscribeTrades = subscribeTrades;
exports.unsubscribeTrades = unsubscribeTrades;

// Account Events Feed
exports.subscribeAccountEvents = subscribeAccountEvents;