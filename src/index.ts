import {
  createServer,
  Server,
  ClientRequest as Req,
  ServerResponse as Res,
} from "http";
import { post } from "request";
import { parse as urlParse } from "url";
import { createHmac } from "crypto";
import { stripIndents } from "common-tags";
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

interface HttpError extends Error {
  syscall: String;
  code: Number;
}

interface postErrorResponse extends Error {
  responseBody?: String;
}

interface formObject {
  "hub.callback": String;
  "hub.mode": String;
  "hub.topic": String;
  "hub.verify": String;
  "hub.secret"?: String;
}

interface postParams {
  url: String;
  form: formObject;
  encoding: String;
  auth?: PubSubHubBubOptions["auth"];
}

export default class PubSubHubBubServer extends EventEmitter3 {
  //* [START] Constructor Data */
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
  //* [END] Constructor Data */

  //* [START] Server Data */
  /** Port to listen on */
  port: Number;
  /** Http server instance */
  server: Server;
  //* [END] Server Data */

  /**
   * Used to create the hub server
   * @param {PubSubHubBubOptions} options Options for the hub server
   * @param {String} options.callbackUrl Callback URL
   * @param {String} options.secret Secret used for authentication
   * @param {Number} options.maxContentSize Maximum content size
   * @param {PubSubHubBubOptions.Auth} options.auth Username and password for authentication
   */
  constructor(options: PubSubHubBubOptions = { callbackUrl: "" }) {
    super();

    // Set secret if provided
    this.secret = options.secret || false;
    // Set the callback URL
    this.callbackUrl = options.callbackUrl;
    // Set the maximum content size
    this.maxContentSize = options.maxContentSize || 3 * 1024 * 1024;

    // Set authentication if provided
    if (options.auth) {
      this.auth = {
        username: options.auth.username,
        password: options.auth.password,
        sendImmediately: false,
      };
    }
  }

  //^ Public methods

  /** Start the hub listening on the provided port
   * @param {Number} port Port to listen on [Default: 3000]
   */
  public listen(port: Number = 3000): void {
    this.port = port;

    // Create the server
    this.server = createServer();

    // Handle a request to the server
    this.server.on("request", this._onRequestRecieved.bind(this));
    // Handle errors and listening events
    this.server.on("error", this._onError.bind(this));
    this.server.on("listening", this._onListening.bind(this));
    
    this.server.listen(this.port)
  }

  /** Subscribes to a topic on the provided hub
   * @param {String} topic Topic to subscribe to (Atom or RSS feed URL)
   * @param {String} hub Hub to subscribe to (Hub URL)
   * @param {String | undefined} callbackUrl Callback URL for the hub, Usually this server ip & port / URL
   * @param {Function} callback Callback function to execute when the hub responds
   */
  public subscribe(
    topic: String,
    hub: String,
    callbackUrl?: String,
    callback?: Function
  ): void {
    this.setSubscription("subscribe", topic, hub, callbackUrl, callback);
  }

  /** Unsubscribes from a topic on the provided hub
   * @param {String} topic Topic to unsubscribe from (Atom or RSS feed URL)
   * @param {String} hub Hub to unsubscribe from (Hub URL)
   * @param {String | undefined} callbackUrl Callback URL for the hub, Usually this server ip & port / URL
   * @param {Function} callback Callback function to execute when the hub responds
   */
  public unsubscribe(
    topic: String,
    hub: String,
    callbackUrl?: String,
    callback?: Function
  ): void {
    this.setSubscription("unsubscribe", topic, hub, callbackUrl, callback);
  }

  /** Sends a subscription request to the hub
   * @param {String} action Action to send to the hub
   * @param {String} topic Topic to send to the hub
   * @param {String} hub Hub to send to the hub
   * @param {String | undefined} callbackUrl Callback URL for the hub, Usually this server ip & port / URL
   * @param {Function} callback Callback function to execute when the hub responds
   */
  public setSubscription(
    action: "subscribe" | "unsubscribe",
    topic: String,
    hub: String,
    callbackUrl?: String,
    callback?: Function
  ): void {
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

    let form: formObject = {
        "hub.callback": callbackUrl,
        "hub.mode": action,
        "hub.topic": topic,
        "hub.verify": "async",
      },
      postParams: postParams = {
        url: hub,
        form: form,
        encoding: "utf-8",
      };
    if (this.auth) postParams.auth = this.auth;

    if (this.secret)
      form["hub.secret"] = createHmac("sha1", this.secret.toString())
        .update(topic.toString())
        .digest("hex");

    // Send the request

    post(postParams, (error, response, body) => {
      // Check for errors
      if (error) {
        if (callback) return callback(error);
        return this.emit("denied", { topic: topic, error: error });
      }

      // Check the response code
      if (response.stausCode !== 202 && response.statusCode !== 204) {
        let err: postErrorResponse = new Error(
          `Invalid response staus ${response.statusCode}`
        );
        err.responseBody = (body || "").toString();

        if (callback) return callback(err);
        return this.emit("denied", { topic: topic, error: err });
      }

      return callback && callback(null, topic);
    });
  }

  //^ Private methods
  /**
   * Will be fired when HTTP server has successfully started listening on the selected port
   *
   * @event
   */
  private _onRequestRecieved(req: Req, res: Res): void {
    // Process the request type and handle acorrdingly
    switch (req.method) {
      case "GET":
        return this._onGetRequestRecieved(req, res);
      case "POST":
        return this._onPostRequestRecieved(req, res);
      default:
        return this._sendError(req, res, 405, "Method Not Allowed");
    }
  }
  /**
   * GET request handler for the HTTP server. This should be called when the server
   * tries to verify the intent of the subscriber.
   *
   * @param {Object} req HTTP Request object
   * @param {Object} res HTTP Response object
   */
  private _onGetRequestRecieved(req: Req, res: Res): void {
    //@ts-ignore
    let params = urlParse(req.url, true, true),
      data;

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
          lease:
            Number(params.query["hub.lease_seconds"] || 0) +
            Math.round(Date.now() / 1000),
        };
        break;

      default:
        // Fail as invalid hub mode
        return this._sendError(req, res, 403, "Forbidden");
    }

    // Emit subcsribtion event
    this.emit((params.query["hub.mode"] || "").toString(), data);
  }
  /**
   * POST request handler. Should be called when the hub tries to notify the subscriber
   * with new data
   *
   * @param {Object} req HTTP Request object
   * @param {Object} res HTTP Response object
   */
  private _onPostRequestRecieved(req: Req, res: Res): void {
    let bodyChunks: Array<Buffer> = [],
      //@ts-ignore
      params = urlParse(req.url, true, true),
      topic = params && params.query && params.query.topic,
      hub = params && params.query && params.query.hub,
      bodyLen = 0,
      tooLargeRequest = false,
      sigParts,
      algo,
      sig,
      hmac;

    // v0.4 hubs have a link header that includes both the topic url and hub url
    //@ts-ignore
    ((req.headers && req.headers.link) || "").toString().replace(
      /<([^>]+)>\s*(?:;\s*rel=['"]([^'"]+)['"])?/gi,
      //@ts-ignore
      (o, url, rel) => {
        switch ((rel || "").toLowerCase()) {
          case "self":
            topic = url;
            break;
          case "hub":
            hub = url;
            break;
        }
      }
    );

    // Check if the request is a valid topic request
    if (!topic) return this._sendError(req, res, 400, "Bad Request");

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
        hmac = createHmac(algo, this.secret.toString())
          .update(topic.toString())
          .digest("hex");
      } catch (e) {
        return this._sendError(req, res, 403, "Forbidden");
      }
    }

    //@ts-ignore
    req
      .on("data", (chunk: Buffer | null) => {
        // Check if there is no chunk or the req is too large
        if (!chunk || !chunk.length || tooLargeRequest) return;

        if (bodyLen + chunk.length > this.maxContentSize) {
          tooLargeRequest = true;
          return;
        }

        bodyChunks.push(chunk);
        bodyLen += chunk.length;
        if (this.secret) hmac.update(chunk);

        chunk = null;
      })
      //@ts-ignore
      .bind(this);

    req
      .on("end", () => {
        if (tooLargeRequest)
          return this._sendError(req, res, 413, "Request Entity Too Large");

        if (this.secret && hmac.digest("hex").toLowerCase() != sig) {
          res.writeHead(202, { "Content-Type": "text/plain; charset=utf-8" });
          return res.end();
        }

        res.writeHead(204, { "Content-Type": "text/plain; charset=utf-8" });
        res.end();

        this.emit("feed", {
          topic: topic,
          hub: hub,
          //@ts-ignore
          callback: `http:// ${req.headers.host}${req.url}`,
          feed: Buffer.concat(bodyChunks, bodyLen).toString("utf-8"),
          //@ts-ignore
          headers: req.headers,
        });
      })
      //@ts-ignore
      .bind(this);
  }

  /**
   * Will be fired when HTTP server has successfully started listening on the selected port
   *
   * @event
   */
  private _onListening(): void {
    // Fire a listening event
    this.emit("listening");
  }

  /**
   * Error event handler for the HTTP server
   *
   * @event
   * @param {Error} error Error object
   */
  private _onError(err: HttpError): void {
    //Check if the error is from the listen action
    if (err.syscall == "listen")
      err.message = `Failed to listen on port ${this.port} (${err.code})`;

    this.emit("error", err);
  }

  /** Send an error response
   * @param req Request object
   * @param res Response object
   * @param statusCode Status code
   * @param message Error message
   */
  private _sendError(req: Req, res: Res, code: number, message: string): void {
    res.writeHead(code, { "Content-Type": "text/html" });

    res.end(stripIndents`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${code} ${message}</title>
      </head>
      <body>
        <h1>${code} ${message}</h1>
      </body>
    </html>
    `);
  }
}
