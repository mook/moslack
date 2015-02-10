const EXPORTED_SYMBOLS = [ "SlackGenericConversationMixin", "SlackChatMessage" ];
const { utils: Cu } = Components;

Cu.import("resource:///modules/jsProtoHelper.jsm");
Cu.import("chrome://moslack/content/Utils.jsm");

const SlackGenericConversationMixin = {

    sendMsg: function(aMessage) {
        this.DEBUG(`Sending message to ${this._data.id}: ${aMessage}`);
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

    systemMessage: function(aMessage, aIsError, aDate) {
        let flags = {system: true};
        if (aIsError) {
            flags.error = true;
        }
        if (aDate) {
            flags.time = aDate;
        }
        this.writeMessage("slack", aMessage, flags);
    },

    on_message: function(aMessage) {
        this.DEBUG("Parsing message " + JSON.stringify(aMessage));
        (new SlackChatMessage(aMessage, this));
    },
};

function SlackChatMessage(data, aChannel) {
    this._channel = aChannel;
    this.DEBUG("New message in " + aChannel + ": " + JSON.stringify(data));
    let user = this._channel._account.buddies.get(data.user);
    this._init(user.displayName, data.text, data);
    this.time = parseFloat(data.ts);
    this.conversation = aChannel;
    switch (data.subtype) {
        case "channel_topic":
            this.system = true;
            aChannel.setTopic(data.topic, user, true);
            break;
    }
}
SlackChatMessage.prototype = Utils.extend(GenericMessagePrototype, {
    get DEBUG() this._channel.DEBUG,
    get LOG() this._channel.LOG,
    get WARN() this._channel.WARN,
    get ERROR() this._channel.ERROR,
});
