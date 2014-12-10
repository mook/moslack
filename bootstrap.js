const {classes: Cc, interfaces: Ci, manager: Cm, utils: Cu} = Components;
Cu.import("resource://gre/modules/Services.jsm");

function install() {
}

function startup(data, reason) {
    Cu.import(Services.io.newURI("prpl.jsm", null, data.resourceURI).spec);
    Components.manager
              .nsIComponentRegistrar
              .registerFactory(SlackPrpl.prototype.classID,
                               SlackPrpl.prototype.name,
                               SlackPrpl.prototype.contractID,
                               NSGetFactory(SlackPrpl.prototype.classID));
}

function shutdown(data, reason) {
    Components.manager
              .nsIComponentRegistrar
              .unregisterFactory(SlackPrpl.prototype.classID,
                                 NSGetFactory(SlackPrpl.prototype.classID));
}

function uninstall() {
}
