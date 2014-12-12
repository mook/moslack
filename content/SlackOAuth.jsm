/**
 * OAuth helper for Slack
 */

"use strict";

const EXPORTED_SYMBOLS = [ "SlackOAuth" ];

const { classes: Cc, utils: Cu } = Components;
Cu.import("resource:///modules/OAuth2.jsm");

const consumerKey = "3185087326.3183676227";
const consumerSecret = "ea2fb9cdf6c1706a67d221e0285ebbbc";

var clients = {};

const SlackOAuth = {
    get: function(name) {
        if (Object.hasOwnProperty.call(clients, name)) {
            return clients[name];
        }
        let oauth = new OAuth2("https://slack.com/",
                               "identify,read,post");
        oauth.authURI = "https://slack.com/oauth/authorize";
        oauth.tokenURI = "https://slack.com/api/oauth.access";
        oauth.completionURI = "https://moslack.invalid/oauth/";
        oauth.consumerKey = consumerKey;
        oauth.consumerSecret = consumerSecret;
        return clients[name] = oauth;
    },
    connect: function(name, onSuccess, onFailure) {
        let oauth = this.get(name);
        oauth.connect(() => {
            if (oauth.accessToken) {
                onSuccess(oauth.accessToken);
            } else {
                onFailure();
            }
        }, (message) => {
            onFailure(message);
        });
    },
};
