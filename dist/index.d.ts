/// <reference types="node" />
import { Server } from "http";
import EventEmitter3 from "eventemitter3";
export interface PubSubHubBubOptions {
    callbackUrl: String;
    secret?: String;
    maxContentSize?: Number;
    auth?: {
        username: String;
        password: String;
        sendImmediately?: Boolean;
    };
}
export default class PubSubHubBubServer extends EventEmitter3 {
    /** Secret used for authentication */
    secret: String | Boolean;
    /** Callback URL */
    callbackUrl: String;
    /** Maximum content size */
    maxContentSize: Number;
    /** Username and password for authentication */
    auth: {
        username: String;
        password: String;
        sendImmediately: Boolean;
    };
    /** Port to listen on */
    port: Number;
    /** Http server instance */
    server: Server;
    /**
     * Used to create the hub server
     * @param {PubSubHubBubOptions} options Options for the hub server
     * @param {String} options.callbackUrl Callback URL
     * @param {String} options.secret Secret used for authentication
     * @param {Number} options.maxContentSize Maximum content size
     * @param {PubSubHubBubOptions.Auth} options.auth Username and password for authentication
     */
    constructor(options?: PubSubHubBubOptions);
    /** Start the hub listening on the provided port
     * @param {Number} port Port to listen on [Default: 3000]
     */
    listen(port?: Number): void;
    /** Subscribes to a topic on the provided hub
     * @param {String} topic Topic to subscribe to (Atom or RSS feed URL)
     * @param {String} hub Hub to subscribe to (Hub URL)
     * @param {String | undefined} callbackUrl Callback URL for the hub, Usually this server ip & port / URL
     * @param {Function} callback Callback function to execute when the hub responds
     */
    subscribe(topic: String, hub: String, callbackUrl?: String, callback?: Function): void;
    /** Unsubscribes from a topic on the provided hub
     * @param {String} topic Topic to unsubscribe from (Atom or RSS feed URL)
     * @param {String} hub Hub to unsubscribe from (Hub URL)
     * @param {String | undefined} callbackUrl Callback URL for the hub, Usually this server ip & port / URL
     * @param {Function} callback Callback function to execute when the hub responds
     */
    unsubscribe(topic: String, hub: String, callbackUrl?: String, callback?: Function): void;
    /** Sends a subscription request to the hub
     * @param {String} action Action to send to the hub
     * @param {String} topic Topic to send to the hub
     * @param {String} hub Hub to send to the hub
     * @param {String | undefined} callbackUrl Callback URL for the hub, Usually this server ip & port / URL
     * @param {Function} callback Callback function to execute when the hub responds
     */
    setSubscription(action: "subscribe" | "unsubscribe", topic: String, hub: String, callbackUrl?: String, callback?: Function): void;
    /**
     * Will be fired when HTTP server has successfully started listening on the selected port
     *
     * @event
     */
    private _onRequestRecieved;
    /**
     * GET request handler for the HTTP server. This should be called when the server
     * tries to verify the intent of the subscriber.
     *
     * @param {Object} req HTTP Request object
     * @param {Object} res HTTP Response object
     */
    private _onGetRequestRecieved;
    /**
     * POST request handler. Should be called when the hub tries to notify the subscriber
     * with new data
     *
     * @param {Object} req HTTP Request object
     * @param {Object} res HTTP Response object
     */
    private _onPostRequestRecieved;
    /**
     * Will be fired when HTTP server has successfully started listening on the selected port
     *
     * @event
     */
    private _onListening;
    /**
     * Error event handler for the HTTP server
     *
     * @event
     * @param {Error} error Error object
     */
    private _onError;
    /** Send an error response
     * @param req Request object
     * @param res Response object
     * @param statusCode Status code
     * @param message Error message
     */
    private _sendError;
}
