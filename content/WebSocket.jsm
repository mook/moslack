/**
 * Emulating DOM WebSocket API via XPCOM
 */

const EXPORTED_SYMBOLS = [ "WebSocket", "CloseEvent" ];

const { classes: Cc, interfaces: Ci, results: Cr, utils: Cu } = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource:///modules/imXPCOMUtils.jsm");
Cu.import("chrome://moslack/content/Utils.jsm");

function WebSocket(aURLSpec, aProtocols=[]) {
    if (!Array.isArray(aProtocols)) {
        aProtocols = [aProtocols];
    }
    aProtocols = aProtocols.filter(p => p instanceof String);
    this.DEBUG("Creating WebSocket for " + aURLSpec +
               " with protocols " + aProtocols.join(", "));
    let url = Services.io.newURI(aURLSpec, null, null);
    this.channel = Cc["@mozilla.org/network/protocol;1?name=" + url.scheme]
                     .createInstance(Ci.nsIWebSocketChannel);
    let context = {};
    context.wrappedJSObject = context;
    this.channel.asyncOpen(url, aURLSpec, this, context);
}

WebSocket.prototype = Utils.extend(WebSocket.prototype, initLogModule('prpl-slack.websocket', {
    // Ready state constants
    get CONNECTING() 0,
    get OPEN() 1,
    get CLOSING() 2,
    get CLOSED() 3,

    // WebSocket (webidl)
    get close() function(code, reason) {
        this.channel.close(code, reason);
    },
    get send() function(data) {
        data = new String(data);
        this.DEBUG("Sending data " + data);
        this.channel.sendMsg(data);
    },

    binaryType: null,
    get bufferedAmount() null,
    onclose: function() {},
    onerror: function() {},
    onmessage: function() {},
    onopen: function() {},

    closeEventCode: CloseEvent.CLOSE_ABNORMAL,
    closeEventReason: "",

    // nsIWebSocketListner
    get onStart() function(aContext) {
        this.DEBUG("onStart");
        this.onopen(new Event("open"));
    },
    get onStop() function(aContext, aStatusCode) {
        this.DEBUG("onStop: " + aStatusCode.toString(16));
        this.readyState = WebSocket.CLOSED;
        let code = this.closeEventCode;
        let reason = this.closeEventReason;
        let isClean = Components.isSuccessCode(aStatusCode);
        if (aStatusCode == Cr.NS_ERROR_BASE_STREAM_CLOSED) {
            aStatusCode = Cr.NS_OK;
        }
        if (!Components.isSuccessCode(aStatusCode)) {
            this.DEBUG("dispatching error");
            this.onerror(new Event("error"));
        }
        this.DEBUG("dispatching close event");
        this.onclose(new CloseEvent(code, reason, isClean));
    },
    get onMessageAvailable() function(aContext, aMsg) {
        this.DEBUG("Received message " + aMsg);
        this.onmessage(new MessageEvent(aMsg));
    },
    get onServerClose() function(aContext, aCode, aReason) {
        this.DEBUG("server close: " + aCode + ": " + aReason);
        this.DEBUG("in state: " + this.readyState);
        if (this.readyState != WebSocket.OPEN) {
            return;
        }
        if ([1005, 1006, 1015].indexOf(aCode) != -1) {
            aCode = 0;
            aReason = "";
        }
        this.closeEventCode = aCode;
        this.closeEventReason = aReason;
        this.readyState = WebSocket.CLOSING;
        this.channel.close(aCode, aReason);
    },
    get QueryInterface() XPCOMUtils.generateQI([Ci.nsIWebSocketListener]),
}));

for (let prop of ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED']) {
    let descriptor = Object.getOwnPropertyDescriptor(WebSocket.prototype, prop);
    Object.defineProperty(WebSocket, prop, descriptor);
}

function Event(aType) {
    Object.defineProperty(this, "type", {value: aType, enumerable: true});
}

function CloseEvent(code, reason, clean) {
    Event.call(this, "close");
    Object.defineProperties(this, {
        code: {value: code, enumerable: true},
        reason: {value: reason, enumerable: true},
        clean: {value: !!clean, enumerable: true},
    });
}
CloseEvent.prototype = Utils.extend(CloseEvent.prototype, Event);

for (let prop of Object.keys(Ci.nsIWebSocketChannel)) {
    if (!prop.startsWith("CLOSE_")) {
        continue;
    }
    let descriptor = { value: Ci.nsIWebSocketChannel[prop], enumerable: true};
    Object.defineProperty(CloseEvent.prototype, prop, descriptor);
    Object.defineProperty(CloseEvent, prop, descriptor);
}

function MessageEvent(data) {
    Event.call(this, "message");
    this.data = data;
}