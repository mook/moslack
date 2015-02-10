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
                    let accountBuddy = new SlackAccountBuddy(this, userData);
                    buddies.set(userData.id, accountBuddy);
                    buddiesByName.set(userData.name, accountBuddy);
                    this.DEBUG(`accountBuddy: ${accountBuddy} account: ${this.imAccount} prpl: ${this.imAccount.protocol.wrappedJSObject}`);
                    let buddy = Services.contacts.getBuddyByNameAndProtocol(userData.id, this.imAccount.protocol);
                    if (buddy) {
                        accountBuddy.buddy = buddy;
                    } else {
                        try {
                            Services.contacts.accountBuddyAdded(accountBuddy);
                        } catch (e) {
                            this.DEBUG(e);
                        }
                    }
                    accountBuddy.setStatus(userData.presence == 'active' ?
                        Ci.imIStatusInfo.STATUS_AVAILABLE :
                        Ci.imIStatusInfo.STATUS_OFFLINE);
                }
                this.buddies = buddies;
                this.buddiesByName = buddiesByName;
                return response;
            })
            .then((response) => {
                this.DEBUG("Loading channels from response");
                let channels = Object.create(null);
                Object.defineProperty(channels, Symbol.iterator, {
                    value: function() {
                        let keys = Object.keys(this);
                        return {
                            next: function() {
                                if (keys.length < 1) {
                                    return { done: true };
                                }
                                let key = keys.shift();
                                return { value: this[key], done: false };
                            }.bind(this)
                        };
                    },
                });
                for (let channelData of response.channels) {
                    let channel;
                    if (this.channels && (channelData.id in this.channels)) {
                        channel = this.channels[channelData.id];
                    } else {
                        channel = new SlackChannel(this, channelData);
                    }
                    channels[channelData.id] = channel;
                    this.DEBUG("channel: " + channel);
                }
                this.DEBUG(`Channels: ${[c for (c of channels)].join(", ")}`);
                return [response, channels];
            })
            .then(([response, channels]) => {
                this.DEBUG("Loading IMs from response");
                for (let channelData of response.ims) {
                    let buddy = this.buddies.get(channelData.user);
                    if (!buddy) {
                        this.WARN(`Loading IM from unknown user ${channelData.user}`);
                        continue;
                    }
                    let channel;
                    if (this.channels && (channelData.id in this.channels)) {
                        channel = this.channels[channelData.id];
                    } else {
                        channel = new SlackBuddyConversation(this, buddy);
                    }
                    channel.update(channelData);
                    channels[channelData.id] = channel;
                    this.DEBUG(`IM: ${channel}`);
                }
                this.channels = channels;
                this.DEBUG("Channels: " + [c for (c of this.channels)].join(", "));
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
                } else if ("error" in e) {
                    msg = e.error;
                } else if ("message" in e) {
                    msg = e.message;
                } else if (e instanceof Object) {
                    msg = JSON.stringify(e);
                    if (msg == "{}") {
                        msg = Object.keys(e).join(", ");
                        if (msg == "") {
                            msg = Object.getOwnPropertyNames(e).join(", ");
                        }
                    }
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
        for (let channel of this.channels || []) {
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
            if (data.channel in this.channels) {
                let channel = this.channels[data.channel];
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
                this.DEBUG(`Message for unknown channel ${data.channel} of [${[c for (c of Object.keys(this.channels))].join(", ")}]`);
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
        this.DEBUG(`presence change: ${buddy} -> ${data.presence}`)
        switch (data.presence) {
            case "active":
                buddy.setStatus(Ci.imIStatusInfo.STATUS_AVAILABLE);
                break;
            case "away":
                buddy.setStatus(Ci.imIStatusInfo.STATUS_OFFLINE);
                break;
        }
    },

    on_team_join: function(aData) {
        if (this.buddies.has(aData.user.id)) {
            this.buddies.get(aData.user.id).update(aData);
            return;
        }
        let buddy = new SlackAccountBuddy(this, aData.user);
        this.buddies.set(aData.user.id, buddy);
        this.buddiesByName.set(aData.user.name, buddy);
        this.DEBUG("team join: " + buddy);
        Services.contacts.accountBuddyAdded(buddy);
        buddy.setStatus(aData.user.presence == 'active' ?
            Ci.imIStatusInfo.STATUS_AVAILABLE :
            Ci.imIStatusInfo.STATUS_OFFLINE);
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

    toString() `<SlackAccount ${this.name}>`,
});
