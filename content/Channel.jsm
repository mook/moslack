/**
 * Slack channels
 */

const EXPORTED_SYMBOLS = [ "SlackChannel" ];
const { utils: Cu } = Components;

Cu.import("resource:///modules/jsProtoHelper.jsm");
Cu.import("resource:///modules/imXPCOMUtils.jsm");
Cu.import("chrome://moslack/content/Utils.jsm");

function SlackChannel(aAccount, aChannelData) {
    this._init(aAccount, aChannelData.name, aAccount.name);
    this._data = aChannelData;
    this.setTopic(aChannelData.topic.value,
                  aChannelData.topic.creator,
                  true);
    for (let member of this._data.members) {
        let participant = new SlackChatParticipant(this._account, member);
        this._participants.set(member, participant);
    }
    this.DEBUG("participants: " + [x for (x of this._participants.values())]);
    this.notifyObservers(new nsSimpleEnumerator(this._participants.values()),
                         "chat-buddy-add");
}

SlackChannel.prototype = Utils.extend(GenericConvChatPrototype, {
    sendMsg: function(aMessage) {
        this.DEBUG("Sending message " + aMessage);
        this._account.request("message", {
            channel: this._data.id,
            text: aMessage,
        })
        .then((r) => {
            this.DEBUG("Sent message: " + JSON.stringify(r));
            return r;
        })
        .then((r) => {
            r.user = this._account.self.id;
            new SlackChatMessage(r, this);
            return r;
        })
        .catch((e) => {
            let message = e.error || e.message || e;
            if (typeof(message) != "string") {
                message = JSON.stringify(message);
            }
            this.DEBUG("Failed to send message: " + message);
        });
    },
    on_message: function(aMessage) {
        this.DEBUG("Parsing message " + JSON.stringify(aMessage));
        (new SlackChatMessage(aMessage, this));
    },
    toString() `<Channel ${this.name} (${this._data.id})>`,
});

function SlackChatParticipant(aAccount, aUserId) {
    this.account = aAccount;
    this.buddy = this.account.buddies.get(aUserId);
}
SlackChatParticipant.prototype = Utils.extend(GenericConvChatBuddyPrototype, {
    get name() this.buddy.userName,
    get alias() this.buddy.displayName,
    toString() `<Participant ${this.buddy}>`,
});

function SlackChatMessage(data, aChannel) {
    this._channel = aChannel;
    this.DEBUG("New message in " + aChannel + ": " + JSON.stringify(data));
    let user = this._channel._account.buddies.get(data.user);
    this._init(user.displayName, data.text, data);
    this.time = parseFloat(data.ts);
    this.conversation = aChannel;
}
SlackChatMessage.prototype = Utils.extend(GenericMessagePrototype, {
    get DEBUG() this._channel.DEBUG,
    get LOG() this._channel.LOG,
    get WARN() this._channel.WARN,
    get ERROR() this._channel.ERROR,
});
