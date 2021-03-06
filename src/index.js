// Module must be started with environment variables
//
//  accesskey="api.ai client access key"
//  subscriptionkey="api.ai subscription key"
//  slackkey="slack bot key"
//

'use strict';

const Botkit = require('botkit');

const apiai = require('apiai');
const uuid = require('node-uuid');

const http = require('http');

const Entities = require('html-entities').XmlEntities;
const decoder = new Entities();

const apiAiAccessToken = process.env.accesstoken;
const slackBotKey = process.env.slackkey;

const apiAiService = apiai(apiAiAccessToken);

var sessionIds = {};

const controller = Botkit.slackbot({
    debug: false
    //include "log: false" to disable logging
});

var bot = controller.spawn({
    token: slackBotKey
}).startRTM();

controller.on('rtm_close', function (bot, err) {
    console.log('** The RTM api just closed, reason', err);
    
    try {

        // sometimes connection closing, so, we should restart bot
        if (bot.doNotRestart != true) {
            var token = bot.config.token;
            console.log('Trying to restart bot ' + token);

            restartBot(bot);
        }

    } catch (err) {
        console.error('Restart bot failed', err);
    }
});

function restartBot(bot) {
    bot.startRTM(function (err) {
        if (err) {
            console.error('Error restarting bot to Slack:', err);
        }
        else {
            var token = bot.config.token;
            console.log('Restarted bot for %s', token);
        }
    });
}

function isDefined(obj) {
    if (typeof obj == 'undefined') {
        return false;
    }

    if (!obj) {
        return false;
    }

    return obj != null;
}

controller.hears(['.*'], ['direct_message', 'direct_mention', 'mention', 'ambient'], function (bot, message) {

    try {
        if (message.type == 'message') {
            if (message.user == bot.identity.id) {
                // message from bot can be skipped
            }
            else if (message.text.indexOf("<@U") == 0 && message.text.indexOf(bot.identity.id) == -1) {
                // skip other users direct mentions
            }
            else {

                var requestText = decoder.decode(message.text);
                requestText = requestText.replace("’", "'");

                var channel = message.channel;
                var messageType = message.event;
                var botId = "<@" + bot.identity.id + ">";

                console.log(requestText);
                console.log(messageType);

                if (requestText.indexOf(botId) > -1) {
                    requestText = requestText.replace(botId, '');
                }

                if (!(channel in sessionIds)) {
                    sessionIds[channel] = uuid.v1();
                }

                var request = apiAiService.textRequest(requestText,
                    {
                        sessionId: sessionIds[channel]
                    });

                request.on('response', function (response) {
                    console.log(response);

                    if (isDefined(response.result)) {
                        var responseText = response.result.fulfillment.speech;
                        var action = response.result.action;

                        if (isDefined(responseText)) {
                            bot.reply(message, responseText, function (err, resp) {
                                console.log(err, resp);
                            });
                        }

                    }
                });

                request.on('error', function (error) {
                    console.error(error);
                });

                request.end();
            }
        }
    } catch (err) {
        console.error(err);
    }

});


//Create a server to prevent Heroku kills the bot
var server = http.createServer(function (req, res) {
    res.end();
});

//Lets start our server
server.listen((process.env.PORT || 5000), function () {
    console.log("Server listening");
});