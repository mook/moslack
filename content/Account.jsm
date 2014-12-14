const EXPORTED_SYMBOLS = ["SlackAccount"];
const { interfaces: Ci, results: Cr, utils: Cu } = Components;

Cu.import("resource://gre/modules/Preferences.jsm");
Cu.import("resource:///modules/jsProtoHelper.jsm");
Cu.import("chrome://moslack/content/SlackOAuth.jsm");
Cu.import("chrome://moslack/content/Buddy.jsm");
Cu.import("chrome://moslack/content/Channel.jsm");
Cu.import("chrome://moslack/content/Utils.jsm");
Cu.import("chrome://moslack/content/WebSocket.jsm");

function SlackAccount(aPrpl, aImAccount) {
    this._init(aPrpl, aImAccount);
    this.token = null;
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
                this.DEBUG("Loading buddies from response");
                let buddies = new Map();
                let buddiesByName = new Map();
                for (let userData of response.users) {
                    let buddy = new SlackAccountBuddy(this, userData);
                    buddies.set(userData.id, buddy);
                    buddiesByName.set(userData.name, buddy);
                    this.DEBUG("buddy: " + buddy);
                }
                this.buddies = buddies;
                this.buddiesByName = buddiesByName;
                return response;
            })
            .then((response) => {
                this.DEBUG("Loading channels from response");
                let channels = new Map();
                for (let channelData of response.channels) {
                    let channel = new SlackChannel(this, channelData);
                    channels[channelData.id] = channel;
                    this.DEBUG("channel: " + channel);
                }
                this.channels = channels;
                return response;
            })
            .then((response) => {
                // Hook up the message stream
                return new Promise((resolve, reject) => {
                    let socket = new WebSocket(response.url);
                    socket.onopen = () => {
                        this.socket = socket;
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
                }
                this.DEBUG("Failed to connect to " + this.name + ": " + msg);
                e = e || { error: "Unknown Error" };
                this.reportDisconnecting(Ci.prplIAccount.ERROR_OTHER_ERROR,
                                         e.error || e.message || e);
                this.disconnect();
            });
        this.DEBUG("Waiting for oauth");
    },
    disconnect: function() {
        if (this.socket) {
            this.socket.close(CloseEvent.CLOSE_GOING_AWAY);
            this.socket = null;
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
        Cu.reportError(JSON.stringify(data));
    },

    onerror: function(event) {
    },

    token: null, /* OAuth access token */

    socket: null, /* WebSocket for the RTM connection */

    buddies: null, /* users known, by user id */

    buddiesByName: null, /* users known, by user name */

    channels: null, /* channels */
});
