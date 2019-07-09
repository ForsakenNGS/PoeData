'use strict';

// Nodejs dependencies
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');

// Local dependencies
const CallbackHandler = require("./callback-handler.js");

class CachedStorage extends CallbackHandler {
  constructor(settings) {
    super();
    // Initialize fields
    this.data = {};
    this.settings = (typeof settings === "object" ? settings : {});
    // Default settings
    if (!this.settings.hasOwnProperty("ident")) {
      this.settings["ident"] = "cache";
    }
    if (!this.settings.hasOwnProperty("cacheLifetime")) {
      this.settings["cacheLifetime"] = 60 * 24 * 7; // Update cache once a week by default
    }
    // Read values from cache
    this.readCache();
  }
  changeSettings(settings) {
    Object.assign(this.settings, settings);
  }
  getCacheDirectory() {
    if(os.platform() === "linux") {
      return path.join(os.homedir(), "/.config/PoeData");
    } else {
      return path.join(os.homedir(), "/AppData/Roaming/PoeData");
    }
  }
  getCacheFilename() {
    return path.join(this.getCacheDirectory(), this.settings["ident"]+".json.gz");
  }
  isCacheValid(cacheLifetime) {
    let cacheFile = this.getCacheFilename();
    if (fs.existsSync(cacheFile)) {
      if (cacheLifetime === 0) {
        return true;
      } else {
        let now = Date.now();
        let cacheStat = fs.statSync(cacheFile);
        let cacheAge = (now - cacheStat.mtimeMs) / 1000 / 60; // File age in minutes
        if (cacheAge < cacheLifetime) {
          return true;
        }
      }
    }
    return false;
  }
  readCache() {
    // Read the data from cache
    let cacheFile = this.getCacheFilename();
    if (!fs.existsSync(cacheFile)) {
      // Cache file does not exist! Initialize empty data object.
      return;
    }
    let cacheContent = this.readCacheRaw(cacheFile);
    try {
      let cacheData = JSON.parse(cacheContent);
      this.data = cacheData;
    } catch (e) {
      console.error("Failed to read cached data for '"+this.ident+"'!");
      console.error(e);
    }
  }
  readCacheRaw(cacheFile) {
    let cacheContent = fs.readFileSync(cacheFile);
    return zlib.gunzipSync(cacheContent).toString();
  }
  writeCache() {
    // Create cache directory if it does not exist
    let cacheDir = this.getCacheDirectory();
    if (!fs.existsSync( cacheDir )) {
      fs.mkdir(cacheDir, { recursive: true });
    }
    // Write specific type into cache
    let cacheFile = this.getCacheFilename();
    this.writeCacheRaw( cacheFile, JSON.stringify(this.data) );
  }
  writeCacheRaw(cacheFile, cacheContent) {
    let cacheContentBuffer = new Buffer(cacheContent, "utf-8");
    let cacheContentGzip = zlib.gzipSync(cacheContentBuffer);
    fs.writeFileSync( cacheFile, cacheContentGzip );
  }
}

module.exports = CachedStorage;
