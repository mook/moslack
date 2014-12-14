/**
 * buddy (user) on Slack
 * Note that, unlike normal IM, not all users might be in the contact list.
 */

const EXPORTED_SYMBOLS = [ "SlackAccountBuddy" ];
const { interfaces: Ci, utils: Cu } = Components;

Cu.import("resource:///modules/jsProtoHelper.jsm");
Cu.import("chrome://moslack/content/SlackOAuth.jsm");
Cu.import("chrome://moslack/content/Utils.jsm");

function SlackAccountBuddy(aAccount, aUserData) {
    this._init(aAccount, null, null, aUserData.name);
    this._data = aUserData;
    /*
    // This doesn't work whem imBuddy is null
    this.setStatus(this._data.presense == 'active' ?
                   Ci.imIStatusInfo.STATUS_AVAILABLE :
                   Ci.imIStatusInfo.STATUS_AWAY);
    */
}

SlackAccountBuddy.prototype = Utils.extend(GenericAccountBuddyPrototype, {
    get normalizedName() this._data.id,

    toString() `<Buddy ${this.displayName}(${this.normalizedName})>`,
});
