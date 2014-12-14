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
    toString() `<Channel ${this.name}>`,
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
