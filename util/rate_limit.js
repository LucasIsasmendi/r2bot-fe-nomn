'use strict'

class RateLimit {
  constructor (config) {
    this.config = Object.assign({
      window: 10000,
      limit: 4,
      keyGenerator: function (ctx) {
        return ctx.from.id
      },
      onLimitExceeded: () => undefined
    }, config)
  }

  middleware () {
    return (ctx, next) => {
      let currentTime = Date.now()
      if (ctx.session.rlinitime === undefined || ctx.session.rlinitime === null) {
        // console.log("ini first time")
        ctx.session.rlinitime = currentTime
        ctx.session.rlcounter = 1
        return next()
      } else if (ctx.session.rlcounter >= this.config.limit) {
        // console.log("session limit")
        if (ctx.session.rlinitime + this.config.window > currentTime) {
          // console.log(`onLimitExceeded rli+cw ${ctx.session.rlinitime+this.config.window} > ct:${currentTime}`)
          return this.config.onLimitExceeded(ctx, next)
        } else {
          // console.log("session limit reset")
          ctx.session.rlinitime = currentTime
          ctx.session.rlcounter = 1
          return next()
        }
      } else {
        // console.log("limit was not reach")
        if (ctx.session.rlinitime + this.config.window > currentTime) {
          ctx.session.rlcounter += 1
        } else {
          // console.log("ini session counters, due to time limit reset",ctx.session)
          ctx.session.rlinitime = currentTime
          ctx.session.rlcounter = 1
        }
        return next()
      }
    }
  }
}

module.exports = RateLimit
