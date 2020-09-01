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
 * this will essentially emit a JSON Object that is in the readable format of what client will consume
 * for example on market subscriptions, return only the relevant information such as OHLC & current ask/bid
 * example standard format of subscriptions:
 * {
 *   open: 1.00,
 *   high: 1.00,
 *   low: 1.00,
 *   close: 1.00,
 *   ask: 1.00,
 *   bid: 1.00
 * }
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
    } catch (e) {
        json_parsed_payload = payload;
    }

    let emitter_parameter = {
        time: new Date().toString()
    };

    if (function_name === "SubscribeLevel1" || function_name === "Level1UpdateEvent") {
        emitter_parameter.open = json_parsed_payload["SessionOpen"];
        emitter_parameter.high = json_parsed_payload["SessionHigh"];
        emitter_parameter.low = json_parsed_payload["SessionLow"];
        emitter_parameter.close = json_parsed_payload["SessionClose"];
        emitter_parameter.ask = json_parsed_payload["BestOffer"];
        emitter_parameter.bid = json_parsed_payload["BestBid"];
        emitter_parameter.InstrumentId = json_parsed_payload["InstrumentId"];

        webSocketMessageEmitter.emit(`SubscribeLevel1-instrument-${emitter_parameter.InstrumentId}`, emitter_parameter);
    } else {
        emitter_parameter = json_parsed_payload;
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
 * @param {number} obj.InstrumentId - for example InstrumentId 6 is BTCPHP which means buy X Quantity of BTC using PHP wallet
 * @param {number} obj.Quantity - amount to buy. for example, as of this writing: 10 pesos = 0.00001740 BTC. Therefore, if you wanted to buy 10 pesos worth of BTC, pass 0.00001740 as Quantity
 * @param {Function} callback
 */
function buy({ InstrumentId, Quantity, OrderType = 1, ClientOrderId = 0, DisplayQuantity = 0, UseDisplayQuantity = true, TimeInForce = 1, LimitPrice, LimitOffset, OrderIdOCO, PegPriceType, TrailingAmount, StopPrice } = {}, callback = function () { }) {
    sendMessage({
        message_type: 0,
        function_name: "SendOrder",
        payload: JSON.stringify({
            OMSId: OMSId,
            AccountId: clientInfo.AccountId,

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
            Side: 0, // 0 (buy) or 1 (sell)
            StopPrice: StopPrice, // optional
        }),
        callback: callback
    })
}

/**
 * send sell order
 * 
 * @param {Object} obj
 * @param {number} obj.InstrumentId - for example InstrumentId 6 is BTCPHP which means sell X Quantity of BTC for Y PHP. value is volatile
 * @param {number} obj.Quantity - amount to sell
 * @param {Function} callback
 */
function sell({ InstrumentId, Quantity, OrderType = 1, ClientOrderId = 0, DisplayQuantity = 0, UseDisplayQuantity = true, TimeInForce = 1, LimitPrice, LimitOffset, OrderIdOCO, PegPriceType, TrailingAmount, StopPrice } = {}, callback = function () { }) {
    sendMessage({
        message_type: 0,
        function_name: "SendOrder",
        payload: JSON.stringify({
            OMSId: OMSId,
            AccountId: clientInfo.AccountId,

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
            Side: 1, // 0 (buy) or 1 (sell)
            StopPrice: StopPrice, // optional
        }),
        callback: callback
    })
}

function subscribe(InstrumentId, callback = function () { }, depth = 0) {
    if (depth === 0) {
        subscribeLevel1(InstrumentId, callback)
    } else {
        // subscribeLevel2(InstrumentId, callback, depth)
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

    function executeEmitterCallback(_payload) {
        callback(_payload);
    }

    // Coins Pro typically uses a instrument ID to distinguish subscriptions. an example is instrument id 6 for SubscribeLevel1 function - this is the BTCPHP instrument
    let { InstrumentId } = JSON.parse(payload);

    // event name is declared as the function_name for subscriptions
    // the reason for this is, on this day of writing August 23, 2020, the coins pro api increments the sequence number by 2 everytime they message the websocket client
    // therefore, `event${sequence_number}` implementation like the one on function sendMessage will not work since the original sequence number upon subscribing has, again, been incremented by coins - hence, the event will not trigger in that setup
    webSocketMessageEmitter.off(`${function_name}-instrument-${InstrumentId}`, executeEmitterCallback);
    webSocketMessageEmitter.on(`${function_name}-instrument-${InstrumentId}`, executeEmitterCallback);

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
        function_name: "GetInstruments",
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

function subscribeLevel1(InstrumentId, callback) {
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

exports.getProducts = getProducts;
exports.getInstruments = getInstruments;

exports.getUserAPIKeys = getUserAPIKeys;
