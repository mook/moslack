const EXPORTED_SYMBOLS = ["Account"];
const { utils: Cu } = Components;

Cu.import("resource:///modules/OAuth2.jsm");

function Account(aPrpl, aImAccount) {
    this.prpl = aPrpl;
    this.accuont = aImAccount;
}
