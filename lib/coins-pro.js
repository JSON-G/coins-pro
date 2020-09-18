// docs: https://exchange.coins.asia/assets/docs/Coins-Pro-API.pdf

const WebSocket = require("ws");
const crypto = require("crypto");
const EventEmitter = require("events");

class WebSocketMessageEmitter extends EventEmitter { }

class CoinsProAPI {

    constructor() {
        this.ws = new WebSocket("wss://api-cx.coins.asia/WSGateway/"); // websocket object
        this.OMSId = 1; // OMSId refers to an internal ID of the order management system and should be always 1.
        this.sequence_number = 0; // "required" by the coins api. The Client-Side sequence number should always be an Even Number, such that your sequence number variable should always be incremented by 2. Also used to map event emitters on-websocket-message-received
        this.clientInfo = {}; // client info such as APIKey, secret, UserId, and AccountId
        this.nonce = new Date().getTime().toString(); // current timestamp as a string
        this.webSocketMessageEmitter = new WebSocketMessageEmitter();
    }

    /**
     * setup websocket & clientInfo
     * 
     * @param {Object} client_info - object which contains the client information such as APIKey, secret, and UserId
     * @param {string} client_info.APIKey
     * @param {string} client_info.secret
     * @param {string} client_info.UserId
     * @param {Function} callback
     * @returns {Promise}
     */
    start(client_info, callback = function () { }) {
        console.log("connecting to coins-pro-api websocket");

        this.ws.on("open", () => {
            console.log("coins-pro-api websocket connection successful");

            this.clientInfo = client_info;

            this.ws.on("message", (data) => {
                let { m: _message_type, i: _sequence_number, n: _function_name, o: _payload } = JSON.parse(data);

                this.emitWebsocketMessage({
                    message_type: _message_type,
                    sequence_number: _sequence_number,
                    function_name: _function_name,
                    payload: _payload
                });
            });

            this.createSignature().then((resolvedData) => {
                this.authUser({
                    UserId: this.clientInfo.UserId,
                    APIKey: this.clientInfo.APIKey,
                    Nonce: this.nonce,
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
    emitWebsocketMessage({ message_type, sequence_number, function_name, payload }) {

        let json_parsed_payload;

        // attempts to parse the payload and will catch responses that are not in JSON string format
        try {
            json_parsed_payload = JSON.parse(payload);
            json_parsed_payload["machine_time"] = new Date().toString();
        } catch (e) {
            json_parsed_payload = payload;
        }

        const emitAuthenticateUser = () => {
            this.clientInfo.AccountId = json_parsed_payload.User.AccountId.toString();
            this.webSocketMessageEmitter.emit(`std-msg-${sequence_number}`, json_parsed_payload);
        }

        const emitSubscribeLevel1 = () => {
            this.webSocketMessageEmitter.emit(`SubscribeLevel1-instrument-${json_parsed_payload["InstrumentId"]}`, json_parsed_payload);
        }

        const emitSubscribeLevel2 = () => {
            let instrument_id = json_parsed_payload[0][7];
            this.webSocketMessageEmitter.emit(`SubscribeLevel2-instrument-${instrument_id}`, json_parsed_payload);
        }

        const emitSubscribeTrades = () => {
            let instrument_id = json_parsed_payload[0][1];
            this.webSocketMessageEmitter.emit(`SubscribeTrades-instrument-${instrument_id}`, json_parsed_payload);
        }

        const emitSubscribeAccountEvents = () => {
            json_parsed_payload["event_type"] = function_name; // emits the function_name as well to enable the subscriber to distinguish/correlate the returned payload
            this.webSocketMessageEmitter.emit(`std-sub-SubscribeAccountEvents`, json_parsed_payload);
        }

        const event_mapping = {
            "AuthenticateUser": emitAuthenticateUser,

            "SubscribeLevel1": emitSubscribeLevel1,
            "Level1UpdateEvent": emitSubscribeLevel1,

            "SubscribeLevel2": emitSubscribeLevel2,
            "Level2UpdateEvent": emitSubscribeLevel2,

            "SubscribeTrades": emitSubscribeTrades,
            "TradeDataUpdateEvent": emitSubscribeTrades,

            "SubscribeAccountEvents": emitSubscribeAccountEvents,
            "PendingDepositUpdate": emitSubscribeAccountEvents,
            "AccountPositionEvent": emitSubscribeAccountEvents,
            "OrderStateEvent": emitSubscribeAccountEvents,
            "OrderTradeEvent": emitSubscribeAccountEvents,
            "NewOrderRejectEvent": emitSubscribeAccountEvents,
            "CancelOrderRejectEvent": emitSubscribeAccountEvents,
            "MarketStateUpdate": emitSubscribeAccountEvents
        }

        if (event_mapping[function_name] === undefined) {
            this.webSocketMessageEmitter.emit(`std-msg-${sequence_number}`, json_parsed_payload);
        } else {
            event_mapping[function_name]();
        }
    }

    /**
     * send buy order
     * 
     * @param {Object} obj
     * @param {number} obj.InstrumentId - for example InstrumentId 6 is BTCPHP which means buy/sell X Quantity of BTC in exchange for PHP
     * @param {number} obj.Quantity - amount to buy/sell. for example, as of this writing: 10 pesos = 0.00001740 BTC. Therefore, if you wanted to buy/sell 10 pesos worth of BTC, pass 0.00001740 as Quantity
     * @param {number} obj.Side - 0 (Buy) or 1 (Sell)
     * @param {number} [obj.OrderType] - The type of order. 1 (Market) or 2 (Limit) or 3 (StopMarket)
     * @param {number} [obj.ClientOrderId] - Set this to your own id if you wish to use one. It will be useful for recognizing future order states related to this call. [64 bit Integer]
     * @param {number} [obj.DisplayQuantity] - Quantity of an order to display publicly on the order book. If you have an order for 1,000 and you want the order book to reflect a quantity of only 100 at any one time, set this to 100. This functionality can only be used for limit orders. Set to 0 to display all. [Decimal]
     * @param {boolean} [obj.UseDisplayQuantity] - [Boolean] If you enter a Limit order with a reserve, you must set UseDisplayQuantity to true.
     * @param {number} [obj.TimeInForce] - 1 (Good until Canceled) or 3 (Immediate or Cancel) or 4 (Fill or Kill)
     * @param {number} [obj.LimitPrice] - The limit price for this order. [Decimal]
     * @param {number} obj.LimitOffset - When entering a Trailing Limit order, this specifies the distance from activation price to your limit order price. [Decimal]
     * @param {number} obj.OrderIdOCO - If you would like to have this order cancel another on execution, set this field to the other order's server order id. Omit or set to 0 if no OCO is required. [64 Bit Integer]
     * @param {number} obj.PegPriceType - When entering a Stop/Trailing order, set this to the type of price you would like to peg the Stop to. [Integer] 1 (Last) or 2 (Bid) or 3 (Ask)
     * @param {number} obj.TrailingAmount - When entering a Trailing order, set this to the quantity required, which the trigger price will trail the market by. [Decimal]
     * @param {number} obj.StopPrice - The Stop Price for this order, if it is a stop order. Otherwise you may omit this field. [Decimal]
     * @param {Function} callback
     */
    sendOrder({ InstrumentId, Quantity, Side, OrderType = 1, ClientOrderId = 0, DisplayQuantity = 0, UseDisplayQuantity = true, TimeInForce = 1, LimitPrice, LimitOffset, OrderIdOCO, PegPriceType, TrailingAmount, StopPrice } = {}, callback = function () { }) {
        this.sendMessage({
            message_type: 0,
            function_name: "SendOrder",
            payload: JSON.stringify({
                OMSId: this.OMSId,
                AccountId: this.clientInfo.AccountId,
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
     * send message to the websocket
     * will increment sequence_number by 2 each time message will be sent. take a look at the global variable sequence_number declared for more information
     * 
     * @param {Object} obj
     * @param {string|number} obj.message_type - Describes the type of call the message relates to. Supported types: 0 = Request, 1 = Reply, 2 = Subscribe To Event, 3 = Event, 4 = Unsubscribe from Event, 5 = Error. Users should only use 0 (Request) and 2 to subscribe to data feed.
     * @param {string} obj.function_name - This is the name of the Remote Function that the message type is a Request or Reply to. For instance, if you wish to make a call to the "GetProducts" function, the Request should contain "GetProducts" in this field, and the Reply will also contain "GetProducts" in this field.
     * @param {JSONstring} obj.payload - This is a JSON-formatted string containing the data being sent with the message, either as Parameters in a Request, or as the data in a Reply to a Request. Note: the rest of functions described below, contain only payload description, so we do not include the whole frame in the rest of the documentation. For requests with zero parameters, users should send a “{}” as Payload. Note: OMSId refers to an internal ID of the order management system and should be always 1.
     * @param {Function} obj.callback - executes a callback function when a message is received from the API pertaining to the sequence number (mapped with sequence_number & handled using [NodeJS Events](https://nodejs.org/api/events.html#events_events))
     */
    sendMessage({ message_type, function_name, payload, callback }) {

        var frame = {
            "m": message_type,
            "i": this.sequence_number,
            "n": function_name,
            "o": payload
        };

        this.webSocketMessageEmitter.once(`std-msg-${this.sequence_number}`, (_payload) => {
            callback(_payload);
        });

        this.ws.send(JSON.stringify(frame));
        this.sequence_number = this.sequence_number + 2;
    }

    /**
     * send message to the websocket and subscribe to some data
     * the difference of this function with this.sendMessage is that, the emitter listener for the websocket messages will persist throughout the life of the app session
     * will increment sequence_number by 2
     * 
     * @param {Object} obj
     * @param {string|number} obj.message_type - Describes the type of call the message relates to. Supported types: 0 = Request, 1 = Reply, 2 = Subscribe To Event, 3 = Event, 4 = Unsubscribe from Event, 5 = Error. Users should only use 0 (Request) and 2 to subscribe to data feed.
     * @param {string} obj.function_name - This is the name of the Remote Function that the message type is a Request or Reply to. For instance, if you wish to make a call to the "GetProducts" function, the Request should contain "GetProducts" in this field, and the Reply will also contain "GetProducts" in this field.
     * @param {JSONstring} obj.payload - This is a JSON-formatted string containing the data being sent with the message, either as Parameters in a Request, or as the data in a Reply to a Request. Note: the rest of functions described below, contain only payload description, so we do not include the whole frame in the rest of the documentation. For requests with zero parameters, users should send a “{}” as Payload. Note: OMSId refers to an internal ID of the order management system and should be always 1.
     * @param {Function} obj.callback - executes a callback function when a message is received from the API pertaining to the sequence number (mapped with sequence_number & handled using [NodeJS Events](https://nodejs.org/api/events.html#events_events))
     */
    subscribeToData({ message_type, function_name, payload, callback }) {
        var frame = {
            "m": message_type,
            "i": this.sequence_number,
            "n": function_name,
            "o": payload
        };

        // Coins Pro typically uses a instrument ID to distinguish subscriptions. an example is instrument id 6 for SubscribeLevel1 function - this is the BTCPHP instrument
        let { InstrumentId } = JSON.parse(payload);

        // emitter event name is concatenated with function_name for subscriptions (unless no instrument_id is provided, therefore std-sub-function_name as event name should suffice)
        // the reason for this is, on this day of writing August 23, 2020, the coins pro api increments the sequence number by 2 everytime they message the websocket client
        // therefore, `std-msg-${sequence_number}` implementation like the one on function this.sendMessage will not work here since the original sequence number upon subscribing has, again, been incremented by coins - hence, the event will not trigger in that setup
        let event_name = InstrumentId !== undefined ? `${function_name}-instrument-${InstrumentId}` : `std-sub-${function_name}`;
        if (this.webSocketMessageEmitter.eventNames().find(eventName => eventName === event_name) === undefined) {
            this.webSocketMessageEmitter.on(event_name, (_payload) => {
                callback(_payload);
            });
        } // only add a new subscription event listener if it does not exist

        this.ws.send(JSON.stringify(frame));
        this.sequence_number = this.sequence_number + 2;
    }

    /**
     * create a HMAC-SHA256 signature with ApiSecret as a key and `nonce + UserId + ApiKey` as a message.
     * https://nodejs.org/api/crypto.html#crypto_class_hmac
     */
    createSignature() {
        const hmac = crypto.createHmac("sha256", this.clientInfo.secret);

        return new Promise((resolve, reject) => {
            hmac.on('readable', () => {
                const data = hmac.read();
                if (data) {
                    resolve(data.toString('hex'));
                }
            });

            hmac.write(`${this.nonce}${this.clientInfo.UserId}${this.clientInfo.APIKey}`);
            hmac.end();
        })
    }

    authUser({ UserId, APIKey, Nonce, Signature, callback }) {
        this.sendMessage({
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

    getInstruments(callback = function () { }) {
        this.sendMessage({
            message_type: 0,
            function_name: "GetInstruments",
            payload: JSON.stringify({
                "OMSId": this.OMSId,
            }),
            callback: callback
        })
    }

    getProducts(callback = function () { }) {
        this.sendMessage({
            message_type: 0,
            function_name: "GetProducts",
            payload: JSON.stringify({
                "OMSId": this.OMSId,
            }),
            callback: callback
        })
    }

    getUserAPIKeys(callback = function () { }) {
        this.sendMessage({
            message_type: 0,
            function_name: "GetUserAPIKeys",
            payload: JSON.stringify({
                UserId: this.clientInfo.UserId
            }),
            callback: callback
        })
    }

    /**
     * 
     * @param {Array} permissions - designate the permissions given when using this APIKey. e.g., ["Deposit", "Withdraw", "Trading"] - these are all the possible values
     * @param {Function} callback 
     */
    addUserAPIKey(permissions, callback = function () { }) {
        this.sendMessage({
            message_type: 0,
            function_name: "AddUserAPIKey",
            payload: JSON.stringify({
                UserId: parseInt(this.clientInfo.UserId), // as of API docs v0.3.3, this endpoint accepts integer for UserId - passing string will not push the request
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
    removeUserAPIKey(ApiKey, callback = function () { }) {
        this.sendMessage({
            message_type: 0,
            function_name: "RemoveUserAPIKey",
            payload: JSON.stringify({
                UserId: this.clientInfo.UserId,
                ApiKey: ApiKey
            }),
            callback: callback
        })
    }

    /**
     * As of API doc v0.3.3, the docs are not accurate - it is stated there you must pass empty string as payload, & this is not the case: you must still pass OMSId for payload
     * @param {Function} callback 
     */
    getUserAccounts(callback = function () { }) {
        this.sendMessage({
            message_type: 0,
            function_name: "GetUserAccounts",
            payload: JSON.stringify({
                OMSId: this.OMSId
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
    getAccountTransactions({ StartIndex, Count }, callback = function () { }) {
        this.sendMessage({
            message_type: 0,
            function_name: "GetAccountTransactions",
            payload: JSON.stringify({
                OMSId: this.OMSId,
                AccountId: parseInt(this.clientInfo.AccountId), // As of API doc v0.3.3, this end point accepts integer for AccountId
                // Depth: depth
                StartIndex: StartIndex,
                Count: Count
            }),
            callback: callback
        })
    }

    getAccountPositions(callback = function () { }) {
        this.sendMessage({
            message_type: 0,
            function_name: "GetAccountPositions",
            payload: JSON.stringify({
                OMSId: this.OMSId,
                AccountId: this.clientInfo.AccountId
            }),
            callback: callback
        });
    }

    getAccountTrades({ StartIndex, Count }, callback = function () { }) {
        this.sendMessage({
            message_type: 0,
            function_name: "GetAccountTrades",
            payload: JSON.stringify({
                OMSId: this.OMSId,
                AccountId: parseInt(this.clientInfo.AccountId), // As of API doc v0.3.3, this end point accepts integer for AccountId
                StartIndex: StartIndex,
                Count: Count
            }),
            callback: callback
        });
    }

    cancelOrder(OrderId, callback = function () { }) {
        this.sendMessage({
            message_type: 0,
            function_name: "CancelOrder",
            payload: JSON.stringify({
                OMSId: this.OMSId,
                AccountId: this.clientInfo.AccountId,
                OrderId: OrderId
            }),
            callback: callback
        });
    }

    getOrderStatus(OrderId, callback = function () { }) {
        this.sendMessage({
            message_type: 0,
            function_name: "GetOrderStatus",
            payload: JSON.stringify({
                OMSId: this.OMSId,
                AccountId: parseInt(this.clientInfo.AccountId), // as of API doc v0.3.3, this endpoint accept AccountId as integer
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
    getOrderFee({ InstrumentId, ProductId, Amount, OrderType, MakerTaker }, callback = function () { }) {
        this.sendMessage({
            message_type: 0,
            function_name: "GetOrderFee",
            payload: JSON.stringify({
                OMSId: this.OMSId,
                AccountId: parseInt(this.clientInfo.AccountId), // as of API doc v0.3.3, this endpoint accept AccountId as integer
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
    getOrderHistory(Depth, callback = function () { }) {
        this.sendMessage({
            message_type: 0,
            function_name: "GetOrderHistory",
            payload: JSON.stringify({
                OMSId: this.OMSId,
                AccountId: parseInt(this.clientInfo.AccountId), // as of API doc v0.3.3, this endpoint accept AccountId as integer
                Depth: Depth
            }),
            callback: callback
        });
    }

    getOpenOrders(callback = function () { }) {
        this.sendMessage({
            message_type: 0,
            function_name: "GetOpenOrders",
            payload: JSON.stringify({
                OMSId: this.OMSId,
                AccountId: this.clientInfo.AccountId
            }),
            callback: callback
        });
    }

    getDepositTickets({ Limit, OperatorId = 1, StartIndex = 0 } = {}, callback = function () { }) {
        this.sendMessage({
            message_type: 0,
            function_name: "GetDepositTickets",
            payload: JSON.stringify({
                OMSId: this.OMSId,
                AccountId: this.clientInfo.AccountId,
                Limit: Limit,
                OperatorId: OperatorId,
                StartIndex, StartIndex
            }),
            callback: callback
        });
    }

    createWithdrawTicket({ ProductId, Amount }, callback = function () { }) {
        this.sendMessage({
            message_type: 0,
            function_name: "CreateWithdrawTicket",
            payload: JSON.stringify({
                OMSId: this.OMSId,
                AccountId: this.clientInfo.AccountId,
                ProductId: ProductId,
                Amount: Amount
            }),
            callback: callback
        });
    }

    getWithdrawTicket(RequestCode, callback = function () { }) {
        this.sendMessage({
            message_type: 0,
            function_name: "GetWithdrawTicket",
            payload: JSON.stringify({
                OMSId: this.OMSId,
                AccountId: this.clientInfo.AccountId,
                RequestCode: RequestCode
            }),
            callback: callback
        });
    }

    getWithdrawTickets({ Limit, StartIndex = 0, OperatorId = 1 } = {}, callback = function () { }) {
        this.sendMessage({
            message_type: 0,
            function_name: "GetWithdrawTickets",
            payload: JSON.stringify({
                OMSId: this.OMSId,
                AccountId: this.clientInfo.AccountId,
                Limit: Limit,
                StartIndex: StartIndex,
                OperatorId: OperatorId
            }),
            callback: callback
        });
    }

    subscribeLevel1(InstrumentId, callback = function () { }) {
        this.subscribeToData({
            message_type: 0,
            function_name: "SubscribeLevel1",
            payload: JSON.stringify({
                OMSId: this.OMSId,
                InstrumentId: InstrumentId
            }),
            callback: callback
        })
    }

    unsubscribeLevel1(InstrumentId, callback = function () { }) {
        this.sendMessage({
            message_type: 0,
            function_name: "UnsubscribeLevel1",
            payload: JSON.stringify({
                OMSId: this.OMSId,
                InstrumentId: InstrumentId
            }),
            callback: callback
        })
    }

    subscribeLevel2({ InstrumentId, Depth }, callback = function () { }) {
        this.subscribeToData({
            message_type: 0,
            function_name: "SubscribeLevel2",
            payload: JSON.stringify({
                OMSId: this.OMSId,
                InstrumentId: InstrumentId,
                Depth: Depth
            }),
            callback: callback
        })
    }

    unsubscribeLevel2(InstrumentId, callback = function () { }) {
        this.sendMessage({
            message_type: 0,
            function_name: "UnsubscribeLevel2",
            payload: JSON.stringify({
                OMSId: this.OMSId,
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
    subscribeTrades({ InstrumentId, IncludeLastCount }, callback = function () { }) {
        this.subscribeToData({
            message_type: 0,
            function_name: "SubscribeTrades",
            payload: JSON.stringify({
                OMSId: this.OMSId,
                InstrumentId: InstrumentId,
                IncludeLastCount: IncludeLastCount
            }),
            callback: callback
        })
    }

    unsubscribeTrades(InstrumentId, callback = function () { }) {
        this.sendMessage({
            message_type: 0,
            function_name: "UnsubscribeTrades",
            payload: JSON.stringify({
                OMSId: this.OMSId,
                InstrumentId: InstrumentId
            }),
            callback: callback
        })
    }

    subscribeAccountEvents(callback = function () { }) {
        this.subscribeToData({
            message_type: 0,
            function_name: "SubscribeAccountEvents",
            payload: JSON.stringify({
                OMSId: this.OMSId,
                AccountId: this.clientInfo.AccountId
            }),
            callback: callback
        })
    }

    ping(callback = function () { }) {
        this.sendMessage({
            message_type: 0,
            function_name: "Ping",
            payload: {},
            callback: callback
        })
    }
}

module.exports = CoinsProAPI;