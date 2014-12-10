/**
 * Main file for slack prpl
 */

const EXPORTED_SYMBOLS = ["SlackPrpl", "NSGetFactory"];
const { utils: Cu } = Components;
Cu.import("resource:///modules/imXPCOMUtils.jsm");
Cu.import("resource:///modules/jsProtoHelper.jsm");
Cu.import("chrome://moslack/content/Account.jsm");

function SlackPrpl() {
}
SlackPrpl.prototype = Object.create(GenericProtocolPrototype);
Object.assign(SlackPrpl.prototype, {
    get name() "Slack",
    options: {

    },
    usernameSplits: [],
    getAccount: function(aImAccount) new Account(this, aImAccount),
    classID: Components.ID("{44bfbca4-cc23-433d-a166-8e4ea6e73b5f}"),
    contractID: "@mozilla.org/chat/slack;1",
});

const NSGetFactory = XPCOMUtils.generateNSGetFactory([SlackPrpl]);
