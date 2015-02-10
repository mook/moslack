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
        if (this.normalizedName in this._account.channels) {
            let channel = this._account.channels[this.normalizedName];
            this.DEBUG(`Found existing conversation ${channel} with ${this}`);
            channel.notifyObservers(null, "chat-update-topic");
            return channel;
        }
        let channel = new SlackBuddyConversation(this._account, this);
        this._account.channels[this.normalizedName] = channel;
        SlackOAuth.request("im.open", {
            token: this._account.token,
            user: this.normalizedName,
        }).then((r) => {
            channel.update(r);
            // Don't notify "chat-buddy-add"; doing so will raise an exception
            // because the buddy list is never shown for IMs.
            this.DEBUG(`IM opened on ${channel.slackId} for ${this}`);
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
    aAccount.DEBUG(`Creating new SlackBuddyConversation with ${aBuddy}`);
    this._data = {};
    this.buddy = aBuddy;
    this._init(aAccount, aBuddy.name);
}

SlackBuddyConversation.prototype = Utils.extend(GenericConvIMPrototype,
                                                SlackGenericConversationMixin,
                                                {
    update: function(aData) {
        this.DEBUG(`update: ${JSON.stringify(aData.channel || aData)}`);
        Object.assign(this._data, aData.channel || aData);
        if (this.slackId && this._account.channels) {
            // Make sure the channel map knows about the Slack id; that is used
            // for incoming messages.  This may not be set yet if this is a
            // IM channel we created, since at that point we don't have the
            // server-side ID yet.
            this._account.channels[this.slackId] = this;
        }
    },

    close: function() {
        Object.defineProperty(this, "DEBUG", {value: this._account.DEBUG});
        this.DEBUG(`Closing conversation ${this} with ${this.buddy}`);
        SlackOAuth.request("im.close", {
            token: this._account.token,
            channel: this.slackId
        }).then((r) => {
            try {
                delete this._account.channels[this.buddy.normalizedName];
                delete this._account.channels[this.slackId];
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
                    delete this._account.channels[this.slackId];
            }
        });
    },

    on_im_close: function(r) {
       this.DEBUG(`Ignoring on_im_close message for ${this} with data ${JSON.stringify(r)}`);
    },

    get name() this.buddy.displayName,

    // IM ids are the buddy id; this is needed because when we initially create
    // the conversation we don't know the actual channel id yet
    get normalizedName() this.buddy.normalizedName,

    // This is the Slack channel id; may not be available.
    get slackId() this._data.id || null,

    toString() `<IM ${this.buddy.displayName}(${this.normalizedName}/${this.slackId || "<no id>"})>`,

    classDescription: "SlackBuddyConversation object",

    get wrappedJSObject() this,
});
