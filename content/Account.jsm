const EXPORTED_SYMBOLS = ["SlackAccount"];
const { interfaces: Ci, results: Cr, utils: Cu } = Components;

Cu.import("resource://gre/modules/Preferences.jsm");
Cu.import("resource:///modules/jsProtoHelper.jsm");
Cu.import("chrome://moslack/content/SlackOAuth.jsm");
Cu.import("chrome://moslack/content/Utils.jsm");

function SlackAccount(aPrpl, aImAccount) {
    this._init(aPrpl, aImAccount);
    this.oauth = SlackOAuth.get(this.name);
    if (!this.oauth.accessToken) {
        this.oauth.accessToken = aImAccount.password;
        this.DEBUG("Access token restored " + this.oauth.accessToken);
    }
}

SlackAccount.prototype = Utils.extend(GenericAccountPrototype, {
    remove: function() {},
    unInit: function() {},
    connect: function() {
        this.reportConnecting();
        this.DEBUG("Connecting to " + this.name);
        SlackOAuth.connect(this.name)
                  .then(() => {
                    this.DEBUG("Connected to " + this.name);
                    this.reportConnected();
                  })
                  .catch((e) => {
                    this.DEBUG("Failed to connect to " + this.name + ": " + JSON.stringify(e));
                    this.reportDisconnecting(Ci.prplIAccount.ERROR_OTHER_ERROR,
                                             (e || {}).error || "Unknown error");
                    this.disconnect();
                  });
        this.DEBUG("Waiting for oauth");
    },
    disconnect: function() {
        this.reportDisconnected();
    },

    createConversation: function(aName) {
        throw Cr.NS_ERROR_NOT_IMPLEMENTED;
    },

    joinChat: function(aComponents) {
        throw Cr.NS_ERROR_NOT_IMPLEMENTED;
    },
});
