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
        this.DEBUG(`Trying to create conversation with ${this}`);
        if (this._data.id in this._account.channels) {
            let channel = this._account.channels[this._data.id];
            this.DEBUG(`Found existing conversation ${channel} with ${this}`);
            channel.notifyObservers(null, "chat-update-topic");
            return channel;
        }
        let channel = new SlackBuddyConversation(this._account, this);
        this._account.channels[this._data.id] = channel;
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
        });
        this.DEBUG(`Created new conversation ${channel} with ${this}`);
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

    close: function() {
        Object.defineProperty(this, "DEBUG", {value: this._account.DEBUG});
        this.DEBUG(`Closing conversation ${this} with ${this.buddy}`);
        SlackOAuth.request("im.close", {
            token: this._account.token,
            channel: this.normalizedName
        }).then((r) => {
            try {
                delete this._account.channels[this.buddy.normalizedName];
                GenericConvIMPrototype.close.call(this);
                this.DEBUG(`Closed conversation ${this} with ${this.buddy}`);
            } catch (e) {
                dump(`Error cleaning up closed conversation ${this}: ${e}`);
            }
        }).catch((r) => {
            this.DEBUG(`Failed to close channel ${this} because ${r.error}`);
            switch (r.error) {
                case "channel_not_found":
                    GenericConvIMPrototype.close.call(this);
                    delete this._account.channels[this.buddy.normalizedName];
            }
        });
    },

    get name() this.buddy.displayName,

    get normalizedName() this._data.id || this.buddy.id,

    toString() `<IM ${this.buddy.displayName}(${this.normalizedName})>`,

    classDescription: "SlackBuddyConversation object",

    get wrappedJSObject() this,
});
