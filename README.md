# PubSubHubbub but its typescript!

PubSubHubbub subscriber module. Supports both 0.3 and 0.4 hubs.

**NB** Do not upgrade from v0.1.x - the API is totally different

## Installation

NPM:

```bash
$ npm install https://github.com/BowsiePup/typescript-pubsubhubbub.git
```

## Getting Started

### Creating a basic subscriber

```typescript
import PubSubHubbubServer from "typescript-pubsubhubbub";

const hub = new PubSubHubbubServer(options); // Detailed options shown below

hub.listen(3000); // Hub listen port.
```

### Your options object

```typescript
PubSubHubBubOptions {
  callbackUrl: String; // Callback URL for the hub - OPTIONAL
  secret?: String; // Secret value for HMAC signatures - OPTIONAL
  maxContentSize?: Number; // Maximum allowed size of the POST messages - OPTIONAL
  auth?: { // Authentication options - OPTIONAL
    username: String; // Username for HTTP Authentication
    password: String; // Username for HTTP Authentication
  };
}
```

### Basic Events

- ```typescript
  <hub>.on("listen", () => {}) // HTTP server has been set up and is listening for incoming connections
  ```
- ```typescript
  <hub>.on("error", (err: HttpError) => {}) // HTTP server has returned an error
  ```
- ```typescript
  <hub>.on("subscribe", () => {}) // Subscription for a feed has been updated
  ```
- ```typescript
  <hub>.on("unsubscribe", () => {}) // Subscription for a feed has been removed
  ```
- ```typescript
  <hub>.on("denied", () => {}) // Subscription has been denied
  ```
- ```typescript
  <hub>.on("feed", () => {}) // Incoming notification from the hub
  ```

## Working with the module

### Listening on the secleted port

```typescript
<hub>.listen(port)
```

- **port** - HTTP port the server will listen on

### Subscribing to a feed

```typescript
<hub>.subscribe(topic, feedUrl, callbackUrl, callback?)
```

- **topic** is the URL of the RSS/ATOM feed to subscribe to
- **hub** is the hub for the feed
- **callbackUrl** is the URL of the callback for the feed (Optional unless using a callback function)
- **callback** (optional) is the callback function with an error object if the subscription failed

### Unsubscribing from a feed

```typescript
<hub>.unsubscribe(topic, feedUrl, callbackUrl, callback?)
```

- **topic** is the URL of the RSS/ATOM feed to subscribe to
- **hub** is the hub for the feed
- **callbackUrl** is the URL of the callback for the feed (Optional unless using a callback function)
- **callback** (optional) is the callback function with an error object if the subscription failed

## Recieving notifications

Notifications are sent to the callback URL of the feed. These are recieved as XML.

The `feed` event structure contains:

- **topic** - Topic URL
- **hub** - Hub URL, might be undefined
- **callback** - Callback URL that was used by the Hub
- **feed** - Feed XML as a Buffer object
- **headers** - Request headers object
