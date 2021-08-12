"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
exports.__esModule = true;
var http_1 = require("http");
var request_1 = require("request");
var url_1 = require("url");
var crypto_1 = require("crypto");
var common_tags_1 = require("common-tags");
var eventemitter3_1 = __importDefault(require("eventemitter3"));
var PubSubHubBubServer = /** @class */ (function (_super) {
    __extends(PubSubHubBubServer, _super);
    //* [END] Server Data */
    /**
     * Used to create the hub server
     * @param {PubSubHubBubOptions} options Options for the hub server
     * @param {String} options.callbackUrl Callback URL
     * @param {String} options.secret Secret used for authentication
     * @param {Number} options.maxContentSize Maximum content size
     * @param {PubSubHubBubOptions.Auth} options.auth Username and password for authentication
     */
    function PubSubHubBubServer(options) {
        if (options === void 0) { options = { callbackUrl: "" }; }
        var _this = _super.call(this) || this;
        // Set secret if provided
        _this.secret = options.secret || false;
        // Set the callback URL
        _this.callbackUrl = options.callbackUrl;
        // Set the maximum content size
        _this.maxContentSize = options.maxContentSize || 3 * 1024 * 1024;
        // Set authentication if provided
        if (options.auth) {
            _this.auth = {
                username: options.auth.username,
                password: options.auth.password,
                sendImmediately: false
            };
        }
        return _this;
    }
    //^ Public methods
    /** Start the hub listening on the provided port
     * @param {Number} port Port to listen on [Default: 3000]
     */
    PubSubHubBubServer.prototype.listen = function (port) {
        if (port === void 0) { port = 3000; }
        this.port = port;
        // Create the server
        this.server = http_1.createServer();
        // Handle a request to the server
        this.server.on("request", this._onRequestRecieved.bind(this));
        // Handle errors and listening events
        this.server.on("error", this._onError.bind(this));
        this.server.on("listening", this._onListening.bind(this));
    };
    /** Subscribes to a topic on the provided hub
     * @param {String} topic Topic to subscribe to (Atom or RSS feed URL)
     * @param {String} hub Hub to subscribe to (Hub URL)
     * @param {String | undefined} callbackUrl Callback URL for the hub, Usually this server ip & port / URL
     * @param {Function} callback Callback function to execute when the hub responds
     */
    PubSubHubBubServer.prototype.subscribe = function (topic, hub, callbackUrl, callback) {
        this.setSubscription("subscribe", topic, hub, callbackUrl, callback);
    };
    /** Unsubscribes from a topic on the provided hub
     * @param {String} topic Topic to unsubscribe from (Atom or RSS feed URL)
     * @param {String} hub Hub to unsubscribe from (Hub URL)
     * @param {String | undefined} callbackUrl Callback URL for the hub, Usually this server ip & port / URL
     * @param {Function} callback Callback function to execute when the hub responds
     */
    PubSubHubBubServer.prototype.unsubscribe = function (topic, hub, callbackUrl, callback) {
        this.setSubscription("unsubscribe", topic, hub, callbackUrl, callback);
    };
    /** Sends a subscription request to the hub
     * @param {String} action Action to send to the hub
     * @param {String} topic Topic to send to the hub
     * @param {String} hub Hub to send to the hub
     * @param {String | undefined} callbackUrl Callback URL for the hub, Usually this server ip & port / URL
     * @param {Function} callback Callback function to execute when the hub responds
     */
    PubSubHubBubServer.prototype.setSubscription = function (action, topic, hub, callbackUrl, callback) {
        var _this = this;
        // Set the topic url to the callback URL
        callbackUrl =
            callbackUrl ||
                this.callbackUrl +
                    (this.callbackUrl.replace(/^https?:\/\//i, "").match(/\//) ? "" : "/") +
                    (this.callbackUrl.match(/\?/) ? "&" : "?") +
                    "topic=" +
                    encodeURIComponent(topic.toString()) +
                    "&hub=" +
                    encodeURIComponent(hub.toString());
        var form = {
            "hub.callback": callbackUrl,
            "hub.mode": action,
            "hub.topic": topic,
            "hub.verify": "async"
        }, postParams = {
            url: hub,
            form: form,
            encoding: "utf-8"
        };
        if (this.auth)
            postParams.auth = this.auth;
        if (this.secret)
            form["hub.secret"] = crypto_1.createHmac("sha1", this.secret.toString())
                .update(topic.toString())
                .digest("hex");
        // Send the request
        request_1.post(postParams, function (error, response, body) {
            // Check for errors
            if (error) {
                if (callback)
                    return callback(error);
                return _this.emit("denied", { topic: topic, error: error });
            }
            // Check the response code
            if (response.stausCode !== 202 && response.statusCode !== 204) {
                var err = new Error("Invalid response staus " + response.statusCode);
                err.responseBody = (body || "").toString();
                if (callback)
                    return callback(err);
                return _this.emit("denied", { topic: topic, error: err });
            }
            return callback && callback(null, topic);
        });
    };
    //^ Private methods
    /**
     * Will be fired when HTTP server has successfully started listening on the selected port
     *
     * @event
     */
    PubSubHubBubServer.prototype._onRequestRecieved = function (req, res) {
        // Process the request type and handle acorrdingly
        switch (req.method) {
            case "GET":
                return this._onGetRequestRecieved(req, res);
            case "POST":
                return this._onPostRequestRecieved(req, res);
            default:
                return this._sendError(req, res, 405, "Method Not Allowed");
        }
    };
    /**
     * GET request handler for the HTTP server. This should be called when the server
     * tries to verify the intent of the subscriber.
     *
     * @param {Object} req HTTP Request object
     * @param {Object} res HTTP Response object
     */
    PubSubHubBubServer.prototype._onGetRequestRecieved = function (req, res) {
        //@ts-ignore
        var params = url_1.parse(req.url, true, true), data;
        // Check if the request is a valid hub request
        if (!params.query["hub.topic"] || !params.query["hub.mode"]) {
            return this._sendError(req, res, 400, "Bad Request");
        }
        // Check the hub mode
        switch (params.query["hub.mode"]) {
            case "denied":
                res.writeHead(200, { "Content-Type": "text/plain" });
                data = { topic: params.query["hub.topic"], hub: params.query.hub };
                res.end(params.query["hub.challenge"] || "ok");
                break;
            case "subscribe":
            case "unsubscribe":
                res.writeHead(200, { "Content-Type": "text/plain" });
                res.end(params.query["hub.challenge"]);
                data = {
                    topic: params.query["hub.topic"],
                    hub: params.query.hub,
                    lease: Number(params.query["hub.lease_seconds"] || 0) +
                        Math.round(Date.now() / 1000)
                };
                break;
            default:
                // Fail as invalid hub mode
                return this._sendError(req, res, 403, "Forbidden");
        }
        // Emit subcsribtion event
        this.emit((params.query["hub.mode"] || "").toString(), data);
    };
    /**
     * POST request handler. Should be called when the hub tries to notify the subscriber
     * with new data
     *
     * @param {Object} req HTTP Request object
     * @param {Object} res HTTP Response object
     */
    PubSubHubBubServer.prototype._onPostRequestRecieved = function (req, res) {
        var _this = this;
        var bodyChunks = [], 
        //@ts-ignore
        params = url_1.parse(req.url, true, true), topic = params && params.query && params.query.topic, hub = params && params.query && params.query.hub, bodyLen = 0, tooLargeRequest = false, sigParts, algo, sig, hmac;
        // v0.4 hubs have a link header that includes both the topic url and hub url
        //@ts-ignore
        ((req.headers && req.headers.link) || "").toString().replace(/<([^>]+)>\s*(?:;\s*rel=['"]([^'"]+)['"])?/gi, 
        //@ts-ignore
        function (o, url, rel) {
            switch ((rel || "").toLowerCase()) {
                case "self":
                    topic = url;
                    break;
                case "hub":
                    hub = url;
                    break;
            }
        });
        // Check if the request is a valid topic request
        if (!topic)
            return this._sendError(req, res, 400, "Bad Request");
        // If secret is set, check if the signature header exists
        //@ts-ignore
        if (this.secret && !req.headers["x-hub-signature"])
            return this._sendError(req, res, 403, "Forbidden");
        // Check if the provided signature is valid
        if (this.secret) {
            //@ts-ignore
            sigParts = (req.headers["x-hub-signature"] || "").split("=");
            algo = (sigParts.shift() || "").toLowerCase();
            sig = (sigParts.pop() || "").toLowerCase();
            // Check if the signature is valid
            try {
                hmac = crypto_1.createHmac(algo, this.secret.toString())
                    .update(topic.toString())
                    .digest("hex");
            }
            catch (e) {
                return this._sendError(req, res, 403, "Forbidden");
            }
        }
        //@ts-ignore
        req
            .on("data", function (chunk) {
            // Check if there is no chunk or the req is too large
            if (!chunk || !chunk.length || tooLargeRequest)
                return;
            if (bodyLen + chunk.length > _this.maxContentSize) {
                tooLargeRequest = true;
                return;
            }
            bodyChunks.push(chunk);
            bodyLen += chunk.length;
            if (_this.secret)
                hmac.update(chunk);
            chunk = null;
        })
            //@ts-ignore
            .bind(this);
        req
            .on("end", function () {
            if (tooLargeRequest)
                return _this._sendError(req, res, 413, "Request Entity Too Large");
            if (_this.secret && hmac.digest("hex").toLowerCase() != sig) {
                res.writeHead(202, { "Content-Type": "text/plain; charset=utf-8" });
                return res.end();
            }
            res.writeHead(204, { "Content-Type": "text/plain; charset=utf-8" });
            res.end();
            _this.emit("feed", {
                topic: topic,
                hub: hub,
                //@ts-ignore
                callback: "http:// " + req.headers.host + req.url,
                feed: Buffer.concat(bodyChunks, bodyLen).toString("utf-8"),
                //@ts-ignore
                headers: req.headers
            });
        })
            //@ts-ignore
            .bind(this);
    };
    /**
     * Will be fired when HTTP server has successfully started listening on the selected port
     *
     * @event
     */
    PubSubHubBubServer.prototype._onListening = function () {
        // Fire a listening event
        this.emit("listening");
    };
    /**
     * Error event handler for the HTTP server
     *
     * @event
     * @param {Error} error Error object
     */
    PubSubHubBubServer.prototype._onError = function (err) {
        //Check if the error is from the listen action
        if (err.syscall == "listen")
            err.message = "Failed to listen on port " + this.port + " (" + err.code + ")";
        this.emit("error", err);
    };
    /** Send an error response
     * @param req Request object
     * @param res Response object
     * @param statusCode Status code
     * @param message Error message
     */
    PubSubHubBubServer.prototype._sendError = function (req, res, code, message) {
        res.writeHead(code, { "Content-Type": "text/html" });
        res.end(common_tags_1.stripIndents(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    <!DOCTYPE html>\n    <html>\n      <head>\n        <meta charset=\"utf-8\" />\n        <title>", " ", "</title>\n      </head>\n      <body>\n        <h1>", " ", "</h1>\n      </body>\n    </html>\n    "], ["\n    <!DOCTYPE html>\n    <html>\n      <head>\n        <meta charset=\"utf-8\" />\n        <title>", " ", "</title>\n      </head>\n      <body>\n        <h1>", " ", "</h1>\n      </body>\n    </html>\n    "])), code, message, code, message));
    };
    return PubSubHubBubServer;
}(eventemitter3_1["default"]));
exports["default"] = PubSubHubBubServer;
var templateObject_1;
