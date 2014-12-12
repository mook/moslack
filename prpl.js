/**
 * Main file for slack prpl
 */

const EXPORTED_SYMBOLS = ["SlackPrpl", "NSGetFactory"];
const { utils: Cu } = Components;
Cu.import("resource:///modules/imXPCOMUtils.jsm");
Cu.import("resource:///modules/jsProtoHelper.jsm");
Cu.import("chrome://moslack/content/Account.jsm");

function SlackPrpl() {
    this.wrappedJSObject = this;
}
var prop = (value) => ({ get get() ()=>value, get enumerable() true });
SlackPrpl.prototype = Object.create(GenericProtocolPrototype, {
    name: prop("Slack"),
    iconBaseURI: prop("chrome://moslack/content/"),
    noPassword: prop(true),
    imagesInIM: prop(true),

    getAccount: prop(function (aImAccount) new Account(this, aImAccount)),

    clientID: prop("3185087326.3183676227"),
    cilentSecret: prop("ea2fb9cdf6c1706a67d221e0285ebbbc"),

    classID: prop(Components.ID("{44bfbca4-cc23-433d-a166-8e4ea6e73b5f}")),
    QueryInterface: XPCOMUtils.generateQI([Ci.prplIProtocol]),
    _xpcom_factory: XPCOMUtils.generateSingletonFactory(SlackPrpl),
});

const NSGetFactory = XPCOMUtils.generateNSGetFactory([SlackPrpl]);
