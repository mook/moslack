/**
 * Slack channels
 */

const EXPORTED_SYMBOLS = [ "SlackChannel" ];
const { utils: Cu } = Components;

Cu.import("resource:///modules/jsProtoHelper.jsm");
Cu.import("chrome://moslack/content/SlackOAuth.jsm");
Cu.import("chrome://moslack/content/Utils.jsm");

function SlackChannel(aAccount, aChannelData) {
    this._init(aAccount, aChannelData.name, aAccount.name);
    this._data = aChannelData;
    this.setTopic(aChannelData.topic.value,
                  aChannelData.topic.creator,
                  true);
}

SlackChannel.prototype = Utils.extend(GenericConvChatPrototype, {
});
