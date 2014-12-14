/**
 * Helpers
 * This shouldn't exist, need to find existing equivalents
 */

const EXPORTED_SYMBOLS = [ "Utils" ];

const Utils = {
    extend: function(aBase, aExtension) {
        var props = {};
        for (let prop of Object.getOwnPropertyNames(aExtension)) {
            props[prop] = Object.getOwnPropertyDescriptor(aExtension, prop);
        }
        return Object.create(aBase, props);
    }
};
