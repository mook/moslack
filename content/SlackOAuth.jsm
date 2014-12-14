/**
 * OAuth helper for Slack
 * Note that Slack doesn't seem to do refresh tokens; only auth tokens are
 * available from the API.
 */

"use strict";

const EXPORTED_SYMBOLS = [ "SlackOAuth" ];

const { classes: Cc, utils: Cu } = Components;
Cu.import("resource://gre/modules/Http.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource:///modules/OAuth2.jsm");
Cu.import("resource:///modules/imXPCOMUtils.jsm");
Cu.import("chrome://moslack/content/Utils.jsm");

const consumerKey = "3185087326.3183676227";
const consumerSecret = "ea2fb9cdf6c1706a67d221e0285ebbbc";

var clients = {};

const SlackOAuth = initLogModule("prpl-slack", {
    /**
     * Get an oauth connection
     * @param name {String} The name / id of the account
     */
    get: function(name) {
        if (name && Object.hasOwnProperty.call(clients, name)) {
            return clients[name];
        }
        let oauth = new OAuth2("https://slack.com/",
                               "identify,read,post,client");
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
     * @param allowUI {Boolean} Whether UI is allowed
     * @param token {String} existing oauth access token, if any
     * @return {Promise} A pending connection
     *      If resolved, value is an object with the following properties:
     *          - token: The OAuth access token
     *          - url: The URL for the team
     *          - user: The user name in the team
     *          - team: The team name
     *          - team_id: The Slack-internal team id
     *          - user_id: The Slack-internal user id
     * @note Since Slack doesn't seem to allow refresh tokens, refreshing is
     *       never available.
     */
    connect: function(allowUI=true, token=null) {
        this.DEBUG("Connecting: UI=" +  allowUI + " token=" + token);
        return new Promise((resolve, reject) => {
            let oauth = this.get();
            if (token) {
                oauth.accessToken = token;
            }
            let onSuccess = () => {
                this.DEBUG("oauth success: access token=" + oauth.accessToken);
                if (!oauth.accessToken) {
                    this.DEBUG("Success, but no access token");
                    reject({error: "No accesss token"});
                    return;
                }
                resolve(this.request('auth.test', {token: oauth.accessToken})
                .then((response) => {
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
                    return result;
                }));
            };
            oauth.connect(onSuccess, reject, allowUI);
        });
    },

    request: function(api, data={}) {
        this.DEBUG("Requesting " + api + " with data " + JSON.stringify(data));
        let postData = [];
        for (let prop of Object.keys(data)) {
            postData.push([prop, data[prop]]);
        }
        return new Promise((resolve, reject) => {
            httpRequest("https://slack.com/api/" + api, {
                postData: postData,
                onLoad: (responseText, xhr) => {
                    let response;
                    try {
                        response = JSON.parse(responseText);
                    } catch (e) {
                        reject({error: responseText});
                        return;
                    }
                    if (response.ok !== true) {
                        reject(response);
                    } else {
                        resolve(response);
                    }
                },
                onError: (err, responseText, xhr) => {
                    try {
                        err = JSON.parse(err);
                    } catch (e) {
                        err = { error: err };
                    }
                    reject(err);
                }
            });
        });
    },
});
