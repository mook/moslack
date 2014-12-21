const EXPORTED_SYMBOLS = ["SlackAccount"];
const { interfaces: Ci, results: Cr, utils: Cu } = Components;

Cu.import("resource://gre/modules/Preferences.jsm");
Cu.import("resource:///modules/imServices.jsm");
Cu.import("resource:///modules/jsProtoHelper.jsm");
Cu.import("chrome://moslack/content/SlackOAuth.jsm");
Cu.import("chrome://moslack/content/Buddy.jsm");
Cu.import("chrome://moslack/content/Channel.jsm");
Cu.import("chrome://moslack/content/Utils.jsm");
Cu.import("chrome://moslack/content/WebSocket.jsm");

function SlackAccount(aPrpl, aImAccount) {
    this._init(aPrpl, aImAccount);
    this.token = null;
    this.self = null;
}

SlackAccount.prototype = Utils.extend(GenericAccountPrototype, {
    remove: function() {},
    unInit: function() {},
    connect: function() {
        if (this.connecting) {
            this.DEBUG("Warning: ignoring duplicate connect attempt");
            return;
        }
        this.DEBUG("Connecting; state=" + this.imAccount.connectionState);
        this.reportConnecting();
        this.DEBUG("Connecting to " + this.name);
        this.socket = null;
        this.pending = null;
        SlackOAuth
            .connect(true, this.imAccount.password)
            .then(({token}) => {
                this.DEBUG("Connected to " + this.name);
                if (token != this.imAccount.password) {
                    // This seems to cause a reconnect...
                    this.imAccount.password = token;
                }
                this.token = token;
            })
            .then(() => SlackOAuth.request('rtm.start', {token: this.token}))
            .then((response) => {
                this.DEBUG('RTM response:', JSON.stringify(response));
                return response;
            })
            .then((response) => {
                this.self = response.self;
                return response;
            })
            .then((response) => {
                this.DEBUG("Loading buddies from response");
                let buddies = new Map();
                let buddiesByName = new Map();
                for (let userData of response.users) {
                    let buddy = new SlackAccountBuddy(this, userData);
                    buddies.set(userData.id, buddy);
                    buddiesByName.set(userData.name, buddy);
                    this.DEBUG("buddy: " + buddy);
                    Services.contacts.accountBuddyAdded(buddy);
                }
                this.buddies = buddies;
                this.buddiesByName = buddiesByName;
                return response;
            })
            .then((response) => {
                this.DEBUG("Loading channels from response");
                let channels = new Map();
                for (let channelData of response.channels) {
                    let channel;
                    if (this.channels && this.channels.has(channelData.id)) {
                        channel = this.channels.get(channelData.id);
                    } else {
                        channel = new SlackChannel(this, channelData);
                    }
                    channels.set(channelData.id, channel);
                    this.DEBUG("channel: " + channel);
                }
                this.channels = channels;
                this.DEBUG("Channels: " + [c for (c in this.channels.values())].join(", "));
                return response;
            })
            .then((response) => {
                // Hook up the message stream
                return new Promise((resolve, reject) => {
                    let socket = new WebSocket(response.url);
                    socket.onopen = () => {
                        this.socket = socket;
                        this.pending = new Map();
                        socket.onmessage = this.onmessage.bind(this);
                        socket.onerror = this.onerror.bind(this);
                        resolve(response);
                    };
                    socket.onerror = () => {
                        reject({error: "Failed to connect to real time messaging stream"});
                    };
                    socket.onclose = () => {
                        this.disconnect();
                    };
                });
            })
            .then(() => this.reportConnected())
            .catch((e) => {
                let msg = e;
                if (e instanceof Error) {
                    msg = e.message + "\n" + e.stack;
                } else if (e instanceof Object) {
                    msg = JSON.stringify(e);
                } else if ("error" in e) {
                    msg = e.error;
                } else if ("message" in e) {
                    msg = e.message;
                }
                this.DEBUG("Failed to connect to " + this.name + ": " + msg);
                e = e || { error: "Unknown Error" };
                this.disconnect(Ci.prplIAccount.ERROR_OTHER_ERROR,
                                e.error || e.message || e);
            });
        this.DEBUG("Waiting for oauth");
    },
    disconnect: function(aError, aErrorMessage) {
        this.reportDisconnecting(Ci.prplIAccount.NO_ERROR, '');
        if (this.socket) {
            this.socket.close(CloseEvent.CLOSE_GOING_AWAY);
            this.socket = null;
        }
        for (let [id, channel] of this.channels || []) {
            channel.notifyObservers(channel, "update-conv-chatleft");
        }
        this.reportDisconnected();
},

    createConversation: function(aName) {
        throw Cr.NS_ERROR_NOT_IMPLEMENTED;
    },

    joinChat: function(aComponents) {
        throw Cr.NS_ERROR_NOT_IMPLEMENTED;
    },

    onmessage: function(event) {
        let data = JSON.parse(event.data);
        let reply_to = data.reply_to || null;
        if (reply_to && this.pending.has(reply_to)) {
            let callback = this.pending.get(reply_to);
            this.pending.delete(reply_to);
            callback(data);
            return;
        } else if (reply_to) {
            this.DEBUG("Replying to martian message " + reply_to);
        }
        this.DEBUG("Got message: " + JSON.stringify(data));
        let handler = "on_" + data.type;

        if ("channel" in data) {
            if (this.channels.has(data.channel)) {
                let channel = this.channels.get(data.channel);
                if (handler in channel) {
                    try {
                        channel[handler](data);
                    } catch (e) {
                        try {
                            channel.ERROR(e);
                        } catch(e2) {
                            this.ERROR(e);
                        }
                    }
                    return;
                }
            } else {
                this.DEBUG(`Message for unknown channel ${data.channel} of [${[c for (c in this.channels.values())].join(", ")}]`);
            }
        }
        if (handler in this) {
            try {
                this[handler](data);
            } catch(e) {
                this.ERROR(e);
            }
        } else {
            this.DEBUG(`Unknown message ${JSON.stringify(data)}`);
        }
    },

    onerror: function(event) {
    },

    on_hello: function(event) {
        /* nothing */
    },

    on_presence_change: function(data) {
        let buddy;
        let state = data.presence;
        if (!this.buddies) {
            this.WARN("Got presence change with no buddy list, invalid state!?");
            return;
        }
        if (this.buddies.has(data.user)) {
            buddy = this.buddies.get(data.user);
        } else {
            this.WARN(`presence change for unknown buddy ${data.user} not implemented`);
            return;
        }
        switch (data.presense) {
            case "active":
                buddy.setStatus(Ci.imIStatusInfo.STATUS_AVAILABLE);
                break;
            case "away":
                buddy.setStatus(Ci.imIStatusInfo.STATUS_AWAY);
                break;
        }
    },

    request: function(api, data={}) {
        let id = (Date.now() + Math.random()).toString();
        data = Object.assign({
            token: this.token,
            id: id,
            type: api,
        }, data);
        return new Promise((resolve, reject) => {
            let onresponse = (message) => {
                if (message.ok) {
                    resolve(message);
                } else {
                    reject(message);
                }
            };
            this.pending.set(id, onresponse);
            this.DEBUG([x for (x of this.pending.keys())].join(", "));
            this.socket.send(JSON.stringify(data));
        });
    },

    token: null, /* OAuth access token */

    socket: null, /* WebSocket for the RTM connection */

    self: null, /* data about this user */

    buddies: null, /* users known, by user id */

    buddiesByName: null, /* users known, by user name */

    channels: null, /* channels, by channel id */
});
