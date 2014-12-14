/**
 * OAuth helper for Slack
 */

"use strict";

const EXPORTED_SYMBOLS = [ "SlackOAuth" ];

const { classes: Cc, utils: Cu } = Components;
Cu.import("resource://gre/modules/Http.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource:///modules/OAuth2.jsm");
Cu.import("chrome://moslack/content/Utils.jsm");

const consumerKey = "3185087326.3183676227";
const consumerSecret = "ea2fb9cdf6c1706a67d221e0285ebbbc";

var clients = {};

const SlackOAuth = {
    /**
     * Get an oauth connection
     * @param name {String} The name / id of the account
     */
    get: function(name) {
        if (name && Object.hasOwnProperty.call(clients, name)) {
            return clients[name];
        }
        let oauth = new OAuth2("https://slack.com/",
                               "identify,read,post");
        oauth.authURI = "https://slack.com/oauth/authorize";
        oauth.tokenURI = "https://slack.com/api/oauth.access";
        oauth.completionURI = "https://moslack.invalid/oauth/";
        oauth.consumerKey = consumerKey;
        oauth.consumerSecret = consumerSecret;
        if (name) {
            clients[name] = oauth;
        }
        return oauth;
    },

    /**
     * Attempt to obtain an authorization
     * @param name {String} The account name (/id), or null to create a new one
     * @return {Promise} A pending connection
     *      If resolved, value is an object with the following properties:
     *          - token: The OAuth token
     *          - url: The URL for the team
     *          - user: The user name in the team
     *          - team: The team name
     *          - team_id: The Slack-internal team id
     *          - user_id: The Slack-internal user id
     */
    connect: function(name) {
        return new Promise((resolve, reject) => {
            let oauth = this.get(name);
            oauth.connect(() => {
                if (!oauth.accessToken) {
                    reject();
                    return;
                }
                resolve(new Promise((resolve, reject) => {
                    httpRequest("https://slack.com/api/auth.test", {
                        postData: [['token', oauth.accessToken]],
                        onLoad: (responseText, xhr) => {
                            let response;
                            try {
                                response = JSON.parse(responseText);
                            } catch (e) {
                                reject(responseText);
                                return;
                            }
                            if (response.ok !== true) {
                                reject(response.error);
                            } else {
                                let team = response.url;
                                try {
                                    team = Services.io
                                                   .newURI(response.url, null, null)
                                                   .host
                                                   .replace(/\.slack\.com$/, '');
                                } catch(e) {}
                                let result = {
                                    team_id: response.team_id,
                                    user_id: response.user_id,
                                    url: response.url,
                                    team: team,
                                    user: response.user,
                                    token: oauth.accessToken,
                                }
                                clients[response.user + '@' + team] =
                                    Utils.extend(oauth, result);
                                resolve(result);
                            }
                        },
                        onError: (err, responseText, xhr) => {
                            reject(err);
                        }
                    });
                }));
            }, reject, true);
        });
    },
};
