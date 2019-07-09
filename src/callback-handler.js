'use strict';

class CallbackHandler {
  constructor() {
    this.callbacks = {};
  }
  invokeCallback(ident, ...parameters) {
    if (!this.callbacks.hasOwnProperty(ident)) {
      return;
    }
    for (let i = 0; i < this.callbacks[ident].length; i++) {
      this.callbacks[ident][i].call(this, ...parameters);
    }
  }
  registerCallback(ident, callback) {
    if (!this.callbacks.hasOwnProperty(ident)) {
      this.callbacks[ident] = [];
    }
    this.callbacks[ident].push(callback);
  }
  unregisterCallback(ident, callback) {
    if (!this.callbacks.hasOwnProperty(ident)) {
      return false;
    }
    let callbackIndex = this.callbacks[ident].indexOf(callback);
    if (callbackIndex >= 0) {
      this.callbacks[ident].splice(callbackIndex, 1);
    }
  }
}

module.exports = CallbackHandler;
