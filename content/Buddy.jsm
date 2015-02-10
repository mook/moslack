/**
 * buddy (user) on Slack
 * Note that, unlike normal IM, not all users might be in the contact list.
 */

const EXPORTED_SYMBOLS = [ "SlackAccountBuddy", "SlackBuddyConversation" ];
const { interfaces: Ci, utils: Cu } = Components;

Cu.import("resource:///modules/imServices.jsm");
Cu.import("resource:///modules/imXPCOMUtils.jsm");
Cu.import("resource:///modules/jsProtoHelper.jsm");
Cu.import("chrome://moslack/content/Conversation.jsm");
Cu.import("chrome://moslack/content/Channel.jsm");
Cu.import("chrome://moslack/content/SlackOAuth.jsm");
Cu.import("chrome://moslack/content/Utils.jsm");

function SlackAccountBuddy(aAccount, aUserData) {
    let tag = Services.tags.defaultTag;
    this._init(aAccount, null, tag, aUserData.name);
    this._data = {};
    this.update(aUserData);
}

SlackAccountBuddy.prototype = Utils.extend(GenericAccountBuddyPrototype, {
    get normalizedName() this._data.id,
    get canSendMessage() true,

    update: function(aData) {
        Object.assign(this._data, aData);
    },

    createConversation: function() {
        if (this._account.channels.has(this._data.id)) {
            return this._account.channels.get(this._data.id);
        }
        let channel = new SlackBuddyConversation(this._account, this);
        this._account.channels.set(this._data.id, channel);
        SlackOAuth.request("im.open", {
            token: this._account.token,
            user: this._data.id,
        }).then((r) => {
            channel.update(r);
            channel.notifyObservers(new nsSimpleEnumerator([this]),
                                    "chat-buddy-add");
            this.DEBUG(`IM opened on ${r.channel.id}`);
        }).catch((r) => {
            this.DEBUG(`Failed to create conversation: ${r}`);
        })
        return channel;
    },

    toString() `<SlackAccountBuddy ${this.displayName} (${this.normalizedName})>`,

    classDescription: "SlackAccountBuddy object",

    get wrappedJSObject() this,
});

function SlackBuddyConversation(aAccount, aBuddy) {
    this.buddy = aBuddy;
    this._init(aAccount, aBuddy.name);
    this._data = {};
}

SlackBuddyConversation.prototype = Utils.extend(GenericConvIMPrototype,
                                                SlackGenericConversationMixin,
                                                {
    update: function(aData) {
        Object.assign(this._data, aData);
    },

    get name() this.buddy.displayName,

    get normalizedName() this._data.id || this.buddy.id,

    toString() `<IM ${this.buddy.displayName}(${this.normalizedName})>`,

    classDescription: "SlackBuddyConversation object",

    get wrappedJSObject() this,
});
