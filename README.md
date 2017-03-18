# Nomination Bot r2bot-fe-nomn
Front End logic to guide voters through the nomination process:
* choose a language
* accept terms and conditions
* get a list of candidates
* nominate a candidate

This release is part of the **R2BOT FAMILY**:
* **r2bot-sdk**: validates voter id, phone#, avoid cast more than once, calls **r2botbe**
* **r2botbe**: BackEnd API to store votes and validate users

## Nomination Process
> You should have a bot token from BotFather bot before run this sentence

For local run, install [redis](https://redis.io/) locally

### local test with webhook
to run the nomination bot firs install dependencies
```sh
npm install
```
Then install localtunnel globally

```sh
npm install -g localtunnel && lt --port 8080
```
> from lt: your url is: https://qjawnckzag.localtunnel.me  
Then, string-from-lt = qjawnckzag

Then execute the bot locally

```sh
BOT_TOKEN='token-id-from-BotFather' API0BOT_URL='api-url' API0BOT_KEY='api-key' WEBHOOK_RANDOM='string-from-lt' node index.js
```

Also, you could use ngrok instead of localtunnel.
Similar, pass the ngrok string into the environment variable

Then execute the bot locally

```sh
BOT_TOKEN='token-id-from-BotFather' API0BOT_URL='api-url' API0BOT_KEY='api-key' WEBHOOK_RANDOM_NGROK='ngrok-string-from-lt' node index.js
```

### local test without webhook
to run the nomination bot firs install dependencies
```sh
npm install
```
Then execute the bot locally
```sh
BOT_TOKEN='token-id-from-BotFather' API0BOT_URL='api-url' API0BOT_KEY='api-key' NODE_ENV='testlocal' node index.js
```



### Production
#### Without Webhook
setup:
* API0BOT_KEY
* API0BOT_URL
* BOT_TOKEN
* NODE_ENV = test
* REDIS_URL = from heroku redis

#### With Webhook
Pending to fix, the bot can't receive the information from Telegram


### Pendings

0.  [ ] Add redis to store sesion id in order to detect terms and conditions accepted by user
0.  [ ] Ask for user by telegram id in order to detect if user already submitted a survey
0.  [ ] Send telegram id, phone, hkid, survey results to storage
0.  [ ] Check sentences in English the bot way
0.  [ ] Check sentences in Chinese the bot way
0.  [ ] Clear code
0.  [ ] Test Script

## [Code Samples](https://core.telegram.org/bots/samples)

### Telegraf

#### Control flow middleware for Telegraf
https://github.com/telegraf/telegraf-flow
https://github.com/telegraf/telegraf-flow/blob/develop/examples/wizard-bot.js

#### Redis session middleware for Telegraf
https://github.com/telegraf/telegraf-session-redis

#### Internationalization middleware for Telegraf
https://github.com/telegraf/telegraf-i18n


### [Botgram](https://github.com/jmendeth/node-botgram)
[shell example](https://github.com/jmendeth/node-botgram/tree/master/examples/shell)


### [telebot](https://github.com/kosmodrey/telebot)

### [telegram node bot](https://github.com/naltox/telegram-node-bot)
Node module for creating Telegram bots.
usa clases, routes, para aprender ES6

## HEROKU
setup heroku webhook
https://github.com/telegraf/telegraf/issues/44

https://core.telegram.org/bots/api#setwebhook
https://core.telegram.org/bots/webhooks#ssl-tls-what-is-it-and-why-do-i-have-to-handle-this-for-a-webhoo
one line Procfile

reset telegram bot
https://github.com/volodymyrlut/heroku-node-telegram-bot

api redis
http://redis.js.org/#api-rediscreateclient
