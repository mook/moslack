/**
 * Main file for slack prpl
 */

const EXPORTED_SYMBOLS = ["SlackPrpl", "NSGetFactory"];
const { interfaces: Ci, utils: Cu } = Components;
Cu.import("resource:///modules/imXPCOMUtils.jsm");
Cu.import("resource:///modules/jsProtoHelper.jsm");
Cu.import("chrome://moslack/content/Utils.jsm");
Cu.import("chrome://moslack/content/Account.jsm");

function SlackPrpl() {
    this.wrappedJSObject = this;
}

SlackPrpl.prototype = Utils.extend(GenericProtocolPrototype, {
    get name() "Slack",

    get iconBaseURI() "chrome://moslack/content/",
    get imagesInIM() true,

    getAccount: function (aImAccount) new SlackAccount(this, aImAccount),
    get usernameSplits() [
        {label: 'Team', separator: '@', reverse: true, defaultValue: ''}
    ],

    get classID() Components.ID("{44bfbca4-cc23-433d-a166-8e4ea6e73b5f}"),
    get _xpcom_factory() XPCOMUtils.generateSingletonFactory(SlackPrpl),
});

const NSGetFactory = XPCOMUtils.generateNSGetFactory([SlackPrpl]);
