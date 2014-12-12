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
    Cc["@mozilla.org/categorymanager;1"]
      .getService(Ci.nsICategoryManager)
      .addCategoryEntry("im-protocol-plugin",
                        "prpl-slack",
                        SlackPrpl.prototype.contractID,
                        false,
                        true);
}

function shutdown(data, reason) {
    Cc["@mozilla.org/categorymanager;1"]
      .getService(Ci.nsICategoryManager)
      .deleteCategoryEntry("im-protocol-plugin",
                           "prpl-slack",
                           false);
    Components.manager
              .nsIComponentRegistrar
              .unregisterFactory(SlackPrpl.prototype.classID,
                                 NSGetFactory(SlackPrpl.prototype.classID));
}

function uninstall() {
}
