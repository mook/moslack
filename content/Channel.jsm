/**
 * Slack channels
 */

const EXPORTED_SYMBOLS = [ "SlackChannel" ];
const { utils: Cu } = Components;

Cu.import("resource:///modules/jsProtoHelper.jsm");
Cu.import("resource:///modules/imXPCOMUtils.jsm");
Cu.import("chrome://moslack/content/SlackOAuth.jsm");
Cu.import("chrome://moslack/content/Utils.jsm");

function SlackChannel(aAccount, aChannelData) {
    this._init(aAccount, aChannelData.name, aAccount.name);
    this.update(aChannelData);
}

SlackChannel.prototype = Utils.extend(GenericConvChatPrototype, {
    update: function(aChannelData) {
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
    },

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

    toString() `<Channel ${this.name} (${this._data.id})>`,

    get topicSettable() true,

    get topic() this._topic,
    set topic(val) {
        SlackOAuth.request("channels.setTopic", {
            token: this._account.token,
            channel: this._data.id,
            topic: val,
        }).then((data) => {
            // Don't set the conversation topic from here; instead, deal with
            // the incoming topic change message from RTM.
            this.DEBUG(`set topic response: ${JSON.stringify(data)}`);
        }).catch((r) => {
            this.DEBUG(`Failed to set topic: ${JSON.stringify(r)}`);
        });
    },
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
