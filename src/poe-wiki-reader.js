'use strict';

// Default settings
const settingsDefault = {
  cacheLifetime: 60 * 24 * 7
};
// Base data structure
const dataBase = {
  items: {},
  mods: {}
};

// Resources
const wikiTableQueries = require("../resource/wikiTableQueries");

// Nodejs dependencies
const request = require('request');

// Internal dependencies
const Helpers = require('./helpers.js');
const CachedStorage = require('./cached-storage.js');
const PoeWikiQuery = require('./poe-wiki-query');

class PoeWikiReader extends CachedStorage {
  constructor(settings) {
    super(Object.assign({}, settingsDefault, settings, { ident: "wiki" }));
    // Ensure data structures are present
    this.data = Object.assign({}, dataBase, this.data);
    // Wiki session
    this.loginToken = null;
    this.limit = 5000;
  }
  async getLoginToken() {
    let params = {
      action: "query",
      meta: "tokens",
      type: "login",
      format: "json"
    };
    let reply = await this.sendRequest(params);
    this.loginToken = reply.query.tokens.logintoken;
    return true;
  }
  async sendLogin(username, password) {
    if (this.loginToken === null) {
      // Ensure there is a login token available
      await this.getLoginToken();
    }
    let params = {
      action: "login",
      lgname: username,
      lgpassword: password,
      lgtoken: this.loginToken,
      format: "json"
    };
    let reply = await this.sendRequest(params);
    return (reply.result === "Success");
  }
  async sendCargoQuery(params) {
    params.action = "cargoquery";
    params.format = "json";
    let reply = await this.sendRequest(params);
    if (reply.hasOwnProperty("warnings")) {
      if (reply.warnings.hasOwnProperty("cargoquery")) {
        if (reply.warnings.cargoquery.hasOwnProperty("*") && reply.warnings.cargoquery['*'].match(/may not be over 500/i)) {
          // Limited by 500 rows per query.
          this.limit = 500;
        }
      }
    }
    if (reply.hasOwnProperty("error")) {
      throw (reply.error.code+": "+reply.error.info);
    }
    if (!reply.hasOwnProperty("cargoquery")) {
      return null;
    }
    return reply.cargoquery;
  }
  async sendRequest(params) {
    let url = "https://pathofexile.gamepedia.com/api.php";
    return new Promise((resolve, reject) => {
      request({
        'method': 'POST',
        'uri': url,
        'form': params,
        'jar': true,
        'json': true,
      }, (error, response, body) => {
          if (error) reject(error);
          if (response.statusCode !== 200) {
              reject('Invalid status code <' + response.statusCode + '>');
          }
          resolve(body);
      });
    });
  }
  async fetchTable(table, callback, ...callbackParams) {
    // Build query
    let query = new PoeWikiQuery(table);
    let queryResult;
    if (wikiTableQueries.hasOwnProperty(table)) {
      query.addFields(wikiTableQueries[table]["fields"]);
    }
    this.invokeCallback("query-wiki-table", query);
    query.setLimit(this.limit, 0);
    // Request results
    let parameters = query.build();
    while (true) {
      // Send query
      queryResult = await this.sendCargoQuery(parameters);
      // Process results
      for (let i = 0; i < queryResult.length; i++) {
        this.invokeCallback("process-wiki-data", table, queryResult[i].title);
        callback(queryResult[i].title, parameters.offset + i, ...callbackParams);
      }
      // Update offset and limit
      parameters.offset += queryResult.length;
      parameters.limit = this.limit;
      if (queryResult.length < this.limit) {
        // Exit when all entries have been processed
        break;
      } else {
        // Throttle a bit.
        await Helpers.wait(200);
      }
    }
  }
  async updateWikiLogin() {
    if (this.loginToken !== null) {
      // Already logged in
      return;
    }
    if (this.settings.hasOwnProperty("username") && this.settings.hasOwnProperty("password")) {
      // Send login
      await this.sendLogin(this.settings["username"], this.settings["password"]);
    }
  }
  async updateWikiItems() {
    let self = this;
    // Check login
    await this.updateWikiLogin();
    // Query data
    this.data.items = {
      byName: {},
      byId: {}
    };
    // -> Items
    await this.fetchTable("items", (item, index, wikiReader) => {
      // Add mod
      let itemPageId = item.page_id;
      delete item.page_id;
      if (!wikiReader.data.items.byName.hasOwnProperty(item.name)) {
        wikiReader.data.items.byName[item.name] = [];
      }
      wikiReader.data.items.byName[item.name].push(itemPageId);
      wikiReader.data.items.byId[itemPageId] = item;
      // Loading "animation"
      if ((index % wikiReader.limit) === 0) {
        this.invokeCallback("update-status", "items", index);
      }
    }, this);
    // -> Item mods
    await this.fetchTable("item_mods", (mod, index, wikiReader) => {
      // Add mod
      let itemPageId = mod.page_id;
      delete mod.page_id;
      if (wikiReader.data.items.byId.hasOwnProperty(itemPageId)) {
        wikiReader.data.items.byId[itemPageId].mods.push(mod);
      } else {
        // Debug code
        //console.log("Found mod without matching item: "+itemPageId+" -> "+util.inspect(mod));
      }
      // Loading "animation"
      if ((index % wikiReader.limit) === 0) {
        this.invokeCallback("update-status", "items-mods", index);
      }
    }, this);
    // -> Item stats
    await this.fetchTable("item_stats", (stat, index, wikiReader) => {
      // Add stat
      let itemPageId = stat.page_id;
      delete stat.page_id;
      if (wikiReader.data.items.byId.hasOwnProperty(itemPageId)) {
        wikiReader.data.items.byId[itemPageId].stats.push(stat);
      } else {
        // Debug code
        //console.log("Found stat without matching item: "+itemPageId+" -> "+util.inspect(stat));
      }
      // Loading "animation"
      if ((index % wikiReader.limit) === 0) {
        this.invokeCallback("update-status", "items-stats", index);
      }
    }, this);
  }
  async updateWikiMods() {
    // Check login
    await this.updateWikiLogin();
    // Query data
    this.data.mods = {
      byModIdent: {},
      byDomain: {},
      byGeneration: {},
      bySpawnTags: {},
      byId: {}
    };
    // -> Mods
    await this.fetchTable("mods", (mod, index, wikiReader) => {
      // Add mod
      let modPageId = mod.page_id;
      delete mod.page_id;
      wikiReader.data.mods.byId[modPageId] = mod;
      wikiReader.data.mods.byModIdent[mod.id] = modPageId;
      // Domain lookup
      if (!wikiReader.data.mods.byDomain.hasOwnProperty(mod['domain'])) {
        wikiReader.data.mods.byDomain[mod['domain']] = [];
      }
      wikiReader.data.mods.byDomain[mod['domain']].push(modPageId);
      // Generation lookup
      if (!wikiReader.data.mods.byGeneration.hasOwnProperty(mod['generation type'])) {
        wikiReader.data.mods.byGeneration[mod['generation type']] = [];
      }
      wikiReader.data.mods.byGeneration[mod['generation type']].push(modPageId);
      // Loading "animation"
      if ((index % wikiReader.limit) === 0) {
        this.invokeCallback("update-status", "mods", index);
      }
    }, this);
    // -> Mod stats
    await this.fetchTable("mod_stats", (stat, index, wikiReader) => {
      // Add mod
      let modPageId = stat.page_id;
      delete stat.page_id;
      if (wikiReader.data.mods.byId.hasOwnProperty(modPageId)) {
        wikiReader.data.mods.byId[modPageId].stats.push(stat);
      } else {
        //console.log("Found stat without matching mod: "+modPageId+" -> "+util.inspect(stat));
      }
      // Loading "animation"
      if ((index % wikiReader.limit) === 0) {
        this.invokeCallback("update-status", "mods-stats", index);
      }
    }, this);
    // -> Mod spawn weights
    await this.fetchTable("spawn_weights", (spawnWeight, index, wikiReader) => {
      // Add mod
      let modPageId = spawnWeight.page_id;
      delete spawnWeight.page_id;
      if (wikiReader.data.mods.byId.hasOwnProperty(modPageId)) {
        wikiReader.data.mods.byId[modPageId].spawnWeights.push(spawnWeight);
        if (spawnWeight.weight > 0) {
          if (!wikiReader.data.mods.bySpawnTags.hasOwnProperty(spawnWeight.tag)) {
            wikiReader.data.mods.bySpawnTags[spawnWeight.tag] = [];
          }
          wikiReader.data.mods.bySpawnTags[spawnWeight.tag].push({
            modId: modPageId, ordinal: spawnWeight.ordinal, weight: spawnWeight.weight
          });
        }
      } else {
        //console.log("Found spawnWeight without matching mod: "+modPageId+" -> "+util.inspect(spawnWeight));
      }
      // Loading "animation"
      if ((index % wikiReader.limit) === 0) {
        this.invokeCallback("update-status", "mods-spawns", index);
      }
    }, this);
  }
  async refresh() {
    // Check cache for wiki data
    if (!this.isCacheValid(this.settings["cacheLifetime"])) {
      this.invokeCallback("update-start");
      await this.updateWikiItems();
      await this.updateWikiMods();
      this.writeCache();
      this.invokeCallback("update-done");
    }
  }
}

module.exports = PoeWikiReader;
