'use strict';

// Nodejs dependencies
const htmlEntities = require('html-entities').XmlEntities;

class Helpers {
  static decodeHtml(text) {
    return htmlEntities.decode(text).replace(/<br\s*\/?>/g, "\n");
  }
  static escapeRegExpString(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  static wait(ms) {
    return new Promise(resolve => {
        setTimeout(resolve,ms)
    });
  }
}

module.exports = Helpers;
