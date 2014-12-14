const EXPORTED_SYMBOLS = ["SlackAccount"];
const { results: Cr, utils: Cu } = Components;

Cu.import("resource://gre/modules/Preferences.jsm");
Cu.import("resource:///modules/jsProtoHelper.jsm");
Cu.import("chrome://moslack/content/SlackOAuth.jsm");
Cu.import("chrome://moslack/content/Utils.jsm");

function SlackAccount(aPrpl, aImAccount) {
    this._init(aPrpl, aImAccount);
    this.oauth = SlackOAuth.get(aImAccount.name);
}

SlackAccount.prototype = Utils.extend(GenericAccountPrototype, {
    remove: function() {},
    unInit: function() {},
    connect: function() {},
    disconnect: function() {},

    createConversation: function(aName) {
        throw Cr.NS_ERROR_NOT_IMPLEMENTED;
    },

    joinChat: function(aComponents) {
        throw Cr.NS_ERROR_NOT_IMPLEMENTED;
    },
});
