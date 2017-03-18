'use strict'
const languages = ['English', 'Spanish', 'French']

function availableLangs () {
  return languages
}
function getLang (text) {
  switch (text) {
    case 'English':
      return 'en-us'
    case 'Spanish':
      return 'en-us'
    case 'French':
      return 'en-us'
    default:
      return 'en-us'
  }
}
module.exports = {
  availableLangs: availableLangs,
  getLang: getLang
}
