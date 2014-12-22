/**
 * Helpers
 * This shouldn't exist, need to find existing equivalents
 */

const EXPORTED_SYMBOLS = [ "Utils" ];

const Utils = {
    assign: function(aTarget, ...aSources) {
        for (let source of aSources) {
            let props = {};
            for (let prop of Object.getOwnPropertyNames(source)) {
                props[prop] = Object.getOwnPropertyDescriptor(source, prop);
            }
            Object.definedProperties(aTarget, props);
        }
    },
    extend: function(aBase, ...aExtensions) {
        var props = {};
        for (let extension of aExtensions) {
            for (let prop of Object.getOwnPropertyNames(extension)) {
                props[prop] = Object.getOwnPropertyDescriptor(extension, prop);
            }
        }
        return Object.create(aBase, props);
    }
};
