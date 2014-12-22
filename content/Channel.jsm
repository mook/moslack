/**
 * Slack channels
 */

const EXPORTED_SYMBOLS = [ "SlackChannel" ];
const { utils: Cu } = Components;

Cu.import("resource:///modules/jsProtoHelper.jsm");
Cu.import("resource:///modules/imXPCOMUtils.jsm");
Cu.import("chrome://moslack/content/Conversation.jsm");
Cu.import("chrome://moslack/content/SlackOAuth.jsm");
Cu.import("chrome://moslack/content/Utils.jsm");

function SlackChannel(aAccount, aChannelData) {
    this._init(aAccount, aChannelData.name, aAccount.name);
    this.update(aChannelData);
}

SlackChannel.prototype = Utils.extend(GenericConvChatPrototype,
                                      SlackGenericConversationMixin,
                                      {
    update: function(aChannelData) {
        this._data = aChannelData;
        if (aChannelData.topic) {
            this.setTopic(aChannelData.topic.value,
                          aChannelData.topic.creator,
                          true);
        }
        for (let member of this._data.members) {
            let participant = new SlackChatParticipant(this._account, member);
            this._participants.set(member, participant);
        }
        this.DEBUG("participants: " + [x for (x of this._participants.values())]);
        this.notifyObservers(new nsSimpleEnumerator(this._participants.values()),
                             "chat-buddy-add");
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
