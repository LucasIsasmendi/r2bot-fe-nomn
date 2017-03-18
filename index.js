'use strict'

const _ = require('lodash')
const path = require('path')

const bluebird = require('bluebird')
const R2SDK = require('r2bot-sdk')
const r2sdk = new R2SDK({
  api_host: process.env.R2BOTBE_URL,
  api_key: process.env.R2BOTBE_KEY
})
const Util = require('./util')
const candidateFile = require('./candidates/candidates.json')

const Telegraf = require('telegraf')
const Extra = Telegraf.Extra
const Markup = Telegraf.Markup
const TelegrafFlow = require('telegraf-flow')
const {
    Scene,
    WizardScene,
    enter
} = TelegrafFlow
const flow = new TelegrafFlow()
const I18n = require('telegraf-i18n')
const i18n = new I18n({
  defaultLocale: 'en-us',
  directory: path.resolve(__dirname, 'locales')
})
const bot = new Telegraf(process.env.BOT_TOKEN)

// support Heroku Redis and Redis Cloud
let redisURL = null
if (process.env.REDIS_URL) {
  redisURL = process.env.REDIS_URL
  console.log('process.env.REDIS_URL', process.env.REDIS_URL)
} else if (process.env.REDISCLOUD_URL) {
  redisURL = process.env.REDISCLOUD_URL
  console.log('process.env.REDISCLOUD_URL', process.env.REDISCLOUD_URL)
}

const RedisSession = require('telegraf-session-redis')
const session = new RedisSession({
  store: {
    url: redisURL
  }
})
bot.use(session.middleware())
const nominationImageSource = path.resolve(__dirname, 'candidates/images')
// both production and development environment are hosted on heroku
if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'development') {
  require('newrelic')
  const PORT = process.env.PORT || 443
  const URL = process.env.URL || 'https://test-nomn-bot.herokuapp.com'
  bot.telegram.setWebhook(`${URL}/bot${process.env.BOT_TOKEN}`)
  bot.startWebhook(`/bot${process.env.BOT_TOKEN}`, null, PORT)
  console.log(`started ${process.env.NODE_ENV} env: -URL: ${URL} -PORT: ${PORT}`)
} else if (process.env.NODE_ENV === 'test') {
  console.log(`started test no webhook env: -REDIS: ${redisURL}`)
} else if (process.env.NODE_ENV === 'testlog') {
  console.log(`started test-log no webhook env: -REDIS: ${redisURL}`)
  bot.use(Telegraf.log())
} else if (process.env.NODE_ENV === 'testlocal') {
  console.log(`started testlocal no webhook env, local redis: -REDIS: ${process.env.REDIS_SESSION_HOST}`)
    // client = redis.createClient(process.env.REDIS_SESSION_PORT || 6379, process.env.REDIS_SESSION_HOST || '127.0.0.1');
  bot.use(Telegraf.log())
} else {
    // https://RANDOMURL.localtunnel.me/secret-path
    // RANDOMURL cames from run: lt --port 8080
  console.log('started development env, webhook, local redis')
  if (process.env.WEBHOOK_RANDOM_NGROK) {
    bot.telegram.setWebhook(`https://${process.env.WEBHOOK_RANDOM_NGROK}.ngrok.io/secret-path`)
  } else {
    bot.telegram.setWebhook(`https://${process.env.WEBHOOK_RANDOM}.localtunnel.me/secret-path`)
  }
    // Start https webhook
    // FYI: First non-file reply will be served via webhook response
  bot.startWebhook('/secret-path', null, process.env.WEBHOOK_PORT || 8080)
  bot.use(Telegraf.log())
}

bot.use(i18n.middleware())

// Set limit to "limit" message per "window" miliseconds per chat per user

const limiter = new Util.Rate_limit({
  window: process.env.RATELIMIT_MILISECONDS || 10000,
  limit: process.env.RATELIMIT_MESSAGES || 10,
  onLimitExceeded: (ctx, next) => {
    ctx.i18n.locale(ctx.session['__i18n'].locale)
    // ctx.reply('Rate limit exceeded')
    return ctx.reply(ctx.i18n.t('rate_limit_exceeded'))
  }
})
bot.use(limiter.middleware())

/*******************************************
 * TERMS AND CONDITIONS
 *******************************************/
// Start scene
flow.command('start', enter('start'))

const startScene = new Scene('start')
const terms1Scene = new Scene('terms1')
const terms2Scene = new Scene('terms2')
const endScene = new Scene('end')
flow.register(startScene)
flow.register(terms1Scene)
flow.register(terms2Scene)
flow.register(endScene)

// Start Scene
startScene.enter((ctx) => {
  let warning = _.get(ctx, 'botnomn.warning', null)
  _.set(ctx, 'botnomn.warning', null)
  let html = (warning) ? '<b>' + warning + '</b>\n\n' : ''
  html += `${ctx.i18n.t('wlc_1_hi')} ${ctx.from.first_name}!
  ${ctx.i18n.t('wlc_2_msg')}
  ${ctx.i18n.t('wlc_3_act')}`
  return ctx.replyWithHTML(html, Extra.markup(
        Markup.keyboard(Util.Lang_code.availableLangs()).oneTime()
    ))
})

startScene.on('text', (ctx, next) => {
  if (_.includes(Util.Lang_code.availableLangs(), ctx.message.text)) {
    let lang = Util.Lang_code.getLang(ctx.message.text)
    ctx.i18n.locale(lang)
    _.set(ctx, 'botnomn.lang', lang)
    return next()
  }
  ctx.reply(ctx.i18n.t('rd_error_input'))
}, (ctx, next) => {
    // check if user is signed up
  return bluebird.promisify(r2sdk.user.get)(ctx.from.id).then(function (user) {
    _.set(ctx, 'botnomn.user', user)
  }).then(next).catch(function (e) {
    ctx.reply(ctx.i18n.t('restart')).then(function () {
      ctx.flow.leave()
    })
    throw e
  })
}, (ctx) => {
  let user = ctx.botnomn.user

  if (user.reason) {
    _.set(ctx, 'botnomn.warning', getError(user.reason, ctx))
    return ctx.flow.reenter()
  }

  if (user.blocked) {
    return ctx.reply(getError(R2SDK.ENUM.REASON.USER_IS_BLOCKED, ctx)).then(function () {
      ctx.flow.leave()
      ctx.session.blocked = true
    })
  }

  if (user.signed_up) {
    ctx.session.l = _.get(ctx, 'botnomn.lang', 'en-us')
    // go to nomination
    return ctx.flow.enter('candidate-wizard')
  }

  // continuo to terms and conditions
  ctx.session.l = _.get(ctx, 'botnomn.lang', 'en-us')
  ctx.session.tc1 = false
  ctx.session.tc2 = false
  ctx.session.phone = null
  ctx.session.voterid = null
  ctx.session.cn = null
  return ctx.flow.enter('terms1')
})

// Terms 1 Scene
terms1Scene.enter((ctx) => {
  return ctx.replyWithHTML(ctx.i18n.t('tc_1'), Extra.markup(
        Markup.keyboard([ctx.i18n.t('tc_1_keyboard_1'), ctx.i18n.t('tc_1_keyboard_2')]).oneTime()
    ))
})

terms1Scene.on('text', (ctx) => {
  if (ctx.message.text === ctx.i18n.t('tc_1_keyboard_1')) {
    ctx.session.tc1 = true
    return ctx.flow.enter('terms2')
  }

  if (ctx.message.text === ctx.i18n.t('tc_1_keyboard_2')) {
    ctx.session.tc1 = ctx.session.tc2 = false
    return ctx.reply(ctx.i18n.t('tc_skipped')).then(function () {
      ctx.flow.leave()
    })
  }

  return ctx.reply(ctx.i18n.t('rd_error_input'))
})

// Terms 2 Scene
terms2Scene.enter((ctx) => {
  return ctx.replyWithHTML(ctx.i18n.t('tc_2'), Extra.markup(
        Markup.keyboard([ctx.i18n.t('tc_2_keyboard_1'), ctx.i18n.t('tc_2_keyboard_2')]).oneTime()
    ))
})

terms2Scene.on('text', (ctx) => {
  if (ctx.message.text === ctx.i18n.t('tc_2_keyboard_1')) {
    ctx.session.tc2 = true
    return ctx.flow.enter('signup-wizard')
  }

  if (ctx.message.text === ctx.i18n.t('tc_2_keyboard_2')) {
    ctx.session.tc1 = ctx.session.tc2 = false
    return ctx.reply(ctx.i18n.t('tc_skipped')).then(function () {
      ctx.flow.leave()
    })
  }

  return ctx.reply(ctx.i18n.t('rd_error_input'))
})

/*******************************************
 * GENERATE USER
 *******************************************/
const signupWizard = new WizardScene('signup-wizard',
    (ctx) => {
      let warning = _.get(ctx, 'botnomn.warning', null)
      _.set(ctx, 'botnomn.warning', null)
      let html = (warning) ? '<b>' + warning + '</b>\n\n' : ''
      html += ctx.i18n.t('get_phone_number_btn')
      return ctx.replyWithHTML(html, Extra.markup((markup) => {
        return markup.resize()
                .keyboard([
                  markup.contactRequestButton(ctx.i18n.t('send_contact'))
                ]).oneTime()
      })).then(function () {
        ctx.flow.wizard.next()
      })
    },
    (ctx) => {
      let phone = _.get(ctx, 'update.message.contact.phone_number', null)
      if (phone) {
        phone = phone.toString()
        if (phone[0] !== '+') {
          phone = '+' + phone
        }
        if (R2SDK.lib.validate.phone(phone)) {
          ctx.session.phone = phone

          return ctx.reply(ctx.i18n.t('get_voter_id')).then(function () {
            ctx.flow.wizard.next()
          })
        }
      }

      return ctx.reply(getError(R2SDK.ENUM.REASON.INVALID_PHONE, ctx))
    },
    (ctx) => {
      let voterID = _.get(ctx, 'message.text', null)
      if (voterID) {
        voterID = voterID.toString().toUpperCase()
        if (R2SDK.lib.validate.voterID(voterID)) {
          return bluebird.promisify(r2sdk.user.signup)(ctx.from.id, voterID, ctx.session.phone).then(function (result) {
            if (_.get(result, 'signup', null)) {
              delete ctx.session.voterid
              delete ctx.session.phone
              return ctx.flow.enter('candidate-wizard')
            } else if (_.get(result, 'reason', null)) {
              if (result.reason.code === R2SDK.ENUM.REASON.UNEXPECTED_ERROR.code) {
                throw result.reason
              }
              _.set(ctx, 'botnomn.warning', getError(result.reason, ctx))
              return ctx.flow.enter('signup-wizard')
            }
          }).catch(function (e) {
            ctx.reply(ctx.i18n.t('restart')).then(function () {
              ctx.flow.leave()
            })
            throw e
          })
        }
      }
      return ctx.reply(getError(R2SDK.ENUM.REASON.INVALID_VOTER_ID, ctx))
    }
)
flow.register(signupWizard)

const candidateWizard = new WizardScene('candidate-wizard',
    (ctx) => {
      let warning = _.get(ctx, 'botnomn.warning', null)
      _.set(ctx, 'botnomn.warning', null)
      let html = (warning) ? '<b>' + warning + '</b>\n\n' : ''

      let jobs = []
      jobs.push(bluebird.promisify(r2sdk.survey.statistic)())
      jobs.push(bluebird.promisify(r2sdk.user.get_nominate)(ctx.from.id))
      return bluebird.all(jobs).then(function (values) {
            // console.log(values);

        if (!_.get(values, '0') || _.get(values, '0.reason.code') === R2SDK.ENUM.REASON.UNEXPECTED_ERROR.code) {
          throw values[0].reason
        }
        if (!_.get(values, '1') || _.get(values, '1.reason.code') === R2SDK.ENUM.REASON.UNEXPECTED_ERROR.code) {
          throw values[1].reason
        }

        let statistic = values[0]
        let user = values[1]

        const language = ctx.i18n.locale()
        html += `<b>${ctx.i18n.t('nominate_title')}</b>`

        let data = []
        let n = candidateFile.Q1[language].choice.length
        for (let i = 0; i < n; i++) {
          data.push(0)
        }
        statistic.forEach(function (s) {
          data[s.key] = s.value
        })

        let stat = ''
        candidateFile.Q1[language].choice.forEach(function (item) {
          stat = stat + item.value + ': ' + data[item.key] + '\n'
        })
        html += '\n\n' + ctx.i18n.t('candidate_endorse_count_1') + '\n' + stat

        if (_.isInteger(user.choice)) {
          html += '\n' + ctx.i18n.t('nominate_desc_has_nominated') + candidateFile.Q1[language].choice[user.choice].value + '\n'
          let imagesource = nominationImageSource + candidateFile.Q1[language].choice[user.choice].image

          _.set(ctx, 'botnomn.html', html)
          return ctx.flow.enter('end')
        }

        let keyboard = []
        candidateFile.Q1[language].choice.forEach(function (item) {
          keyboard.push(item.value)
        })
        keyboard = _.shuffle(keyboard)

        html += '\n' + ctx.i18n.t('nominate_desc')
        return ctx.replyWithHTML(html, Extra.markup((markup) => {
          return markup.resize()
                    .keyboard(keyboard).oneTime()
        })).then(function () {
          ctx.flow.wizard.next()
        })
      }).catch(function (e) {
        ctx.reply(ctx.i18n.t('restart')).then(function () {
          ctx.flow.leave()
        })
        throw e
      })
    },
    (ctx) => {
        // check candidate number valid, if not 0
      const candidate = ctx.update.message.text
      const language = ctx.i18n.locale()

      let found = null
      candidateFile.Q1[language].choice.forEach(function (item) {
        if (candidate === item.value) {
          found = item.key
        }
      })

      if (found === null) {
        return ctx.reply(ctx.i18n.t('invalid_candidate'))
      }

      ctx.session.cn = found
      const imagesource = nominationImageSource + candidateFile.Q1[language].choice[found].image
      const election = ctx.i18n.t('confirm_modal_nominate_correct') + candidate + '\n'

      let extra = Extra.markup(
            Markup.keyboard(
                [ctx.i18n.t('cd_right'), ctx.i18n.t('cd_wrong_candidate')]
            ).oneTime()
        )
      extra.caption = election

      return ctx.replyWithPhoto({
        url: imagesource
      }, extra).then(function () {
        return ctx.flow.wizard.next()
      })
    },
    (ctx) => {
      const choice = ctx.update.message.text

      if (choice === ctx.i18n.t('cd_right')) {
        return bluebird.promisify(r2sdk.user.nominate)(ctx.from.id, ctx.session.cn).then(function (result) {
          if (result.nominate) {
            _.set(ctx, 'botnomn.message', ctx.i18n.t('nomination_ok'))
            return ctx.flow.enter('end')
          } else if (_.get(result, 'reason', null)) {
            if (result.reason.code === R2SDK.ENUM.REASON.UNEXPECTED_ERROR.code) {
              throw result.reason
            }
            _.set(ctx, 'botnomn.warning', getError(result.reason, ctx))
            return ctx.flow.enter('end')
          }
        }).catch(function (e) {
          ctx.reply(ctx.i18n.t('restart')).then(function () {
            ctx.flow.leave()
          })
          throw e
        })
      } else if (choice === ctx.i18n.t('cd_wrong_candidate')) {
        return ctx.flow.enter('candidate-wizard')
      }

      return ctx.reply(ctx.i18n.t('rd_error_input'))
    }
)
flow.register(candidateWizard)

endScene.enter((ctx) => {
  let warning = _.get(ctx, 'botnomn.warning', null)
  _.set(ctx, 'botnomn.warning', null)
  let html = (warning) ? '<b>' + warning + '</b>\n\n' : ''

  let message = _.get(ctx, 'botnomn.message', null)
  _.set(ctx, 'botnomn.message', null)
  html += (message) ? '<b>' + message + '</b>\n\n' : ''

  let inputHtml = _.get(ctx, 'botnomn.html', null)
  _.set(ctx, 'botnomn.html', null)
  html += (inputHtml) ? inputHtml + '\n\n' : ''

  html += `${ctx.i18n.t('complete_ad2_text')}
  link1
  ${ctx.i18n.t('complete_ad3_text')}
  link2`

  return ctx.replyWithHTML(html).then(function () {
    return ctx.flow.leave()
  })
})
endScene.on('text', (ctx) => {
  return ctx.reply(ctx.i18n.t('start'))
})

bot.use(flow.middleware())

bot.on('text', (ctx) => {
  return ctx.reply(ctx.i18n.t('start'))
})

function getError (e, ctx) {
  let code = _.get(e, 'code', null) || 4000
  return ctx.i18n.t('error_message_code_' + code)
}

/*******************************************
 * EXTRAS FOR TEST
 *******************************************/
bot.catch((err) => {
  console.log('Bot Error->', err)
})
if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'testlocal') {
  bot.startPolling()
}
